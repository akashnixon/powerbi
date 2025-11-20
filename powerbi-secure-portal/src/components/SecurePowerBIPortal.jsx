import React, { useState, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { PowerBIEmbed } from "powerbi-client-react";
import * as models from "powerbi-models";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";

import "../App.css";

// -----------------------------------------------------------------------------
// USERS (from new file, with displayName; you can add more clients later)
// -----------------------------------------------------------------------------
const USERS = {
  admin: {
    username: "admin",
    password: "admin123",
    role: "admin",
    displayName: "Admin (dashboard owner)",
  },
  clientA: {
    username: "clientA",
    password: "clientA123",
    role: "CLIENTA",          // maps to backend CLIENT_CONFIGS.CLIENTA
    displayName: "Client A",
  },
  clientB: {
    username: "clientB",
    password: "clientB123",
    role: "CLIENTB",          // maps to backend CLIENT_CONFIGS.CLIENTB
    displayName: "Client B",
  },
};

const API_BASE = "http://localhost:5050";

export default function SecurePowerBIPortal() {

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  //login
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [selectedClient, setSelectedClient] = useState(null);
  const [filters, setFilters] = useState({ month: "", minRevenue: "" });
  const [chartType, setChartType] = useState("bar");

  // Power BI specific
  const [activeClient, setActiveClient] = useState(null);
  const [embedConfig, setEmbedConfig] = useState(null);

  // ---------------------------------------------------------------------------
  // LOGIN HELPERS
  // ---------------------------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginWithPassword = (e) => {
    e.preventDefault();

    const foundUser = Object.values(USERS).find(
      (u) =>
        u.username.toLowerCase() === formData.username.trim().toLowerCase() &&
        u.password === formData.password.trim()
    );

    if (!foundUser) {
      setError("Invalid username or password");
      setUser(null);
      return;
    }

    setUser(foundUser);
    setError("");

    if (foundUser.role === "admin") {
      // admin default to CLIENTA for embed
      setActiveClient("CLIENTA");
     // setSelectedClient("overview");
    } else {
      // CLIENTA / CLIENTB
      setActiveClient(foundUser.role);
    }
  };

  const handleLoginWithMicrosoft = async () => {
    try {
      await instance.loginRedirect();
    } catch (err) {
      console.error("MSAL login error", err);
      setError("Microsoft login failed. Please try again.");
    }
  };

  const handleLogout = () => {
    // Clear active account ONLY inside your app
    instance.setActiveAccount(null);
  
    // Clear your app UI state
    setUser(null);
    setFormData({ username: "", password: "" });
    setEmbedConfig(null);
    setActiveClient(null);
    setError("");
  
    // DO NOT CALL logoutPopup or logoutRedirect
  };
  
  

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      return;
    }
  
    // get active signed-in account
    const activeAccount = instance.getActiveAccount();
  
    if (!activeAccount) {
      console.warn("No active account found.");
      setUser(null);
      return;
    }
  
    console.log("Active account:", activeAccount);
  
    const email = activeAccount.username?.toLowerCase() || "";
    const displayName = activeAccount.name || activeAccount.username;
  
    let role = "CLIENTA"; // default
  
    if (email === "joshuajojejo@outlook.com") {
      role = "admin";
    } else if (email === "ak_nixon@live.concordia.ca") {
      role = "CLIENTA";
    }
  
    setUser({
      username: email,
      role,
      displayName,
    });
  
    if (role === "admin") {
      setSelectedClient("overview");
    } else {
      setSelectedClient("CLIENTA");
    }
  }, [isAuthenticated, instance]);
  

  // ---------------------------------------------------------------------------
  // FETCH EMBED TOKEN FROM BACKEND
  // ---------------------------------------------------------------------------
  const fetchEmbedConfig = async (clientKey) => {
    if (!clientKey) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch("http://127.0.0.1:5050/api/embed-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey }), // "CLIENTA" / "CLIENTB"
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Server error ${res.status}: ${text || "Failed to get embed config"}`
        );
      }

      const data = await res.json();

      if (!data.embedToken || !data.embedUrl || !data.reportId) {
        throw new Error(data.error || "Invalid embed configuration returned");
      }

      setEmbedConfig({
        id: data.reportId,
        embedUrl: data.embedUrl,
        accessToken: data.embedToken,
      });
    } catch (err) {
      console.error("Error fetching embed config:", err);
      setError(
        err.message || "Something went wrong while loading the dashboard"
      );
      setEmbedConfig(null);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // EFFECT: fetch Power BI embed config when active client changes 
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    if (activeClient && activeClient.startsWith("CLIENT")) {
      fetchEmbedConfig(activeClient);
    }
  }, [user, activeClient]);

  // ---------------------------------------------------------------------------
  // FULL-PAGE LOGIN VIEW
  // ---------------------------------------------------------------------------
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
    
            <button type="submit" className="btn primary-btn">Login</button>
    
            <div className="divider">
              <span>or</span>
            </div>
    
            <button type="button" className="btn ms-btn" onClick={handleLoginWithMicrosoft}>
             <img src="/ms-logo.png" alt="Microsoft" className="ms-icon" />
               Sign in with Microsoft
            </button>

          </form>
        </div>
      </div>
    );
    
  }

  // ---------------------------------------------------------------------------
  // SIDEBAR
  // ---------------------------------------------------------------------------
  const renderSidebar = () => {
    if (!user) return null;
  
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
          <button className="sidebar-btn active" 
          onClick={() => setActiveClient("CLIENTA")}
          >
            {user.displayName.toUpperCase()}
          </button>
        )}
      </>
    );
  };
  
  // ---------------------------------------------------------------------------
  // Power BI EMBED AREA
  // ---------------------------------------------------------------------------
  const renderEmbedArea = () => {
    if (loading) {
      return <div className="status-msg">Loading dashboard…</div>;
    }

    if (error) {
      return <div className="error-text">{error}</div>;
    }

    if (!embedConfig) {
      return (
        <div className="status-msg">
          Select a client to load their Power BI dashboard.
        </div>
      );
    }

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
              panes: {
                filters: { visible: false },
                pageNavigation: { visible: true },
              },
              navContentPaneEnabled: true,
            },
          }}
          cssClassName="powerbi-report"
        />
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // MAIN LAYOUT 
  // ---------------------------------------------------------------------------
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Power BI Dashboard</h1>
        <div className="header-actions">
          <span className="user-name">
            {user.displayName || user.username}
          </span>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="main-container">
        <aside className="sidebar">{renderSidebar()}</aside>
        <section className="dashboard-content">
          {renderEmbedArea()}
          {}
        </section>
      </main>

      <footer className="footer">© 2025 Alphard</footer>
    </div>
  );
}