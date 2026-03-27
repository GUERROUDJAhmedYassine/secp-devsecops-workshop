import { Navigate } from 'react-router-dom';

const MOCK_ROLE = 'IT_ADMIN';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  if (MOCK_ROLE !== 'IT_ADMIN') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
