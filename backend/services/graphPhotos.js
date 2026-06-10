// backend/services/graphPhotos.js
require('isomorphic-fetch');
const https = require('https');
const { getAccessToken } = require('./emailService');

function bufferToDataUrl(buffer, contentType = 'image/jpeg') {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function escapeODataString(value) {
  return String(value).replace(/'/g, "''");
}

/** Resolve an IMS email to a Graph user (mail and UPN often differ, e.g. .com vs .net). */
async function resolveGraphUserByEmail(email) {
  if (!email) return null;
  try {
    const token = await getAccessToken();
    const normalized = email.toLowerCase().trim();
    const filter = encodeURIComponent(
      `mail eq '${escapeODataString(normalized)}' or userPrincipalName eq '${escapeODataString(normalized)}'`,
    );
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users?$filter=${filter}&$select=id,mail,userPrincipalName&$top=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.value?.[0] || null;
  } catch {
    return null;
  }
}

/** Fetch signed-in user's photo using their delegated Graph token. */
function fetchMePhoto(accessToken) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.microsoft.com',
      path: '/v1.0/me/photo/$value',
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const ct = res.headers['content-type'] || 'image/jpeg';
        resolve(bufferToDataUrl(Buffer.concat(chunks), ct));
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

/** Fetch any org user's photo using app-only Graph credentials. */
async function fetchUserPhotoByEmail(email) {
  if (!email) return null;
  try {
    const graphUser = await resolveGraphUserByEmail(email);
    if (!graphUser?.id) return null;

    const token = await getAccessToken();
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${graphUser.id}/photo/$value`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/jpeg';
    return bufferToDataUrl(buffer, ct);
  } catch {
    return null;
  }
}

module.exports = {
  fetchMePhoto,
  fetchUserPhotoByEmail,
  resolveGraphUserByEmail,
  dataUrlToBuffer,
};
