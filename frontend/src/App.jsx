/* eslint-disable no-unused-vars */
// frontend/src/App.jsx
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/msalConfig';
import { AppProvider, useCurrentUser } from './context/AppContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import ReportIncident from './pages/ReportIncident';
import EmailLog from './pages/EmailLog';
import Admin from './pages/Admin';

function RequireAuth({ children }) {
  const user = useCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireAdmin({ children }) {
  const user = useCurrentUser();
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireIso({ children }) {
  const user = useCurrentUser();
  if (!user || (user.role !== 'iso' && !user.isAdmin)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireEmployee({ children }) {
  const user = useCurrentUser();
  // ISO can access everything; only block non-ISO from ISO-only pages
  return children;
}

function AppContent() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/incidents" element={<RequireAuth><Incidents /></RequireAuth>} />
        <Route path="/incidents/:id" element={<RequireAuth><IncidentDetail /></RequireAuth>} />
        <Route path="/report"   element={<RequireAuth><ReportIncident /></RequireAuth>} />
        <Route path="/email-log" element={<RequireAuth><RequireIso><EmailLog /></RequireIso></RequireAuth>} />
        <Route path="/admin"    element={<RequireAuth><RequireAdmin><Admin /></RequireAdmin></RequireAuth>} />
        <Route path="*"         element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  const [msal, setMsal] = useState(null);

  useEffect(() => {
    // Initialize MSAL and handle any pending redirect responses
    msalInstance.handleRedirectPromise()
      .then(() => {
        setMsal(msalInstance);
      })
      .catch(err => {
        console.error('[MSAL] Redirect promise error:', err);
        setMsal(msalInstance);  // Continue anyway
      });
  }, []);

  if (!msal) return null;  // Wait for MSAL to initialize

  return (
    <MsalProvider instance={msal}>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </MsalProvider>
  );
}
