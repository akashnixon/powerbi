const bcrypt = require("bcrypt");

(async () => {
  const admin = await bcrypt.hash("admin123", 10);
  const clientA = await bcrypt.hash("clientA123", 10);
  const clientB = await bcrypt.hash("clientB123", 10);

  console.log("\n========= COPY THESE HASHES =========");
  console.log("admin:    ", admin);
  console.log("clientA:  ", clientA);
  console.log("clientB:  ", clientB);
  console.log("=====================================\n");
})();
