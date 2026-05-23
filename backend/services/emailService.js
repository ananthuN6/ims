// backend/services/emailService.js
// Sends email via Microsoft Graph using app-only (client credentials) flow.
// The sender mailbox is the dedicated IMS account in config.azure.senderEmail.
//
// MSSQL migration note: this file doesn't touch the DB, no changes needed.

require('isomorphic-fetch');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const cfg = require('../config');
const { EmailLog } = require('../db/fileDb');
const { v4: uuidv4 } = require('uuid');

// ── MSAL app (lazy init so server starts even without Azure creds) ───────────
let msalApp = null;
function getMsalApp() {
  if (!msalApp) {
    msalApp = new ConfidentialClientApplication({
      auth: {
        clientId:     cfg.azure.clientId,
        clientSecret: cfg.azure.clientSecret,
        authority:    `https://login.microsoftonline.com/${cfg.azure.tenantId}`,
      },
    });
  }
  return msalApp;
}

async function getAccessToken() {
  const result = await getMsalApp().acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) throw new Error('Failed to acquire Graph token');
  return result.accessToken;
}

async function graphFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph request failed ${res.status}: ${body}`);
  }

  return res.json();
}

async function getOrgUsers() {
  const fields = 'displayName,mail,userPrincipalName,accountEnabled';
  let url = `/users?$select=${fields}&$top=999`;
  const users = [];

  while (url) {
    const result = await graphFetch(url, { method: 'GET' });
    if (Array.isArray(result.value)) {
      users.push(...result.value);
    }
    url = result['@odata.nextLink'] ? result['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '') : null;
  }

  return users
    .filter(u => u.email || u.userPrincipalName)
    .filter(u => u.accountEnabled !== false)
    .map(u => ({
      id: u.id,
      displayName: u.displayName || '',
      email: (u.mail || u.userPrincipalName || '').toLowerCase(),
    }))
    .sort((a,b) => a.displayName.localeCompare(b.displayName));
}

// ── Core send function ───────────────────────────────────────────────────────
async function sendEmail({ to, subject, htmlBody, type = 'system' }) {
  const toList = Array.isArray(to) ? to : [to];
  const toAddresses = toList
    .filter(Boolean)
    .map(addr => ({ emailAddress: { address: addr } }));

  if (!toAddresses.length) {
    console.warn('[Email] No recipients – skipping', subject);
    return;
  }

  try {
    const token = await getAccessToken();

    const message = {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: toAddresses,
    };

    const resp = await fetch(
      `https://graph.microsoft.com/v1.0/users/${cfg.azure.senderEmail}/sendMail`,
      {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Graph sendMail failed ${resp.status}: ${err}`);
    }

    // Log success
    EmailLog.append({
      id: uuidv4(),
      to: toList.join(', '),
      subject,
      type,
      status: 'sent',
      timestamp: new Date().toISOString(),
    });

    console.log(`[Email] ✓ Sent "${subject}" → ${toList.join(', ')}`);

  } catch (err) {
    // Log failure but don't crash the request
    EmailLog.append({
      id: uuidv4(),
      to: toList.join(', '),
      subject,
      type,
      status: 'failed',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
    console.error(`[Email] ✗ Failed "${subject}":`, err.message);
  }
}

// ── HTML email builder ───────────────────────────────────────────────────────
function buildHtml(title, lines, incidentId, appUrl = '') {
  const rows = lines.map(l => `<tr><td style="padding:6px 0;color:#94a3b8;font-size:14px;">${l}</td></tr>`).join('');
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1e;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a2236;border:1px solid #1e2d45;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f,#1a2236);padding:24px 32px;border-bottom:1px solid #1e2d45;">
            <table width="100%"><tr>
              <td>
                <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#3b82f6;text-transform:uppercase;">IMS · Incident Management</span>
                <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#f0f4ff;">${title}</p>
              </td>
              ${incidentId ? `<td align="right"><span style="font-family:monospace;background:#0f1729;border:1px solid #1e2d45;color:#06b6d4;padding:6px 12px;border-radius:6px;font-size:13px;">${incidentId}</span></td>` : ''}
            </tr></table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <table width="100%">${rows}</table>
          </td>
        </tr>
        ${appUrl ? `
        <tr>
          <td style="padding:0 32px 28px;">
            <a href="${appUrl}" style="display:inline-block;background:#3b82f6;color:#fff;padding:11px 24px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">Open in IMS →</a>
          </td>
        </tr>` : ''}
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1e2d45;text-align:center;">
            <p style="margin:0;font-size:11px;color:#4a6080;">This is an automated notification from the IMS system. Do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Typed email senders ──────────────────────────────────────────────────────
const appUrl = cfg.server?.frontendUrl || '';

async function notifyNewIncident(incident, isoEmails) {
  await sendEmail({
    to: isoEmails,
    subject: `[IMS] New Incident Submitted – ${incident.incidentId}`,
    type: 'submitted',
    htmlBody: buildHtml(
      'New Incident Submitted',
      [
        `<strong style="color:#f0f4ff;">Reported by:</strong> ${incident.reportedByName}`,
        `<strong style="color:#f0f4ff;">Date:</strong> ${incident.incidentDate}`,
        `<strong style="color:#f0f4ff;">Description:</strong><br>${incident.description}`,
        `<br>Please log in to review and validate this incident.`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyAssigned(incident, ownerEmail) {
  const lines = [
    `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
    `<strong style="color:#f0f4ff;">Severity:</strong> ${incident.severity}`,
    `<strong style="color:#f0f4ff;">Description:</strong><br>${incident.description}`,
  ];
  if (incident.targetDate) {
    lines.push(`<strong style="color:#f0f4ff;">Target Date:</strong> ${incident.targetDate}`);
  }
  if (incident.responseDeadline) {
    lines.push(`<strong style="color:#f0f4ff;">Response Due:</strong> ${new Date(incident.responseDeadline).toLocaleString()}`);
  }
  lines.push('<br>Please log in to submit the Root Cause Analysis and closure details.');

  await sendEmail({
    to: ownerEmail,
    subject: `[IMS] Incident Assigned to You – ${incident.incidentId}`,
    type: 'assigned',
    htmlBody: buildHtml(
      'You Have Been Assigned an Incident',
      lines,
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyRejected(incident, reporterEmail) {
  await sendEmail({
    to: reporterEmail,
    subject: `[IMS] Incident Rejected – ${incident.incidentId}`,
    type: 'rejected',
    htmlBody: buildHtml(
      'Your Incident Has Been Rejected',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">ISO Comments:</strong> ${incident.isoComments || 'No comments provided.'}`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyClosureSubmitted(incident, isoEmails) {
  await sendEmail({
    to: isoEmails,
    subject: `[IMS] Closure Details Submitted – ${incident.incidentId}`,
    type: 'closure_submitted',
    htmlBody: buildHtml(
      'Closure Details Ready for Review',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">Owner:</strong> ${incident.ownerName || incident.ownerId}`,
        `<br>The owner has submitted RCA and corrective action details. Please review and approve.`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyResponseReminder(incident, recipientEmails) {
  await sendEmail({
    to: recipientEmails,
    subject: `[IMS] Response Overdue – ${incident.incidentId}`,
    type: 'response_reminder',
    htmlBody: buildHtml(
      'Incident Response Overdue',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">Severity:</strong> ${incident.severity}`,
        `<strong style="color:#f0f4ff;">Target Date:</strong> ${incident.targetDate || '—'}`,
        `<strong style="color:#f0f4ff;">Response Due:</strong> ${incident.responseDeadline ? new Date(incident.responseDeadline).toLocaleString() : '—'}`,
        `<br>The assigned owner has not yet submitted a response. Please take action immediately.`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyAdminApproved(incident, recipientEmails) {
  await sendEmail({
    to: recipientEmails,
    subject: `[IMS] Incident Approved for Closure – ${incident.incidentId}`,
    type: 'admin_approved',
    htmlBody: buildHtml(
      'Incident Approved for Closure',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">Approved by:</strong> ${incident.reviewedBy || 'Admin'}`,
        `<br>The incident has been approved and is ready for final closure.`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyOverdue(incident, higherEmails) {
  await sendEmail({
    to: higherEmails,
    subject: `[IMS] Incident Overdue – ${incident.incidentId}`,
    type: 'overdue',
    htmlBody: buildHtml(
      'Incident Overdue',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">Owner:</strong> ${incident.ownerName || incident.ownerId}`,
        `<strong style="color:#f0f4ff;">Target Date:</strong> ${incident.targetDate || '—'}`,
        `<br>This incident is overdue and still not closed. Please review and take action.`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyClosed(incident, recipientEmails) {
  await sendEmail({
    to: recipientEmails,
    subject: `[IMS] Incident Closed – ${incident.incidentId}`,
    type: 'closed',
    htmlBody: buildHtml(
      'Incident Has Been Closed',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">Reviewed by:</strong> ${incident.reviewedBy}`,
        `<strong style="color:#f0f4ff;">Closed on:</strong> ${incident.closedDate}`,
        `<strong style="color:#f0f4ff;">Lessons Learned:</strong><br>${incident.lessonsLearned || '—'}`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

module.exports = {
  notifyNewIncident,
  notifyAssigned,
  notifyRejected,
  notifyClosureSubmitted,
  notifyResponseReminder,
  notifyAdminApproved,
  notifyOverdue,
  notifyClosed,
  sendEmail,
  getOrgUsers,
};
