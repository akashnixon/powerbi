const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const app = express();

app.use(cors());
app.use(express.json());

function readExcel(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet);
  } catch (error) {
    console.error("Error reading Excel:", error);
    return [];
  }
}

// --- Admin route: loads all clients dynamically ---
app.get("/api/data/admin", (req, res) => {
  const dataDir = path.join(__dirname, "data");
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".xlsx"));

  const allClients = {};
  for (const file of files) {
    const clientName = path.basename(file, ".xlsx"); // e.g. "clientC"
    allClients[clientName] = readExcel(path.join(dataDir, file));
  }

  res.json(allClients);
});

// --- Generic client route ---
app.get("/api/data/:client", (req, res) => {
  const client = req.params.client;
  const filePath = path.join(__dirname, `data/${client}.xlsx`);
  const data = readExcel(filePath);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Client not found" });
  }

  res.json(data);
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));


// ---------------------------------------------------------------------
// 1) HARD-CODED POWER BI CREDENTIALS (LOCAL DEMO ONLY)
//    These are the same values you put in .env
// ---------------------------------------------------------------------
const TENANT_ID = "b3b50e0d-8cd4-4052-a870-61c1c9ab351e";
const POWERBI_CLIENT_ID = "60bc632f-65e7-4100-b44c-9aa0968d1adc";
const POWERBI_CLIENT_SECRET =
  "6F18Q~~iJ6ITurEODOuDjGN7rWTafaCWcJ9SmdsV";

// ---------------------------------------------------------------------
// 2) EXPRESS BASIC SETUP
// ---------------------------------------------------------------------

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5051"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ---------------------------------------------------------------------
// 3) CLIENT → WORKSPACE / REPORT MAP
//    CLIENTA = your first workspace/report
//    CLIENTB = fill later when you have second one
// ---------------------------------------------------------------------
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

// ---------------------------------------------------------------------
// 4) HELPER: GET AAD TOKEN FOR POWER BI (service principal)
// ---------------------------------------------------------------------
async function getAadAccessToken() {
  if (!TENANT_ID || !POWERBI_CLIENT_ID || !POWERBI_CLIENT_SECRET) {
    throw new Error(
      "Missing TENANT_ID / POWERBI_CLIENT_ID / POWERBI_CLIENT_SECRET (hard-coded)"
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: POWERBI_CLIENT_ID,
    client_secret: POWERBI_CLIENT_SECRET,
    scope: "https://analysis.windows.net/powerbi/api/.default",
    grant_type: "client_credentials",
  });

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await resp.json();

  if (!resp.ok) {
    console.error("AAD token error:", json);
    throw new Error("Failed to obtain Azure AD token for Power BI");
  }

  return json.access_token;
}

// ---------------------------------------------------------------------
// 5) ROUTE: GENERATE EMBED CONFIG FOR A CLIENT
//    POST /api/embed-config   { "clientKey": "CLIENTA" | "CLIENTB" }
// ---------------------------------------------------------------------
app.post("/api/embed-config", async (req, res) => {
  try {
    const { clientKey } = req.body;

    if (!clientKey) {
      return res
        .status(400)
        .json({ error: "Missing clientKey in request body" });
    }

    const cfg = CLIENT_CONFIGS[clientKey];
    if (!cfg || !cfg.workspaceId || !cfg.reportId) {
      return res.status(400).json({
        error: "Unknown clientKey or workspace/report IDs not configured",
      });
    }

    const { workspaceId, reportId } = cfg;

    // 1) Get Azure AD access token
    const aadToken = await getAadAccessToken();

    // 2) Generate embed token for this report
    const generateTokenUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`;

    const tokenResp = await fetch(generateTokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aadToken}`,
      },
      body: JSON.stringify({
        accessLevel: "View",
        // Add RLS identities here later if you want
      }),
    });

    const tokenJson = await tokenResp.json();

    if (!tokenResp.ok) {
      console.error("Embed token error:", tokenJson);
      return res.status(500).json({
        error: "Failed to generate embed token",
        details: tokenJson,
      });
    }

    // 3) Get report details (to get embedUrl)
    const reportDetailsUrl = `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`;

    const reportResp = await fetch(reportDetailsUrl, {
      headers: { Authorization: `Bearer ${aadToken}` },
    });

    const reportJson = await reportResp.json();

    if (!reportResp.ok) {
      console.error("Report details error:", reportJson);
      return res.status(500).json({
        error: "Failed to get report details",
        details: reportJson,
      });
    }

    // 4) Send back everything React needs
    return res.json({
      success: true,
      embedToken: tokenJson.token,
      expiration: tokenJson.expiration,
      embedUrl: reportJson.embedUrl,
      reportId,
      workspaceId,
    });
  } catch (err) {
    console.error("Unexpected server error:", err);
    return res.status(500).json({
      error: "Unexpected server error",
      details: err.message,
    });
  }
});

// ---------------------------------------------------------------------
// 6) HEALTH CHECK
// ---------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------------------------------------------------------------------
// 7) START SERVER
// ---------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Power BI embed server running on http://localhost:${PORT}`);
});