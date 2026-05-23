// frontend/src/pages/ReportIncident.jsx
/* eslint-disable */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api } from '../utils/api';
import { fileToBase64 } from '../utils';
import { Card, FormField, Input, Textarea, Button, Toast } from '../components/ui';
import { FilePlus, Paperclip, X } from 'lucide-react';

export default function ReportIncident() {
  const { dispatch } = useApp();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [form, setForm] = useState({ description:'', incidentDate:new Date().toISOString().slice(0,10) });
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.incidentDate) e.incidentDate = 'Date is required';
    return e;
  };

  const handleFile = async (e) => {
    const converted = await Promise.all(Array.from(e.target.files).map(fileToBase64));
    setAttachments(prev => [...prev, ...converted]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const incident = await api.createIncident({ ...form, attachments });
      dispatch({ type:'UPSERT_INCIDENT', incident });
      dispatch({ type:'ADD_NOTIF', message:`Incident ${incident.incidentId} submitted successfully` });
      setToast({ message:'Incident submitted! ISO Team has been notified by email.', type:'success' });
      setTimeout(() => navigate('/incidents'), 1600);
    } catch (err) {
      setToast({ message: err.message, type:'error' });
    } finally { setSubmitting(false); }
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth:680, margin:'0 auto' }}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:10 }}>
          <FilePlus size={22} color="var(--accent-blue)" /> Report Incident
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>Fill in the details below. The ISO Team will be notified by Outlook email immediately.</p>
      </div>
      <Card>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <FormField label="Incident ID"><Input value="Auto-generated" disabled style={{ color:'var(--text-muted)', fontFamily:'var(--font-mono)', fontSize:13 }} /></FormField>
            <FormField label="Reported By"><Input value={user?.name} disabled style={{ color:'var(--text-secondary)' }} /></FormField>
          </div>
          <FormField label="Incident Date" required error={errors.incidentDate}>
            <Input type="date" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate:e.target.value }))} max={new Date().toISOString().slice(0,10)} />
          </FormField>
          <FormField label="Incident Description" required error={errors.description} hint="Describe what happened, when, and the potential impact.">
            <Textarea rows={6} value={form.description} onChange={e => setForm(f => ({ ...f, description:e.target.value }))} placeholder="Provide a clear and detailed description of the incident..." />
          </FormField>
          <FormField label="Attachments" hint="Attach any relevant files, screenshots, or documents.">
            <div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,.05)', border:'1px dashed var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 16px', cursor:'pointer', fontSize:14, color:'var(--text-secondary)', transition:'all var(--transition)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent-blue)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
              >
                <Paperclip size={15} /> Attach files
                <input type="file" multiple onChange={handleFile} style={{ display:'none' }} />
              </label>
              {attachments.length > 0 && (
                <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:8 }}>
                  {attachments.map((att,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.2)', borderRadius:6, padding:'4px 10px', fontSize:12, color:'#60a5fa' }}>
                      <Paperclip size={11} /> <span>{att.name}</span>
                      <button type="button" onClick={() => setAttachments(p => p.filter((_,j) => j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'#60a5fa', display:'flex', padding:0 }}><X size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormField>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:12, paddingTop:8, borderTop:'1px solid var(--border)' }}>
            <Button variant="secondary" onClick={() => navigate(-1)} type="button">Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Incident'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
