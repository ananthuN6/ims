// frontend/src/utils/userPhotos.js
import { API_BASE } from '../config';
import { getApiUserEmail } from './api';

const cache = new Map();

export function getCachedPhoto(email) {
  const key = email?.toLowerCase();
  if (!key || !cache.has(key)) return undefined;
  return cache.get(key);
}

export function primePhotoCache(email, src) {
  const key = email?.toLowerCase();
  if (!key) return;
  cache.set(key, src || null);
}

export async function loadUserPhoto(email) {
  const key = email?.toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  const authEmail = getApiUserEmail();
  if (!authEmail) {
    cache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/users/photo/${encodeURIComponent(key)}`, {
      headers: { 'x-user-email': authEmail },
    });
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    cache.set(key, objectUrl);
    return objectUrl;
  } catch {
    cache.set(key, null);
    return null;
  }
}
