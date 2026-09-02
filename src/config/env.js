const { Pool } = require("pg");
const env = require("./env");

if (!env.DATABASE_URL) {
  console.warn(
    "⚠️  DATABASE_URL haijawekwa kwenye .env — weka kabla ya kuendesha server dhidi ya database halisi."
  );
}

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Weka SSL kwenye production kwenye baadhi ya watoa huduma (Render, Heroku, n.k.)
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Hitilafu isiyotarajiwa kwenye Postgres pool:", err);
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
