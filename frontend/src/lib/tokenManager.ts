/* ------------------------------------------------------------------
 *  Token Manager
 *  Auth tokens are stored by the API in HttpOnly cookies. JavaScript
 *  cannot read or write them; this module only coordinates refresh.
 * ------------------------------------------------------------------ */

import { AUTH_BASE } from './constants';
import type { AuthTokens } from '../types/user.types';

const LEGACY_ACCESS_KEY = 'secp_access_token';
const LEGACY_REFRESH_KEY = 'secp_refresh_token';

function clearLegacyLocalStorage(): void {
  localStorage.removeItem(LEGACY_ACCESS_KEY);
  localStorage.removeItem(LEGACY_REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return null;
}

export function getRefreshToken(): string | null {
  return null;
}

export function setTokens(_tokens: AuthTokens): void {
  // Cookies are set by the auth service with HttpOnly.
  clearLegacyLocalStorage();
}

export function clearTokens(): void {
  // Cookies are cleared by /auth/logout. Nothing client-readable remains.
  clearLegacyLocalStorage();
}

/* ---- silent refresh ---- */

let refreshPromise: Promise<AuthTokens> | null = null;

/**
 * Attempt to obtain a new access token using the HttpOnly refresh cookie.
 * De-duplicates concurrent calls so only one network request fires.
 */
export async function silentRefresh(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch(`${AUTH_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      clearTokens();
      throw new Error('Refresh failed');
    }

    const tokens: AuthTokens = await res.json();
    return tokens;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
