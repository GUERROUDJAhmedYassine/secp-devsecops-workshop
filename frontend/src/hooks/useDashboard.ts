/* ------------------------------------------------------------------
 *  useDashboard hook
 *  Fetches the current user and dashboard stats conditionally.
 * ------------------------------------------------------------------ */

import { useState, useEffect } from 'react';
import { getStats } from '../api/dashboard';
import { useAuth } from './useAuth';

export function useDashboard() {
  const { user, isManagerOrAbove, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    if (isManagerOrAbove) {
      setLoadingStats(true);
      getStats()
        .then((s) => setStats(s))
        .catch(console.error)
        .finally(() => setLoadingStats(false));
    } else {
      setStats({
        unread_emails: 3,
        new_messages: 1,
        my_files_count: 8,
        my_files_size: '42 MB',
        vpn_status: 'Active',
        vpn_ip: '10.8.0.44',
      });
    }
  }, [user, isManagerOrAbove, authLoading]);

  return { user, stats, loading: authLoading || loadingStats };
}
