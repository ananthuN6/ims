// backend/services/reminderService.js
// Daily working-day email reminders until IRT validates or owner submits RCA.

const { Incidents } = require('../db/fileDb');
const email = require('./emailService');
const {
  businessDaysSince,
  shouldSendDailyReminder,
  getAssignedAt,
} = require('../utils/businessDays');

function hasRcaSubmitted(inc) {
  return !!(inc.rca && inc.correction && inc.correctiveAction) || !!inc.responseSubmittedAt;
}

function isPastTargetDate(targetDate) {
  if (!targetDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return targetDate < today;
}

async function sendValidationReminders(incidents, now) {
  for (const inc of incidents) {
    if (inc.status !== 'Submitted') continue;
    if (businessDaysSince(inc.createdAt, now) < 1) continue;
    if (!shouldSendDailyReminder(inc.validationReminderDate, now)) continue;

    const updated = await Incidents.update(inc.id, {
      validationReminderDate: now.toISOString().slice(0, 10),
    });
    await email.notifyValidationReminder(updated, {}).catch(console.error);
  }
}

async function sendRcaReminders(incidents, now) {
  for (const inc of incidents) {
    if (!['Assigned', 'Overdue'].includes(inc.status)) continue;
    if (hasRcaSubmitted(inc)) continue;

    const assignedAt = getAssignedAt(inc);
    if (!assignedAt || businessDaysSince(assignedAt, now) < 1) continue;

    const lastDate = inc.rcaReminderDate || (inc.responseNotifiedAt
      ? inc.responseNotifiedAt.slice(0, 10)
      : null);
    if (!shouldSendDailyReminder(lastDate, now)) continue;

    const updated = await Incidents.update(inc.id, {
      rcaReminderDate: now.toISOString().slice(0, 10),
      responseNotifiedAt: now.toISOString(),
    });
    await email.notifyResponseReminder(updated, {}).catch(console.error);
  }
}

async function markTargetOverdue(incidents, now) {
  for (const inc of incidents) {
    if (!['Assigned', 'Pending Admin Approval', 'Overdue'].includes(inc.status)) continue;
    if (!isPastTargetDate(inc.targetDate)) continue;

    const updated = await Incidents.update(inc.id, {
      status: 'Overdue',
      overdueNotifiedAt: inc.overdueNotifiedAt || now.toISOString(),
    });

    if (!inc.overdueNotifiedAt) {
      await email.notifyOverdue(updated, {}).catch(console.error);
    }
  }
}

/** Run validation + RCA daily reminders and target-date overdue marking. */
async function runDailyReminders() {
  const now = new Date();
  const incidents = await Incidents.all();
  await sendValidationReminders(incidents, now);
  await sendRcaReminders(incidents, now);
  await markTargetOverdue(incidents, now);
}

module.exports = {
  runDailyReminders,
  sendValidationReminders,
  sendRcaReminders,
  markTargetOverdue,
};
