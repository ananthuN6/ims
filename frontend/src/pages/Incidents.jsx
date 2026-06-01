// frontend/src/pages/Incidents.jsx
/* eslint-disable */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { getVisibleIncidents, isRejectedIncident, exportToExcel, formatDate } from '../utils';
import { hasIRTRole, INCIDENT_STATUSES } from '../constants';
import { StatusBadge, SeverityBadge, Button, EmptyState, Spinner } from '../components/ui';
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
      return true;
    })
    .sort((a,b) => {
      const va = a[sortField]||'', vb = b[sortField]||'';
      return sortDir==='asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }), [all, search, filterStatus, filterSeverity, sortField, sortDir]);

  const handleSort = (f) => { if (sortField===f) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortField(f); setSortDir('desc'); } };

  const sel = { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', color:'var(--text-secondary)', fontSize:13, cursor:'pointer', outline:'none' };
  const col = (f) => ({ cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center', gap:4, color: sortField===f?'var(--accent-blue)':'var(--text-muted)', fontSize:12, fontWeight:600, letterSpacing:'0.05em' });

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em' }}>Incidents</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:2 }}>{filtered.length} of {all.length} incident{all.length!==1?'s':''}</p>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:20, padding:14, background:'var(--bg-card)', borderRadius:'var(--radius-md)', border:'1px solid var(--border)' }}>
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
          {['High','Medium','Low'].map(s => <option key={s}>{s}</option>)}
        </select>
        {(search||filterStatus||filterSeverity) && <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterSeverity(''); }} style={{ ...sel, color:'var(--accent-rose)', borderColor:'rgba(244,63,94,.3)' }}>Clear</button>}
      </div>

      {state.loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:64 }}><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title="No incidents found" message="Adjust your search or filters." />
      ) : (
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'130px 1fr 140px 90px 160px 120px 120px', padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-secondary)' }}>
            {[['incidentId','ID'],['description','Description'],['reportedByName','Reporter'],['severity','Severity'],['status','Status'],['incidentDate','Date'],['updatedAt','Updated']].map(([f,l]) => (
              <div key={f} style={col(f)} onClick={() => handleSort(f)}>{l} {sortField===f && <span style={{ fontSize:10 }}>{sortDir==='asc'?'↑':'↓'}</span>}</div>
            ))}
          </div>
          {filtered.map(inc => (
            <div key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
              style={{ display:'grid', gridTemplateColumns:'130px 1fr 140px 90px 160px 120px 120px', padding:'14px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background var(--transition)', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}
            >
              <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent-blue)' }}>{inc.incidentId}</span>
              <span style={{ fontSize:13, paddingRight:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inc.description}</span>
              <span style={{ fontSize:13, color:'var(--text-secondary)' }}>{inc.reportedByName}</span>
              <SeverityBadge severity={inc.severity} />
              <StatusBadge status={inc.status} />
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{formatDate(inc.incidentDate)}</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{formatDate(inc.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}

      {isIRT && (
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:20, paddingTop:20, borderTop:'1px solid var(--border)' }}>
          <Button variant="secondary" onClick={() => exportToExcel(all, state.users)} icon={<FileDown size={15} />}>Export Excel</Button>
        </div>
      )}
    </div>
  );
}
