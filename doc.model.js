const { query } = require("../config/db");

async function create({ owner_id, collection = "default", data = {} }) {
  const { rows } = await query(
    `INSERT INTO docs (owner_id, collection, data)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [owner_id, collection, data]
  );
  return rows[0];
}

async function findById(doc_id) {
  const { rows } = await query("SELECT * FROM docs WHERE doc_id = $1", [doc_id]);
  return rows[0] || null;
}

async function findAll({ collection, limit = 100, offset = 0 } = {}) {
  if (collection) {
    const { rows } = await query(
      `SELECT * FROM docs WHERE collection = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [collection, limit, offset]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT * FROM docs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function update(doc_id, data) {
  const { rows } = await query(
    `UPDATE docs SET data = $1, updated_at = now() WHERE doc_id = $2 RETURNING *`,
    [data, doc_id]
  );
  return rows[0] || null;
}

async function remove(doc_id) {
  const { rowCount } = await query("DELETE FROM docs WHERE doc_id = $1", [doc_id]);
  return rowCount > 0;
}

module.exports = { create, findById, findAll, update, remove };
