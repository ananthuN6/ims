// frontend/src/context/AppContext.jsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { api, setApiUser } from '../utils/api';

const Ctx = createContext(null);

const INIT = {
  currentUser:   null,
  users:         [],
  incidents:     [],
  emailLog:      [],
  notifications: [],   // in-app bell (derived from workflow events during session)
  loading:       false,
  error:         null,
};

function addNotif(state, message, forUserId) {
  if (!forUserId || forUserId !== state.currentUser?.id) return state.notifications;
  return [
    ...state.notifications,
    { id: Date.now(), message, read: false, ts: new Date().toISOString() },
  ];
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':      return { ...state, currentUser: action.user, error: null };
    case 'SET_LOADING':   return { ...state, loading: action.v };
    case 'SET_ERROR':     return { ...state, error: action.msg, loading: false };
    case 'CLEAR_ERROR':   return { ...state, error: null };
    case 'SET_USERS':     return { ...state, users: action.users };
    case 'SET_INCIDENTS': return { ...state, incidents: action.incidents };
    case 'SET_EMAIL_LOG': return { ...state, emailLog: action.log };
    case 'UPSERT_INCIDENT': {
      const exists = state.incidents.find(i => i.id === action.incident.id);
      const incidents = exists
        ? state.incidents.map(i => i.id === action.incident.id ? action.incident : i)
        : [action.incident, ...state.incidents];
      return { ...state, incidents };
    }
    case 'ADD_NOTIF':
      return { ...state, notifications: [{ id: Date.now(), message: action.message, read: false, ts: new Date().toISOString() }, ...state.notifications] };
    case 'MARK_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.id ? { ...n, read: true } : n) };
    case 'MARK_ALL_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case 'LOGOUT':
      return { ...INIT };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INIT);

  const setUser = useCallback((user) => {
    if (user) setApiUser(user.email);
    dispatch({ type: 'SET_USER', user });
  }, []);

  const logout = useCallback(() => {
    setApiUser(null);
    dispatch({ type: 'LOGOUT' });
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      const data = await api.getIncidents();
      dispatch({ type: 'SET_INCIDENTS', incidents: data });
    } catch (e) { dispatch({ type: 'SET_ERROR', msg: e.message }); }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      dispatch({ type: 'SET_USERS', users: data });
    } catch {}
  }, []);

  const loadEmailLog = useCallback(async () => {
    try {
      const data = await api.getEmailLog();
      dispatch({ type: 'SET_EMAIL_LOG', log: data });
    } catch {}
  }, []);

  // Auto-load users when current user is set
  React.useEffect(() => {
    if (state.currentUser) {
      loadUsers();
    }
  }, [state.currentUser, loadUsers]);

  return (
    <Ctx.Provider value={{ state, dispatch, setUser, logout, loadIncidents, loadUsers, loadEmailLog }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp       = () => useContext(Ctx);
export const useCurrentUser = () => useContext(Ctx).state.currentUser;
export const useMyNotifs  = () => {
  const { state } = useContext(Ctx);
  return state.notifications;
};
