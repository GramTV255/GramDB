const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types");
const { v4: uuidv4 } = require("uuid");
const env = require("../config/env");

const uploadDir = path.join(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const fileId = uuidv4();
    const ext = path.extname(file.originalname) || `.${mime.extension(file.mimetype) || "bin"}`;
    req._generatedFileId = fileId;
    cb(null, `${fileId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
});

module.exports = upload;
