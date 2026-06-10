// frontend/src/components/ui/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { displayStatus } from '../../constants';
import { useApp } from '../../context/AppContext';
import { getCachedPhoto, loadUserPhoto, primePhotoCache } from '../../utils/userPhotos';

export const STATUS_COLORS = {
  Submitted:             { bg:'var(--ms-brand-subtle)',  text:'var(--accent-blue)', dot:'var(--ms-brand)' },
  Assigned:              { bg:'var(--ms-purple-subtle)', text:'var(--ms-purple)', dot:'var(--ms-purple)' },
  'Pending IRT Closure': { bg:'var(--ms-warning-subtle)', text:'var(--ms-warning)', dot:'var(--ms-warning)' },
  'Pending ISO Closure': { bg:'var(--ms-warning-subtle)', text:'var(--ms-warning)', dot:'var(--ms-warning)' },
  'Pending Admin Approval': { bg:'var(--ms-warning-subtle)', text:'var(--ms-warning)', dot:'var(--ms-warning)' },
  'Pending RCA Approval':     { bg:'var(--ms-warning-subtle)', text:'var(--ms-warning)', dot:'var(--ms-warning)' },
  'RCA Approved':             { bg:'var(--ms-success-subtle)', text:'var(--ms-success)', dot:'var(--ms-success)' },
  'Pending Closure Approval': { bg:'var(--ms-warning-subtle)', text:'var(--ms-warning)', dot:'var(--ms-warning)' },
  'Admin Approved':           { bg:'var(--ms-success-subtle)', text:'var(--ms-success)', dot:'var(--ms-success)' },
  Overdue:               { bg:'var(--ms-danger-subtle)', text:'var(--ms-danger)', dot:'var(--ms-danger)' },
  Closed:                { bg:'var(--ms-success-subtle)', text:'var(--ms-success)', dot:'var(--ms-success)' },
  Rejected:              { bg:'var(--ms-danger-subtle)', text:'var(--ms-danger)', dot:'var(--ms-danger)' },
};
export const SEVERITY_COLORS = {
  Critical: { bg:'var(--ms-danger-subtle)', text:'var(--ms-danger)' },
  High:   { bg:'var(--ms-danger-subtle)', text:'var(--ms-danger)' },
  Medium: { bg:'var(--ms-warning-subtle)', text:'var(--ms-warning)' },
  Low:    { bg:'var(--ms-success-subtle)', text:'var(--ms-success)' },
};

export function StatusBadge({ status }) {
  const label = displayStatus(status);
  const c = STATUS_COLORS[status] || STATUS_COLORS[label] || { bg:'var(--surface-hover)', text:'var(--text-muted)', dot:'var(--text-muted)' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:c.bg, color:c.text, padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:500 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot, animation: ['Submitted','Pending IRT Closure','Pending ISO Closure','Pending Admin Approval','Pending RCA Approval','Pending Closure Approval'].includes(label) ? 'pulse-dot 1.5s ease infinite' : 'none' }} />
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  if (!severity) return <span style={{ color:'var(--text-muted)', fontSize:13 }}>—</span>;
  const c = SEVERITY_COLORS[severity] || { bg:'var(--surface-hover)', text:'var(--text-muted)' };
  return <span style={{ display:'inline-flex', alignItems:'center', background:c.bg, color:c.text, padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:500 }}>{severity}</span>;
}

export function Card({ children, style={} }) {
  return <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:24, ...style }}>{children}</div>;
}

export function Button({ children, variant='primary', size='md', onClick, disabled, type='button', style={}, icon }) {
  const base = { display:'inline-flex', alignItems:'center', gap:8, fontFamily:'inherit', fontWeight:500, cursor:disabled?'not-allowed':'pointer', border:'none', transition:'all var(--transition)', borderRadius:'var(--radius-sm)', opacity:disabled?.5:1, whiteSpace:'nowrap' };
  const sizes = { sm:{ padding:'6px 12px', fontSize:13 }, md:{ padding:'9px 18px', fontSize:14 }, lg:{ padding:'12px 24px', fontSize:15 } };
  const variants = {
    primary: { background:'var(--ms-brand)', color:'#fff' },
    secondary: { background:'var(--btn-secondary-bg)', color:'var(--text-primary)', border:'1px solid var(--border)' },
    danger:  { background:'var(--ms-danger-subtle)', color:'var(--ms-danger)', border:'1px solid var(--ms-danger)' },
    success: { background:'var(--ms-success-subtle)', color:'var(--ms-success)', border:'1px solid var(--ms-success)' },
    ghost:   { background:'transparent', color:'var(--text-secondary)' },
  };
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>{icon}{children}</button>;
}

export function FormField({ label, required, error, children, hint }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)' }}>{label}{required && <span style={{ color:'var(--accent-rose)' }}> *</span>}</label>}
      {children}
      {hint  && <span style={{ fontSize:12, color:'var(--text-muted)' }}>{hint}</span>}
      {error && <span style={{ fontSize:12, color:'var(--accent-rose)' }}>{error}</span>}
    </div>
  );
}

const inputBase = { background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'9px 12px', color:'var(--text-primary)', fontSize:14, width:'100%', outline:'none', transition:'border-color var(--transition)' };
const iFocus = e => e.target.style.borderColor='var(--border-focus)';
const iBlur  = e => e.target.style.borderColor='var(--border)';

export function Input({ style={}, ...p }) { return <input style={{ ...inputBase, ...style }} onFocus={iFocus} onBlur={iBlur} {...p} />; }
export function Textarea({ style={}, rows=4, ...p }) { return <textarea rows={rows} style={{ ...inputBase, resize:'vertical', lineHeight:1.6, ...style }} onFocus={iFocus} onBlur={iBlur} {...p} />; }
export function Select({ style={}, children, ...p }) { return <select style={{ ...inputBase, cursor:'pointer', ...style }} onFocus={iFocus} onBlur={iBlur} {...p}>{children}</select>; }

export function EmptyState({ icon, title, message }) {
  return (
    <div style={{ textAlign:'center', padding:'64px 24px', color:'var(--text-muted)' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:16, fontWeight:600, color:'var(--text-secondary)', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:14 }}>{message}</div>
    </div>
  );
}

export function Toast({ message, type='success', onClose }) {
  const c = { success:{ border:'var(--ms-success)', text:'var(--ms-success)' }, error:{ border:'var(--ms-danger)', text:'var(--ms-danger)' }, info:{ border:'var(--ms-brand)', text:'var(--accent-blue)' } }[type];
  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, background:'var(--bg-card)', border:`1px solid ${c.border}`, borderRadius:'var(--radius-md)', padding:'14px 20px', boxShadow:'var(--shadow-lg)', minWidth:280, maxWidth:400, display:'flex', alignItems:'center', gap:12, animation:'slideInRight .3s ease' }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:c.border, flexShrink:0 }} />
      <span style={{ fontSize:14, color:c.text, flex:1 }}>{message}</span>
      <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:18, lineHeight:1 }}>×</button>
    </div>
  );
}

export function Spinner({ size=20 }) {
  return (
    <div style={{ width:size, height:size, border:`2px solid var(--border)`, borderTopColor:'var(--accent-blue)', borderRadius:'50%', animation:'spin .7s linear infinite' }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

function useUserPhoto(email) {
  const { state } = useApp();
  const normalized = email?.toLowerCase();

  const fromState = useMemo(() => {
    if (!normalized) return null;
    const match = state.users.find(u => u.email?.toLowerCase() === normalized);
    if (match?.photoUrl) return match.photoUrl;
    if (state.currentUser?.email?.toLowerCase() === normalized && state.currentUser.photoUrl) {
      return state.currentUser.photoUrl;
    }
    return null;
  }, [normalized, state.users, state.currentUser]);

  const [src, setSrc] = useState(() => fromState || getCachedPhoto(normalized) || null);

  useEffect(() => {
    if (!normalized) {
      setSrc(null);
      return;
    }
    if (fromState) {
      primePhotoCache(normalized, fromState);
      setSrc(fromState);
      return;
    }
    const cached = getCachedPhoto(normalized);
    if (cached !== undefined) {
      setSrc(cached);
      return;
    }
    let alive = true;
    loadUserPhoto(normalized).then((url) => {
      if (alive) setSrc(url);
    });
    return () => { alive = false; };
  }, [normalized, fromState]);

  return src;
}

export function UserIdentity({ email, name, size = 24, showEmail = false, style = {} }) {
  const displayName = name || (email ? email.split('@')[0] : '—');
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, ...style }}>
      <UserAvatar email={email} name={displayName} size={size} />
      <div style={{ minWidth:0, overflow:'hidden' }}>
        <div style={{ fontSize:13, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {displayName}
        </div>
        {showEmail && email && (
          <div style={{ fontSize:11, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {email}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmailRecipients({ to, size = 22 }) {
  const emails = String(to || '').split(/[,;]/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) return <span style={{ color:'var(--text-muted)' }}>—</span>;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {emails.map((addr) => (
        <UserIdentity key={addr} email={addr} size={size} showEmail />
      ))}
    </div>
  );
}

export function UserAvatar({ email, name, size = 32, style = {} }) {
  const src = useUserPhoto(email);
  const initials = (name || email || '?').trim().charAt(0).toUpperCase() || '?';
  const shared = { width: size, height: size, borderRadius: '50%', flexShrink: 0, ...style };

  if (src) {
    return <img src={src} alt="" style={{ ...shared, objectFit: 'cover' }} />;
  }

  return (
    <div style={{
      ...shared,
      background: 'var(--ms-brand)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.max(11, Math.round(size * 0.38)),
      fontWeight: 700,
      color: '#fff',
    }}>
      {initials}
    </div>
  );
}
