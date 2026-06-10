// backend/routes/users.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Users } = require('../db/fileDb');
const { getOrgUsers } = require('../services/emailService');
const { fetchUserPhotoByEmail, dataUrlToBuffer } = require('../services/graphPhotos');
const cfg = require('../config');
const { IRT_ROLE, hasIRTRole } = require('../constants');

async function requireAuth(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const user = await Users.findByEmail(email);
  if (!user) return res.status(403).json({ error: 'Not authorized' });
  req.imsUser = user;
  next();
}

// ── Middleware: require IRT role ─────────────────────────────
async function requireIRT(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const user = await Users.findByEmail(email);
  if (!user || !hasIRTRole(user)) return res.status(403).json({ error: 'IRT role required' });
  req.imsUser = user;
  next();
}

// ── Middleware: require admin ────────────────────────────────
async function requireAdmin(req, res, next) {
  const email = req.headers['x-user-email'];
  if (!email) return res.status(401).json({ error: 'Not authenticated' });
  const user = await Users.findByEmail(email);
  if (!user || !hasIRTRole(user)) return res.status(403).json({ error: 'IRT role required' });
  req.imsUser = user;
  const isAdmin = user.isAdmin || user.email.toLowerCase() === cfg.admin.email.toLowerCase();
  if (!isAdmin) return res.status(403).json({ error: 'Admin IRT role required' });
  next();
}

function publicUserRow(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isAdmin: !!u.isAdmin,
    createdAt: u.createdAt,
    hasPhoto: !!u.photoUrl,
    photoUrl: u.photoUrl || null,
  };
}

// GET /api/users  – IRT can list all IMS users
router.get('/', requireIRT, async (req, res) => {
  const all = await Users.all();
  res.json(all.map(publicUserRow));
});

// POST /api/users/sync-photos – pull missing photos from Microsoft Graph
router.post('/sync-photos', requireIRT, async (req, res) => {
  const all = await Users.all();
  let synced = 0;
  for (const u of all) {
    if (u.photoUrl) continue;
    const photoUrl = await fetchUserPhotoByEmail(u.email);
    if (photoUrl) {
      await Users.update(u.id, { photoUrl });
      synced += 1;
    }
  }
  res.json({ synced, total: all.length });
});

// GET /api/users/photo/:email – profile photo for any IMS user (Microsoft Graph)
router.get('/photo/:email', requireAuth, async (req, res) => {
  const email = decodeURIComponent(req.params.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email required' });

  let imsUser = await Users.findByEmail(email);
  let photoUrl = imsUser?.photoUrl || null;

  if (!photoUrl) {
    photoUrl = await fetchUserPhotoByEmail(email);
    if (photoUrl && imsUser) {
      imsUser = await Users.update(imsUser.id, { photoUrl });
    }
  }

  if (!photoUrl) return res.status(404).end();

  const parsed = dataUrlToBuffer(photoUrl);
  if (!parsed) return res.status(404).end();

  res.set('Cache-Control', 'private, max-age=3600');
  res.type(parsed.contentType);
  return res.send(parsed.buffer);
});

// GET /api/users/org – IRT can list all organization users from Azure AD
router.get('/org', requireIRT, async (req, res) => {
  try {
    const users = await getOrgUsers();
    res.json(users);
  } catch (err) {
    console.error('[Users] org fetch failed:', err.message);
    res.status(500).json({ error: 'Failed to load organization users' });
  }
});

// POST /api/users  – Admin IRT creates a user
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) return res.status(400).json({ error: 'name, email, role required' });
  if (!['employee', IRT_ROLE, 'iso'].includes(role)) return res.status(400).json({ error: 'role must be employee or irt' });
  const normalizedRole = role === 'iso' ? IRT_ROLE : role;
  const existing = await Users.findByEmail(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const user = await Users.create({
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    role: normalizedRole,
    isAdmin: false,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(user);
});

// PUT /api/users/:id  – Admin IRT updates a user
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
  if (role && ['employee', IRT_ROLE, 'iso'].includes(role)) patch.role = role === 'iso' ? IRT_ROLE : role;
  const updated = await Users.update(req.params.id, patch);
  res.json(updated);
});

// DELETE /api/users/:id  – Admin IRT deletes a user
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
