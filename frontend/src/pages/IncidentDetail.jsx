// frontend/src/pages/IncidentDetail.jsx
/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../utils/api';
import {
  hasIRTRole, displayAction, canOwnerClose, canReviewRca, canReviewClosure,
  STATUS_PENDING_CLOSURE_APPROVAL, STATUS_RCA_APPROVED,
} from '../constants';
import { formatDate, formatDateTime, fileToBase64 } from '../utils';
import { StatusBadge, SeverityBadge, FormField, Input, Textarea, Select, Button, Toast, Spinner } from '../components/ui';
import { ArrowLeft, Paperclip, X, CheckCircle, XCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react';

function InfoRow({ label, value, mono, span }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:2, gridColumn: span ? `span ${span}` : undefined }}>
      <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontSize:13, color: mono?'var(--accent-cyan)':'var(--text-primary)', fontFamily: mono?'var(--font-mono)':'inherit', whiteSpace:'pre-wrap', wordBreak:'break-word', lineHeight:1.45 }}>{value||'—'}</span>
    </div>
  );
}

function MetaChip({ label, value }) {
  return (
    <div className="incident-meta-chip">
      <span className="incident-meta-chip__label">{label}</span>
      <span className="incident-meta-chip__value">{value || '—'}</span>
    </div>
  );
}

function Panel({ title, badge, children, style, className = '' }) {
  return (
    <div className={`incident-panel ${className}`.trim()} style={style}>
      {title && (
        <div className="incident-panel__head">
          <span className="incident-panel__title">{title}</span>
          {badge}
        </div>
      )}
      <div className="incident-panel__body">{children}</div>
    </div>
  );
}

function AttachmentList({ attachments=[] }) {
  if (!attachments.length) return <span style={{ fontSize:13, color:'var(--text-muted)' }}>No attachments</span>;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
      {attachments.map((att,i) => (
        <a key={i} href={att.data} download={att.name} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.2)', borderRadius:6, padding:'5px 10px', fontSize:12, color:'#60a5fa', textDecoration:'none' }}>
          <Paperclip size={11} /> {att.name}
        </a>
      ))}
    </div>
  );
}

function WorkflowBar({ incident }) {
  const steps = [
    { id: 'report', label: 'Reported' },
    { id: 'validate', label: 'Validated' },
    { id: 'rca', label: 'RCA Review' },
    { id: 'rcaOk', label: 'RCA Approved' },
    { id: 'closed', label: 'Closed' },
  ];
  const s = incident.status;
  let active = 0;
  if (s === 'Rejected') active = -1;
  else if (s === 'Submitted') active = 0;
  else if (s === 'Assigned' || s === 'Overdue') active = incident.rca || incident.responseSubmittedAt ? 2 : 1;
  else if (s === 'Pending Admin Approval') active = 2;
  else if (s === STATUS_RCA_APPROVED) active = 3;
  else if (s === STATUS_PENDING_CLOSURE_APPROVAL) active = 4;
  else if (s === 'Closed') active = 5;

  if (s === 'Rejected') {
    return (
      <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(244,63,94,.1)', border:'1px solid rgba(244,63,94,.3)', fontSize:13, color:'#fb7185' }}>
        Incident rejected at validation
      </div>
    );
  }

  return (
    <div className="incident-workflow-bar">
      {steps.map((step, i) => {
        const done = active > i || (active === 5 && i < 5);
        const isActive = active === i || (active === 4 && i === 3) || (active === 5 && i === 4);
        return (
          <div
            key={step.id}
            className={`incident-workflow-step${done ? ' incident-workflow-step--done' : ''}${isActive ? ' incident-workflow-step--active' : ''}`}
          >
            {step.label}
          </div>
        );
      })}
    </div>
  );
}

function SidebarCard({ title, children, style }) {
  return (
    <div className="incident-sidebar-card" style={style}>
      {title && <h4>{title}</h4>}
      {children}
    </div>
  );
}

function CollapsibleSection({ title, subtitle, open, onToggle, children, style, headerExtra, accent }) {
  return (
    <div className={`incident-panel incident-collapsible${accent ? ' incident-panel--accent' : ''}`} style={style}>
      <button type="button" onClick={onToggle} className="incident-panel__head" style={{ width:'100%', border:'none', margin:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
          {headerExtra}
          <span className="incident-panel__title">{title}</span>
          {subtitle != null && subtitle !== '' && (
            <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:500, textTransform:'none', letterSpacing:0 }}>{subtitle}</span>
          )}
        </div>
        {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>
      {open && <div className="incident-panel__body">{children}</div>}
    </div>
  );
}

export default function IncidentDetail() {
  const { id } = useParams();
  const { state, dispatch, loadIncidents, loadUsers } = useApp();
  const user = useCurrentUser();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(() => state.incidents.find(i => i.id === id) || null);
  const [loading, setLoading]   = useState(!incident);
  const [toast, setToast]       = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [orgUsers, setOrgUsers] = useState([]);

  // IRT Validation form
  const [isoForm, setIsoForm] = useState({ validationStatus:'', severity:'', ownerEmail:'', ownerName:'', isoComments:'' });
  const [ownerSearch, setOwnerSearch] = useState('');
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false);

  // Owner closure form
  const [ownerForm, setOwnerForm] = useState({ rca:'', correction:'', correctiveAction:'', targetDate:'' });
  const [closureAtts, setClosureAtts] = useState([]);

  // IRT final closure form
  const [closeForm, setCloseForm] = useState({ closedDate:new Date().toISOString().slice(0,10), reviewDate:'', reviewedBy: user?.name||'', lessonsLearned:'' });
  const [rejectComment, setRejectComment] = useState('');
  const [rejectMode, setRejectMode] = useState(null); // 'rca' | 'closure'
  const [openSections, setOpenSections] = useState({
    details: true,
    history: false,
    validationDone: false,
    validationForm: true,
    ownerRca: true,
    finalClose: true,
    closed: false,
    irtActions: false,
    pendingClosure: false,
  });

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  useEffect(() => {
    if (rejectMode) setOpenSections(s => ({ ...s, irtActions: true }));
  }, [rejectMode]);

  useEffect(() => {
    if (!incident) {
      api.getIncident(id)
        .then(data => { setIncident(data); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [id]);

  // Load users and org users on mount
  useEffect(() => {
    loadUsers();
    api.getOrgUsers().then(setOrgUsers).catch(() => {});
  }, [loadUsers]);

  // Pre-fill forms when incident loads
  useEffect(() => {
    if (!incident) return;
    setIsoForm({ validationStatus: incident.validationStatus||'', severity: incident.severity||'', ownerEmail:'', ownerName:'', isoComments: incident.isoComments||'' });
    setOwnerForm({ rca: incident.rca||'', correction: incident.correction||'', correctiveAction: incident.correctiveAction||'', targetDate: incident.targetDate||'' });
    setCloseForm(f => ({ ...f, closedDate: incident.closedDate||f.closedDate, reviewDate: incident.reviewDate||f.reviewDate, reviewedBy: incident.reviewedBy||f.reviewedBy, lessonsLearned: incident.lessonsLearned||'' }));
    const isSubmitted = incident.status === 'Submitted';
    const needsOwnerRca = ['Assigned', 'Overdue'].includes(incident.status);
    const needsFinalClose = canOwnerClose(incident);
    const needsIrtActions = canReviewRca(incident) || canReviewClosure(incident);
    setOpenSections({
      details: true,
      history: false,
      validationDone: false,
      validationForm: isSubmitted,
      ownerRca: needsOwnerRca,
      finalClose: needsFinalClose,
      closed: incident.status === 'Closed',
      irtActions: needsIrtActions,
      pendingClosure: incident.status === STATUS_PENDING_CLOSURE_APPROVAL,
    });
  }, [incident?.id, incident?.status]);

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:80 }}><Spinner size={32} /></div>;
  if (!incident) return <div style={{ textAlign:'center', padding:80, color:'var(--text-muted)' }}>Incident not found</div>;

  const isIRT   = hasIRTRole(user);
  const normalizedUserEmail = user?.email?.toLowerCase();
  const normalizedUserName  = user?.name?.toLowerCase();
  const ownerEmail = incident.ownerEmail?.toLowerCase();
  const ownerName  = incident.ownerName?.toLowerCase();
  const isOwner = user?.id === incident.ownerId
    || (ownerEmail && normalizedUserEmail === ownerEmail)
    || (!incident.ownerId && ownerName && normalizedUserName === ownerName);
  const allUsers = state.users;
  const owner = allUsers.find(u => u.id === incident.ownerId)
    || allUsers.find(u => ownerEmail && u.email.toLowerCase() === ownerEmail)
    || allUsers.find(u => ownerName && u.name.toLowerCase() === ownerName);
  const rawOwnerOptions = orgUsers.length ? orgUsers : allUsers.map(u => ({ id: u.id, displayName: u.name, email: u.email }));
  const ownerMap = new Map();
  rawOwnerOptions.forEach(u => {
    const email = (u.email || '').toLowerCase();
    if (!email) return;
    if (!ownerMap.has(email)) ownerMap.set(email, { ...u, email });
  });
  const ownerOptions = Array.from(ownerMap.values());

  const ownerSearchTokens = ownerSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visibleOwnerOptions = ownerOptions.filter(u => {
    if (!ownerSearchTokens.length) return true;
    const text = `${u.displayName || ''} ${u.email || ''}`.toLowerCase();
    return ownerSearchTokens.every(token => text.includes(token));
  });

  const showIRTValidate   = isIRT && incident.status === 'Submitted';
  const showOwnerClosure  = (isOwner || isIRT) && ['Assigned','Overdue'].includes(incident.status);
  const showOwnerClose       = isOwner && canOwnerClose(incident);
  const showFinalClose       = showOwnerClose;
  const showRcaReview        = isIRT && canReviewRca(incident);
  const showClosureReview    = isIRT && canReviewClosure(incident);
  const showPendingClosure   = incident.status === STATUS_PENDING_CLOSURE_APPROVAL && incident.closedDate;
  const showIrtActions       = showRcaReview || showClosureReview;
  const showValidationFacts  = incident.validationStatus && !showIRTValidate;
  const showRcaFacts         = incident.rca && !showOwnerClosure;
  const showOverviewFacts    = showValidationFacts || showRcaFacts || showPendingClosure
    || (incident.status === 'Closed' && incident.closedDate);

  const refresh = async () => {
    const data = await api.getIncident(id);
    setIncident(data);
    dispatch({ type:'UPSERT_INCIDENT', incident:data });
  };

  const handleValidate = async () => {
    if (!isoForm.validationStatus) { setToast({ message:'Select validation status', type:'error' }); return; }
    if (isoForm.validationStatus==='Valid' && (!isoForm.severity || !isoForm.ownerEmail)) { setToast({ message:'Severity and owner required for valid incidents', type:'error' }); return; }
    setSubmitting(true);
    try {
      await api.validate(id, {
        validationStatus: isoForm.validationStatus,
        severity: isoForm.severity,
        ownerEmail: isoForm.ownerEmail,
        ownerName: isoForm.ownerName,
        isoComments: isoForm.isoComments,
      });
      dispatch({ type:'ADD_NOTIF', message:`Incident ${incident.incidentId} ${isoForm.validationStatus==='Valid'?'validated & assigned':'rejected'}` });
      setToast({ message: isoForm.validationStatus==='Valid' ? 'Incident validated and owner notified by email!' : 'Incident rejected. Reporter notified by email.', type: isoForm.validationStatus==='Valid'?'success':'info' });
      await refresh();
    } catch(e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    if (!ownerForm.rca||!ownerForm.correction||!ownerForm.correctiveAction||!ownerForm.targetDate) {
      setToast({ message:'RCA, Correction, Corrective Action, and Target Date are required', type:'error' });
      return;
    }
    setSubmitting(true);
    try {
      await api.submitClosure(id, { ...ownerForm, closureAttachments: closureAtts });
      dispatch({ type:'ADD_NOTIF', message:`RCA submitted for ${incident.incidentId}` });
      setToast({ message:'RCA submitted! IRT notified by email.', type:'success' });
      await refresh();
    } catch(e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleFinalClose = async () => {
    if (!closeForm.closedDate) { setToast({ message:'Closed Date is required', type:'error' }); return; }

    const payload = {
      closedDate: closeForm.closedDate,
      lessonsLearned: closeForm.lessonsLearned || '',
    };

    payload.reviewDate = closeForm.reviewDate || closeForm.closedDate;
    payload.reviewedBy = closeForm.reviewedBy || user?.name || '';

    setSubmitting(true);
    try {
      await api.closeIncident(id, payload);
      dispatch({ type:'ADD_NOTIF', message:`Incident ${incident.incidentId} closed` });
      setToast({ message:'Closure submitted. IRT will approve or reject the closure.', type:'success' });
      await refresh();
    } catch(e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) { setToast({ message:'Rejection reason is required', type:'error' }); return; }
    setSubmitting(true);
    try {
      if (rejectMode === 'rca') {
        await api.rejectRca(id, { comment: rejectComment.trim() });
        dispatch({ type:'ADD_NOTIF', message:`RCA rejected for ${incident.incidentId}` });
        setToast({ message:'RCA rejected. Owner notified to revise and resubmit.', type:'info' });
      } else if (rejectMode === 'closure') {
        await api.rejectClosure(id, { comment: rejectComment.trim() });
        dispatch({ type:'ADD_NOTIF', message:`Closure rejected for ${incident.incidentId}` });
        setToast({ message:'Closure rejected. Owner may update and close again.', type:'info' });
      }
      setRejectComment('');
      setRejectMode(null);
      await refresh();
    } catch (e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleApproveRca = async () => {
    setSubmitting(true);
    try {
      await api.approveRca(id);
      dispatch({ type:'ADD_NOTIF', message:`RCA approved for ${incident.incidentId}` });
      setToast({ message:'RCA approved. Owner may now close the incident.', type:'success' });
      await refresh();
    } catch (e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleApproveClosure = async () => {
    setSubmitting(true);
    try {
      await api.approveClosure(id);
      dispatch({ type:'ADD_NOTIF', message:`Incident ${incident.incidentId} closed` });
      setToast({ message:'Closure approved. Incident flow is complete.', type:'success' });
      await refresh();
    } catch (e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const addClosureFile = async (e) => {
    const converted = await Promise.all(Array.from(e.target.files).map(fileToBase64));
    setClosureAtts(prev => [...prev, ...converted]);
  };

  return (
    <div className="animate-fade-up incident-detail-page">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <button onClick={() => navigate('/incidents')} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:14, marginBottom:16, padding:0 }}>
        <ArrowLeft size={16} /> Back to Incidents
      </button>

      <header className="incident-detail-header">
        <div className="incident-header-row">
          <span className="incident-header-id">{incident.incidentId}</span>
          <StatusBadge status={incident.status} />
          {incident.severity && <SeverityBadge severity={incident.severity} />}
        </div>
        <div className="incident-meta-chips">
          <MetaChip label="Reported by" value={incident.reportedByName} />
          <MetaChip label="Owner" value={owner?.name || incident.ownerName} />
          <MetaChip label="Incident date" value={formatDate(incident.incidentDate)} />
          <MetaChip label="Updated" value={formatDateTime(incident.updatedAt).slice(0, 16)} />
        </div>
      </header>

      <div className="incident-detail-layout">
        <div className="incident-detail-main">

      <Panel title="Overview">
        <div className={`incident-overview-grid${showOverviewFacts ? '' : ' incident-overview-grid--solo'}`}>
          <div>
            <div className="incident-field-label">Description</div>
            <div className="incident-desc-inline">{incident.description}</div>
            {incident.attachments?.length > 0 && (
              <div style={{ marginTop:10 }}>
                <div className="incident-field-label">Attachments</div>
                <AttachmentList attachments={incident.attachments} />
              </div>
            )}
          </div>
          <div className="incident-facts-stack">
            {showValidationFacts && (
              <div className={`incident-subpanel${incident.validationStatus === 'Valid' ? ' incident-subpanel--valid' : ''}`}>
                <div className="incident-subpanel__head">
                  <span className="incident-subpanel__title">IRT validation</span>
                  {incident.validationStatus === 'Valid'
                    ? <CheckCircle size={14} color="var(--accent-emerald)" />
                    : <XCircle size={14} color="var(--accent-rose)" />}
                </div>
                <div className="incident-info-grid">
                  <InfoRow label="Result" value={incident.validationStatus} />
                  <InfoRow label="Severity" value={incident.severity} />
                  <InfoRow label="IRT comments" value={incident.isoComments} span={2} />
                </div>
              </div>
            )}
            {showRcaFacts && (
              <div className="incident-subpanel">
                <div className="incident-subpanel__head">
                  <span className="incident-subpanel__title">Owner RCA</span>
                  <Lock size={12} color="var(--text-muted)" />
                </div>
                <div className="incident-info-grid">
                  <InfoRow label="RCA" value={incident.rca} span={2} />
                  <InfoRow label="Correction" value={incident.correction} />
                  <InfoRow label="Corrective action" value={incident.correctiveAction} />
                  <InfoRow label="Target date" value={formatDate(incident.targetDate)} />
                </div>
                {incident.closureAttachments?.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <AttachmentList attachments={incident.closureAttachments} />
                  </div>
                )}
              </div>
            )}
            {showPendingClosure && (
              <div className="incident-subpanel incident-subpanel--warn">
                <div className="incident-subpanel__head">
                  <span className="incident-subpanel__title">Closure pending approval</span>
                </div>
                <div className="incident-info-grid">
                  <InfoRow label="Closed" value={formatDate(incident.closedDate)} />
                  <InfoRow label="Closed by" value={incident.reviewedBy} />
                  <InfoRow label="Lessons" value={incident.lessonsLearned} span={2} />
                </div>
              </div>
            )}
            {incident.status === 'Closed' && incident.closedDate && (
              <div className="incident-subpanel incident-subpanel--valid">
                <div className="incident-subpanel__head">
                  <span className="incident-subpanel__title">Incident closed</span>
                  <CheckCircle size={14} color="#10b981" />
                </div>
                <div className="incident-info-grid">
                  <InfoRow label="Closed" value={formatDate(incident.closedDate)} />
                  <InfoRow label="Closed by" value={incident.reviewedBy} />
                  <InfoRow label="Lessons" value={incident.lessonsLearned} span={2} />
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <div className="incident-forms-split">
      {showIRTValidate && (
        <CollapsibleSection
          title="IRT validation — action required"
          open={openSections.validationForm}
          onToggle={() => toggleSection('validationForm')}
          accent
        >
          <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'0 0 12px' }}>Mark valid or invalid and assign an owner.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div className="incident-form-grid-2">
              <FormField label="Validation Status" required>
                <Select value={isoForm.validationStatus} onChange={e => setIsoForm(f => ({ ...f, validationStatus:e.target.value }))}>
                  <option value="">Select…</option>
                  <option>Valid</option>
                  <option>Invalid</option>
                </Select>
              </FormField>
              <FormField label="Severity" required={isoForm.validationStatus==='Valid'}>
                <Select value={isoForm.severity} onChange={e => setIsoForm(f => ({ ...f, severity:e.target.value }))}>
                  <option value="">Select…</option>
                  <option>High</option><option>Medium</option><option>Low</option>
                </Select>
              </FormField>
            </div>
            {isoForm.validationStatus==='Valid' && (
              <FormField label="Assign Owner" required>
                <div style={{ position:'relative' }}>
                  <Input
                    value={ownerSearch}
                    onChange={e => {
                      const value = e.target.value;
                      const match = ownerOptions.find(u => {
                        const normalized = value.trim().toLowerCase();
                        return u.email.toLowerCase() === normalized || u.displayName.toLowerCase() === normalized || `${u.displayName} (${u.email})`.toLowerCase() === normalized;
                      });
                      setOwnerSearch(value);
                      setIsoForm(f => ({
                        ...f,
                        ownerEmail: match?.email || '',
                        ownerName: match?.displayName || match?.email || '',
                      }));
                      setOwnerDropdownOpen(true);
                    }}
                    onFocus={() => setOwnerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setOwnerDropdownOpen(false), 150)}
                    placeholder="Type to search owners or open list…"
                    style={{ paddingRight:24 }}
                  />
                  <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-muted)', fontSize:12 }}>▾</div>
                  {ownerDropdownOpen && visibleOwnerOptions.length > 0 && (
                    <div style={{ position:'absolute', zIndex:20, top:'100%', left:0, right:0, maxHeight:220, overflowY:'auto', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginTop:6, boxShadow:'0 18px 45px rgba(15,23,42,.12)' }}>
                      {visibleOwnerOptions.map(u => (
                        <button
                          key={u.id || u.email}
                          type="button"
                          onMouseDown={() => {
                            setOwnerSearch(`${u.displayName} (${u.email})`);
                            setIsoForm(f => ({ ...f, ownerEmail: u.email, ownerName: u.displayName }));
                            setOwnerDropdownOpen(false);
                          }}
                          style={{
                            width:'100%', textAlign:'left', padding:'10px 12px', background:'transparent', border:'none', cursor:'pointer', color:'var(--text-primary)', fontSize:14,
                          }}
                        >
                          <div style={{ fontWeight:500 }}>{u.displayName}</div>
                          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{u.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </FormField>
            )}
            <FormField label="IRT Comments">
              <Textarea rows={3} value={isoForm.isoComments} onChange={e => setIsoForm(f => ({ ...f, isoComments:e.target.value }))} placeholder="Add notes or comments…" />
            </FormField>
            <div>
              <Button onClick={handleValidate} disabled={submitting} variant={isoForm.validationStatus==='Invalid'?'danger':'primary'}>
                {submitting ? 'Saving…' : isoForm.validationStatus==='Invalid' ? 'Reject Incident' : 'Validate & Assign'}
              </Button>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {showOwnerClosure && (
        <CollapsibleSection
          title="Owner RCA — submit"
          open={openSections.ownerRca}
          onToggle={() => toggleSection('ownerRca')}
          accent
        >
          {showOwnerClosure ? (
            <form onSubmit={handleOwnerSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <FormField label="Root Cause Analysis (RCA)" required>
                <Textarea rows={4} value={ownerForm.rca} onChange={e => setOwnerForm(f => ({ ...f, rca:e.target.value }))} placeholder="Describe the root cause…" />
              </FormField>
              <div className="incident-form-grid-2">
                <FormField label="Correction" required>
                  <Textarea rows={3} value={ownerForm.correction} onChange={e => setOwnerForm(f => ({ ...f, correction:e.target.value }))} placeholder="Immediate corrective action taken…" />
                </FormField>
                <FormField label="Corrective Action" required>
                  <Textarea rows={3} value={ownerForm.correctiveAction} onChange={e => setOwnerForm(f => ({ ...f, correctiveAction:e.target.value }))} placeholder="Long-term corrective measures…" />
                </FormField>
              </div>
              <div className="incident-form-grid-3">
              <FormField label="Target Date">
                <Input type="date" value={ownerForm.targetDate} onChange={e => setOwnerForm(f => ({ ...f, targetDate:e.target.value }))} />
              </FormField>
              </div>
              <FormField label="Closure Evidence">
                <div>
                  <label style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.05)', border:'1px dashed var(--border)', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:13, color:'var(--text-secondary)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent-blue)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                  >
                    <Paperclip size={14} /> Attach evidence
                    <input type="file" multiple onChange={addClosureFile} style={{ display:'none' }} />
                  </label>
                  {closureAtts.length > 0 && (
                    <div style={{ marginTop:10, display:'flex', flexWrap:'wrap', gap:8 }}>
                      {closureAtts.map((att,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', borderRadius:6, padding:'4px 10px', fontSize:12, color:'#34d399' }}>
                          <Paperclip size={11} /> {att.name}
                          <button type="button" onClick={() => setClosureAtts(p => p.filter((_,j) => j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'#34d399', display:'flex', padding:0 }}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {incident.closureAttachments?.length > 0 && <div style={{ marginTop:10 }}><AttachmentList attachments={incident.closureAttachments} /></div>}
                </div>
              </FormField>
              <div><Button type="submit" variant="success" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit RCA'}</Button></div>
            </form>
          ) : null}
        </CollapsibleSection>
      )}

      {showFinalClose && (
        <CollapsibleSection
          title="Close incident"
          open={openSections.finalClose}
          onToggle={() => toggleSection('finalClose')}
          accent
        >
          <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'0 0 12px' }}>
            Submit closure for IRT approval.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="incident-form-grid-3">
              <FormField label="Closed Date" required>
                <Input type="date" value={closeForm.closedDate} onChange={e => setCloseForm(f => ({ ...f, closedDate:e.target.value }))} />
              </FormField>
              <FormField label="Review Date">
                <Input type="date" value={closeForm.reviewDate} onChange={e => setCloseForm(f => ({ ...f, reviewDate:e.target.value }))} />
              </FormField>
              <FormField label="Closed By">
                <Input value={closeForm.reviewedBy} onChange={e => setCloseForm(f => ({ ...f, reviewedBy:e.target.value }))} placeholder="Name" />
              </FormField>
            </div>
            <FormField label="Lessons Learned">
              <Textarea rows={3} value={closeForm.lessonsLearned} onChange={e => setCloseForm(f => ({ ...f, lessonsLearned:e.target.value }))} placeholder="Optional…" />
            </FormField>
            <div>
              <Button variant="success" onClick={handleFinalClose} disabled={submitting}>
                {submitting ? 'Closing…' : 'Close incident'}
              </Button>
            </div>
          </div>
        </CollapsibleSection>
      )}
      </div>

        </div>

        <aside className="incident-detail-sidebar">
          <SidebarCard title="Workflow">
            <WorkflowBar incident={incident} />
          </SidebarCard>

          {showIrtActions && (
            <SidebarCard title="IRT Actions" style={{ borderColor: 'rgba(59,130,246,.35)' }}>
              {showRcaReview && (
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 14px', lineHeight:1.5 }}>
                  Approve or reject the submitted RCA.
                </p>
              )}
              {showClosureReview && (
                <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 14px', lineHeight:1.5 }}>
                  Approve closure to complete the incident, or reject to reopen for the owner.
                </p>
              )}
              {rejectMode && (
                <div style={{ marginBottom:14, padding:14, border:'1px solid rgba(244,63,94,.3)', borderRadius:8, background:'rgba(244,63,94,.06)' }}>
                  <div style={{ fontWeight:600, fontSize:13, marginBottom:10, color:'#fb7185' }}>
                    {rejectMode === 'rca' ? 'Reject RCA' : 'Reject Closure'}
                  </div>
                  <FormField label="Reason" required>
                    <Textarea
                      value={rejectComment}
                      onChange={e => setRejectComment(e.target.value)}
                      rows={3}
                      placeholder="Reason for rejection…"
                    />
                  </FormField>
                  <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                    <button type="button" className="incident-btn-reject" onClick={handleReject} disabled={submitting} style={{ background:'var(--accent-rose)', color:'#fff', border:'none' }}>
                      Confirm
                    </button>
                    <button type="button" onClick={() => { setRejectMode(null); setRejectComment(''); }} style={{ border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', borderRadius:8, padding:'10px 14px', cursor:'pointer', fontSize:13 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="incident-actions-bar">
                {showRcaReview && !rejectMode && (
                  <>
                    <button type="button" className="incident-btn-approve" onClick={handleApproveRca} disabled={submitting}>
                      {submitting ? '…' : 'Approve RCA'}
                    </button>
                    <button type="button" className="incident-btn-reject" onClick={() => setRejectMode('rca')}>
                      Reject RCA
                    </button>
                  </>
                )}
                {showClosureReview && !rejectMode && (
                  <>
                    <button type="button" className="incident-btn-approve" onClick={handleApproveClosure} disabled={submitting}>
                      {submitting ? '…' : 'Approve Closure'}
                    </button>
                    <button type="button" className="incident-btn-reject" onClick={() => setRejectMode('closure')}>
                      Reject Closure
                    </button>
                  </>
                )}
              </div>
            </SidebarCard>
          )}

          {incident.status === STATUS_RCA_APPROVED && !incident.closedDate && isOwner && (
            <SidebarCard style={{ borderColor: 'rgba(6,182,212,.35)', background: 'rgba(6,182,212,.06)' }}>
              <p style={{ fontSize:13, color:'var(--accent-cyan)', margin:0, lineHeight:1.5 }}>
                RCA approved — complete <strong>Close Incident</strong> in the main panel.
              </p>
            </SidebarCard>
          )}

          {incident.actionLog?.length > 0 && (
            <SidebarCard title={`History (${incident.actionLog.length})`}>
              <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                {[...incident.actionLog].reverse().map(entry => (
                  <div key={entry.id} className="incident-history-item">
                    <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)' }}>{displayAction(entry.action)}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(entry.at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{entry.by || entry.byEmail}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.45 }}>{entry.comment || '—'}</div>
                  </div>
                ))}
              </div>
            </SidebarCard>
          )}
        </aside>
      </div>
    </div>
  );
}
