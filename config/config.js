// ============================================================
//  IMS – MASTER CONFIGURATION
//  Fill every value before running. Never commit this file.
// ============================================================

module.exports = {

  // ── Server ────────────────────────────────────────────────
  server: {
    port: Number(process.env.PORT) || 4000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  // ── Microsoft Azure AD (for MS Login + Graph API email) ───
  azure: {
    tenantId:     process.env.AZURE_TENANT_ID || '',
    clientId:     process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    senderEmail:  process.env.AZURE_SENDER_EMAIL || '',
  },

  // ── Admin ISO user (hardcoded, logs in with MS SSO) ───────
  // This is the ONE person who can add/edit/delete users.
  // Their Microsoft account email must match exactly.
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    name:  process.env.ADMIN_NAME  || 'Admin ISO',
  },

  // ── File-based DB paths (relative to backend/) ────────────
  db: {
    dir:       './db',
    users:     './db/users.json',
    incidents: './db/incidents.json',
    emailLog:  './db/emailLog.json',
  },

};
