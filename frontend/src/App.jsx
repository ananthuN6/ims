/* eslint-disable no-unused-vars */
// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/msalConfig';
import { AppProvider, useApp, useCurrentUser } from './context/AppContext';
import AuthRestore from './auth/AuthRestore';
import { Spinner } from './components/ui';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import IncidentDetail from './pages/IncidentDetail';
import ReportIncident from './pages/ReportIncident';
import EmailLog from './pages/EmailLog';
import Admin from './pages/Admin';
import { hasIRTRole } from './constants';

function RequireAuth({ children }) {
  const user = useCurrentUser();
  const { state } = useApp();
  if (state.authChecking) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
        <Spinner size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireAdmin({ children }) {
  const user = useCurrentUser();
  if (!user?.isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireIRT({ children }) {
  const user = useCurrentUser();
  if (!hasIRTRole(user)) return <Navigate to="/dashboard" replace />;
  return children;
}

function RequireEmployee({ children }) {
  const user = useCurrentUser();
  // IRT can access everything; only block non-IRT from IRT-only pages
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
        <Route path="/email-log" element={<RequireAuth><RequireIRT><EmailLog /></RequireIRT></RequireAuth>} />
        <Route path="/admin"    element={<RequireAuth><RequireAdmin><Admin /></RequireAdmin></RequireAuth>} />
        <Route path="*"         element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App({ instance = msalInstance }) {
  return (
    <MsalProvider instance={instance}>
      <AppProvider>
        <AuthRestore />
        <AppContent />
      </AppProvider>
    </MsalProvider>
  );
}
