import React, { useState, useEffect } from "react";
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

const USERS = {

  
    admin: { username: "admin", password: "admin123", role: "admin" },
    clientA: { username: "clientA", password: "clientA123", role: "clientA" },
    clientB: { username: "clientB", password: "clientB123", role: "clientB" },
    clientC: { username: "clientC", password: "clientC123", role: "clientC" }, // ✅ example new client
  };
  

const API_BASE = "http://localhost:5050";

export default function SecurePowerBIPortal() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [excelData, setExcelData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [filters, setFilters] = useState({ month: "", minRevenue: "" });
  const [chartType, setChartType] = useState("bar");

  // ---------- LOGIN ----------
  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = Object.values(USERS).find(
      (u) =>
        u.username === formData.username && u.password === formData.password
    );
    if (foundUser) {
      setUser(foundUser);
      setFormData({ username: "", password: "" });
      setError("");
      if (foundUser.role === "admin") setSelectedClient("overview");
    } else {
      setError("Invalid username or password");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setExcelData(null);
    setSelectedClient(null);
    setFilters({ month: "", minRevenue: "" });
  };

  // ---------- FETCH EXCEL DATA ----------
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        let endpoint = "";
        if (user.role === "admin") endpoint = "/api/data/admin";
        if (user.role === "clientA") endpoint = "/api/data/clientA";
        if (user.role === "clientB") endpoint = "/api/data/clientB";

        const res = await fetch(`${API_BASE}${endpoint}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        setExcelData(data);
      } catch (err) {
        console.error("❌ Error fetching Excel data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ---------- LOGIN VIEW ----------
  if (!user) {
    return (
      <div className="login-container">
        <form className="login-box" onSubmit={handleLogin}>
          <h2>Power BI Portal Login</h2>

          <label>Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="primary-btn">
            Login
          </button>

          {/* <div className="hint">
            <strong>Demo Logins:</strong>
            <br />
            Admin: admin / admin123 <br />
            Client A: clientA / clientA123 <br />
            Client B: clientB / clientB123
          </div> */}
        </form>
      </div>
    );
  }

  // ---------- SIDEBAR ----------
  const renderSidebar = () => {
    if (!user) return null;
  
    if (user.role === "admin") {
      const clientKeys = excelData ? Object.keys(excelData) : [];
  
      return (
        <>
          <h2>Clients</h2>
          {clientKeys.map((key) => (
            <button
              key={key}
              className={selectedClient === key ? "active" : ""}
              onClick={() => setSelectedClient(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
          <button>Users & Permissions</button>
        </>
      );
    }
  
    // Clients
    return (
      <>
        <h2>{user.username}</h2>
        <button className="active">My Dashboard</button>
      </>
    );
  };
  

  // ---------- FILTER ----------
  const renderFilters = () => (
    <div className="filter-bar">
      <label>
        Month:
        <select
          value={filters.month}
          onChange={(e) => setFilters({ ...filters, month: e.target.value })}
        >
          <option value="">All</option>
          <option>January</option>
          <option>February</option>
          <option>March</option>
          <option>April</option>
          <option>May</option>
          <option>June</option>
        </select>
      </label>
  
      <label>
        Min Revenue:
        <input
          type="number"
          placeholder="e.g. 50000"
          value={filters.minRevenue}
          onChange={(e) =>
            setFilters({ ...filters, minRevenue: e.target.value })
          }
        />
      </label>
  
      <label>
        Chart Type:
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value)}
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="pie">Pie</option>
          <option value="area">Area</option>
          <option value="composed">Composed</option>
        </select>
      </label>
  
      <button
        onClick={() => setFilters({ month: "", minRevenue: "" })}
        className="clear-btn"
      >
        Clear Filters
      </button>
    </div>
  );
  

  // ---------- FILTER LOGIC ----------
  const applyFilters = (rows) => {
    if (!rows) return [];
    return rows.filter((row) => {
      const matchMonth = filters.month
        ? row.Month?.toLowerCase() === filters.month.toLowerCase()
        : true;
      const matchRevenue = filters.minRevenue
        ? Number(row.Revenue) >= Number(filters.minRevenue)
        : true;
      return matchMonth && matchRevenue;
    });
  };

  // ---------- TABLE ----------
  const renderTable = (rows) => {
    const filtered = applyFilters(rows);
    if (filtered.length === 0)
      return <p>No results match your filters.</p>;

    return (
      <table className="data-table">
        <thead>
          <tr>
            {Object.keys(filtered[0] || {}).map((key) => (
              <th key={key}>{key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={i}>
              {Object.values(row).map((val, j) => (
                <td key={j}>{val}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

// ---------- CHART ----------
const renderCharts = (rows) => {
    const filtered = applyFilters(rows);
    if (!filtered.length) return <p>No data to visualize.</p>;
  
    const totalRevenue = filtered.reduce((sum, r) => sum + Number(r.Revenue || 0), 0);
    const totalExpenses = filtered.reduce((sum, r) => sum + Number(r.Expenses || 0), 0);
    const pieData = [
      { name: "Revenue", value: totalRevenue },
      { name: "Expenses", value: totalExpenses },
    ];
  
    return (
      <div className="charts-container">
        {chartType === "bar" && (
          <>
            <h4>Revenue vs Expenses (Bar)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Revenue" fill="#4e79a7" />
                <Bar dataKey="Expenses" fill="#f28e2b" />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
  
        {chartType === "line" && (
          <>
            <h4>Revenue Trend (Line)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke="#4e79a7" strokeWidth={2} />
                <Line type="monotone" dataKey="Expenses" stroke="#e15759" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
  
        {chartType === "pie" && (
          <>
            <h4>Total Revenue vs Expenses (Pie)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={120}
                  fill="#8884d8"
                  label
                >
                  <Cell fill="#4e79a7" />
                  <Cell fill="#f28e2b" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </>
        )}
  
        {chartType === "area" && (
          <>
            <h4>Revenue vs Expenses (Area)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={filtered}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4e79a7" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#4e79a7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f28e2b" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#f28e2b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="Revenue" stroke="#4e79a7" fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Expenses" stroke="#f28e2b" fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
  
        {chartType === "composed" && (
          <>
            <h4>Composed Chart (Bar + Line)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={filtered}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="Month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Revenue" barSize={20} fill="#4e79a7" />
                <Line type="monotone" dataKey="Expenses" stroke="#e15759" />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    );
  };
  
  

  // ---------- DASHBOARD ----------
  const renderDashboard = () => {
    if (loading) return <p>Loading data...</p>;
    if (!excelData) return <p>No data loaded.</p>;

    let dataset = [];
    if (user.role === "clientA") dataset = excelData.clientA || excelData;
    if (user.role === "clientB") dataset = excelData.clientB || excelData;
    if (user.role === "admin") {
        dataset = excelData[selectedClient] || [];
      }
      

    return (
      <>
        <h2>
          {user.role === "admin"
            ? `Admin Dashboard – ${selectedClient.toUpperCase()}`
            : `${user.username} Dashboard`}
        </h2>
        {renderFilters()}
        {/* {renderCharts(dataset)} */}
        <div className="embed-frame">{renderTable(dataset)}</div>
      </>
    );
  };

  // ---------- MAIN LAYOUT ----------
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Power BI Dashboard</h1>
        <div className="header-actions">
          <span className="user-name">{user.username}</span>
          <button onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      <main className="main-container">
        <aside className="sidebar">{renderSidebar()}</aside>
        <section className="dashboard-content">{renderDashboard()}</section>
      </main>

      <footer className="footer">© 2025 Alphard</footer>
    </div>
  );
}
