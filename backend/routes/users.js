// backend/routes/users.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Users } = require('../db/fileDb');
const { getOrgUsers } = require('../services/emailService');
const cfg = require('../config');

// ── Middleware: require ISO role ─────────────────────────────
async function requireISO(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const user = await Users.findByEmail(email);
  if (!user || user.role !== 'iso') return res.status(403).json({ error: 'ISO role required' });
  req.imsUser = user;
  next();
}

// ── Middleware: require admin ────────────────────────────────
async function requireAdmin(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const user = await Users.findByEmail(email);
  if (!user || user.role !== 'iso') return res.status(403).json({ error: 'ISO role required' });
  req.imsUser = user;
  const isAdmin = user.isAdmin || user.email.toLowerCase() === cfg.admin.email.toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Admin ISO role required' });
  next();
}

// GET /api/users  – ISO can list all IMS users
router.get('/', requireISO, async (req, res) => {
  const all = await Users.all();
  res.json(all.map(u => ({
    id: u.id, name: u.name, email: u.email,
    role: u.role, isAdmin: !!u.isAdmin, createdAt: u.createdAt,
  })));
});

// GET /api/users/org – ISO can list all organization users from Azure AD
router.get('/org', requireISO, async (req, res) => {
  try {
    const users = await getOrgUsers();
    res.json(users);
  } catch (err) {
    console.error('[Users] org fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to load organization users' });
  }
});

// POST /api/users  – Admin ISO creates a user
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  if (!['employee', 'iso'].includes(role)) return res.status(400).json({ error: 'role must be employee or iso' });
  const existing = await Users.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const user = await Users.create({
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    role,
    isAdmin: false,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(user);
});

// PUT /api/users/:id  – Admin ISO updates a user
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  const existing = await Users.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (existing.email.toLowerCase() === cfg.admin.email.toLowerCase()) {
    return res.status(403).json({ error: 'Cannot modify the system admin account' });
  }
  const patch = {};
  if (name)  patch.name  = name.trim();
  if (email) patch.email = email.toLowerCase().trim();
  if (role && ['employee','iso'].includes(role)) patch.role = role;
  const updated = await Users.update(req.params.id, patch);
  res.json(updated);
});

// DELETE /api/users/:id  – Admin ISO deletes a user
router.delete('/:id', requireAdmin, async (req, res) => {
  const existing = await Users.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (existing.email.toLowerCase() === cfg.admin.email.toLowerCase()) {
    return res.status(403).json({ error: 'Cannot delete the system admin account' });
  }
  await Users.delete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
