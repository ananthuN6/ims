// frontend/src/config.js
// ─────────────────────────────────────────────────────────────────────────────
//  FRONT-END CONFIG
//  Mirror the Azure values from config/config.js here.
//  These values are embedded in the browser bundle – do NOT put secrets here.
// ─────────────────────────────────────────────────────────────────────────────

export const AZURE = {
  clientId:  process.env.REACT_APP_AZURE_CLIENT_ID ,
  tenantId:  process.env.REACT_APP_AZURE_TENANT_ID ,
  redirectUri: process.env.REACT_APP_REDIRECT_URI ,
};

// Backend base URL (proxied in dev via package.json "proxy")
export const API_BASE = process.env.REACT_APP_API_BASE || '/api';
