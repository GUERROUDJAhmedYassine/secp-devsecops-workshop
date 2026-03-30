/* ------------------------------------------------------------------
 *  useAuth hook
 *  Login / logout actions, current user, role checks.
 * ------------------------------------------------------------------ */

import { useCallback } from 'react';
import { useAuthContext } from '../context/AuthContext';
import type { UserRole } from '../types/user.types';

export function useAuth() {
  const ctx = useAuthContext();

  /** Check whether the current user has one of the given roles. */
  const hasRole = useCallback(
    (...roles: UserRole[]): boolean => {
      return ctx.role !== null && roles.includes(ctx.role);
    },
    [ctx.role],
  );

  /** Convenience: true when the user is IT_ADMIN. */
  const isAdmin = ctx.role === 'IT_ADMIN';

  /** Convenience: true when the user is MANAGER or IT_ADMIN. */
  const isManagerOrAbove =
    ctx.role === 'MANAGER' || ctx.role === 'IT_ADMIN';

  return {
    user: ctx.user,
    role: ctx.role,
    isAuthenticated: ctx.isAuthenticated,
    isLoading: ctx.isLoading,
    error: ctx.error,
    login: ctx.login,
    logout: ctx.logout,
    clearError: ctx.clearError,
    hasRole,
    isAdmin,
    isManagerOrAbove,
  };
}
