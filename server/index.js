/************************************************************
 * POWER BI SECURE PORTAL - BACKEND SERVER
 * Includes:
 *  - PostgreSQL user auth (password + Microsoft login)
 *  - Role-based client access
 *  - Excel API (existing)
 *  - Power BI embed token generator
 ************************************************************/

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 5050;

/************************************************************
 * 1) MIDDLEWARE
 ************************************************************/
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

/************************************************************
 * 2) POSTGRES CONNECTION
 ************************************************************/
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: false, // Enable if using cloud DB
});

async function getUserByUsername(username) {
  const res = await pool.query(
    "SELECT * FROM users WHERE username = $1 AND is_active = TRUE",
    [username]
  );
  return res.rows[0] || null;
}

async function getUserByMsEmail(msEmail) {
  const res = await pool.query(
    "SELECT * FROM users WHERE LOWER(ms_email) = LOWER($1) AND is_active = TRUE",
    [msEmail]
  );
  return res.rows[0] || null;
}

async function logLogin(userId, method, req) {
  try {
    await pool.query(
      "INSERT INTO login_audit (user_id, login_method, ip_address, user_agent) VALUES ($1,$2,$3,$4)",
      [userId, method, req.ip, req.headers["user-agent"]]
    );
  } catch (e) {
    console.error("Login audit failed:", e);
  }
}

/************************************************************
 * 3) PASSWORD LOGIN ROUTE
 ************************************************************/
app.post("/api/auth/login-password", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await getUserByUsername(username);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    await logLogin(user.id, "password", req);

    return res.json({
      username: user.username,
      role: user.role,
      msEmail: user.ms_email,
    });
  } catch (err) {
    console.error("Password login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/************************************************************
 * 4) MICROSOFT LOGIN ROUTE
 ************************************************************/
app.post("/api/auth/login-microsoft", async (req, res) => {
  try {
    const { msEmail } = req.body;

    const user = await getUserByMsEmail(msEmail);
    if (!user) {
      return res.status(401).json({ error: "User not authorized" });
    }

    await logLogin(user.id, "microsoft", req);

    return res.json({
      username: user.username || user.ms_email,
      msEmail: user.ms_email,
      role: user.role,
    });
  } catch (err) {
    console.error("Microsoft login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/************************************************************
 * 5) EXCEL DATA ROUTES (UNCHANGED)
 ************************************************************/
function readExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
  } catch (error) {
    console.error("Error reading Excel:", error);
    return [];
  }
}

// Admin: return all client Excel files
app.get("/api/data/admin", (req, res) => {
  const dataDir = path.join(__dirname, "data");
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".xlsx"));

  const allClients = {};
  for (const file of files) {
    const name = path.basename(file, ".xlsx");
    allClients[name] = readExcel(path.join(dataDir, file));
  }

  res.json(allClients);
});

// Client route
app.get("/api/data/:client", (req, res) => {
  const filePath = path.join(__dirname, `data/${req.params.client}.xlsx`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Client not found" });
  }
  res.json(readExcel(filePath));
});

/************************************************************
 * 6) POWER BI CONFIG
 ************************************************************/
const TENANT_ID = process.env.TENANT_ID;
const POWERBI_CLIENT_ID = process.env.POWERBI_CLIENT_ID;
const POWERBI_CLIENT_SECRET = process.env.POWERBI_CLIENT_SECRET;

const CLIENT_CONFIGS = {
  CLIENTA: {
    workspaceId: "26b19100-b20e-4fc3-ab0a-1efcb6a18cf0",
    reportId: "f2ba2374-6dc8-4ce2-8792-751c2448a4d9",
  },
  CLIENTB: {
    workspaceId: "74655aef-a1dd-4834-b1ed-e952e46ea390",
    reportId: "f7be459b-b3ab-4528-8ade-48fb1d3c8eee",
  },
};

/************************************************************
 * 7) GET AAD TOKEN
 ************************************************************/
async function getAadAccessToken() {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: POWERBI_CLIENT_ID,
    client_secret: POWERBI_CLIENT_SECRET,
    scope: "https://analysis.windows.net/powerbi/api/.default",
    grant_type: "client_credentials",
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await resp.json();

  if (!resp.ok) throw new Error("Failed to get AAD token");
  return json.access_token;
}

/************************************************************
 * 8) EMBED CONFIG ROUTE
 ************************************************************/
app.post("/api/embed-config", async (req, res) => {
  try {
    const { clientKey } = req.body;
    const cfg = CLIENT_CONFIGS[clientKey];

    if (!cfg) return res.status(400).json({ error: "Unknown clientKey" });

    const aadToken = await getAadAccessToken();

    const tokenResp = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${cfg.workspaceId}/reports/${cfg.reportId}/GenerateToken`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aadToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accessLevel: "View" }),
      }
    );

    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok)
      return res.status(500).json({ error: "Failed to generate embed token" });

    const reportResp = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${cfg.workspaceId}/reports/${cfg.reportId}`,
      { headers: { Authorization: `Bearer ${aadToken}` } }
    );

    const reportJson = await reportResp.json();
    if (!reportResp.ok)
      return res.status(500).json({ error: "Failed to fetch report details" });

    res.json({
      embedToken: tokenJson.token,
      expiration: tokenJson.expiration,
      embedUrl: reportJson.embedUrl,
      reportId: cfg.reportId,
      workspaceId: cfg.workspaceId,
    });
  } catch (err) {
    console.error("Embed config error:", err);
    res.status(500).json({ error: err.message });
  }
});

/************************************************************
 * 9) HEALTH CHECK
 ************************************************************/
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

/************************************************************
 * 10) START SERVER
 ************************************************************/
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
