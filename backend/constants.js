// IRT (Incident Response Team) – shared terminology and legacy ISO aliases

const IRT_ROLE = 'irt';
const LEGACY_IRT_ROLE = 'iso';

const STATUS_PENDING_IRT_CLOSURE = 'Pending IRT Closure';
const LEGACY_STATUS_PENDING_ISO_CLOSURE = 'Pending ISO Closure';

const PENDING_CLOSURE_STATUSES = [
  STATUS_PENDING_IRT_CLOSURE,
  LEGACY_STATUS_PENDING_ISO_CLOSURE,
  'Pending Admin Approval',
  'Admin Approved',
];

function hasIRTRole(user) {
  if (!user) return false;
  return user.role === IRT_ROLE || user.role === LEGACY_IRT_ROLE;
}

function isPendingIRTClosure(status) {
  return status === STATUS_PENDING_IRT_CLOSURE || status === LEGACY_STATUS_PENDING_ISO_CLOSURE;
}

function normalizeIncidentStatus(status) {
  if (status === LEGACY_STATUS_PENDING_ISO_CLOSURE) return STATUS_PENDING_IRT_CLOSURE;
  return status;
}

module.exports = {
  IRT_ROLE,
  LEGACY_IRT_ROLE,
  STATUS_PENDING_IRT_CLOSURE,
  LEGACY_STATUS_PENDING_ISO_CLOSURE,
  PENDING_CLOSURE_STATUSES,
  hasIRTRole,
  isPendingIRTClosure,
  normalizeIncidentStatus,
};
