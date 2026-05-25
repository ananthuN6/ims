const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function bootstrap() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    )
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
    return res.rows.map(r => r.data);
  },
  async findById(id) {
    const res = await pool.query('SELECT data FROM users WHERE id=$1', [id]);
    return res.rows[0]?.data || null;
  },
  async findByEmail(email) {
    const res = await pool.query(
      "SELECT data FROM users WHERE lower(data->>'email') = lower($1)", [email]
    );
    return res.rows[0]?.data || null;
  },
  async byRole(role) {
    const res = await pool.query(
      "SELECT data FROM users WHERE data->>'role' = $1", [role]
    );
    return res.rows.map(r => r.data);
  },
  async create(data) {
    await pool.query('INSERT INTO users(id, data) VALUES($1,$2)', [data.id, JSON.stringify(data)]);
    return data;
  },
  async update(id, patch) {
    const res = await pool.query(
      'UPDATE users SET data = data || $2::jsonb WHERE id=$1 RETURNING data',
      [id, JSON.stringify(patch)]
    );
    return res.rows[0]?.data || null;
  },
  async delete(id) {
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
  },
};

const Incidents = {
  async all() {
    const res = await pool.query("SELECT data FROM incidents ORDER BY data->>'createdAt' DESC");
    return res.rows.map(r => r.data);
  },
  async findById(id) {
    const res = await pool.query('SELECT data FROM incidents WHERE id=$1', [id]);
    return res.rows[0]?.data || null;
  },
  async create(data) {
    await pool.query('INSERT INTO incidents(id, data) VALUES($1,$2)', [data.id, JSON.stringify(data)]);
    return data;
  },
  async update(id, patch) {
    const updated = { ...patch, updatedAt: new Date().toISOString() };
    const res = await pool.query(
      'UPDATE incidents SET data = data || $2::jsonb WHERE id=$1 RETURNING data',
      [id, JSON.stringify(updated)]
    );
    return res.rows[0]?.data || null;
  },
};

const EmailLog = {
  async all() {
    const res = await pool.query("SELECT data FROM email_log ORDER BY data->>'timestamp' DESC");
    return res.rows.map(r => r.data);
  },
  async append(entry) {
    await pool.query('INSERT INTO email_log(id, data) VALUES($1,$2)', [entry.id, JSON.stringify(entry)]);
    return entry;
  },
};

bootstrap().catch(err => console.error('[DB] Bootstrap error:', err));

module.exports = { Users, Incidents, EmailLog };
