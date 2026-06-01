// frontend/src/pages/EmailLog.jsx
/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { useCurrentUser } from '../context/AppContext';
import { api } from '../utils/api';
import { formatDateTime } from '../utils';
import { hasIRTRole } from '../constants';
import { EmptyState, Card, Spinner } from '../components/ui';
import { Mail } from 'lucide-react';

const TYPE_META = {
  submitted:          { label:'Incident Submitted',    color:'#60a5fa' },
  assigned:           { label:'Incident Assigned',     color:'#a78bfa' },
  rejected:           { label:'Incident Rejected',     color:'#fb7185' },
  admin_reopened:     { label:'Incident Reopened',     color:'#fb7185' },
  rca_rejected:       { label:'RCA Rejected',          color:'#fb7185' },
  closure_submitted:  { label:'RCA Submitted',         color:'#fbbf24' },
  admin_approved:     { label:'RCA Approved',          color:'#34d399' },
  closed:             { label:'Incident Closed',       color:'#34d399' },
  overdue:            { label:'Incident Overdue',      color:'#f97316' },
  response_reminder:  { label:'RCA Response Reminder', color:'#f97316' },
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
    <div className="animate-fade-up">
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:700, letterSpacing:'-0.02em', display:'flex', alignItems:'center', gap:10 }}>
          <Mail size={20} color="var(--accent-blue)" /> Outlook Email Log
        </h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
          All emails sent via the IMS Outlook mailbox ({emails.length} total)
        </p>
      </div>

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:64 }}><Spinner size={28} /></div>
      ) : emails.length === 0 ? (
        <EmptyState icon="📬" title="No emails sent yet" message="Emails are triggered automatically by incident workflow events." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {emails.map(email => {
            const t = TYPE_META[email.type] || { label: email.type, color:'#94a3b8' };
            const isFailed = email.status === 'failed';
            return (
              <Card key={email.id} style={{ padding:'16px 20px', border: isFailed ? '1px solid rgba(244,63,94,.2)' : '1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                      <span style={{ background:`${t.color}20`, color:t.color, border:`1px solid ${t.color}40`, borderRadius:999, fontSize:11, fontWeight:600, padding:'2px 10px' }}>{t.label}</span>
                      {isFailed && <span style={{ background:'rgba(244,63,94,.15)', color:'#fb7185', borderRadius:999, fontSize:11, fontWeight:600, padding:'2px 8px' }}>FAILED</span>}
                    </div>
                    <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:3 }}><span style={{ color:'var(--text-muted)' }}>To: </span>{email.to}</div>
                    {isFailed && <div style={{ fontSize:12, color:'#fb7185', marginTop:4 }}>Error: {email.error}</div>}
                  </div>
                  <span style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{formatDateTime(email.timestamp)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
