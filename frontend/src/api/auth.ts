/* ------------------------------------------------------------------
 *  Auth API
 *  Login, register, logout, refresh, /auth/me, password change.
 * ------------------------------------------------------------------ */

import { AUTH_BASE } from '../lib/constants';
import { apiGet, apiPost, apiPut } from '../lib/apiClient';
import { setTokens, clearTokens } from '../lib/tokenManager';
import type {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterPayload,
  PasswordChangePayload,
} from '../types/user.types';

import type { DirectoryUser } from '../types/user.types';
// NOTE: messaging directory is intentionally minimal (no PII)

/**
 * Authenticate a user. Returns tokens and stores them.
 * Uses form-urlencoded body for FastAPI OAuth2PasswordRequestForm.
 */
export async function login(creds: LoginCredentials): Promise<AuthTokens> {
  const formData = new URLSearchParams();
  formData.append('username', creds.username);
  formData.append('password', creds.password);

  const res = await fetch(`${AUTH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as Record<string, string>).detail ?? 'Login failed',
    );
  }

  const tokens: AuthTokens = await res.json();
  setTokens(tokens);
  return tokens;
}

/** Register a new user account (IT_ADMIN only in most deployments). */
export async function register(payload: RegisterPayload): Promise<User> {
  return apiPost<User>(`${AUTH_BASE}/auth/register`, payload);
}

/** Server-side token invalidation + local cleanup. */
export async function logout(): Promise<void> {
  try {
    await apiPost(`${AUTH_BASE}/auth/logout`);
  } finally {
    clearTokens();
  }
}

/** Refresh access token using stored refresh token. */
export async function refreshToken(refresh_token: string): Promise<AuthTokens> {
  const tokens = await apiPost<AuthTokens>(
    `${AUTH_BASE}/auth/refresh`,
    { refresh_token },
    { skipAuth: true },
  );
  setTokens(tokens);
  return tokens;
}

/** Get the currently authenticated user. */
export async function getMe(): Promise<User> {
  return apiGet<User>(`${AUTH_BASE}/auth/me`);
}

/** Change the current user's password. */
export async function changePassword(payload: PasswordChangePayload): Promise<void> {
  await apiPut(`${AUTH_BASE}/auth/password`, payload);
}

/** Public user directory for DM user picker (any authenticated user). */
export async function listDirectoryUsers(): Promise<DirectoryUser[]> {
  return apiGet<DirectoryUser[]>(`${AUTH_BASE}/auth/users`);
}
