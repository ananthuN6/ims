// frontend/src/pages/Login.jsx
/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';
import { useApp, useCurrentUser } from '../context/AppContext';
import { api} from '../utils/api';
import { ShieldCheck } from 'lucide-react';
import { Spinner } from '../components/ui';

export default function Login() {
  const { instance } = useMsal();
  const { setUser, state } = useApp();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!state.authChecking && user) navigate('/dashboard', { replace: true });
  }, [user, state.authChecking, navigate]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await instance.loginPopup(loginRequest);
      const accessToken = result.accessToken;

      // Hand token to backend – backend verifies via Graph and returns IMS user
      const { user: imsUser } = await api.login(accessToken);

      setUser(imsUser);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.message || 'Sign-in failed';
      // Friendly message for users not in the system
      if (msg.includes('Access denied') || msg.includes('not been added')) {
        setError('Your account has not been added to IMS. Please contact your IRT Administrator.');
      } else if (msg.toLowerCase().includes('cancelled') || msg.toLowerCase().includes('user_cancelled')) {
        setError('');  // user closed popup
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (state.authChecking) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-primary)' }}>
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg-primary)', padding:24,
    }}>
      <div style={{ width:'100%', maxWidth:400 }} className="animate-fade-up">
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div className="ms-logo-tile ms-logo-tile--lg" style={{ margin:'0 auto 14px' }}>
            <ShieldCheck size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'var(--text-primary)', letterSpacing:'-0.03em' }}>Incident Management</h1>
          <p style={{ fontSize:14, color:'var(--text-muted)', marginTop:6 }}>Sign in with your Microsoft account</p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:28, boxShadow:'var(--shadow-lg)' }}>

          {error && (
            <div style={{ marginBottom:20, padding:'12px 14px', borderRadius:'var(--radius-sm)', background:'var(--ms-danger-subtle)', border:'1px solid var(--ms-danger)', fontSize:13, color:'var(--ms-danger)', lineHeight:1.5 }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} className="ms-sign-in-btn">
            {loading ? <Spinner size={20} /> : (
              /* Microsoft logo SVG */
              <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
            )}
            {loading ? 'Signing in…' : 'Continue with Microsoft'}
          </button>

          <p style={{ marginTop:20, fontSize:12, color:'var(--text-muted)', textAlign:'center', lineHeight:1.6 }}>
            Access is restricted to registered IMS users.<br />
            Contact your IRT Administrator to request access.
          </p>
        </div>
      </div>
    </div>
  );
}
