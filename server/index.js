const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

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