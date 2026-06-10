// backend/services/emailService.js
// Sends email via Microsoft Graph using app-only (client credentials) flow.
// The sender mailbox is the dedicated IMS account in config.azure.senderEmail.
//
// MSSQL migration note: this file doesn't touch the DB, no changes needed.

require('isomorphic-fetch');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const cfg = require('../config');
const { Users, EmailLog } = require('../db/fileDb');
const { v4: uuidv4 } = require('uuid');
const { IRT_ROLE, STATUS_PENDING_IRT_CLOSURE } = require('../constants');

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
  const fields = 'id,displayName,mail,userPrincipalName,accountEnabled';
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
// Recipient matrix:
//   Report incident     → IRT
//   Validate → assign   → Owner + Reporter
//   Validate → reject   → Reporter + Owner + IRT
//   Submit RCA          → IRT + Owner
//   Approve RCA         → Owner + IRT
//   Reject RCA          → Owner + IRT
//   Owner closes        → IRT + Owner
//   Approve closure     → Owner + Reporter + IRT
//   Reject closure      → Owner + IRT
//   Validation reminder (daily) → IRT
//   RCA submission reminder (daily) → Owner + IRT
//   Overdue (target date) → Owner + IRT

const appUrl = cfg.server?.frontendUrl || '';

async function notifyValidationReminder(incident, { actorEmail } = {}) {
  await sendToInvolved(incident, {
    irt: true,
    actorEmail,
    subject: `[IMS] Validation Reminder – ${incident.incidentId}`,
    type: 'validation_reminder',
    title: 'IRT Validation Pending',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Reported by:</strong> ${incident.reportedByName || '—'}`,
      `<strong style="color:#f0f4ff;">Submitted:</strong> ${incident.createdAt ? new Date(incident.createdAt).toLocaleDateString() : '—'}`,
      `<br>This incident has been waiting for IRT validation for at least one working day. Please review and validate it in IMS.`,
    ],
  });
}

async function notifyNewIncident(incident, { actorEmail } = {}) {
  await sendToInvolved(incident, {
    irt: true,
    actorEmail,
    subject: `[IMS] New Incident Submitted – ${incident.incidentId}`,
    type: 'submitted',
    title: 'New Incident Submitted',
    lines: [
      `<strong style="color:#f0f4ff;">Reported by:</strong> ${incident.reportedByName}`,
      `<strong style="color:#f0f4ff;">Date:</strong> ${incident.incidentDate}`,
      `<strong style="color:#f0f4ff;">Description:</strong><br>${incident.description}`,
      `<br>Please log in to review and validate this incident.`,
    ],
  });
}

async function notifyAssigned(incident, { actorEmail } = {}) {
  const lines = [
    `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
    `<strong style="color:#f0f4ff;">Severity:</strong> ${incident.severity}`,
    `<strong style="color:#f0f4ff;">Owner:</strong> ${incident.ownerName || '—'}`,
    `<strong style="color:#f0f4ff;">Description:</strong><br>${incident.description}`,
    `<br>The assigned owner must log in and submit their RCA with a target date.`,
  ];

  await sendToInvolved(incident, {
    owner: true,
    reporter: true,
    actorEmail,
    subject: `[IMS] Incident Assigned – ${incident.incidentId}`,
    type: 'assigned',
    title: 'Incident Assigned to Owner',
    lines,
  });
}

async function getIRTMemberEmails() {
  const all = await Users.all();
  return all
    .filter(u => u.role === IRT_ROLE || u.role === 'iso' || u.isAdmin)
    .map(u => u.email)
    .filter(Boolean);
}

/** Notify reporter, owner, RCA submitter, and all IRT members */
async function notifyAllInvolved(incident, { actorEmail, subject, type, title, lines }) {
  await sendToInvolved(incident, {
    reporter: true,
    owner: true,
    irt: true,
    rcaSubmitter: true,
    actorEmail,
    subject,
    type,
    title,
    lines,
  });
}

/** Collect emails for everyone involved in an incident */
async function collectInvolvedEmails(incident, { reporter, owner, irt, rcaSubmitter } = {}) {
  const emails = new Set();
  if (reporter) {
    const e = await resolveReporterEmail(incident);
    if (e) emails.add(e);
  }
  if (owner) {
    const e = await resolveOwnerEmail(incident);
    if (e) emails.add(e);
  }
  if (rcaSubmitter) {
    const e = await resolveRcaSubmitterEmail(incident);
    if (e) emails.add(e);
  }
  if (irt) {
    (await getIRTMemberEmails()).forEach(e => emails.add(e));
  }
  return uniqueEmails([...emails]);
}

function withoutActor(recipients, actorEmail) {
  if (!actorEmail) return recipients;
  const actor = actorEmail.toLowerCase().trim();
  return recipients.filter(e => e.toLowerCase() !== actor);
}

async function sendToInvolved(incident, { reporter, owner, irt, rcaSubmitter, actorEmail, subject, title, lines, type }) {
  const recipients = withoutActor(
    await collectInvolvedEmails(incident, { reporter, owner, irt, rcaSubmitter }),
    actorEmail
  );
  if (!recipients.length) {
    console.warn(`[Email] ${type}: no recipients for`, incident.incidentId);
    return;
  }
  await sendEmail({
    to: recipients,
    subject,
    type,
    htmlBody: buildHtml(title, lines, incident.incidentId, appUrl),
  });
}

async function resolveReporterEmail(incident) {
  if (incident.reportedByEmail) return incident.reportedByEmail.toLowerCase().trim();
  if (incident.reportedBy) {
    const user = await Users.findById(incident.reportedBy);
    if (user?.email) return user.email.toLowerCase().trim();
  }
  return null;
}

async function resolveOwnerEmail(incident) {
  if (incident.ownerEmail) return incident.ownerEmail.toLowerCase().trim();
  if (incident.ownerId) {
    const user = await Users.findById(incident.ownerId);
    if (user?.email) return user.email.toLowerCase().trim();
  }
  return null;
}

/** Email of whoever last submitted RCA (usually the assigned owner) */
async function resolveRcaSubmitterEmail(incident) {
  const log = [...(incident.actionLog || [])].reverse();
  const entry = log.find(e =>
    e.action === 'RCA Submitted' || e.action === 'Closure Submitted'
  );
  if (entry?.byEmail) return entry.byEmail.toLowerCase().trim();
  return resolveOwnerEmail(incident);
}

function isRcaReviewRejection(fromStatus) {
  return ['Pending Admin Approval', 'Overdue', 'Admin Approved'].includes(fromStatus);
}

function uniqueEmails(list) {
  return [...new Set(list.filter(Boolean).map(e => e.toLowerCase().trim()))];
}

/** IRT validation reject at Submitted stage */
async function notifyRejected(incident, { comment, actorEmail } = {}) {
  const rejectionComment = comment || incident.isoComments || 'No comments provided.';
  await sendToInvolved(incident, {
    reporter: true,
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] Incident Rejected – ${incident.incidentId}`,
    type: 'rejected',
    title: 'Incident Rejected at Validation',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">IRT Comments:</strong> ${rejectionComment}`,
      `<br>Please log in to IMS for more details.`,
    ],
  });
}

/** Admin reject & reopen → all involved parties for that incident */
async function getAdminRejectRecipients(incident, toStatus, fromStatus) {
  const emails = new Set();
  const reporter = await resolveReporterEmail(incident);
  const owner = await resolveOwnerEmail(incident);
  const rcaSubmitter = await resolveRcaSubmitterEmail(incident);
  const irtEmails = await getIRTMemberEmails();

  if (reporter) emails.add(reporter);
  if (owner) emails.add(owner);
  if (rcaSubmitter) emails.add(rcaSubmitter);
  irtEmails.forEach(e => emails.add(e));

  return uniqueEmails([...emails]);
}

async function notifyRcaRejected(incident, { fromStatus, toStatus, comment, rejectedBy, actorEmail }) {
  await sendToInvolved(incident, {
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] RCA Rejected – ${incident.incidentId}`,
    type: 'rca_rejected',
    title: 'RCA Rejected',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Previous status:</strong> ${fromStatus}`,
      `<strong style="color:#f0f4ff;">Current status:</strong> ${toStatus}`,
      `<strong style="color:#f0f4ff;">Rejected by:</strong> ${rejectedBy || 'IRT'}`,
      `<strong style="color:#f0f4ff;">Reason:</strong><br>${comment || incident.isoComments || 'No reason provided.'}`,
      `<br>Please log in to IMS, update your RCA, and resubmit.`,
    ],
  });
}

async function notifyAdminReopened(incident, { fromStatus, toStatus, comment, rejectedBy, actorEmail }) {
  if (isRcaReviewRejection(fromStatus)) {
    return notifyRcaRejected(incident, { fromStatus, toStatus, comment, rejectedBy, actorEmail });
  }

  const recipients = withoutActor(
    await getAdminRejectRecipients(incident, toStatus, fromStatus),
    actorEmail
  );
  if (!recipients.length) {
    console.warn('[Email] notifyAdminReopened: no recipients for', incident.incidentId);
    return;
  }

  await sendEmail({
    to: recipients,
    subject: `[IMS] Incident Reopened – ${incident.incidentId}`,
    type: 'admin_reopened',
    htmlBody: buildHtml(
      'Incident Reopened – Action Required',
      [
        `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
        `<strong style="color:#f0f4ff;">Previous status:</strong> ${fromStatus}`,
        `<strong style="color:#f0f4ff;">Current status:</strong> ${toStatus}`,
        `<strong style="color:#f0f4ff;">Rejected by:</strong> ${rejectedBy || 'IRT'}`,
        `<strong style="color:#f0f4ff;">Comments:</strong><br>${comment || 'No comments provided.'}`,
        `<br>Please log in to IMS and complete the required next steps.`,
      ],
      incident.incidentId,
      appUrl
    ),
  });
}

async function notifyClosureSubmitted(incident, { actorEmail } = {}) {
  await sendToInvolved(incident, {
    irt: true,
    owner: true,
    actorEmail,
    subject: `[IMS] RCA Submitted – ${incident.incidentId}`,
    type: 'closure_submitted',
    title: 'RCA Submitted for Review',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Submitted by:</strong> ${incident.ownerName || 'Owner'}`,
      `<br>RCA has been submitted. IRT will approve or reject the RCA, then the owner may close the incident.`,
    ],
  });
}

async function notifyResponseReminder(incident, { actorEmail } = {}) {
  await sendToInvolved(incident, {
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] RCA Submission Reminder – ${incident.incidentId}`,
    type: 'response_reminder',
    title: 'RCA Submission Reminder',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Owner:</strong> ${incident.ownerName || '—'}`,
      `<strong style="color:#f0f4ff;">Severity:</strong> ${incident.severity || '—'}`,
      `<strong style="color:#f0f4ff;">Target Date:</strong> ${incident.targetDate || '—'}`,
      incident.responseDeadline
        ? `<strong style="color:#f0f4ff;">Response Due:</strong> ${new Date(incident.responseDeadline).toLocaleString()}`
        : '',
      `<br>The RCA has not been submitted. This reminder is sent on each working day until the owner submits RCA in IMS.`,
    ].filter(Boolean),
  });
}

async function notifyOwnerClosed(incident, { actorEmail } = {}) {
  await sendToInvolved(incident, {
    irt: true,
    owner: true,
    actorEmail,
    subject: `[IMS] Closure Submitted – Approval Needed – ${incident.incidentId}`,
    type: 'owner_closed',
    title: 'Owner Submitted Closure – IRT Review Required',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Closed by:</strong> ${incident.reviewedBy || incident.ownerName || 'Owner'}`,
      `<strong style="color:#f0f4ff;">Closed date:</strong> ${incident.closedDate || '—'}`,
      `<br>The owner has submitted closure details. IRT should approve or reject the closure to complete the workflow.`,
    ],
  });
}

async function notifyAdminApproved(incident, { actorEmail, approvedBy } = {}) {
  await sendToInvolved(incident, {
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] RCA Approved – ${incident.incidentId}`,
    type: 'admin_approved',
    title: 'RCA Approved',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Approved by:</strong> ${approvedBy || 'IRT'}`,
      `<br>RCA is approved. The owner may now complete incident closure in IMS.`,
    ],
  });
}

async function notifyClosureRejected(incident, { comment, rejectedBy, actorEmail } = {}) {
  await sendToInvolved(incident, {
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] Closure Rejected – ${incident.incidentId}`,
    type: 'closure_rejected',
    title: 'Closure Rejected – Action Required',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Rejected by:</strong> ${rejectedBy || 'IRT'}`,
      `<strong style="color:#f0f4ff;">Reason:</strong><br>${comment || 'No reason provided.'}`,
      `<br>RCA remains approved. The owner should update closure details and close again.`,
    ],
  });
}

async function notifyOverdue(incident, { actorEmail } = {}) {
  await sendToInvolved(incident, {
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] Incident Overdue – ${incident.incidentId}`,
    type: 'overdue',
    title: 'Incident Overdue',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Owner:</strong> ${incident.ownerName || '—'}`,
      `<strong style="color:#f0f4ff;">Target Date:</strong> ${incident.targetDate || '—'}`,
      `<br>This incident is past its target date. Please review and take action.`,
    ],
  });
}

async function notifyClosed(incident, { actorEmail, closedBy } = {}) {
  await sendToInvolved(incident, {
    owner: true,
    reporter: true,
    irt: true,
    actorEmail,
    subject: `[IMS] Closure Approved – Incident Closed – ${incident.incidentId}`,
    type: 'closed',
    title: 'Closure Approved – Incident Closed',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Approved by:</strong> ${closedBy || incident.reviewedBy || 'IRT'}`,
      `<strong style="color:#f0f4ff;">Closed on:</strong> ${incident.closedDate || '—'}`,
      `<strong style="color:#f0f4ff;">Lessons Learned:</strong><br>${incident.lessonsLearned || '—'}`,
      `<br>The incident workflow is complete.`,
    ],
  });
}

async function notifyTargetDateExtended(incident, { actorEmail, remark, previousDate } = {}) {
  await sendToInvolved(incident, {
    owner: true,
    irt: true,
    actorEmail,
    subject: `[IMS] Target Date Extended – ${incident.incidentId}`,
    type: 'target_date_extended',
    title: 'Target Date Extended',
    lines: [
      `<strong style="color:#f0f4ff;">Incident:</strong> ${incident.incidentId}`,
      `<strong style="color:#f0f4ff;">Previous target date:</strong> ${previousDate || '—'}`,
      `<strong style="color:#f0f4ff;">New target date:</strong> ${incident.targetDate || '—'}`,
      `<strong style="color:#f0f4ff;">Remark:</strong><br>${remark || '—'}`,
      `<br>View the updated target date and remark in IMS.`,
    ],
  });
}

module.exports = {
  notifyValidationReminder,
  notifyNewIncident,
  notifyAssigned,
  notifyRejected,
  notifyRcaRejected,
  notifyAdminReopened,
  resolveReporterEmail,
  resolveOwnerEmail,
  resolveRcaSubmitterEmail,
  notifyClosureSubmitted,
  notifyResponseReminder,
  notifyOwnerClosed,
  notifyClosureRejected,
  notifyAdminApproved,
  notifyOverdue,
  notifyClosed,
  notifyTargetDateExtended,
  collectInvolvedEmails,
  sendEmail,
  getOrgUsers,
  getIRTMemberEmails,
  getAccessToken,
};
