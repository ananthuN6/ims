// backend/routes/incidents.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Users, Incidents } = require('../db/fileDb');
const email = require('../services/emailService');

// ── Auth helpers ─────────────────────────────────────────────
function getCallerUser(req) {
  const e = req.headers['x-user-email'];
  return e ? Users.findByEmail(e) : null;
}

function requireAuth(req, res, next) {
  const user = getCallerUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.imsUser = user;
  next();
}

function requireISO(req, res, next) {
  requireAuth(req, res, () => {
    if (req.imsUser.role !== 'iso') return res.status(403).json({ error: 'ISO role required' });
    next();
  });
}

// ── Visibility filter ─────────────────────────────────────────
function visibleTo(incident, user) {
  if (user.role === 'iso') return true;
  const email = user.email?.toLowerCase();
  const name = user.name?.toLowerCase();
  const ownerEmail = incident.ownerEmail?.toLowerCase();
  const ownerName = incident.ownerName?.toLowerCase();
  return incident.reportedBy === user.id
    || incident.ownerId === user.id
    || (ownerEmail && email === ownerEmail)
    || (ownerName && name === ownerName);
}

function isPastTargetDate(targetDate) {
  if (!targetDate) return false;
  const today = new Date().toISOString().slice(0,10);
  return targetDate < today;
}

function addBusinessDays(date, days) {
  const result = new Date(date);
  while (days > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) days -= 1;
  }
  return result.toISOString().slice(0,10);
}

function addBusinessHours(date, hours) {
  const result = new Date(date);
  const moveToNextBusiness = () => {
    while (result.getDay() === 0 || result.getDay() === 6) {
      result.setDate(result.getDate() + 1);
    }
    if (result.getHours() < 9) result.setHours(9,0,0,0);
    if (result.getHours() >= 17) {
      result.setDate(result.getDate() + 1);
      while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
      }
      result.setHours(9,0,0,0);
    }
  };

  moveToNextBusiness();
  while (hours > 0) {
    result.setHours(result.getHours() + 1);
    if (result.getHours() >= 17) {
      result.setDate(result.getDate() + 1);
      while (result.getDay() === 0 || result.getDay() === 6) {
        result.setDate(result.getDate() + 1);
      }
      result.setHours(9,0,0,0);
    }
    const day = result.getDay();
    if (day !== 0 && day !== 6 && result.getHours() >= 9 && result.getHours() <= 17) {
      hours -= 1;
    }
  }
  return result.toISOString();
}

function shouldSendResponseReminder(incident, now) {
  if (!incident.responseDeadline) return false;
  if (!['Assigned','Overdue'].includes(incident.status)) return false;
  if (incident.responseSubmittedAt) return false;
  return incident.responseDeadline <= now;
}

function shouldThrottleResponseReminder(incident, now) {
  if (!incident.responseNotifiedAt) return true;
  return new Date(incident.responseNotifiedAt).getTime() + 3600000 <= new Date(now).getTime();
}

function getAdminRevertStatus(status) {
  switch (status) {
    case 'Closed': return 'Pending ISO Closure';
    case 'Admin Approved': return 'Pending Admin Approval';
    case 'Overdue':
    case 'Pending Admin Approval': return 'Assigned';
    case 'Assigned': return 'Submitted';
    default: return status;
  }
}

function getHigherRecipientEmails() {
  return Users.all()
    .filter(u => u.role === 'iso' || u.isAdmin)
    .map(u => u.email)
    .filter(Boolean);
}

async function auditOverdueIncidents() {
  const incidents = Incidents.all();
  const now = new Date().toISOString();

  for (const inc of incidents) {
    if (shouldSendResponseReminder(inc, now) && shouldThrottleResponseReminder(inc, now)) {
      const updated = Incidents.update(inc.id, {
        responseNotifiedAt: now,
      });
      const isoEmails = getHigherRecipientEmails();
      const notifyEmails = [inc.ownerEmail, ...isoEmails].filter(Boolean);
      if (notifyEmails.length) email.notifyResponseReminder(updated, notifyEmails).catch(console.error);
    }

    if (!['Assigned','Pending ISO Closure','Pending Admin Approval'].includes(inc.status)) continue;
    if (!isPastTargetDate(inc.targetDate)) continue;

    const updated = Incidents.update(inc.id, {
      status: 'Overdue',
      overdueNotifiedAt: inc.overdueNotifiedAt || now,
    });

    if (!inc.overdueNotifiedAt) {
      const higherEmails = getHigherRecipientEmails();
      if (higherEmails.length) email.notifyOverdue(updated, higherEmails).catch(console.error);
    }
  }
}

// ── ID generator ─────────────────────────────────────────────
function genIncidentId() {
  return `INC-${Math.floor(10000 + Math.random() * 90000)}`;
}

// GET /api/incidents
router.get('/', requireAuth, async (req, res) => {
  await auditOverdueIncidents();
  const all = Incidents.all().filter(i => visibleTo(i, req.imsUser));
  res.json(all);
});

// GET /api/incidents/:id
router.get('/:id', requireAuth, async (req, res) => {
  await auditOverdueIncidents();
  const inc = Incidents.findById(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });
  if (!visibleTo(inc, req.imsUser)) return res.status(403).json({ error: 'Forbidden' });
  res.json(inc);
});

// POST /api/incidents  – employee or ISO submits new incident
router.post('/', requireAuth, async (req, res) => {
  const { description, incidentDate, attachments } = req.body;
  if (!description || !incidentDate) return res.status(400).json({ error: 'description and incidentDate required' });

  const incident = Incidents.create({
    id: uuidv4(),
    incidentId:      genIncidentId(),
    description:     description.trim(),
    incidentDate,
    reportedBy:      req.imsUser.id,
    reportedByName:  req.imsUser.name,
    reportedByEmail: req.imsUser.email,
    attachments:     attachments || [],
    status:          'Submitted',
    actionLog: [
      { id: uuidv4(), action:'Submitted', fromStatus:null, toStatus:'Submitted', by:req.imsUser.name, byEmail:req.imsUser.email, role:req.imsUser.role, comment:'Incident submitted', at:new Date().toISOString() }
    ],
    // ISO fields
    validationStatus: null, severity: null, ownerId: null, ownerName: null, ownerEmail: null, isoComments: null,
    // Owner closure
    rca: '', correction: '', correctiveAction: '', targetDate: '', closureAttachments: [],
    // ISO final closure
    lessonsLearned: '', closedDate: '', reviewDate: '', reviewedBy: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Email ISO team
  const isoEmails = Users.byRole('iso').map(u => u.email);
  email.notifyNewIncident(incident, isoEmails).catch(console.error);

  res.status(201).json(incident);
});

// PATCH /api/incidents/:id/validate  – ISO validates & assigns
router.patch('/:id/validate', requireISO, async (req, res) => {
  const { validationStatus, severity, ownerId, ownerEmail, ownerName, isoComments } = req.body;
  if (!validationStatus) return res.status(400).json({ error: 'validationStatus required' });

  const inc = Incidents.findById(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });
  if (inc.status !== 'Submitted') return res.status(409).json({ error: 'Incident is not in Submitted state' });

  if (validationStatus === 'Valid' && (!severity || (!ownerId && !ownerEmail))) {
    return res.status(400).json({ error: 'severity and ownerId or ownerEmail required for valid incidents' });
  }

  let owner = ownerId ? Users.findById(ownerId) : null;
  if (!owner && ownerEmail) {
    const email = ownerEmail.toLowerCase().trim();
    owner = Users.findByEmail(email);
    if (!owner) {
      owner = Users.create({
        id: uuidv4(),
        name: ownerName?.trim() || email,
        email,
        role: 'employee',
        isAdmin: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const newStatus = validationStatus === 'Valid' ? 'Assigned' : 'Rejected';
  let targetDate = inc.targetDate || '';
  let responseDeadline = null;
  if (validationStatus === 'Valid') {
    if (severity === 'High') {
      targetDate = addBusinessDays(new Date(), 2);
      responseDeadline = addBusinessHours(new Date(), 4);
    } else if (severity === 'Medium') {
      targetDate = addBusinessDays(new Date(), 5);
      responseDeadline = addBusinessHours(new Date(), 8);
    }
  }

  const updated = Incidents.update(inc.id, {
    validationStatus,
    severity: severity || null,
    ownerId: owner?.id || null,
    ownerEmail: owner?.email || ownerEmail || null,
    ownerName: owner?.name || ownerName || ownerEmail || null,
    isoComments: isoComments || null,
    status: newStatus,
    targetDate,
    responseDeadline,
    responseNotifiedAt: null,
    responseSubmittedAt: null,
    actionLog: [
      ...(inc.actionLog || []),
      {
        id: uuidv4(),
        action: validationStatus === 'Valid' ? 'Assigned' : 'Rejected',
        fromStatus: inc.status,
        toStatus: newStatus,
        by: req.imsUser.name,
        byEmail: req.imsUser.email,
        role: req.imsUser.role,
        comment: isoComments || (validationStatus === 'Valid' ? 'Incident validated and assigned' : 'Incident rejected'),
        at: new Date().toISOString(),
      },
    ],
  });

  // Emails
  if (validationStatus === 'Valid' && owner) {
    email.notifyAssigned(updated, owner.email).catch(console.error);
  } else if (validationStatus === 'Invalid') {
    const reporter = Users.findById(inc.reportedBy);
    if (reporter) email.notifyRejected(updated, reporter.email).catch(console.error);
  }

  res.json(updated);
});

// PATCH /api/incidents/:id/closure  – Owner submits closure details
router.patch('/:id/closure', requireAuth, async (req, res) => {
  const inc = Incidents.findById(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });

  // Only the assigned owner OR ISO can submit closure
  const isOwner = req.imsUser.id === inc.ownerId;
  const isISO   = req.imsUser.role === 'iso';
  if (!isOwner && !isISO) return res.status(403).json({ error: 'Only the assigned owner or ISO can submit closure' });
  if (!['Assigned','Overdue'].includes(inc.status)) return res.status(409).json({ error: 'Incident is not in Assigned or Overdue state' });

  const { rca, correction, correctiveAction, targetDate, closureAttachments } = req.body;
  if (!rca || !correction || !correctiveAction || !targetDate) {
    return res.status(400).json({ error: 'rca, correction, correctiveAction, and targetDate are required' });
  }

  const finalStatus = isPastTargetDate(targetDate) ? 'Overdue' : 'Pending Admin Approval';
  const updated = Incidents.update(inc.id, {
    rca,
    correction,
    correctiveAction,
    targetDate,
    closureAttachments: closureAttachments || [],
    status: finalStatus,
    responseSubmittedAt: new Date().toISOString(),
    actionLog: [
      ...(inc.actionLog || []),
      {
        id: uuidv4(),
        action: 'Closure Submitted',
        fromStatus: inc.status,
        toStatus: finalStatus,
        by: req.imsUser.name,
        byEmail: req.imsUser.email,
        role: req.imsUser.role,
        comment: `Target date set to ${targetDate}`,
        at: new Date().toISOString(),
      },
    ],
  });

  // Email ISO team
  const isoEmails = Users.byRole('iso').map(u => u.email);
  email.notifyClosureSubmitted(updated, isoEmails).catch(console.error);

  res.json(updated);
});

// PATCH /api/incidents/:id/approve  – ISO or admin approves the submitted closure before final close
router.patch('/:id/approve', requireISO, async (req, res) => {
  const inc = Incidents.findById(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });
  if (!['Pending Admin Approval','Overdue'].includes(inc.status)) return res.status(409).json({ error: 'Incident is not awaiting approval' });

  const updated = Incidents.update(inc.id, {
    status: 'Admin Approved',
    actionLog: [
      ...(inc.actionLog || []),
      {
        id: uuidv4(),
        action: 'Admin Approved',
        fromStatus: inc.status,
        toStatus: 'Admin Approved',
        by: req.imsUser.name,
        byEmail: req.imsUser.email,
        role: req.imsUser.role,
        comment: 'Closure approved and ready for final close',
        at: new Date().toISOString(),
      },
    ],
  });

  const recipientIds = [inc.reportedBy, inc.ownerId].filter(Boolean);
  const uniqueIds = [...new Set(recipientIds)];
  const recipientEmails = uniqueIds.map(id => Users.findById(id)?.email).filter(Boolean);
  email.notifyAdminApproved(updated, recipientEmails).catch(console.error);

  res.json(updated);
});

// PATCH /api/incidents/:id/close  – ISO or assigned owner performs final closure
router.patch('/:id/close', requireAuth, async (req, res) => {
  const inc = Incidents.findById(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });
  if (inc.status !== 'Admin Approved') return res.status(409).json({ error: 'Incident is not approved for closure' });

  const normalizedUserEmail = req.imsUser.email?.toLowerCase();
  const normalizedUserName = req.imsUser.name?.toLowerCase();
  const ownerEmail = inc.ownerEmail?.toLowerCase();
  const ownerName = inc.ownerName?.toLowerCase();
  const isOwner = req.imsUser.id === inc.ownerId
    || (ownerEmail && normalizedUserEmail === ownerEmail)
    || (!inc.ownerId && ownerName && normalizedUserName === ownerName);
  const isISO = req.imsUser.role === 'iso';
  if (!isOwner && !isISO) return res.status(403).json({ error: 'Only the assigned owner or ISO can close this incident' });

  const { closedDate, reviewDate, reviewedBy, lessonsLearned } = req.body;
  if (!closedDate) {
    return res.status(400).json({ error: 'closedDate required' });
  }

  const finalReviewDate = reviewDate || closedDate;
  const finalReviewedBy = reviewedBy || (isOwner ? req.imsUser.name : '');

  if (isISO && (!reviewDate || !reviewedBy)) {
    return res.status(400).json({ error: 'reviewDate and reviewedBy required for ISO closure' });
  }

  if (!finalReviewedBy) {
    return res.status(400).json({ error: 'reviewedBy required' });
  }

  const updated = Incidents.update(inc.id, {
    closedDate,
    reviewDate: finalReviewDate,
    reviewedBy: finalReviewedBy,
    lessonsLearned: lessonsLearned || '',
    status: 'Closed',
    actionLog: [
      ...(inc.actionLog || []),
      {
        id: uuidv4(),
        action: 'Closed',
        fromStatus: inc.status,
        toStatus: 'Closed',
        by: req.imsUser.name,
        byEmail: req.imsUser.email,
        role: req.imsUser.role,
        comment: lessonsLearned || 'Incident marked closed',
        at: new Date().toISOString(),
      },
    ],
  });

  // Email reporter + owner
  const recipientIds = [inc.reportedBy, inc.ownerId].filter(Boolean);
  const uniqueIds = [...new Set(recipientIds)];
  const recipientEmails = uniqueIds.map(id => Users.findById(id)?.email).filter(Boolean);
  email.notifyClosed(updated, recipientEmails).catch(console.error);

  res.json(updated);
});

// PATCH /api/incidents/:id/reject  – ISO/admin rejects and reopens incident with comment
router.patch('/:id/reject', requireISO, async (req, res) => {
  const inc = Incidents.findById(req.params.id);
  if (!inc) return res.status(404).json({ error: 'Not found' });
  if (inc.status === 'Rejected') return res.status(409).json({ error: 'Cannot reject a rejected incident' });

  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment required' });

  const toStatus = getAdminRevertStatus(inc.status);
  const updated = Incidents.update(inc.id, {
    status: toStatus,
    actionLog: [
      ...(inc.actionLog || []),
      {
        id: uuidv4(),
        action: 'Admin Reject',
        fromStatus: inc.status,
        toStatus,
        by: req.imsUser.name,
        byEmail: req.imsUser.email,
        role: req.imsUser.role,
        comment,
        at: new Date().toISOString(),
      },
    ],
  });

  res.json(updated);
});

// GET /api/incidents/emaillog  – ISO only
router.get('/emaillog/all', requireISO, (req, res) => {
  const { EmailLog } = require('../db/fileDb');
  res.json(EmailLog.all().reverse());
});

module.exports = router;
