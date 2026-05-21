// frontend/src/auth/msalConfig.js
import { PublicClientApplication, LogLevel } from '@azure/msal-browser';
import { AZURE } from '../config';

const redirectUri = typeof window !== 'undefined' ? window.location.origin : AZURE.redirectUri;

export const msalConfig = {
  auth: {
    clientId:    AZURE.clientId,
    authority:   `https://login.microsoftonline.com/${AZURE.tenantId}`,
    redirectUri,
    navigateToLoginRequestUrl: false,  // Don't navigate after token refresh
  },
  cache: {
    cacheLocation:       'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, msg, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error('[MSAL]', msg);
      },
    },
    allowNativeBroker: false,  // Disable native broker to avoid hash issues
  },
};

// Scopes needed: openid + profile so we can call /me on Graph
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

export const msalInstance = new PublicClientApplication(msalConfig);
