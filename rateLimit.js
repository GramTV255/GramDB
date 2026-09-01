const rateLimit = require("express-rate-limit");
const env = require("../config/env");

/** Rate limit kwa IP: X majaribio ya login kwa saa moja */
const loginLimiterByIp = rateLimit({
  windowMs: 60 * 60 * 1000, // saa 1
  max: env.LOGIN_LIMIT_PER_IP_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Majaribio mengi kutoka IP hii, jaribu tena baadaye" },
});

/**
 * Rate limit kwa namba ya simu: X majaribio kwa siku moja.
 * (in-memory kwa unyenyekevu; kwa multi-instance tumia Redis store)
 */
const phoneAttempts = new Map(); // phone -> [timestamps]
const DAY = 24 * 60 * 60 * 1000;

function cleanupOld(arr, windowMs) {
  const cutoff = Date.now() - windowMs;
  return arr.filter((t) => t > cutoff);
}

function loginLimiterByPhone(req, res, next) {
  const phone = (req.body && req.body.phone_number) || "unknown";
  const attempts = cleanupOld(phoneAttempts.get(phone) || [], DAY);

  if (attempts.length >= env.LOGIN_LIMIT_PER_PHONE_PER_DAY) {
    return res.status(429).json({ error: "Majaribio mengi kwa namba hii, jaribu tena baadaye" });
  }

  attempts.push(Date.now());
  phoneAttempts.set(phone, attempts);
  next();
}

module.exports = { loginLimiterByIp, loginLimiterByPhone };
