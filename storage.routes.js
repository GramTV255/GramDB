const express = require("express");
const router = express.Router();

const storageController = require("../controllers/storage.controller");
const { requireApiKey, requireAuth } = require("../middleware/auth");
const upload = require("../utils/upload");

router.post("/upload", requireApiKey, requireAuth, upload.single("file"), storageController.uploadFile);
router.get("/files", requireApiKey, requireAuth, storageController.listFiles);
router.delete("/:file_id", requireApiKey, requireAuth, storageController.deleteFile);

module.exports = router;
