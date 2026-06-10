// frontend/src/utils/index.js
import ExcelJS from 'exceljs';
import { format, parseISO } from 'date-fns';
import { hasIRTRole } from '../constants';

export const formatDate = (d) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; } };
export const formatDateTime = (d) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy, HH:mm'); } catch { return d; } };

export const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res({ name: file.name, size: file.size, type: file.type, data: r.result });
  r.onerror = rej;
  r.readAsDataURL(file);
});

/** Microsoft brand blue (#0078d4) — Excel header */
const HEADER_FILL = 'FF0078D4';
const HEADER_FONT = 'FFFFFFFF';

const EXPORT_HEADERS = [
  'Incident ID',
  'Description',
  'Reported By',
  'Incident Date',
  'Status',
  'Severity',
  'Owner',
  'IRT Comments',
  'RCA',
  'Correction',
  'Corrective Action',
  'Target Date',
  'Lessons Learned',
  'Closed Date',
  'Review Date',
  'Closed By',
  'Created At',
  'Updated At',
];

const COLUMN_WIDTHS = [14, 40, 18, 14, 20, 10, 18, 30, 35, 35, 35, 14, 35, 14, 14, 18, 20, 20];

function incidentNumericId(incidentId) {
  const n = parseInt(String(incidentId || '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function exportCellDate(d) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return String(d); }
}

function exportCellDateTime(d) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yyyy, HH:mm'); } catch { return String(d); }
}

function styleHeaderRow(row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
}

function styleDataRow(row) {
  row.eachCell((cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    cell.font = { size: 11 };
  });
}

/** Incident register export — full columns, styled header, incident_register_YYYY-MM-DD.xlsx */
export async function exportToExcel(incidents, users = []) {
  const ownerName = (id) => users.find(u => u.id === id)?.name || '—';

  const sorted = [...incidents].sort(
    (a, b) => incidentNumericId(b.incidentId) - incidentNumericId(a.incidentId),
  );

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IMS';
  const ws = wb.addWorksheet('Incidents', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.addRow(EXPORT_HEADERS);
  styleHeaderRow(ws.getRow(1));

  sorted.forEach((i) => {
    const row = ws.addRow([
      i.incidentId || '',
      i.description || '',
      i.reportedByName || '',
      exportCellDate(i.incidentDate),
      i.status || '',
      i.severity || '—',
      i.ownerId ? ownerName(i.ownerId) : (i.ownerName || '—'),
      i.isoComments || '—',
      i.rca || '—',
      i.correction || '—',
      i.correctiveAction || '—',
      exportCellDate(i.targetDate),
      i.lessonsLearned || '—',
      exportCellDate(i.closedDate),
      exportCellDate(i.reviewDate),
      i.reviewedBy || '—',
      exportCellDateTime(i.createdAt),
      exportCellDateTime(i.updatedAt),
    ]);
    styleDataRow(row);
  });

  ws.columns = COLUMN_WIDTHS.map((wch) => ({ width: wch }));

  const fileDate = format(new Date(), 'yyyy-MM-dd');
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `incident_register_${fileDate}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export const isRejectedIncident = (inc) =>
  inc.status === 'Rejected' || inc.validationStatus === 'Invalid';

export function lookupUserEmail(users, { id, email, name } = {}) {
  if (email) return String(email).toLowerCase().trim();
  if (id && users?.length) {
    const u = users.find((x) => x.id === id);
    if (u?.email) return u.email.toLowerCase();
  }
  if (name && users?.length) {
    const normalized = String(name).toLowerCase().trim();
    const u = users.find((x) => x.name?.toLowerCase() === normalized);
    if (u?.email) return u.email.toLowerCase();
  }
  return null;
}

export function reporterEmailFromIncident(inc, users) {
  return lookupUserEmail(users, {
    id: inc.reportedBy,
    email: inc.reportedByEmail,
    name: inc.reportedByName,
  });
}

export function ownerEmailFromIncident(inc, users) {
  return lookupUserEmail(users, {
    id: inc.ownerId,
    email: inc.ownerEmail,
    name: inc.ownerName,
  });
}

export function emailFromPerson(users, { email, name } = {}) {
  return lookupUserEmail(users, { email, name });
}

export const getVisibleIncidents = (incidents, user) => {
  if (!user) return [];
  if (hasIRTRole(user)) return incidents;
  return incidents.filter(i => i.reportedBy === user.id || i.ownerId === user.id);
};
