/* ------------------------------------------------------------------
 *  Token Manager
 *  Stores access / refresh tokens in localStorage, exposes helpers
 *  for silent refresh and logout cleanup.
 * ------------------------------------------------------------------ */

import { AUTH_BASE } from './constants';
import type { AuthTokens } from '../types/user.types';

const ACCESS_KEY = 'secp_access_token';
const REFRESH_KEY = 'secp_refresh_token';

/* ---- getters / setters ---- */

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  // Store in localStorage for application logic
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  // Store in document.cookie so they show up in browser "Cookies" tab (client-side cookies)
  document.cookie = `${ACCESS_KEY}=${tokens.access_token}; path=/; max-age=86400; SameSite=Strict`;
  
  if (tokens.refresh_token) {
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
    document.cookie = `${REFRESH_KEY}=${tokens.refresh_token}; path=/; max-age=604800; SameSite=Strict`;
  }
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${ACCESS_KEY}=; path=/; max-age=0;`;
  document.cookie = `${REFRESH_KEY}=; path=/; max-age=0;`;
}

/* ---- silent refresh ---- */

let refreshPromise: Promise<AuthTokens> | null = null;

/**
 * Attempt to obtain a new access token using the stored refresh token.
 * De-duplicates concurrent calls so only one network request fires.
 */
export async function silentRefresh(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;

  const refresh_token = getRefreshToken();
  if (!refresh_token) {
    return Promise.reject(new Error('No refresh token available'));
  }

  refreshPromise = (async () => {
    const res = await fetch(`${AUTH_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    });

    if (!res.ok) {
      clearTokens();
      throw new Error('Refresh failed');
    }

    const tokens: AuthTokens = await res.json();
    setTokens(tokens);
    return tokens;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
