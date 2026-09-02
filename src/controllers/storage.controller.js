const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const fileModel = require("../models/file.model");
const env = require("../config/env");
const { sendSiteNotFoundPage } = require("../middleware/errorHandler");

async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Hakuna faili lililotumwa (field name: 'file')" });
    }

    const publicUrl = `${env.BASE_URL}/media/${req.file.filename}`;

    const record = await fileModel.create({
      file_id: req._generatedFileId || uuidv4(),
      uploaded_by: req.uid,
      file_name: req.file.originalname,
      stored_name: req.file.filename,
      file_type: req.file.mimetype,
      size_bytes: req.file.size,
      public_url: publicUrl,
    });

    res.status(201).json({
      file_id: record.file_id,
      public_url: record.public_url,
      uploaded_by: record.uploaded_by,
      file_name: record.file_name,
      file_type: record.file_type,
      size: Number(record.size_bytes),
      created_at: record.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function listFiles(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const rows = await fileModel.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    res.json(
      rows.map((r) => ({
        file_id: r.file_id,
        public_url: r.public_url,
        uploaded_by: r.uploaded_by,
        file_name: r.file_name,
        file_type: r.file_type,
        size: Number(r.size_bytes),
        created_at: r.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function deleteFile(req, res, next) {
  try {
    const record = await fileModel.remove(req.params.file_id);
    if (!record) return res.status(404).json({ error: "Faili haipo" });

    const filePath = path.join(process.cwd(), env.UPLOAD_DIR, record.stored_name);
    fs.unlink(filePath, () => {}); // futa kimya kimya kama halipo

    res.json({ deleted: true, file_id: req.params.file_id });
  } catch (err) {
    next(err);
  }
}

/** Kufikia faili kwa umma — hakuna API Key wala Access Token */
async function serveMedia(req, res, next) {
  try {
    const safeName = path.basename(req.params.filename); // zuia path traversal
    const filePath = path.join(process.cwd(), env.UPLOAD_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return sendSiteNotFoundPage(res);
    }

    const record = await fileModel.findByStoredName(safeName);
    if (!record) {
      return sendSiteNotFoundPage(res);
    }

    res.setHeader("Content-Type", record.file_type || "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadFile, listFiles, deleteFile, serveMedia };
