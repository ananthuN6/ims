// frontend/src/pages/IncidentDetail.jsx
/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../utils/api';
import { hasIRTRole, displayAction } from '../constants';
import { formatDate, formatDateTime, fileToBase64 } from '../utils';
import { Card, StatusBadge, SeverityBadge, FormField, Input, Textarea, Select, Button, Toast, Spinner } from '../components/ui';
import { ArrowLeft, Paperclip, X, CheckCircle, XCircle, Lock, ChevronDown, ChevronUp } from 'lucide-react';

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontSize:14, color: mono?'var(--accent-blue)':'var(--text-primary)', fontFamily: mono?'var(--font-mono)':'inherit', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{value||'—'}</span>
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

const sectionToggleBtn = {
  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
  background:'none', border:'none', padding:0, cursor:'pointer', color:'var(--text-primary)', textAlign:'left',
};

function CollapsibleSection({ title, subtitle, open, onToggle, children, style, headerExtra }) {
  return (
    <Card style={{ marginBottom:20, ...style }}>
      <button type="button" onClick={onToggle} style={sectionToggleBtn}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', flex:1, minWidth:0 }}>
          {headerExtra}
          <h3 style={{ fontWeight:600, fontSize:15, margin:0 }}>{title}</h3>
          {subtitle != null && subtitle !== '' && (
            <span style={{ fontWeight:400, fontSize:13, color:'var(--text-muted)' }}>{subtitle}</span>
          )}
        </div>
        {open ? <ChevronUp size={20} color="var(--text-muted)" style={{ flexShrink:0 }} /> : <ChevronDown size={20} color="var(--text-muted)" style={{ flexShrink:0 }} />}
      </button>
      {open && (
        <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
          {children}
        </div>
      )}
    </Card>
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
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [openSections, setOpenSections] = useState({
    details: true,
    history: false,
    validationDone: false,
    validationForm: true,
    ownerRca: true,
    finalClose: true,
    closed: false,
    adminReject: false,
    approveRca: false,
  });

  const toggleSection = (key) => setOpenSections(s => ({ ...s, [key]: !s[key] }));

  useEffect(() => {
    if (showRejectForm) setOpenSections(s => ({ ...s, adminReject: true }));
  }, [showRejectForm]);

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
    const needsFinalClose = incident.status === 'Admin Approved';
    const needsApproveRca = ['Pending Admin Approval', 'Overdue'].includes(incident.status);
    setOpenSections({
      details: true,
      history: false,
      validationDone: false,
      validationForm: isSubmitted,
      ownerRca: needsOwnerRca,
      finalClose: needsFinalClose,
      closed: incident.status === 'Closed',
      adminReject: false,
      approveRca: needsApproveRca,
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
  const showApproveRca = isIRT && ['Pending Admin Approval','Overdue'].includes(incident.status);
  const showOwnerClose    = isOwner && incident.status === 'Admin Approved';
  const showIRTClose      = isIRT && incident.status === 'Admin Approved';
  const showFinalClose    = showIRTClose || showOwnerClose;
  const canAdminReject    = isIRT && incident.status !== 'Rejected';

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

    if (showIRTClose) {
      if (!closeForm.reviewDate || !closeForm.reviewedBy) {
        setToast({ message:'Review Date and Closed By are required for IRT closure', type:'error' });
        return;
      }
      payload.reviewDate = closeForm.reviewDate;
      payload.reviewedBy = closeForm.reviewedBy;
    } else {
      payload.reviewDate = closeForm.reviewDate || closeForm.closedDate;
      payload.reviewedBy = closeForm.reviewedBy || user?.name || '';
    }

    setSubmitting(true);
    try {
      await api.closeIncident(id, payload);
      dispatch({ type:'ADD_NOTIF', message:`Incident ${incident.incidentId} closed` });
      setToast({ message:'Incident closed! Reporter and owner notified by email.', type:'success' });
      await refresh();
    } catch(e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleAdminReject = async () => {
    if (!rejectComment.trim()) { setToast({ message:'Comment is required to reject', type:'error' }); return; }
    setSubmitting(true);
    try {
      await api.rejectIncident(id, { comment: rejectComment.trim() });
      dispatch({ type:'ADD_NOTIF', message:`Incident ${incident.incidentId} rejected by admin` });
      setToast({ message:'RCA rejected. Owner and relevant parties notified by email.', type:'success' });
      setRejectComment('');
      setShowRejectForm(false);
      await refresh();
    } catch (e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await api.approveIncident(id);
      dispatch({ type:'ADD_NOTIF', message:`RCA approved for ${incident.incidentId}` });
      setToast({ message:'RCA approved. Owner or IRT may now complete final closure.', type:'success' });
      await refresh();
    } catch (e) { setToast({ message:e.message, type:'error' }); }
    finally { setSubmitting(false); }
  };

  const addClosureFile = async (e) => {
    const converted = await Promise.all(Array.from(e.target.files).map(fileToBase64));
    setClosureAtts(prev => [...prev, ...converted]);
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth:800, margin:'0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <button onClick={() => navigate('/incidents')} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', color:'var(--text-secondary)', cursor:'pointer', fontSize:14, marginBottom:20, padding:0 }}>
        <ArrowLeft size={16} /> Back to Incidents
      </button>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6, flexWrap:'wrap' }}>
          <span style={{ fontFamily:'var(--font-mono)', fontSize:13, color:'var(--accent-cyan)' }}>{incident.incidentId}</span>
          <StatusBadge status={incident.status} />
          {incident.severity && <SeverityBadge severity={incident.severity} />}
        </div>
        <p style={{ fontSize:13, color:'var(--text-muted)' }}>Submitted {formatDateTime(incident.createdAt)} · Updated {formatDateTime(incident.updatedAt)}</p>
      </div>

      <CollapsibleSection
        title="Incident Details"
        open={openSections.details}
        onToggle={() => toggleSection('details')}
      >
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:20, marginBottom:20 }}>
          <InfoRow label="Incident ID"   value={incident.incidentId} mono />
          <InfoRow label="Reported By"   value={incident.reportedByName} />
          <InfoRow label="Incident Date" value={formatDate(incident.incidentDate)} />
          <InfoRow label="Assigned Owner" value={owner?.name} />
        </div>
        <FormField label="Description">
          <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:8, padding:12, fontSize:14, lineHeight:1.7, minHeight:80, whiteSpace:'pre-wrap' }}>
            {incident.description}
          </div>
        </FormField>
        {incident.attachments?.length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>ATTACHMENTS</div>
            <AttachmentList attachments={incident.attachments} />
          </div>
        )}
      </CollapsibleSection>

      {incident.actionLog?.length > 0 && (
        <CollapsibleSection
          title="Incident History"
          subtitle={`(${incident.actionLog.length})`}
          open={openSections.history}
          onToggle={() => toggleSection('history')}
          style={{ border:'1px solid rgba(148,163,184,.2)', background:'rgba(148,163,184,.04)' }}
        >
          <div style={{ display:'grid', gap:12 }}>
            {[...incident.actionLog].reverse().map(entry => (
              <div key={entry.id} style={{ padding:14, border:'1px solid rgba(148,163,184,.15)', borderRadius:10, background:'#0f172a' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:8 }}>
                  <span style={{ fontSize:13, color:'#cbd5e1', fontWeight:600 }}>{displayAction(entry.action)}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{new Date(entry.at).toLocaleString()}</span>
                </div>
                <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:6 }}>{entry.role?.toUpperCase() || 'SYSTEM'} by {entry.by || entry.byEmail}</div>
                <div style={{ fontSize:14, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>{entry.comment || 'No comment provided.'}</div>
                <div style={{ marginTop:6, fontSize:12, color:'var(--text-muted)' }}>
                  {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Status: ${entry.toStatus}`}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── 2. IRT Validation (read-only once done) ── */}
      {incident.validationStatus && !showIRTValidate && (
        <CollapsibleSection
          title="IRT Validation"
          subtitle={incident.validationStatus}
          open={openSections.validationDone}
          onToggle={() => toggleSection('validationDone')}
          style={{ border:`1px solid ${incident.validationStatus==='Valid'?'rgba(16,185,129,.2)':'rgba(244,63,94,.2)'}` }}
          headerExtra={incident.validationStatus==='Valid' ? <CheckCircle size={18} color="var(--accent-emerald)" /> : <XCircle size={18} color="var(--accent-rose)" />}
        >
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16 }}>
            <InfoRow label="Validation"  value={incident.validationStatus} />
            <InfoRow label="Severity"    value={incident.severity} />
            <InfoRow label="IRT Comments" value={incident.isoComments} />
          </div>
        </CollapsibleSection>
      )}

      {/* ── 2. IRT Validation Form (active) ── */}
      {showIRTValidate && (
        <CollapsibleSection
          title="🛡️ IRT Validation"
          subtitle="Review required"
          open={openSections.validationForm}
          onToggle={() => toggleSection('validationForm')}
          style={{ border:'1px solid rgba(59,130,246,.25)' }}
        >
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:20, marginTop:0 }}>Review and mark this incident as valid or invalid.</p>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
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

      {(incident.rca || showOwnerClosure) && (
        <CollapsibleSection
          title="📝 Owner RCA"
          subtitle={showOwnerClosure ? 'Action required' : 'Submitted'}
          open={openSections.ownerRca}
          onToggle={() => toggleSection('ownerRca')}
          headerExtra={!showOwnerClosure ? <Lock size={14} color="var(--text-muted)" /> : null}
        >
          {showOwnerClosure ? (
            <form onSubmit={handleOwnerSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <FormField label="Root Cause Analysis (RCA)" required>
                <Textarea rows={4} value={ownerForm.rca} onChange={e => setOwnerForm(f => ({ ...f, rca:e.target.value }))} placeholder="Describe the root cause…" />
              </FormField>
              <FormField label="Correction" required>
                <Textarea rows={3} value={ownerForm.correction} onChange={e => setOwnerForm(f => ({ ...f, correction:e.target.value }))} placeholder="Immediate corrective action taken…" />
              </FormField>
              <FormField label="Corrective Action" required>
                <Textarea rows={3} value={ownerForm.correctiveAction} onChange={e => setOwnerForm(f => ({ ...f, correctiveAction:e.target.value }))} placeholder="Long-term corrective measures…" />
              </FormField>
              <FormField label="Target Date">
                <Input type="date" value={ownerForm.targetDate} onChange={e => setOwnerForm(f => ({ ...f, targetDate:e.target.value }))} />
              </FormField>
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
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:16 }}>
              <InfoRow label="RCA"               value={incident.rca} />
              <InfoRow label="Correction"        value={incident.correction} />
              <InfoRow label="Corrective Action" value={incident.correctiveAction} />
              <InfoRow label="Target Date"       value={formatDate(incident.targetDate)} />
              {incident.closureAttachments?.length > 0 && (
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>CLOSURE EVIDENCE</div>
                  <AttachmentList attachments={incident.closureAttachments} />
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>
      )}

      {showFinalClose && (
        <CollapsibleSection
          title={showIRTClose ? '✅ Final IRT Closure' : '✅ Close Incident'}
          open={openSections.finalClose}
          onToggle={() => toggleSection('finalClose')}
          style={{ border:'1px solid rgba(16,185,129,.25)' }}
        >
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:20, marginTop:0 }}>
            {showIRTClose ? 'Review the closure details and officially close the incident.' : 'Confirm the closure date and complete the incident.'}
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:16 }}>
              <FormField label="Closed Date" required>
                <Input type="date" value={closeForm.closedDate} onChange={e => setCloseForm(f => ({ ...f, closedDate:e.target.value }))} />
              </FormField>
              <FormField label="Review Date" required={showIRTClose}>
                <Input type="date" value={closeForm.reviewDate} onChange={e => setCloseForm(f => ({ ...f, reviewDate:e.target.value }))} />
                {showOwnerClose && <small style={{ color:'var(--text-muted)', display:'block', marginTop:6 }}>Optional for owner closure; defaults to closed date.</small>}
              </FormField>
              <FormField label="Closed By" required={showIRTClose}>
                <Input value={closeForm.reviewedBy} onChange={e => setCloseForm(f => ({ ...f, reviewedBy:e.target.value }))} placeholder="Name of person closing" />
                {showOwnerClose && <small style={{ color:'var(--text-muted)', display:'block', marginTop:6 }}>Optional for owner closure; defaults to your name.</small>}
              </FormField>
            </div>
            {/* Lessons Learned moved here to IRT section */}
            <FormField label="Lessons Learned" hint="IRT's documented lessons and recommendations from this incident.">
              <Textarea rows={4} value={closeForm.lessonsLearned} onChange={e => setCloseForm(f => ({ ...f, lessonsLearned:e.target.value }))} placeholder="What lessons can be drawn? What should be done differently?…" />
            </FormField>
            <div>
              <Button variant="success" onClick={handleFinalClose} disabled={submitting}>
                {submitting ? 'Closing…' : '🔒 Close Incident'}
              </Button>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {incident.status === 'Closed' && incident.closedDate && (
        <CollapsibleSection
          title="Incident Closed"
          open={openSections.closed}
          onToggle={() => toggleSection('closed')}
          style={{ border:'1px solid rgba(16,185,129,.2)', background:'rgba(16,185,129,.04)' }}
          headerExtra={<CheckCircle size={18} color="#10b981" />}
        >
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16 }}>
            <InfoRow label="Closed Date"     value={formatDate(incident.closedDate)} />
            <InfoRow label="Review Date"     value={formatDate(incident.reviewDate)} />
            <InfoRow label="Closed By"       value={incident.reviewedBy} />
            <InfoRow label="Lessons Learned" value={incident.lessonsLearned} />
          </div>
        </CollapsibleSection>
      )}

      {showApproveRca && (
        <CollapsibleSection
          title="✅ Approve RCA"
          open={openSections.approveRca}
          onToggle={() => toggleSection('approveRca')}
          style={{ marginTop:28, border:'1px solid rgba(34,197,94,.25)', background:'rgba(34,197,94,.04)' }}
        >
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:0, marginBottom:16 }}>
            Review the submitted RCA. After approval, the owner or IRT will complete final incident closure.
          </p>
          <Button variant="success" onClick={handleApprove} disabled={submitting}>
            {submitting ? 'Approving…' : 'Approve RCA'}
          </Button>
        </CollapsibleSection>
      )}

      {isIRT && incident.status !== 'Rejected' && (
        <div style={{ marginTop:28, paddingTop:24, borderTop:'1px solid var(--border)' }}>
          <CollapsibleSection
            title="IRT Actions"
            open={openSections.adminReject}
            onToggle={() => toggleSection('adminReject')}
            style={{ border:'1px solid var(--border)' }}
          >
            {showRejectForm && (
              <div style={{ marginBottom:16, padding:16, border:'1px solid rgba(244,63,94,.25)', borderRadius:8, background:'rgba(254,226,226,.35)' }}>
                <h4 style={{ fontWeight:600, fontSize:14, marginBottom:10 }}>Admin Reject & Reopen</h4>
                <p style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:16 }}>Provide a reason to reject and reopen this incident to the prior stage.</p>
                <FormField label="Rejection Comment" required>
                  <Textarea
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    rows={4}
                    placeholder="Enter a comment for the action log and notification"
                  />
                </FormField>
                <div style={{ display:'flex', gap:10, marginTop:12 }}>
                  <button
                    type="button"
                    onClick={handleAdminReject}
                    disabled={submitting}
                    style={{
                      border:'none',
                      background:'var(--accent-rose)',
                      color:'#fff',
                      borderRadius:8,
                      padding:'10px 16px',
                      cursor:'pointer',
                      fontWeight:600,
                    }}
                  >
                    Reject Incident
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    style={{
                      border:'1px solid var(--border)',
                      background:'var(--bg-card)',
                      color:'var(--text-primary)',
                      borderRadius:8,
                      padding:'10px 16px',
                      cursor:'pointer',
                      fontWeight:600,
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'flex-end' }}>
            {canAdminReject && (
              <button
                type="button"
                onClick={() => setShowRejectForm(prev => !prev)}
                style={{
                  border:'1px solid var(--border)',
                  background:'var(--bg-card)',
                  color:'var(--text-primary)',
                  borderRadius:8,
                  padding:'10px 16px',
                  cursor:'pointer',
                  fontWeight:600,
                }}
              >
                {showRejectForm ? 'Cancel Reject' : 'Admin Reject & Reopen'}
              </button>
            )}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
