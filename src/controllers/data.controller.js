const docModel = require("../models/doc.model");

async function createDoc(req, res, next) {
  try {
    const collection = req.query.collection || "default";
    const doc = await docModel.create({
      owner_id: req.uid,
      collection,
      data: req.body || {},
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

async function getDoc(req, res, next) {
  try {
    const doc = await docModel.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Document haipo" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function listDocs(req, res, next) {
  try {
    const { collection, limit, offset } = req.query;
    const docs = await docModel.findAll({
      collection,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    res.json(docs);
  } catch (err) {
    next(err);
  }
}

async function updateDoc(req, res, next) {
  try {
    const updated = await docModel.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: "Document haipo" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteDoc(req, res, next) {
  try {
    const deleted = await docModel.remove(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Document haipo" });
    res.json({ deleted: true, doc_id: req.params.id });
  } catch (err) {
    next(err);
  }
}

module.exports = { createDoc, getDoc, listDocs, updateDoc, deleteDoc };
