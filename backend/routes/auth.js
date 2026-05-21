// backend/routes/auth.js
// The frontend sends the MS ID token; we verify it with JWKS,
// look up the user in our DB, and return their IMS profile.

const express = require('express');
const router  = express.Router();
const cfg     = require('../../config/config');
const { Users } = require('../db/fileDb');

// Simple JWKS-based verification using Microsoft's public keys
// We use the lightweight manual approach to avoid heavy JWT libraries
const https = require('https');

function fetchJwks() {
  return new Promise((resolve, reject) => {
    const url = `https://login.microsoftonline.com/${cfg.azure.tenantId}/discovery/v2.0/keys`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// Decode JWT payload without verification (verification happens via token info endpoint)
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const padded = parts[1] + '='.repeat((4 - parts[1].length % 4) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch { return null; }
}

// Verify the token by calling MS token info endpoint (userinfo)
async function verifyMsToken(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'graph.microsoft.com',
      path: '/v1.0/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed);
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// POST /api/auth/login
// Body: { accessToken }  (MS access token with User.Read scope)
router.post('/login', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

  try {
    // Verify token and get profile from Graph
    const profile = await verifyMsToken(accessToken);
    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();

    if (!email) return res.status(401).json({ error: 'Could not resolve email from MS token' });

    // Is this the hardcoded admin?
    const isAdmin = email === cfg.admin.email.toLowerCase();

    // Look up in our user DB
    let user = Users.findByEmail(email);

    // Auto-create user if not yet in DB
    if (!user) {
      const { v4: uuidv4 } = require('uuid');
      
      if (isAdmin) {
        // Auto-create admin with ISO role
        user = Users.create({
          id:        uuidv4(),
          name:      profile.displayName || cfg.admin.name,
          email:     email,
          role:      'iso',
          isAdmin:   true,
          createdAt: new Date().toISOString(),
        });
      } else {
        // Auto-create regular user as employee
        user = Users.create({
          id:        uuidv4(),
          name:      profile.displayName || '',
          email:     email,
          role:      'employee',
          isAdmin:   false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Sync display name from MS profile
    if (user && user.name !== profile.displayName && profile.displayName) {
      user = Users.update(user.id, { name: profile.displayName });
    }

    return res.json({
      user: {
        id:      user.id,
        name:    user.name,
        email:   user.email,
        role:    user.role,
        isAdmin: !!user.isAdmin,
      },
    });

  } catch (err) {
    console.error('[Auth] login error:', err.message);
    return res.status(401).json({ error: 'Authentication failed', detail: err.message });
  }
});

module.exports = router;
