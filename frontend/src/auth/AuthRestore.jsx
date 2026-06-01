// Restores IMS session from MSAL cache after page refresh
import React, { useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionRequiredAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from './msalConfig';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

export default function AuthRestore() {
  const { instance, accounts, inProgress } = useMsal();
  const { state, setUser, setAuthChecking } = useApp();

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    let cancelled = false;

    async function restore() {
      if (state.currentUser) {
        setAuthChecking(false);
        return;
      }

      const account = instance.getActiveAccount() || accounts[0];
      if (!account) {
        setAuthChecking(false);
        return;
      }

      if (!instance.getActiveAccount()) {
        instance.setActiveAccount(account);
      }

      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        const { user } = await api.login(result.accessToken);
        if (!cancelled) setUser(user);
      } catch (err) {
        if (err instanceof InteractionRequiredAuthError) {
          console.info('[Auth] Interactive login required');
        } else {
          console.warn('[Auth] Session restore failed:', err.message);
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    restore();
    return () => { cancelled = true; };
  }, [inProgress, instance, accounts, state.currentUser, setUser, setAuthChecking]);

  return null;
}
