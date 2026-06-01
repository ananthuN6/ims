import React from 'react';
import ReactDOM from 'react-dom/client';
import { EventType } from '@azure/msal-browser';
import { msalInstance } from './auth/msalConfig';
import './index.css';
import App from './App';

msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch(() => {});

  if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    msalInstance.setActiveAccount(msalInstance.getAllAccounts()[0]);
  }

  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
      msalInstance.setActiveAccount(event.payload.account);
    }
  });

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App instance={msalInstance} />
    </React.StrictMode>
  );
});
