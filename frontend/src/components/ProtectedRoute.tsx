/* ------------------------------------------------------------------
 *  ProtectedRoute
 *  • Redirects to /login if unauthenticated.
 *  • Blocks non-IT_ADMIN from admin pages when requireAdmin is set.
 *  • Shows a loading spinner while the auth state is resolving.
 * ------------------------------------------------------------------ */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  /** When true, only IT_ADMIN users may access children. */
  requireAdmin?: boolean;
  children?: React.ReactNode;
}

export default function ProtectedRoute({
  requireAdmin = false,
  children,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page text-primary font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">Verifying session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
