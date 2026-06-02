#!/usr/bin/env node
/**
 * One-time migration:
 * - Ensures users.email_lookup column + index exist
 * - Encrypts existing JSONB rows in users/incidents/email_log
 * - Backfills users.email_lookup from decrypted user.email
 *
 * Usage:
 *   DATA_ENCRYPTION_KEY=... node scripts/migrate-encrypt-existing.js
 *
 * Recommended: run with backend/.env present.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = require('pg');
const { encryptForStorage, decryptFromStorage, isEncryptionEnabled } = require('../utils/encryption');

if (!isEncryptionEnabled()) {
  console.error('[Migration] DATA_ENCRYPTION_KEY is not set. Aborting (encryption must be enabled).');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

function toStorage(plain) {
  return encryptForStorage(plain);
}

function fromStorage(value) {
  if (!value) return null;
  const obj = typeof value === 'string' ? JSON.parse(value) : value;
  return decryptFromStorage(obj);
}

async function ensureSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_lookup TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email_lookup ON users (lower(email_lookup))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS email_log (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
}

async function migrateUsers() {
  const res = await pool.query('SELECT id, data, email_lookup FROM users');
  let updated = 0;
  for (const row of res.rows) {
    const plain = fromStorage(row.data);
    if (!plain || typeof plain !== 'object') continue;

    const emailLookup = plain.email ? String(plain.email).toLowerCase().trim() : null;
    const encrypted = toStorage(plain);
    await pool.query(
      'UPDATE users SET data = $2::jsonb, email_lookup = $3 WHERE id = $1',
      [row.id, JSON.stringify(encrypted), emailLookup],
    );
    updated += 1;
  }
  console.log(`[Migration] users: encrypted ${updated}/${res.rowCount}`);
}

async function migrateTable(name) {
  const res = await pool.query(`SELECT id, data FROM ${name}`);
  let updated = 0;
  for (const row of res.rows) {
    const plain = fromStorage(row.data);
    if (!plain || typeof plain !== 'object') continue;
    const encrypted = toStorage(plain);
    await pool.query(
      `UPDATE ${name} SET data = $2::jsonb WHERE id = $1`,
      [row.id, JSON.stringify(encrypted)],
    );
    updated += 1;
  }
  console.log(`[Migration] ${name}: encrypted ${updated}/${res.rowCount}`);
}

async function main() {
  console.log('[Migration] Starting encryption/backfill migration...');
  await ensureSchema();
  await migrateUsers();
  await migrateTable('incidents');
  await migrateTable('email_log');
  console.log('[Migration] Done.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('[Migration] Failed:', err);
  try { await pool.end(); } catch {}
  process.exit(1);
});

