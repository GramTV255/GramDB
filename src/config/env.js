require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  NODE_ENV: process.env.NODE_ENV || "development",

  API_KEY: process.env.GRAMDB_API_KEY || "gdb_public_apikey_2005Tanzania2005",

  DATABASE_URL: process.env.DATABASE_URL,

  UPLOAD_DIR: process.env.UPLOAD_DIR || "uploads",
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB || "100", 10),

  LOGIN_LIMIT_PER_IP_PER_HOUR: parseInt(process.env.LOGIN_LIMIT_PER_IP_PER_HOUR || "20", 10),
  LOGIN_LIMIT_PER_PHONE_PER_DAY: parseInt(process.env.LOGIN_LIMIT_PER_PHONE_PER_DAY || "5", 10),
};
