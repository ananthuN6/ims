// frontend/src/pages/EmailLog.jsx
/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '../context/AppContext';
import { api } from '../utils/api';
import { formatDateTime } from '../utils';
import { hasIRTRole } from '../constants';
import { EmptyState, Card, Spinner, EmailRecipients } from '../components/ui';
import { Mail } from 'lucide-react';

const TYPE_META = {
  submitted:          { label:'Incident Submitted',    color:'var(--accent-blue)' },
  assigned:           { label:'Incident Assigned',     color:'var(--ms-purple)' },
  rejected:           { label:'Incident Rejected',     color:'var(--ms-danger)' },
  admin_reopened:     { label:'Incident Reopened',     color:'var(--ms-danger)' },
  rca_rejected:       { label:'RCA Rejected',          color:'var(--ms-danger)' },
  closure_rejected:   { label:'Closure Rejected',    color:'var(--ms-danger)' },
  closure_submitted:  { label:'RCA Submitted',         color:'var(--ms-warning)' },
  owner_closed:       { label:'Owner Closed',          color:'var(--ms-purple)' },
  admin_approved:     { label:'RCA Approved',          color:'var(--ms-success)' },
  closed:             { label:'Incident Closed',       color:'var(--ms-success)' },
  overdue:            { label:'Incident Overdue',      color:'var(--ms-warning)' },
  validation_reminder:{ label:'IRT Validation Reminder', color:'var(--ms-warning)' },
  target_date_extended:{ label:'Target Date Extended',  color:'var(--ms-warning)' },
  response_reminder:  { label:'RCA Submission Reminder', color:'var(--ms-warning)' },
};

export default function EmailLog() {
  const user = useCurrentUser();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEmailLog()
      .then(data => { setEmails(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (!hasIRTRole(user)) return null;

  return (
    <div className="animate-fade-up scroll-page">
      <div className="scroll-page__header">
        <div className="scroll-page__title-row" style={{ marginBottom:0 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:10 }}>
              <Mail size={20} color="var(--accent-blue)" /> Outlook Email Log
            </h1>
            <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
              All emails sent via the IMS Outlook mailbox ({emails.length} total)
            </p>
          </div>
        </div>
      </div>

      <div className="scroll-page__body">
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:64 }}><Spinner size={28} /></div>
        ) : emails.length === 0 ? (
          <EmptyState icon="📬" title="No emails sent yet" message="Emails are triggered automatically by incident workflow events." />
        ) : (
          <div className="scroll-page__list">
            {emails.map(email => {
              const t = TYPE_META[email.type] || { label: email.type, color:'var(--text-muted)' };
              const isFailed = email.status === 'failed';
              return (
                <Card key={email.id} style={{ padding:'16px 20px', border: isFailed ? '1px solid var(--ms-danger)' : '1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ background:'var(--ms-brand-subtle)', color:t.color, border:'1px solid var(--border)', borderRadius:999, fontSize:11, fontWeight:600, padding:'2px 10px' }}>{t.label}</span>
                        {isFailed && <span style={{ background:'var(--ms-danger-subtle)', color:'var(--ms-danger)', borderRadius:999, fontSize:11, fontWeight:600, padding:'2px 8px' }}>FAILED</span>}
                      </div>
                      <EmailRecipients to={email.to} size={24} />
                      {isFailed && <div style={{ fontSize:12, color:'var(--ms-danger)', marginTop:4 }}>Error: {email.error}</div>}
                    </div>
                    <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDateTime(email.timestamp)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
