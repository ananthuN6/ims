// IRT (Incident Response Team) – shared terminology and legacy ISO aliases

export const IRT_ROLE = 'irt';
export const LEGACY_IRT_ROLE = 'iso';

export const STATUS_PENDING_IRT_CLOSURE = 'Pending IRT Closure';
export const LEGACY_STATUS_PENDING_ISO_CLOSURE = 'Pending ISO Closure';

export const INCIDENT_STATUSES = [
  'Submitted',
  'Assigned',
  STATUS_PENDING_IRT_CLOSURE,
  'Pending Admin Approval',
  'Admin Approved',
  'Overdue',
  'Closed',
  'Rejected',
];

export const PENDING_DASHBOARD_STATUSES = [
  STATUS_PENDING_IRT_CLOSURE,
  LEGACY_STATUS_PENDING_ISO_CLOSURE,
  'Pending Admin Approval',
  'Admin Approved',
];

export function hasIRTRole(user) {
  if (!user) return false;
  return user.role === IRT_ROLE || user.role === LEGACY_IRT_ROLE || !!user.isAdmin;
}

export function isPendingIRTClosure(status) {
  return status === STATUS_PENDING_IRT_CLOSURE || status === LEGACY_STATUS_PENDING_ISO_CLOSURE;
}

export function displayStatus(status) {
  if (status === LEGACY_STATUS_PENDING_ISO_CLOSURE) return STATUS_PENDING_IRT_CLOSURE;
  if (status === 'Pending Admin Approval') return 'Pending RCA Approval';
  if (status === 'Admin Approved') return 'RCA Approved';
  return status;
}

export function displayAction(action) {
  if (action === 'Admin Approved') return 'RCA Approved';
  return action;
}

export const ROLE_LABELS = {
  [IRT_ROLE]: 'IRT',
  [LEGACY_IRT_ROLE]: 'IRT',
  employee: 'Employee',
};
