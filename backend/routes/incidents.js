// backend/routes/incidents.js
const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { Users, Incidents, EmailLog } = require('../db/fileDb');
const email = require('../services/emailService');
const {
  STATUS_PENDING_IRT_CLOSURE,
  STATUS_PENDING_CLOSURE_APPROVAL,
  PENDING_CLOSURE_STATUSES,
  hasIRTRole,
  isPendingIRTClosure,
} = require('../constants');

// ── Auth helpers ─────────────────────────────────────────────
async function getCallerUser(req) {
  const e = req.headers['x-user-email'];
  return e ? await Users.findByEmail(e) : null;
}

async function requireAuth(req, res, next) {
  const user = await getCallerUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  req.imsUser = user;
  next();
}

async function requireIRT(req, res, next) {
  const user = await getCallerUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!hasIRTRole(user)) return res.status(403).json({ error: 'IRT role required' });
  req.imsUser = user;
  next();
}

// ── Visibility filter ─────────────────────────────────────────
function visibleTo(incident, user) {
  if (hasIRTRole(user)) return true;
  const userEmail = user.email?.toLowerCase();
  const userName = user.name?.toLowerCase();
  const ownerEmail = incident.ownerEmail?.toLowerCase();
  const ownerName = incident.ownerName?.toLowerCase();
  return incident.reportedBy === user.id
    || incident.ownerId === user.id
    || (ownerEmail && userEmail === ownerEmail)
    || (ownerName && userName === ownerName);
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

function hasRcaSubmitted(inc) {
  return !!(inc.rca && inc.correction && inc.correctiveAction) || !!inc.responseSubmittedAt;
}

function isPendingRcaApproval(status) {
  return ['Pending Admin Approval', 'Overdue'].includes(status);
}

function appendLog(inc, entry) {
  return [...(inc.actionLog || []), entry];
}

async function auditOverdueIncidents() {
  const incidents = await Incidents.all();
  const now = new Date().toISOString();

  for (const inc of incidents) {
    if (shouldSendResponseReminder(inc, now) && shouldThrottleResponseReminder(inc, now)) {
      const updated = await Incidents.update(inc.id, { responseNotifiedAt: now });
      email.notifyResponseReminder(updated, {}).catch(console.error);
    }

    if (!['Assigned', 'Pending Admin Approval', 'Overdue'].includes(inc.status)) continue;
    if (!isPastTargetDate(inc.targetDate)) continue;

    const updated = await Incidents.update(inc.id, {
      status: 'Overdue',
      overdueNotifiedAt: inc.overdueNotifiedAt || now,
    });

    if (!inc.overdueNotifiedAt) {
      email.notifyOverdue(updated, {}).catch(console.error);
    }
  }
}

// ── ID generator ─────────────────────────────────────────────
async function genIncidentId() {
  const all = await Incidents.all();
  const nextNum = String(all.length + 1).padStart(4, '0');
  return `INC-${nextNum}`;
}

// GET /api/incidents
router.get('/', requireAuth, async (req, res) => {
  try {
    await auditOverdueIncidents();
    const all = await Incidents.all();
    res.json(all.filter(i => visibleTo(i, req.imsUser)));
  } catch (err) {
    console.error('[Incidents] GET / error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incidents/emaillog/all – IRT only
router.get('/emaillog/all', requireIRT, async (req, res) => {
  try {
    const logs = await EmailLog.all();
    res.json(logs.reverse());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incidents/next-id – preview next incident ID
router.get('/next-id', requireAuth, async (req, res) => {
  try {
    res.json({ incidentId: await genIncidentId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/incidents/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    await auditOverdueIncidents();
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (!visibleTo(inc, req.imsUser)) return res.status(403).json({ error: 'Forbidden' });
    res.json(inc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/incidents
router.post('/', requireAuth, async (req, res) => {
  try {
    const { description, incidentDate, attachments } = req.body;
    if (!description || !incidentDate) return res.status(400).json({ error: 'description and incidentDate required' });

    const incident = await Incidents.create({
      id:              uuidv4(),
      incidentId:      await genIncidentId(),
      description:     description.trim(),
      incidentDate,
      reportedBy:      req.imsUser.id,
      reportedByName:  req.imsUser.name,
      reportedByEmail: req.imsUser.email,
      attachments:     attachments || [],
      status:          'Submitted',
      actionLog: [{
        id: uuidv4(), action: 'Submitted', fromStatus: null, toStatus: 'Submitted',
        by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
        comment: 'Incident submitted', at: new Date().toISOString(),
      }],
      validationStatus: null, severity: null, ownerId: null, ownerName: null, ownerEmail: null, isoComments: null,
      rca: '', correction: '', correctiveAction: '', targetDate: '', closureAttachments: [],
      lessonsLearned: '', closedDate: '', reviewDate: '', reviewedBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    email.notifyNewIncident(incident, { actorEmail: req.imsUser.email }).catch(console.error);

    res.status(201).json(incident);
  } catch (err) {
    console.error('[Incidents] POST error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/validate
router.patch('/:id/validate', requireIRT, async (req, res) => {
  try {
    const { validationStatus, severity, ownerId, ownerEmail, ownerName, isoComments } = req.body;
    if (!validationStatus) return res.status(400).json({ error: 'validationStatus required' });

    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (inc.status !== 'Submitted') return res.status(409).json({ error: 'Incident is not in Submitted state' });

    if (validationStatus === 'Valid' && (!severity || (!ownerId && !ownerEmail))) {
      return res.status(400).json({ error: 'severity and ownerId or ownerEmail required for valid incidents' });
    }

    let owner = ownerId ? await Users.findById(ownerId) : null;
    if (!owner && ownerEmail) {
      const ownerEmailClean = ownerEmail.toLowerCase().trim();
      owner = await Users.findByEmail(ownerEmailClean);
      if (!owner) {
        owner = await Users.create({
          id: uuidv4(),
          name: ownerName?.trim() || ownerEmailClean,
          email: ownerEmailClean,
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

    const updated = await Incidents.update(inc.id, {
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

    if (validationStatus === 'Valid' && owner) {
      email.notifyAssigned(updated, { actorEmail: req.imsUser.email }).catch(console.error);
    } else if (validationStatus === 'Invalid') {
      email.notifyRejected(updated, { comment: isoComments, actorEmail: req.imsUser.email }).catch(console.error);
    }

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] validate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/closure
router.patch('/:id/closure', requireAuth, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });

    const normalizedUserEmail = req.imsUser.email?.toLowerCase();
    const ownerEmailOnInc = inc.ownerEmail?.toLowerCase();
    const isOwner = req.imsUser.id === inc.ownerId
      || (ownerEmailOnInc && normalizedUserEmail === ownerEmailOnInc);
    const isIRT = hasIRTRole(req.imsUser);
    if (!isOwner && !isIRT) return res.status(403).json({ error: 'Only the assigned owner or IRT can submit RCA' });
    if (!['Assigned','Overdue'].includes(inc.status)) return res.status(409).json({ error: 'Incident is not in Assigned or Overdue state' });

    const { rca, correction, correctiveAction, targetDate, closureAttachments } = req.body;
    if (!rca || !correction || !correctiveAction || !targetDate) {
      return res.status(400).json({ error: 'rca, correction, correctiveAction, and targetDate are required' });
    }

    const finalStatus = isPastTargetDate(targetDate) ? 'Overdue' : 'Pending Admin Approval';
    const ownerPatch = {};
    if (isOwner) {
      if (!inc.ownerId) ownerPatch.ownerId = req.imsUser.id;
      if (!inc.ownerEmail) ownerPatch.ownerEmail = req.imsUser.email;
      if (!inc.ownerName) ownerPatch.ownerName = req.imsUser.name;
    }

    const updated = await Incidents.update(inc.id, {
      rca, correction, correctiveAction, targetDate,
      closureAttachments: closureAttachments || [],
      status: finalStatus,
      responseSubmittedAt: new Date().toISOString(),
      ...ownerPatch,
      actionLog: [
        ...(inc.actionLog || []),
        {
          id: uuidv4(), action: 'RCA Submitted',
          fromStatus: inc.status, toStatus: finalStatus,
          by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
          comment: `Target date set to ${targetDate}`, at: new Date().toISOString(),
        },
      ],
    });

    email.notifyClosureSubmitted(updated, { actorEmail: req.imsUser.email }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] closure error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/approve-rca — IRT approves submitted RCA
router.patch('/:id/approve-rca', requireIRT, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (!isPendingRcaApproval(inc.status) || !hasRcaSubmitted(inc)) {
      return res.status(409).json({ error: 'Incident is not awaiting RCA approval' });
    }

    const updated = await Incidents.update(inc.id, {
      status: 'Admin Approved',
      actionLog: appendLog(inc, {
        id: uuidv4(), action: 'RCA Approved',
        fromStatus: inc.status, toStatus: 'Admin Approved',
        by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
        comment: 'RCA approved; owner may complete incident closure', at: new Date().toISOString(),
      }),
    });

    email.notifyAdminApproved(updated, {
      actorEmail: req.imsUser.email,
      approvedBy: req.imsUser.name,
    }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] approve-rca error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/reject-rca — IRT rejects RCA (returns to Assigned)
router.patch('/:id/reject-rca', requireIRT, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (!isPendingRcaApproval(inc.status) || !hasRcaSubmitted(inc)) {
      return res.status(409).json({ error: 'Incident is not awaiting RCA approval' });
    }

    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Rejection reason required' });

    const fromStatus = inc.status;
    const updated = await Incidents.update(inc.id, {
      status: 'Assigned',
      isoComments: comment.trim(),
      actionLog: appendLog(inc, {
        id: uuidv4(), action: 'RCA Rejected',
        fromStatus, toStatus: 'Assigned',
        by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
        comment: comment.trim(), at: new Date().toISOString(),
      }),
    });

    email.notifyRcaRejected(updated, {
      fromStatus,
      toStatus: 'Assigned',
      comment: comment.trim(),
      rejectedBy: req.imsUser.name,
      actorEmail: req.imsUser.email,
    }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] reject-rca error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/approve-closure — IRT approves owner closure (ends workflow)
router.patch('/:id/approve-closure', requireIRT, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (inc.status !== STATUS_PENDING_CLOSURE_APPROVAL) {
      return res.status(409).json({ error: 'Incident is not awaiting closure approval' });
    }

    const updated = await Incidents.update(inc.id, {
      status: 'Closed',
      actionLog: appendLog(inc, {
        id: uuidv4(), action: 'Closure Approved',
        fromStatus: inc.status, toStatus: 'Closed',
        by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
        comment: 'Closure approved; incident closed', at: new Date().toISOString(),
      }),
    });

    email.notifyClosed(updated, {
      actorEmail: req.imsUser.email,
      closedBy: req.imsUser.name,
    }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] approve-closure error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/reject-closure — IRT rejects closure (reopen for owner)
router.patch('/:id/reject-closure', requireIRT, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (inc.status !== STATUS_PENDING_CLOSURE_APPROVAL) {
      return res.status(409).json({ error: 'Incident is not awaiting closure approval' });
    }

    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Rejection reason required' });

    const fromStatus = inc.status;
    const updated = await Incidents.update(inc.id, {
      status: 'Admin Approved',
      isoComments: comment.trim(),
      closedDate: '',
      reviewDate: '',
      reviewedBy: '',
      actionLog: appendLog(inc, {
        id: uuidv4(), action: 'Closure Rejected',
        fromStatus, toStatus: 'Admin Approved',
        by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
        comment: comment.trim(), at: new Date().toISOString(),
      }),
    });

    email.notifyClosureRejected(updated, {
      comment: comment.trim(),
      rejectedBy: req.imsUser.name,
      actorEmail: req.imsUser.email,
    }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] reject-closure error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/close — owner closes after RCA; awaits IRT RCA approval
router.patch('/:id/close', requireAuth, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (inc.status !== 'Admin Approved') {
      return res.status(409).json({ error: 'RCA must be approved before owner can close the incident' });
    }

    const normalizedUserEmail = req.imsUser.email?.toLowerCase();
    const normalizedUserName  = req.imsUser.name?.toLowerCase();
    const ownerEmail = inc.ownerEmail?.toLowerCase();
    const ownerName  = inc.ownerName?.toLowerCase();
    const isOwner = req.imsUser.id === inc.ownerId
      || (ownerEmail && normalizedUserEmail === ownerEmail)
      || (!inc.ownerId && ownerName && normalizedUserName === ownerName);
    if (!isOwner) return res.status(403).json({ error: 'Only the assigned owner can close the incident at this stage' });

    const { closedDate, reviewDate, reviewedBy, lessonsLearned } = req.body;
    if (!closedDate) return res.status(400).json({ error: 'closedDate required' });

    const finalReviewDate = reviewDate || closedDate;
    const finalReviewedBy = reviewedBy || req.imsUser.name || '';

    const updated = await Incidents.update(inc.id, {
      closedDate,
      reviewDate: finalReviewDate,
      reviewedBy: finalReviewedBy,
      lessonsLearned: lessonsLearned || '',
      status: STATUS_PENDING_CLOSURE_APPROVAL,
      actionLog: appendLog(inc, {
        id: uuidv4(), action: 'Owner Closed',
        fromStatus: inc.status, toStatus: STATUS_PENDING_CLOSURE_APPROVAL,
        by: req.imsUser.name, byEmail: req.imsUser.email, role: req.imsUser.role,
        comment: lessonsLearned || 'Owner completed closure; awaiting IRT closure approval',
        at: new Date().toISOString(),
      }),
    });

    email.notifyOwnerClosed(updated, { actorEmail: req.imsUser.email }).catch(console.error);

    res.json(updated);
  } catch (err) {
    console.error('[Incidents] close error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/incidents/:id/reject — legacy generic reject (validation-stage incidents)
router.patch('/:id/reject', requireIRT, async (req, res) => {
  try {
    const inc = await Incidents.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    if (inc.status === 'Rejected') return res.status(409).json({ error: 'Cannot reject a rejected incident' });

    if (isPendingRcaApproval(inc.status) && hasRcaSubmitted(inc)) {
      return res.status(409).json({ error: 'Use reject-rca for RCA rejection' });
    }
    if (inc.status === STATUS_PENDING_CLOSURE_APPROVAL) {
      return res.status(409).json({ error: 'Use reject-closure for closure rejection' });
    }

    const { comment } = req.body;
    if (!comment) return res.status(400).json({ error: 'Comment required' });

    res.status(409).json({ error: 'Generic reject is not available for this incident status' });
  } catch (err) {
    console.error('[Incidents] reject error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
