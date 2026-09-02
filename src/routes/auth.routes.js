const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { requireApiKey, requireAuth } = require("../middleware/auth");
const { loginLimiterByIp, loginLimiterByPhone } = require("../middleware/rateLimit");

// POST /auth/login  (register + login endpoint moja)
router.post("/login", requireApiKey, loginLimiterByIp, loginLimiterByPhone, authController.login);

// POST /auth/logout — futa current_token bila kutengeneza mpya
router.post("/logout", requireApiKey, requireAuth, authController.logout);

// GET /auth/me — taarifa za mtumiaji wa sasa
router.get("/me", requireApiKey, requireAuth, authController.me);

module.exports = router;

