// frontend/src/utils/api.js
import { API_BASE } from '../config';

let _userEmail = null;
export function setApiUser(email) { _userEmail = email; }
export function getApiUserEmail() { return _userEmail; }

async function request(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  if (_userEmail) headers['x-user-email'] = _userEmail;

  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login:       (accessToken) => request('/auth/login', { method: 'POST', body: { accessToken } }),

  // Users (admin)
  getUsers:    ()             => request('/users'),
  syncUserPhotos: ()          => request('/users/sync-photos', { method: 'POST' }),
  getOrgUsers: ()             => request('/users/org'),
  createUser:  (u)            => request('/users',    { method: 'POST',   body: u }),
  updateUser:  (id, u)        => request(`/users/${id}`, { method: 'PUT', body: u }),
  deleteUser:  (id)           => request(`/users/${id}`, { method: 'DELETE' }),

  // Incidents
  getIncidents:  ()           => request('/incidents'),
  getNextIncidentId: ()        => request('/incidents/next-id'),
  getIncident:   (id)         => request(`/incidents/${id}`),
  createIncident:(data)       => request('/incidents', { method: 'POST', body: data }),
  validate:      (id, data)   => request(`/incidents/${id}/validate`, { method: 'PATCH', body: data }),
  submitClosure: (id, data)   => request(`/incidents/${id}/closure`,  { method: 'PATCH', body: data }),
  approveRca:      (id)         => request(`/incidents/${id}/approve-rca`,      { method: 'PATCH' }),
  rejectRca:       (id, data)   => request(`/incidents/${id}/reject-rca`,       { method: 'PATCH', body: data }),
  approveClosure:  (id)         => request(`/incidents/${id}/approve-closure`,  { method: 'PATCH' }),
  rejectClosure:   (id, data)   => request(`/incidents/${id}/reject-closure`,   { method: 'PATCH', body: data }),
  closeIncident:   (id, data)   => request(`/incidents/${id}/close`,            { method: 'PATCH', body: data }),
  extendTargetDate:(id, data)   => request(`/incidents/${id}/extend-target-date`, { method: 'PATCH', body: data }),

  // Email log
  getEmailLog:   ()           => request('/incidents/emaillog/all'),
};
