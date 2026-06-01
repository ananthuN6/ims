// frontend/src/components/ui/index.jsx
import React from 'react';
import { displayStatus } from '../../constants';

export const STATUS_COLORS = {
  Submitted:             { bg:'rgba(59,130,246,.15)',  text:'#60a5fa', dot:'#3b82f6' },
  Assigned:              { bg:'rgba(139,92,246,.15)',  text:'#a78bfa', dot:'#8b5cf6' },
  'Pending IRT Closure': { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', dot:'#f59e0b' },
  'Pending ISO Closure': { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', dot:'#f59e0b' },
  'Pending Admin Approval': { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', dot:'#f59e0b' },
  'Pending RCA Approval':     { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', dot:'#f59e0b' },
  'RCA Approved':             { bg:'rgba(34,197,94,.15)',   text:'#22c55e', dot:'#10b981' },
  'Pending Closure Approval': { bg:'rgba(245,158,11,.15)',  text:'#fbbf24', dot:'#f59e0b' },
  'Admin Approved':           { bg:'rgba(34,197,94,.15)',   text:'#22c55e', dot:'#10b981' },
  Overdue:               { bg:'rgba(244,63,94,.15)',   text:'#f87171', dot:'#ef4444' },
  Closed:                { bg:'rgba(16,185,129,.15)',  text:'#34d399', dot:'#10b981' },
  Rejected:              { bg:'rgba(244,63,94,.15)',   text:'#fb7185', dot:'#f43f5e' },
};
export const SEVERITY_COLORS = {
  High:   { bg:'rgba(239,68,68,.15)',  text:'#f87171' },
  Medium: { bg:'rgba(245,158,11,.15)', text:'#fbbf24' },
  Low:    { bg:'rgba(16,185,129,.15)', text:'#34d399' },
};

export function StatusBadge({ status }) {
  const label = displayStatus(status);
  const c = STATUS_COLORS[status] || STATUS_COLORS[label] || { bg:'rgba(100,116,139,.2)', text:'#94a3b8', dot:'#64748b' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:c.bg, color:c.text, padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:500 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:c.dot, animation: ['Submitted','Pending IRT Closure','Pending ISO Closure','Pending Admin Approval','Pending RCA Approval','Pending Closure Approval'].includes(label) ? 'pulse-dot 1.5s ease infinite' : 'none' }} />
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  if (!severity) return <span style={{ color:'var(--text-muted)', fontSize:13 }}>—</span>;
  const c = SEVERITY_COLORS[severity] || { bg:'rgba(100,116,139,.2)', text:'#94a3b8' };
  return <span style={{ display:'inline-flex', alignItems:'center', background:c.bg, color:c.text, padding:'3px 10px', borderRadius:999, fontSize:12, fontWeight:500 }}>{severity}</span>;
}

export function Card({ children, style={} }) {
  return <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:24, ...style }}>{children}</div>;
}

export function Button({ children, variant='primary', size='md', onClick, disabled, type='button', style={}, icon }) {
  const base = { display:'inline-flex', alignItems:'center', gap:8, fontFamily:'inherit', fontWeight:500, cursor:disabled?'not-allowed':'pointer', border:'none', transition:'all var(--transition)', borderRadius:'var(--radius-sm)', opacity:disabled?.5:1, whiteSpace:'nowrap' };
  const sizes = { sm:{ padding:'6px 12px', fontSize:13 }, md:{ padding:'9px 18px', fontSize:14 }, lg:{ padding:'12px 24px', fontSize:15 } };
  const variants = {
    primary: { background:'var(--accent-blue)', color:'#fff' },
    secondary: { background:'rgba(255,255,255,.06)', color:'var(--text-primary)', border:'1px solid var(--border)' },
    danger:  { background:'rgba(244,63,94,.15)', color:'#fb7185', border:'1px solid rgba(244,63,94,.3)' },
    success: { background:'rgba(16,185,129,.15)', color:'#34d399', border:'1px solid rgba(16,185,129,.3)' },
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
  const c = { success:{ border:'rgba(16,185,129,.4)', text:'#34d399' }, error:{ border:'rgba(244,63,94,.4)', text:'#fb7185' }, info:{ border:'rgba(59,130,246,.4)', text:'#60a5fa' } }[type];
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
