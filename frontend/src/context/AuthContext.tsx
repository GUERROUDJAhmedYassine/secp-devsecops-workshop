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
import { setTokens, clearTokens } from '../lib/tokenManager';
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

  /* Attempt to restore the session from the HttpOnly access cookie on mount */
  useEffect(() => {
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
      /* The FastAPI login endpoint expects JSON for body: UserLogin */
      const res = await fetch(`${AUTH_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: creds.username,
          password: creds.password,
        }),
      });

      if (!res.ok) {
        let errMessage = 'Invalid credentials';
        try {
          const body = await res.json();
          if (Array.isArray(body.detail)) {
            // FastAPI validation error array inside detail
            errMessage = body.detail[0]?.msg || 'Validation Error';
          } else if (body.detail) {
            errMessage = body.detail;
          }
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errMessage);
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
