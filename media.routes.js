const express = require("express");
const router = express.Router();

const storageController = require("../controllers/storage.controller");

// GET /media/:filename — hakuna API Key wala Access Token
router.get("/:filename", storageController.serveMedia);

module.exports = router;
