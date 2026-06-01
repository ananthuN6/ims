// backend/utils/businessDays.js — Mon–Fri working-day helpers

function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function toDateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/** Business days elapsed since start (day after start counts toward total). */
function businessDaysSince(startIso, endIso = new Date()) {
  if (!startIso) return 0;
  const start = new Date(startIso);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endIso);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    if (isBusinessDay(cur)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function addBusinessDays(date, days) {
  const result = new Date(date);
  while (days > 0) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) days -= 1;
  }
  return result.toISOString().slice(0, 10);
}

function addBusinessHours(date, hours) {
  const result = new Date(date);
  const moveToNextBusiness = () => {
    while (!isBusinessDay(result)) {
      result.setDate(result.getDate() + 1);
    }
    if (result.getHours() < 9) result.setHours(9, 0, 0, 0);
    if (result.getHours() >= 17) {
      result.setDate(result.getDate() + 1);
      while (!isBusinessDay(result)) {
        result.setDate(result.getDate() + 1);
      }
      result.setHours(9, 0, 0, 0);
    }
  };
  moveToNextBusiness();
  while (hours > 0) {
    result.setHours(result.getHours() + 1);
    if (result.getHours() >= 17) {
      result.setDate(result.getDate() + 1);
      while (!isBusinessDay(result)) {
        result.setDate(result.getDate() + 1);
      }
      result.setHours(9, 0, 0, 0);
    }
    if (isBusinessDay(result) && result.getHours() >= 9 && result.getHours() <= 17) {
      hours -= 1;
    }
  }
  return result.toISOString();
}

/** True if today is a business day and we have not sent a reminder yet today. */
function shouldSendDailyReminder(lastReminderDate, now = new Date()) {
  if (!isBusinessDay(now)) return false;
  const today = toDateOnly(now);
  return lastReminderDate !== today;
}

function getAssignedAt(incident) {
  const log = incident.actionLog || [];
  const assigned = [...log].reverse().find(
    e => e.toStatus === 'Assigned' || e.action === 'Assigned',
  );
  if (assigned?.at) return assigned.at;
  if (['Assigned', 'Overdue'].includes(incident.status)) {
    return incident.updatedAt || incident.createdAt;
  }
  return null;
}

module.exports = {
  isBusinessDay,
  toDateOnly,
  businessDaysSince,
  addBusinessDays,
  addBusinessHours,
  shouldSendDailyReminder,
  getAssignedAt,
};
