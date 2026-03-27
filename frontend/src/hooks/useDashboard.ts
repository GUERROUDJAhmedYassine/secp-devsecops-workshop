import { useState, useEffect } from 'react';
import { getUser, getStats } from '../api/dashboard';
import type { User } from '../types/auth.types';

export function useDashboard() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<User | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUser(), getStats()])
      .then(([u, s]) => {
        setUser(u as User);
        setStats(s);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, stats, loading };
}
