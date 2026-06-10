// frontend/src/pages/Dashboard.jsx
/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { getVisibleIncidents, isRejectedIncident, formatDateTime, reporterEmailFromIncident, ownerEmailFromIncident } from '../utils';
import { hasIRTRole, PENDING_DASHBOARD_STATUSES, isPastTargetDate } from '../constants';
import { StatusBadge, SeverityBadge, Card, Spinner, UserAvatar, UserIdentity } from '../components/ui';
import { FilePlus, AlertCircle, CheckCircle2, Clock, XCircle, TrendingUp, CalendarClock, ChevronDown, ChevronUp } from 'lucide-react';

function CollapsibleListSection({ title, count, open, onToggle, collapsible, children }) {
  return (
    <div style={{ marginBottom:28 }}>
      <button
        type="button"
        onClick={collapsible ? onToggle : undefined}
        style={{
          display:'flex', alignItems:'center', gap:8, width:'100%', marginBottom: open ? 14 : 0,
          background:'none', border:'none', padding:0, textAlign:'left',
          cursor: collapsible ? 'pointer' : 'default', color:'var(--text-primary)',
        }}
      >
        <h2 style={{ fontSize:16, fontWeight:600, margin:0 }}>{title} ({count})</h2>
        {collapsible && (open ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />)}
      </button>
      {open && children}
    </div>
  );
}

function DashboardPanel({ title, icon: Icon, iconColor, count, headerExtra, children }) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__head">
        <h2 className="dashboard-panel__title">
          {Icon && <Icon size={18} color={iconColor} />}
          {title}
          <span style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)' }}>({count})</span>
        </h2>
        {headerExtra}
      </div>
      <div className="dashboard-panel__body">{children}</div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconColor = 'var(--ms-brand)', iconBg = 'var(--ms-brand-subtle)' }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:20, display:'flex', flexDirection:'column', gap:12, boxShadow:'var(--shadow-sm)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <span style={{ fontSize:13, color:'var(--text-secondary)', fontWeight:500 }}>{label}</span>
        <div style={{ width:36, height:36, borderRadius:'var(--radius-sm)', background:iconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={18} style={{ color:iconColor }} />
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
  const location = useLocation();

  const [assignedOpen, setAssignedOpen] = useState(true);

  useEffect(() => { loadIncidents(); }, [location.pathname, loadIncidents]);

  const incidents = getVisibleIncidents(state.incidents, user);
  const stats = {
    total:     incidents.length,
    submitted: incidents.filter(i => i.status === 'Submitted').length,
    assigned:  incidents.filter(i => i.status === 'Assigned').length,
    pending:   incidents.filter(i => PENDING_DASHBOARD_STATUSES.includes(i.status)).length,
    overdue:   incidents.filter(i => i.status === 'Overdue').length,
    closed:    incidents.filter(i => i.status === 'Closed').length,
    rejected:  incidents.filter(isRejectedIncident).length,
  };
  const recent = [...incidents].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const isIRT = hasIRTRole(user);

  const isOwnedByUser = (inc) => {
    const userEmail = user?.email?.toLowerCase();
    const userName = user?.name?.toLowerCase();
    const ownerEmail = inc.ownerEmail?.toLowerCase();
    const ownerName = inc.ownerName?.toLowerCase();
    return inc.ownerId === user?.id
      || (ownerEmail && userEmail === ownerEmail)
      || (!inc.ownerId && ownerName && userName === ownerName);
  };

  const myAssigned = incidents.filter(i => i.status === 'Assigned' && isOwnedByUser(i));

  const pastTargetIncidents = incidents
    .filter(i => i.targetDate && isPastTargetDate(i.targetDate) && !['Closed', 'Rejected', 'Submitted'].includes(i.status))
    .filter(i => isIRT || isOwnedByUser(i))
    .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));

  return (
    <div className="animate-fade-up dashboard-page">
      <div style={{ marginBottom:28, display:'flex', alignItems:'center', gap:14 }}>
        <UserAvatar email={user?.email} name={user?.name} size={44} />
        <div>
        <h1 style={{ fontSize:24, fontWeight:700, letterSpacing:'-0.03em', marginBottom:4 }}>
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14 }}>
          {isIRT ? 'IRT Dashboard – manage and review all incidents' : 'Your incident overview and updates'}
        </p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:16, marginBottom:32 }}>
        <StatCard label="Total"     value={stats.total}     icon={TrendingUp}  />
        <StatCard label="Submitted" value={stats.submitted}  icon={AlertCircle} />
        <StatCard label="Assigned"  value={stats.assigned}   icon={Clock}       iconColor="var(--ms-purple)" iconBg="var(--ms-purple-subtle)" />
        <StatCard label="Pending"   value={stats.pending}    icon={Clock}       iconColor="var(--ms-warning)" iconBg="var(--ms-warning-subtle)" />
        <StatCard label="Overdue"   value={stats.overdue}    icon={AlertCircle} iconColor="var(--ms-danger)" iconBg="var(--ms-danger-subtle)" />
        <StatCard label="Closed"    value={stats.closed}     icon={CheckCircle2} iconColor="var(--ms-success)" iconBg="var(--ms-success-subtle)" />
        <StatCard label="Rejected"  value={stats.rejected}   icon={XCircle}     iconColor="var(--ms-danger)" iconBg="var(--ms-danger-subtle)" />
      </div>

      {!isIRT && (
        <Card style={{ marginBottom:28, background:'var(--ms-brand-subtle)', border:'1px solid var(--ms-brand)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
            <div>
              <h3 style={{ fontWeight:600, marginBottom:4 }}>Need to report an incident?</h3>
              <p style={{ fontSize:13, color:'var(--text-secondary)' }}>Submit a new incident for IRT review.</p>
            </div>
            <button onClick={() => navigate('/report')} style={{ display:'flex', alignItems:'center', gap:8, background:'var(--ms-brand)', color:'#fff', border:'none', borderRadius:'var(--radius-sm)', padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              <FilePlus size={16} /> Report Incident
            </button>
          </div>
        </Card>
      )}

      {!isIRT && myAssigned.length > 0 && (
        <CollapsibleListSection
          title="Assigned to You"
          count={myAssigned.length}
          open={assignedOpen}
          onToggle={() => setAssignedOpen(o => !o)}
          collapsible={myAssigned.length > 1}
        >
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
        </CollapsibleListSection>
      )}

      <div className="dashboard-panels-grid">
        <DashboardPanel
          title={isIRT ? 'Past Target Date' : 'Your Past Target Dates'}
          icon={CalendarClock}
          iconColor="#f97316"
          count={pastTargetIncidents.length}
        >
          {pastTargetIncidents.length === 0 ? (
            <div className="dashboard-panel__empty">
              <CalendarClock size={28} color="var(--text-muted)" style={{ marginBottom:8, opacity:0.6 }} />
              <div>No incidents past target date</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {pastTargetIncidents.map(inc => (
                <div key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
                  style={{ background:'rgba(249,115,22,.08)', border:'1px solid rgba(249,115,22,.25)', borderRadius:'var(--radius-md)', padding:'12px 14px', cursor:'pointer', transition:'all var(--transition)' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(249,115,22,.14)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(249,115,22,.08)'}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'#fb923c' }}>{inc.incidentId}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <SeverityBadge severity={inc.severity} />
                      <StatusBadge status={inc.status} />
                    </div>
                  </div>
                  <p style={{ fontSize:13, color:'var(--text-primary)', marginTop:6, lineHeight:1.4 }}>{inc.description.slice(0,80)}{inc.description.length>80?'…':''}</p>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>Target: {inc.targetDate}</span>
                    {isOwnedByUser(inc) ? (
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>Extend on incident page</span>
                    ) : (
                      <UserIdentity
                        email={ownerEmailFromIncident(inc, state.users)}
                        name={inc.ownerName}
                        size={20}
                        style={{ marginLeft:'auto' }}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Recent Activity"
          count={recent.length}
          headerExtra={(
            <button
              type="button"
              onClick={() => navigate('/incidents')}
              style={{ background:'none', border:'none', fontSize:13, color:'var(--accent-blue)', cursor:'pointer', flexShrink:0 }}
            >
              View all →
            </button>
          )}
        >
          {state.loading ? (
            <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:200 }}><Spinner size={28} /></div>
          ) : recent.length === 0 ? (
            <div className="dashboard-panel__empty">
              <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
              <div>No incidents yet</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {recent.map(inc => (
                <div key={inc.id} onClick={() => navigate(`/incidents/${inc.id}`)}
                  style={{ padding:'12px 14px', borderRadius:'var(--radius-md)', background:'var(--bg-input)', border:'1px solid var(--border)', cursor:'pointer', transition:'background var(--transition)' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background='var(--bg-input)'}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:6 }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent-cyan)' }}>{inc.incidentId}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>{formatDateTime(inc.updatedAt).slice(0, 16)}</span>
                  </div>
                  <p style={{ fontSize:13, color:'var(--text-primary)', marginBottom:6, lineHeight:1.4 }}>{inc.description.slice(0,70)}{inc.description.length>70?'…':''}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <UserIdentity
                      email={reporterEmailFromIncident(inc, state.users)}
                      name={inc.reportedByName}
                      size={20}
                    />
                    <SeverityBadge severity={inc.severity} />
                    <StatusBadge status={inc.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
