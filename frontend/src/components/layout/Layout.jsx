// frontend/src/components/layout/Layout.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { useApp, useCurrentUser, useMyNotifs } from '../../context/AppContext';
import { hasIRTRole, isUserAdmin } from '../../constants';
import { LayoutDashboard, FilePlus, ListChecks, Bell, LogOut, ShieldCheck, X, Menu, Mail, Users } from 'lucide-react';

function NavItem({ to, icon: Icon, label, badge }) {
  return (
    <NavLink to={to} style={({ isActive }) => ({
      display:'flex', alignItems:'center', gap:10,
      padding:'9px 14px', borderRadius:'var(--radius-sm)',
      fontSize:14, fontWeight:500,
      background: isActive ? 'rgba(59,130,246,.12)' : 'transparent',
      borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
      color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
      transition:'all var(--transition)', textDecoration:'none',
    })}>
      <Icon size={16} />
      <span style={{ flex:1 }}>{label}</span>
      {badge > 0 && <span style={{ background:'var(--accent-rose)', color:'#fff', borderRadius:999, fontSize:11, fontWeight:700, padding:'1px 6px' }}>{badge}</span>}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { instance } = useMsal();
  const { logout } = useApp();
  const user = useCurrentUser();
  const notifs = useMyNotifs();
  const unread = notifs.filter(n => !n.read).length;
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { dispatch } = useApp();

  const handleLogout = async () => {
    logout();
    await instance.logoutPopup().catch(() => {});
    navigate('/login');
  };

  const isIRT   = hasIRTRole(user);
  const isAdmin = isUserAdmin(user);

  const nav = [
    { to:'/dashboard',  icon:LayoutDashboard, label:'Dashboard' },
    { to:'/report', icon:FilePlus, label:'Report Incident' },
    { to:'/incidents',  icon:ListChecks, label:'Incidents' },
    ...(isIRT ? [{ to:'/email-log', icon:Mail,  label:'Email Log' }] : []),
    ...(isAdmin ? [{ to:'/admin',    icon:Users, label:'User Admin' }] : []),
  ];

  const sidebar = (
    <aside style={{ width:224, background:'var(--bg-secondary)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0, flexShrink:0 }}>
      {/* Logo */}
      <div style={{ padding:'20px 18px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#3b82f6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <ShieldCheck size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>IMS</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.08em' }}>INCIDENT SYSTEM</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 8px', display:'flex', flexDirection:'column', gap:2 }}>
        {nav.map(n => <NavItem key={n.to} {...n} />)}
      </nav>

      {/* User */}
      <div style={{ padding:12, borderTop:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:10, borderRadius:'var(--radius-sm)', background:'rgba(255,255,255,.04)' }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#6366f1,#3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
            {user?.name?.[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize:11, color: isAdmin ? '#fbbf24' : isIRT ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
              {isAdmin ? '⭐ Admin IRT' : isIRT ? 'IRT' : 'Employee'}
            </div>
          </div>
          <button onClick={handleLogout} title="Sign out" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex', padding:4 }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <div style={{ display:'none' }} className="sidebar-desktop">{sidebar}</div>
      <style>{`.sidebar-desktop{display:flex!important}@media(max-width:768px){.sidebar-desktop{display:none!important}}`}</style>

      {sidebarOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:200 }}>
          <div onClick={() => setSidebarOpen(false)} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.6)' }} />
          <div style={{ position:'absolute', left:0, top:0, height:'100%', zIndex:1 }}>{sidebar}</div>
        </div>
      )}

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* Topbar */}
        <header style={{ height:56, background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 20px', gap:12, position:'sticky', top:0, zIndex:100 }}>
          <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'none' }}>
            <Menu size={20} />
          </button>
          <style>{`.mobile-menu-btn{display:none!important}@media(max-width:768px){.mobile-menu-btn{display:flex!important}}`}</style>
          <div style={{ flex:1 }} />

          {/* Bell */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setNotifOpen(o => !o)} style={{ position:'relative', background:'rgba(255,255,255,.05)', border:'1px solid var(--border)', borderRadius:8, padding:'7px 10px', cursor:'pointer', color:'var(--text-secondary)', display:'flex', alignItems:'center' }}>
              <Bell size={16} />
              {unread > 0 && <span style={{ position:'absolute', top:-4, right:-4, background:'var(--accent-rose)', color:'#fff', borderRadius:999, fontSize:10, fontWeight:700, width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center' }}>{unread}</span>}
            </button>

            {notifOpen && (
              <div style={{ position:'absolute', right:0, top:'110%', zIndex:300, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-md)', width:340, boxShadow:'var(--shadow-lg)', overflow:'hidden' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>Notifications</span>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {unread > 0 && <button onClick={() => dispatch({ type:'MARK_ALL_READ' })} style={{ background:'none', border:'none', fontSize:12, color:'var(--accent-blue)', cursor:'pointer' }}>Mark all read</button>}
                    <button onClick={() => setNotifOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={14} /></button>
                  </div>
                </div>
                <div style={{ maxHeight:360, overflowY:'auto' }}>
                  {notifs.length === 0
                    ? <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>No notifications</div>
                    : notifs.slice(0, 20).map(n => (
                        <div key={n.id} onClick={() => dispatch({ type:'MARK_READ', id:n.id })} style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background: n.read ? 'transparent' : 'rgba(59,130,246,.05)', cursor:'pointer' }}>
                          <div style={{ fontSize:13, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', marginBottom:3 }}>{n.message}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>{n.ts?.slice(0,16).replace('T',' ')}</div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{ flex:1, padding:'24px 28px', width:'100%', maxWidth:'100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
