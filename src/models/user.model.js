const { query } = require("../config/db");
const crypto = require("crypto");

function generateUid() {
  return "u_" + crypto.randomBytes(6).toString("hex");
}

function generateToken() {
  return "at_" + crypto.randomBytes(24).toString("hex");
}

async function findByPhone(phone_number) {
  const { rows } = await query("SELECT * FROM users WHERE phone_number = $1", [phone_number]);
  return rows[0] || null;
}

async function findByToken(token) {
  const { rows } = await query("SELECT * FROM users WHERE current_token = $1", [token]);
  return rows[0] || null;
}

async function findByUid(uid) {
  const { rows } = await query("SELECT * FROM users WHERE uid = $1", [uid]);
  return rows[0] || null;
}

/**
 * Login/Register kwa namba moja: ikiwa mtumiaji yupo, batilisha token ya
 * zamani na tengeneza mpya (single-session). Ikiwa hayupo, mtengeneze mpya.
 */
async function loginOrRegister(phone_number) {
  const existing = await findByPhone(phone_number);
  const newToken = generateToken();

  if (existing) {
    const { rows } = await query(
      `UPDATE users
         SET current_token = $1, updated_at = now()
       WHERE uid = $2
       RETURNING *`,
      [newToken, existing.uid]
    );
    return rows[0];
  }

  const uid = generateUid();
  const { rows } = await query(
    `INSERT INTO users (uid, phone_number, current_token)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [uid, phone_number, newToken]
  );
  return rows[0];
}

/** Logout: futa current_token bila kutengeneza mpya */
async function logout(uid) {
  await query("UPDATE users SET current_token = NULL, updated_at = now() WHERE uid = $1", [uid]);
}

module.exports = {
  findByPhone,
  findByToken,
  findByUid,
  loginOrRegister,
  logout,
};
