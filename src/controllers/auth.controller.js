const userModel = require("../models/user.model");

async function login(req, res, next) {
  try {
    const { phone_number } = req.body || {};

    if (!phone_number || typeof phone_number !== "string") {
      return res.status(400).json({ error: "phone_number inahitajika" });
    }

    const user = await userModel.loginOrRegister(phone_number.trim());

    res.status(200).json({
      uid: user.uid,
      access_token: user.current_token,
      phone_number: user.phone_number,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    await userModel.logout(req.uid);
    res.json({ logged_out: true });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({
    uid: req.user.uid,
    phone_number: req.user.phone_number,
    created_at: req.user.created_at,
  });
}

module.exports = { login, logout, me };
