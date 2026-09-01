const { query } = require("../config/db");

async function create({ file_id, uploaded_by, file_name, stored_name, file_type, size_bytes, public_url }) {
  const { rows } = await query(
    `INSERT INTO files (file_id, uploaded_by, file_name, stored_name, file_type, size_bytes, public_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [file_id, uploaded_by, file_name, stored_name, file_type, size_bytes, public_url]
  );
  return rows[0];
}

async function findByStoredName(stored_name) {
  const { rows } = await query("SELECT * FROM files WHERE stored_name = $1", [stored_name]);
  return rows[0] || null;
}

async function findById(file_id) {
  const { rows } = await query("SELECT * FROM files WHERE file_id = $1", [file_id]);
  return rows[0] || null;
}

async function findAll({ limit = 100, offset = 0 } = {}) {
  const { rows } = await query(
    "SELECT * FROM files ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [limit, offset]
  );
  return rows;
}

async function remove(file_id) {
  const { rows } = await query("DELETE FROM files WHERE file_id = $1 RETURNING *", [file_id]);
  return rows[0] || null;
}

module.exports = { create, findByStoredName, findById, findAll, remove };
