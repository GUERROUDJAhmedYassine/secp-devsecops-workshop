/* ------------------------------------------------------------------
 *  Auth Context
 *  Provides user state, role, login / logout actions, and persists
 *  the session via tokenManager.
 * ------------------------------------------------------------------ */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, UserRole, LoginCredentials, AuthTokens } from '../types/user.types';
import { setTokens, clearTokens, getAccessToken } from '../lib/tokenManager';
import { AUTH_BASE } from '../lib/constants';
import { apiGet, apiPost } from '../lib/apiClient';

/* ---- context shape ---- */

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (creds: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/* ---- provider ---- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /* Attempt to restore the session from a stored token on mount */
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiGet<User>(`${AUTH_BASE}/auth/me`)
      .then((u) => setUser(u))
      .catch(() => {
        clearTokens();
      })
      .finally(() => setIsLoading(false));
  }, []);

  /* ---- login ---- */
  const login = useCallback(async (creds: LoginCredentials) => {
    setError(null);
    setIsLoading(true);

    try {
      /* The FastAPI OAuth2 form-based login expects x-www-form-urlencoded */
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
          (body as Record<string, string>).detail ?? 'Invalid credentials',
        );
      }

      const tokens: AuthTokens = await res.json();
      setTokens(tokens);

      const me = await apiGet<User>(`${AUTH_BASE}/auth/me`);
      setUser(me);
      return me;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---- logout ---- */
  const logout = useCallback(async () => {
    try {
      await apiPost(`${AUTH_BASE}/auth/logout`).catch(() => {
        /* best-effort server-side invalidation */
      });
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value: AuthState = {
    user,
    role: user?.role ?? null,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ---- hook ---- */

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}

export { AuthContext };
