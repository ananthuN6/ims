// IRT (Incident Response Team) – shared terminology and legacy ISO aliases

export const IRT_ROLE = 'irt';
export const LEGACY_IRT_ROLE = 'iso';

export const STATUS_PENDING_IRT_CLOSURE = 'Pending IRT Closure';
export const LEGACY_STATUS_PENDING_ISO_CLOSURE = 'Pending ISO Closure';
export const STATUS_PENDING_RCA_APPROVAL = 'Pending Admin Approval';
export const STATUS_RCA_APPROVED = 'Admin Approved';
export const STATUS_PENDING_CLOSURE_APPROVAL = 'Pending Closure Approval';

export const SEVERITY_OPTIONS = ['Critical', 'High', 'Medium'];

export const VALIDATION_FILTER_OPTIONS = ['Valid', 'Invalid'];

export const INCIDENT_STATUSES = [
  'Submitted',
  'Assigned',
  STATUS_PENDING_IRT_CLOSURE,
  STATUS_PENDING_RCA_APPROVAL,
  STATUS_RCA_APPROVED,
  STATUS_PENDING_CLOSURE_APPROVAL,
  'Overdue',
  'Closed',
  'Rejected',
];

export const PENDING_DASHBOARD_STATUSES = [
  STATUS_PENDING_IRT_CLOSURE,
  LEGACY_STATUS_PENDING_ISO_CLOSURE,
  STATUS_PENDING_RCA_APPROVAL,
  STATUS_RCA_APPROVED,
  STATUS_PENDING_CLOSURE_APPROVAL,
];

/** IRT role: full incident management. System admin also has IRT powers + User Admin only. */
export function hasIRTRole(user) {
  if (!user) return false;
  return user.role === IRT_ROLE || user.role === LEGACY_IRT_ROLE || !!user.isAdmin;
}

export function isUserAdmin(user) {
  return !!user?.isAdmin;
}

export function isPendingIRTClosure(status) {
  return status === STATUS_PENDING_IRT_CLOSURE || status === LEGACY_STATUS_PENDING_ISO_CLOSURE;
}

export function isPendingRcaApproval(status) {
  return [STATUS_PENDING_RCA_APPROVAL, 'Overdue'].includes(status);
}

export function displayStatus(status) {
  if (status === LEGACY_STATUS_PENDING_ISO_CLOSURE) return STATUS_PENDING_IRT_CLOSURE;
  if (status === STATUS_PENDING_RCA_APPROVAL) return 'Pending RCA Approval';
  if (status === STATUS_RCA_APPROVED) return 'RCA Approved';
  if (status === STATUS_PENDING_CLOSURE_APPROVAL) return 'Pending Closure Approval';
  return status;
}

export function displayAction(action) {
  if (action === 'Admin Approved') return 'RCA Approved';
  if (action === 'Owner Closed') return 'Owner Closed';
  if (action === 'Closure Approved') return 'Closure Approved';
  if (action === 'Closure Rejected') return 'Closure Rejected';
  if (action === 'RCA Rejected') return 'RCA Rejected';
  if (action === 'Target Date Extended') return 'Target Date Extended';
  return action;
}

export function isPastTargetDate(targetDate) {
  if (!targetDate) return false;
  return targetDate < new Date().toISOString().slice(0, 10);
}

export function canExtendTargetDate(incident) {
  if (!incident?.targetDate || !isPastTargetDate(incident.targetDate)) return false;
  if (['Closed', 'Rejected', 'Submitted'].includes(incident.status)) return false;
  return ['Assigned', 'Overdue', 'Pending Admin Approval', STATUS_RCA_APPROVED, STATUS_PENDING_CLOSURE_APPROVAL].includes(incident.status);
}

export function hasRcaSubmitted(incident) {
  if (!incident) return false;
  return !!(incident.rca && incident.correction && incident.correctiveAction) || !!incident.responseSubmittedAt;
}

export function canOwnerClose(incident) {
  if (!incident) return false;
  return incident.status === STATUS_RCA_APPROVED;
}

export function canReviewRca(incident) {
  if (!incident) return false;
  return isPendingRcaApproval(incident.status) && hasRcaSubmitted(incident);
}

export function canReviewClosure(incident) {
  if (!incident) return false;
  return incident.status === STATUS_PENDING_CLOSURE_APPROVAL;
}

export const ROLE_LABELS = {
  [IRT_ROLE]: 'IRT',
  [LEGACY_IRT_ROLE]: 'IRT',
  employee: 'Employee',
};
