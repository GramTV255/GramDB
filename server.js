const app = require("./app");
const env = require("./config/env");
const { pool } = require("./config/db");

const server = app.listen(env.PORT, () => {
  console.log(`✅ GramDB (production build) inaendesha kwenye ${env.BASE_URL}`);
  console.log(`   Mazingira: ${env.NODE_ENV}`);
});

/** Graceful shutdown — funga connections vizuri wakati wa deploy/restart */
function shutdown(signal) {
  console.log(`\n${signal} imepokelewa. Inafunga server kwa utaratibu...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log("✅ Database pool imefungwa. Kwaheri.");
      process.exit(0);
    } catch (err) {
      console.error("Hitilafu wakati wa kufunga:", err);
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
