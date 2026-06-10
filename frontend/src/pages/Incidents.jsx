// frontend/src/pages/Incidents.jsx
/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { getVisibleIncidents, isRejectedIncident, exportToExcel, formatDate, reporterEmailFromIncident, ownerEmailFromIncident } from '../utils';
import { hasIRTRole, INCIDENT_STATUSES, SEVERITY_OPTIONS, VALIDATION_FILTER_OPTIONS } from '../constants';
import { StatusBadge, SeverityBadge, Button, EmptyState, Spinner, UserIdentity } from '../components/ui';
import { Search, FileDown } from 'lucide-react';

export default function Incidents() {
  const { state, loadIncidents } = useApp();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const isIRT = hasIRTRole(user);

  useEffect(() => { loadIncidents(); }, []);

  const all = getVisibleIncidents(state.incidents, user);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterValidation, setFilterValidation] = useState('');
  const [sortField, setSortField]     = useState('updatedAt');
  const [sortDir, setSortDir]         = useState('desc');

  const filtered = useMemo(() => all
    .filter(inc => {
      const q = search.toLowerCase();
      if (q && !inc.incidentId.toLowerCase().includes(q) && !inc.description.toLowerCase().includes(q) && !inc.reportedByName.toLowerCase().includes(q)) return false;
      if (filterStatus === 'Rejected') {
        if (!isRejectedIncident(inc)) return false;
      } else if (filterStatus === 'Pending IRT Closure') {
        if (inc.status !== 'Pending IRT Closure' && inc.status !== 'Pending ISO Closure') return false;
      } else if (filterStatus && inc.status !== filterStatus) return false;
      if (filterSeverity && inc.severity !== filterSeverity) return false;
      if (filterValidation === 'Valid' && inc.validationStatus !== 'Valid') return false;
      if (filterValidation === 'Invalid' && inc.validationStatus !== 'Invalid') return false;
      return true;
    })
    .sort((a,b) => {
      const va = a[sortField]||'', vb = b[sortField]||'';
      return sortDir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }), [all, search, filterStatus, filterSeverity, filterValidation, sortField, sortDir]);

  const handleSort = (f) => { if (sortField===f) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('desc'); } };

  const sel = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text-secondary)', fontSize:13, cursor:'pointer', outline:'none' };
  const col = (f) => ({ cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center', gap:4, color: sortField===f?'var(--accent-blue)':'var(--text-muted)', fontSize:12, fontWeight:600, letterSpacing:'0.05em' });

  return (
    <div className="animate-fade-up scroll-page">
      <div className="scroll-page__header">
        <div className="scroll-page__title-row">
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em' }}>Incidents</h1>
            <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:2 }}>{filtered.length} of {all.length} incident{all.length!==1?'s':''}</p>
          </div>
          {isIRT && (
            <Button variant="secondary" onClick={() => exportToExcel(all, state.users)} icon={<FileDown size={15} />}>Export Excel</Button>
          )}
        </div>

        <div className="scroll-page__filters">
          <div style={{ flex:'1 1 200px', position:'relative' }}>
            <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search incidents…" style={{ ...sel, paddingLeft:32, width:'100%' }} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={sel}>
            <option value="">All statuses</option>
            {INCIDENT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={sel}>
            <option value="">All severities</option>
            {SEVERITY_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterValidation} onChange={e => setFilterValidation(e.target.value)} style={sel}>
            <option value="">All validation</option>
            {VALIDATION_FILTER_OPTIONS.map(v => <option key={v}>{v}</option>)}
          </select>
          {(search||filterStatus||filterSeverity||filterValidation) && (
            <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterSeverity(''); setFilterValidation(''); }} style={{ ...sel, color:'var(--accent-rose)', borderColor:'var(--ms-danger)' }}>Clear</button>
          )}
        </div>
      </div>

      <div className="scroll-page__body">
        {state.loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:64 }}><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="📋" title="No incidents found" message="Adjust your search or filters." />
        ) : (
          <div className="data-table">
            <div className="data-table__head">
              {[['incidentId','ID'],['description','Description'],['reportedByName','Reporter'],['ownerName','Owner'],['severity','Severity'],['status','Status'],['incidentDate','Date'],['updatedAt','Updated']].map(([f,l]) => (
                <div key={f} style={col(f)} onClick={() => handleSort(f)}>{l} {sortField===f && <span style={{ fontSize:10 }}>{sortDir==='asc'?'↑':'↓'}</span>}</div>
              ))}
            </div>
            {filtered.map(inc => (
              <div key={inc.id} className="data-table__row" onClick={() => navigate(`/incidents/${inc.id}`)}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent-blue)' }}>{inc.incidentId}</span>
                <span style={{ fontSize:13, paddingRight:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.description}</span>
                <UserIdentity
                  email={reporterEmailFromIncident(inc, state.users)}
                  name={inc.reportedByName}
                  size={24}
                />
                {inc.ownerName || inc.ownerEmail ? (
                  <UserIdentity
                    email={ownerEmailFromIncident(inc, state.users)}
                    name={inc.ownerName}
                    size={24}
                  />
                ) : (
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>—</span>
                )}
                <SeverityBadge severity={inc.severity} />
                <StatusBadge status={inc.status} />
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{formatDate(inc.incidentDate)}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{formatDate(inc.updatedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
