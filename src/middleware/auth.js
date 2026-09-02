const env = require("../config/env");
const userModel = require("../models/user.model");

/** 1) Angalia API Key kwa kila request */
function requireApiKey(req, res, next) {
  const apiKey = req.header("X-API-Key");
  if (!apiKey || apiKey !== env.API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API Key" });
  }
  next();
}

/** 2) Angalia Access Token — lazima ifanane na current_token ya uid husika */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.header("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: "Missing Authorization Bearer token" });
    }
    const token = match[1];

    const user = await userModel.findByToken(token);
    if (!user || user.current_token !== token) {
      return res.status(401).json({ error: "Session imekwisha (umelogin sehemu nyingine) au token si sahihi" });
    }

    req.uid = user.uid;
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireApiKey, requireAuth };
