const express = require("express");
const router = express.Router();

const dataController = require("../controllers/data.controller");
const { requireApiKey, requireAuth } = require("../middleware/auth");

router.use(requireApiKey, requireAuth);

router.post("/", dataController.createDoc);
router.get("/", dataController.listDocs);
router.get("/:id", dataController.getDoc);
router.put("/:id", dataController.updateDoc);
router.delete("/:id", dataController.deleteDoc);

module.exports = router;
