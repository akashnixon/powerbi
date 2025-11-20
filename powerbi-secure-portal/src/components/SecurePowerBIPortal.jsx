import React, { useState, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { PowerBIEmbed } from "powerbi-client-react";
import * as models from "powerbi-models";

import "../App.css";

// Backend API
const API_BASE = "http://localhost:5050";

export default function SecurePowerBIPortal() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeClient, setActiveClient] = useState(null); // CLIENTA / CLIENTB
  const [embedConfig, setEmbedConfig] = useState(null);

  /************************************************************
   * 1) FORM CHANGE HANDLER
   ************************************************************/
  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  /************************************************************
   * 2) PASSWORD LOGIN
   ************************************************************/
  const handleLoginWithPassword = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      setUser({
        username: data.username,
        displayName: data.username,
        role: data.role, // admin / CLIENTA / CLIENTB
      });

      // Set default dashboard based on role
      setActiveClient(data.role === "admin" ? "CLIENTA" : data.role);
    } catch (err) {
      setError(err.message);
    }
  };

  /************************************************************
   * 3) MICROSOFT LOGIN BUTTON
   ************************************************************/
  const handleLoginWithMicrosoft = async () => {
    try {
      await instance.loginRedirect({
        prompt: "select_account" 
      });
    } catch (err) {
      console.error("MSAL login error", err);
      setError("Microsoft login failed. Please try again.");
    }
  };
  

/************************************************************
 * 4) MICROSOFT LOGIN → LOOKUP ROLE FROM DB (FIXED VERSION)
 ************************************************************/
useEffect(() => {
  const handleMsLogin = async () => {
    if (!isAuthenticated) return;

    // 🔥 ALWAYS get the true selected account
    let activeAccount = instance.getActiveAccount();

    // If MSAL does not have an active account yet, set one
    if (!activeAccount) {
      if (accounts.length > 0) {
        instance.setActiveAccount(accounts[0]);
        activeAccount = accounts[0];
      } else {
        return; // no accounts available
      }
    }

    const msEmail = (activeAccount.username || "").toLowerCase();

    try {
      const res = await fetch(`${API_BASE}/api/auth/login-microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not authorized");

      // Store user info into React state
      setUser({
        username: data.username,
        displayName: activeAccount.name || data.username,
        role: data.role,
      });

      // Admin sees CLIENTA by default, client sees their own dashboard
      setActiveClient(data.role === "admin" ? "CLIENTA" : data.role);
    } catch (err) {
      console.error("MS login DB lookup failed:", err);
      setUser(null);
      setError(err.message);
    }
  };

  handleMsLogin();
}, [isAuthenticated, accounts, instance]);


  /************************************************************
   * 5) LOGOUT (APP ONLY — does NOT logout Microsoft globally)
   ************************************************************/
  const handleLogout = () => {
    // Clear app state only
    setEmbedConfig(null);
    setUser(null);
    setActiveClient(null);
    setFormData({ username: "", password: "" });
    setError("");
    instance.setActiveAccount(null);
  };
  

  /************************************************************
   * 6) FETCH POWER BI TOKEN WHEN CLIENT CHANGES
   ************************************************************/
  useEffect(() => {
    if (!activeClient || !user) return;

    const fetchEmbed = async () => {
      try {
        setLoading(true);
        setEmbedConfig(null);

        const res = await fetch(`${API_BASE}/api/embed-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientKey: activeClient }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setEmbedConfig({
          id: data.reportId,
          embedUrl: data.embedUrl,
          accessToken: data.embedToken,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmbed();
  }, [activeClient, user]);

  /************************************************************
   * 7) LOGIN PAGE
   ************************************************************/
  if (!user) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <h2 className="login-title">Secure Power BI Portal</h2>

          <form className="login-form" onSubmit={handleLoginWithPassword}>
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button className="btn primary-btn" type="submit">
              Login
            </button>

            <div className="divider"><span>or</span></div>

            <button className="btn ms-btn" type="button" onClick={handleLoginWithMicrosoft}>
              <img src="/ms-logo.png" className="ms-icon" alt="Microsoft" />
              Sign in with Microsoft
            </button>
          </form>
        </div>
      </div>
    );
  }

  /************************************************************
   * 8) SIDEBAR
   ************************************************************/
  const renderSidebar = () => {
    const isAdmin = user.role === "admin";

    return (
      <>
        <h3 className="sidebar-title">Clients</h3>

        {isAdmin ? (
          <>
            <button
              className={`sidebar-btn ${activeClient === "CLIENTA" ? "active" : ""}`}
              onClick={() => setActiveClient("CLIENTA")}
            >
              CLIENT A
            </button>

            <button
              className={`sidebar-btn ${activeClient === "CLIENTB" ? "active" : ""}`}
              onClick={() => setActiveClient("CLIENTB")}
            >
              CLIENT B
            </button>
          </>
        ) : (
          <button className="sidebar-btn active" disabled>
            {user.role}
          </button>
        )}
      </>
    );
  };

  /************************************************************
   * 9) EMBED AREA
   ************************************************************/
  const renderEmbedArea = () => {
    if (loading) return <div className="status-msg">Loading dashboard…</div>;
    if (error) return <div className="error-text">{error}</div>;
    if (!embedConfig) return <div className="status-msg">Select a client…</div>;

    return (
      <div className="embed-frame">
        <PowerBIEmbed
          embedConfig={{
            type: "report",
            id: embedConfig.id,
            embedUrl: embedConfig.embedUrl,
            accessToken: embedConfig.accessToken,
            tokenType: models.TokenType.Embed,
            settings: {
              panes: { filters: { visible: false } },
              navContentPaneEnabled: true,
            },
          }}
          cssClassName="powerbi-report"
        />
      </div>
    );
  };

  /************************************************************
   * 10) MAIN LAYOUT
   ************************************************************/
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Power BI Dashboard</h1>

        <div className="header-actions">
          <span className="user-name">{user.displayName}</span>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="main-container">
        <aside className="sidebar">{renderSidebar()}</aside>
        <section className="dashboard-content">{renderEmbedArea()}</section>
      </main>

      <footer className="footer">© 2025 Alphard</footer>
    </div>
  );
}
