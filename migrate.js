/**
 * Endesha: npm run migrate
 * Inasoma migrations/*.sql kwa mfuatano na kuzitekeleza dhidi ya DATABASE_URL.
 */
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function migrate() {
  const migrationsDir = path.join(__dirname, "..", "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`▶ Inatekeleza migration: ${file}`);
    await pool.query(sql);
  }

  console.log("✅ Migrations zote zimekamilika.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("❌ Migration imeshindwa:", err);
  process.exit(1);
});
