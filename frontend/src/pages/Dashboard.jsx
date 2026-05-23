// frontend/src/pages/Dashboard.jsx
/* eslint-disable */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { getVisibleIncidents, formatDateTime } from '../utils';
import { StatusBadge, SeverityBadge, Card, Spinner } from '../components/ui';
import { FilePlus, AlertCircle, CheckCircle2, Clock, XCircle, TrendingUp } from 'lucide-react';

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:20, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>{label}</span>
        <div style={{ width:36, height:36, borderRadius:10, background:`${color}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div style={{ fontSize:32, fontWeight:700, color:'var(--text-primary)', lineHeight:1 }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { state, loadIncidents } = useApp();
  const user = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => { loadIncidents(); }, []);

  const incidents = getVisibleIncidents(state.incidents, user);
  const stats = {
    total:     incidents.length,
    submitted: incidents.filter(i => i.status === 'Submitted').length,
    assigned:  incidents.filter(i => i.status === 'Assigned').length,
    pending:   incidents.filter(i => ['Pending ISO Closure','Pending Admin Approval','Admin Approved'].includes(i.status)).length,
    overdue:   incidents.filter(i => i.status === 'Overdue').length,
    closed:    incidents.filter(i => i.status === 'Closed').length,
    rejected:  incidents.filter(i => i.status === 'Rejected').length,
  };
  const recent = [...incidents].sort((a,b) => b.updatedAt?.localeCompare(a.updatedAt)).slice(0,5);
  const isISO = user?.role === 'iso';
  const myAssigned = incidents.filter(i => i.ownerId === user?.id && i.status === 'Assigned');

  return (
    <div className="animate-fade-up">
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.03em', marginBottom:4 }}>
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>
          {isISO ? 'ISO Team Dashboard – manage and review all incidents' : 'Your incident overview and updates'}
        </p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:32 }}>
        <StatCard label="Total"     value={stats.total}     icon={TrendingUp}  color="#3b82f6" />
        <StatCard label="Submitted" value={stats.submitted}  icon={AlertCircle} color="#3b82f6" />
        <StatCard label="Assigned"  value={stats.assigned}   icon={Clock}       color="#8b5cf6" />
        <StatCard label="Pending"   value={stats.pending}    icon={Clock}       color="#f59e0b" />
        <StatCard label="Overdue"   value={stats.overdue}    icon={AlertCircle} color="#ef4444" />
        <StatCard label="Closed"    value={stats.closed}     icon={CheckCircle2} color="#10b981" />
        <StatCard label="Rejected"  value={stats.rejected}   icon={XCircle}     color="#ef4444" />
      </div>

      {!isISO && (
        <Card style={{ marginBottom:28, background:'linear-gradient(135deg,rgba(59,130,246,.12),rgba(99,102,241,.08))', border:'1px solid rgba(59,130,246,.2)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div>
              <h3 style={{ fontWeight:600, marginBottom:4 }}>Need to report an incident?</h3>
              <p style={{ fontSize:13, color:'var(--text-secondary)' }}>Submit a new incident for ISO Team review.</p>
            </div>
            <button onClick={() => navigate('/report')} style={{ display:'flex', alignItems:'center', gap:8, background:'var(--accent-blue)', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              <FilePlus size={16} /> Report Incident
            </button>
          </div>
        </Card>
      )}

      {!isISO && myAssigned.length > 0 && (
        <div style={{ marginBottom:28 }}>
          <h2 style={{ fontSize:16, fontWeight:600, marginBottom:14 }}>🎯 Assigned to You ({myAssigned.length})</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {myAssigned.map(inc => (
              <div key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
                style={{ background:'rgba(139,92,246,.08)', border:'1px solid rgba(139,92,246,.2)', borderRadius:'var(--radius-md)', padding:'14px 18px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(139,92,246,.14)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(139,92,246,.08)'}
              >
                <div>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'#a78bfa' }}>{inc.incidentId}</span>
                  <p style={{ fontSize:14, color:'var(--text-primary)', marginTop:2 }}>{inc.description.slice(0,80)}{inc.description.length>80?'…':''}</p>
                </div>
                <SeverityBadge severity={inc.severity} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:16, fontWeight:600 }}>Recent Activity</h2>
          <button onClick={() => navigate('/incidents')} style={{ background:'none', border:'none', fontSize:13, color:'var(--accent-blue)', cursor:'pointer' }}>View all →</button>
        </div>

        {state.loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}><Spinner size={28} /></div>
        ) : recent.length === 0 ? (
          <Card><div style={{ textAlign:'center', padding:32, color:'var(--text-muted)' }}><div style={{ fontSize:32, marginBottom:8 }}>📋</div><div>No incidents yet</div></div></Card>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {recent.map(inc => (
              <div key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
                style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap', padding:'14px 18px', borderRadius:'var(--radius-md)', background:'var(--bg-card)', border:'1px solid var(--border)', cursor:'pointer', transition:'all var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                onMouseLeave={e => e.currentTarget.style.background='var(--bg-card)'}
              >
                <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--text-muted)', width:90 }}>{inc.incidentId}</span>
                <span style={{ flex:1, fontSize:14, color:'var(--text-primary)', minWidth:160 }}>{inc.description.slice(0,60)}{inc.description.length>60?'…':''}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{inc.reportedByName}</span>
                <SeverityBadge severity={inc.severity} />
                <StatusBadge status={inc.status} />
                <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDateTime(inc.updatedAt).slice(0,16)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
