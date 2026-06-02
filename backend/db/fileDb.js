const { Pool } = require('pg');
const { encryptForStorage, decryptFromStorage } = require('../utils/encryption');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

function toStorage(record) {
  return encryptForStorage(record);
}

function fromStorage(row) {
  if (!row) return null;
  const data = row.data ?? row;
  return decryptFromStorage(typeof data === 'string' ? JSON.parse(data) : data);
}

async function bootstrap() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
  // Existing installations may already have the table; keep schema upgrades additive.
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lookup TEXT`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email_lookup
    ON users (lower(email_lookup))
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_log (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
  console.log('[DB] PostgreSQL tables ready');
}

const Users = {
  async all() {
    const res = await pool.query('SELECT data FROM users');
    return res.rows.map(r => fromStorage(r));
  },
  async findById(id) {
    const res = await pool.query('SELECT data FROM users WHERE id=$1', [id]);
    return fromStorage(res.rows[0]);
  },
  async findByEmail(email) {
    const res = await pool.query(
      'SELECT data FROM users WHERE lower(email_lookup) = lower($1)',
      [email],
    );
    return fromStorage(res.rows[0]);
  },
  async byRole(role) {
    const all = await this.all();
    return all.filter(u => u.role === role);
  },
  async create(data) {
    const emailLookup = data.email ? data.email.toLowerCase().trim() : null;
    await pool.query(
      'INSERT INTO users(id, data, email_lookup) VALUES($1, $2::jsonb, $3)',
      [data.id, JSON.stringify(toStorage(data)), emailLookup],
    );
    return data;
  },
  async update(id, patch) {
    const current = await this.findById(id);
    if (!current) return null;
    const merged = { ...current, ...patch };
    const emailLookup = merged.email ? merged.email.toLowerCase().trim() : null;
    const res = await pool.query(
      'UPDATE users SET data = $2::jsonb, email_lookup = $3 WHERE id = $1 RETURNING data',
      [id, JSON.stringify(toStorage(merged)), emailLookup],
    );
    return fromStorage(res.rows[0]) || merged;
  },
  async delete(id) {
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
  },
};

const Incidents = {
  async all() {
    const res = await pool.query('SELECT data FROM incidents');
    const items = res.rows.map(r => fromStorage(r));
    return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },
  async findById(id) {
    const res = await pool.query('SELECT data FROM incidents WHERE id=$1', [id]);
    return fromStorage(res.rows[0]);
  },
  async create(data) {
    await pool.query(
      'INSERT INTO incidents(id, data) VALUES($1, $2::jsonb)',
      [data.id, JSON.stringify(toStorage(data))],
    );
    return data;
  },
  async update(id, patch) {
    const current = await this.findById(id);
    if (!current) return null;
    const merged = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const res = await pool.query(
      'UPDATE incidents SET data = $2::jsonb WHERE id = $1 RETURNING data',
      [id, JSON.stringify(toStorage(merged))],
    );
    return fromStorage(res.rows[0]) || merged;
  },
};

const EmailLog = {
  async all() {
    const res = await pool.query('SELECT data FROM email_log');
    const items = res.rows.map(r => fromStorage(r));
    return items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  },
  async append(entry) {
    await pool.query(
      'INSERT INTO email_log(id, data) VALUES($1, $2::jsonb)',
      [entry.id, JSON.stringify(toStorage(entry))],
    );
    return entry;
  },
};

bootstrap().catch(err => console.error('[DB] Bootstrap error:', err));

module.exports = { Users, Incidents, EmailLog };
