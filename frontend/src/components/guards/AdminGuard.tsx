/* ------------------------------------------------------------------
 *  AdminGuard (legacy wrapper – now delegates to ProtectedRoute)
 * ------------------------------------------------------------------ */

import ProtectedRoute from '../ProtectedRoute';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requireAdmin>{children}</ProtectedRoute>;
}
