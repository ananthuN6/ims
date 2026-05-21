// backend/db/fileDb.js
// Lightweight JSON file database.
// Each collection is a single .json file: { "rows": [...] }
// Migration to MSSQL: replace every export here with a Sequelize/mssql call.

const fs   = require('fs');
const path = require('path');
const cfg  = require('../../config/config');

// ── Bootstrap: create db dir + empty files if they don't exist ──────────────
function bootstrap() {
  const dir = path.resolve(__dirname, '..', cfg.db.dir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const files = {
    [path.resolve(__dirname, '..', cfg.db.users)]:     { rows: [] },
    [path.resolve(__dirname, '..', cfg.db.incidents)]: { rows: [] },
    [path.resolve(__dirname, '..', cfg.db.emailLog)]:  { rows: [] },
  };

  for (const [filePath, seed] of Object.entries(files)) {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(seed, null, 2), 'utf8');
      console.log(`[DB] Created ${filePath}`);
    }
  }
}

// ── Generic helpers ──────────────────────────────────────────────────────────
function readCollection(filePath) {
  const abs = path.resolve(__dirname, '..', filePath);
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    return JSON.parse(raw).rows || [];
  } catch (e) {
    console.error('[DB] read error', filePath, e.message);
    return [];
  }
}

function writeCollection(filePath, rows) {
  const abs = path.resolve(__dirname, '..', filePath);
  fs.writeFileSync(abs, JSON.stringify({ rows }, null, 2), 'utf8');
}

// ── Users ────────────────────────────────────────────────────────────────────
const Users = {
  all:       ()      => readCollection(cfg.db.users),
  findById:  (id)    => Users.all().find(u => u.id === id) || null,
  findByEmail:(email)=> Users.all().find(u => u.email.toLowerCase() === email.toLowerCase()) || null,
  byRole:    (role)  => Users.all().filter(u => u.role === role),

  create(data) {
    const rows = Users.all();
    rows.push(data);
    writeCollection(cfg.db.users, rows);
    return data;
  },

  update(id, patch) {
    const rows = Users.all().map(u => u.id === id ? { ...u, ...patch } : u);
    writeCollection(cfg.db.users, rows);
    return rows.find(u => u.id === id);
  },

  delete(id) {
    const rows = Users.all().filter(u => u.id !== id);
    writeCollection(cfg.db.users, rows);
  },
};

// ── Incidents ────────────────────────────────────────────────────────────────
const Incidents = {
  all:       ()   => readCollection(cfg.db.incidents),
  findById:  (id) => Incidents.all().find(i => i.id === id) || null,

  create(data) {
    const rows = Incidents.all();
    rows.push(data);
    writeCollection(cfg.db.incidents, rows);
    return data;
  },

  update(id, patch) {
    const rows = Incidents.all().map(i => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i);
    writeCollection(cfg.db.incidents, rows);
    return rows.find(i => i.id === id);
  },
};

// ── Email Log ────────────────────────────────────────────────────────────────
const EmailLog = {
  all: () => readCollection(cfg.db.emailLog),

  append(entry) {
    const rows = EmailLog.all();
    rows.push(entry);
    writeCollection(cfg.db.emailLog, rows);
    return entry;
  },
};

// Run bootstrap when module is first loaded
bootstrap();

module.exports = { Users, Incidents, EmailLog };
