// frontend/src/utils/index.js
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';

export const formatDate = (d) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; } };
export const formatDateTime = (d) => { if (!d) return '—'; try { return format(parseISO(d), 'dd MMM yyyy, HH:mm'); } catch { return d; } };

export const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res({ name:file.name, size:file.size, type:file.type, data:r.result });
  r.onerror = rej;
  r.readAsDataURL(file);
});

export const exportToExcel = (incidents, users) => {
  const name = (id) => users.find(u => u.id === id)?.name || '—';
  const rows = incidents.map(i => ({
    'Incident ID':        i.incidentId,
    'Description':        i.description,
    'Reported By':        i.reportedByName,
    'Incident Date':      formatDate(i.incidentDate),
    'Status':             i.status,
    'Severity':           i.severity || '—',
    'Owner':              i.ownerId ? name(i.ownerId) : (i.ownerName || '—'),
    'ISO Comments':       i.isoComments || '—',
    'RCA':                i.rca || '—',
    'Correction':         i.correction || '—',
    'Corrective Action':  i.correctiveAction || '—',
    'Target Date':        formatDate(i.targetDate),
    'Lessons Learned':    i.lessonsLearned || '—',
    'Closed Date':        formatDate(i.closedDate),
    'Review Date':        formatDate(i.reviewDate),
    'Reviewed By':        i.reviewedBy || '—',
    'Created At':         formatDateTime(i.createdAt),
    'Updated At':         formatDateTime(i.updatedAt),
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [14,40,18,14,20,10,18,30,35,35,35,14,35,14,14,18,20,20].map(w => ({ wch:w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Incidents');
  XLSX.writeFile(wb, `incidents_${format(new Date(),'yyyyMMdd_HHmm')}.xlsx`);
};

export const getVisibleIncidents = (incidents, user) => {
  if (!user) return [];
  if (user.role === 'iso') return incidents;
  return incidents.filter(i => i.reportedBy === user.id || i.ownerId === user.id);
};
