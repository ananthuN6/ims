// backend/server.js
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('isomorphic-fetch');
const express = require('express');
const cors    = require('cors');
const cfg     = require('../config/config');

const app = express();

app.use(cors({ origin: cfg.server.frontendUrl, credentials: true }));
app.use(express.json({ limit: '20mb' }));   // 20 MB for file attachments
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/incidents', require('./routes/incidents'));

// Health check
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────────────────
const PORT = cfg.server.port || 4000;
app.listen(PORT, () => {
  console.log(`\n🛡️  IMS Backend running on http://localhost:${PORT}`);
  console.log(`   Frontend expected at: ${cfg.server.frontendUrl}`);
  console.log(`   Admin IRT account:    ${cfg.admin.email}\n`);
});
