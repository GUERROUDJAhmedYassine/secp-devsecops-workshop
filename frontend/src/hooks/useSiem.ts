/* ------------------------------------------------------------------
 *  useSiem hook
 *  Live alert feed via WebSocket, alert updates, baseline data.
 * ------------------------------------------------------------------ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WsManager } from '../lib/websocket';
import {
  getAlerts,
  getBaselines,
  updateAlertStatus as apiUpdateAlertStatus,
  createSiemSocket,
} from '../api/siem';
import type {
  Alert,
  UserBaseline,
  AlertStatusUpdate,
  SiemWsPayload,
} from '../types/siem.types';
import { useAuth } from './useAuth';

export function useSiem() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [baselines, setBaselines] = useState<UserBaseline[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const wsRef = useRef<WsManager | null>(null);

  /* ---- initial fetch ---- */
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    Promise.all([
      getAlerts({ per_page: 100 }),
      getBaselines(),
    ])
      .then(([alertRes, baselineRes]) => {
        setAlerts(alertRes.alerts);
        setBaselines(baselineRes);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAuthenticated, isAdmin]);

  /* ---- WebSocket lifecycle ---- */
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const ws = createSiemSocket((raw: unknown) => {
      setLastMessage(raw);
      const payloads = Array.isArray(raw) ? raw : [raw];

      payloads.forEach(p => {
        const payload = p as SiemWsPayload;

        switch (payload.type) {
          case 'new_alert':
            setAlerts((prev) => [payload.data, ...prev]);
            break;

          case 'alert_updated':
            setAlerts((prev) =>
              prev.map((a) => (a.id === payload.data.id ? payload.data : a)),
            );
            break;
            
          case 'new_baseline':
            setBaselines((prev) => {
              const exists = prev.find(b => b.user_id === payload.data.user_id);
              if (exists) {
                return prev.map(b => b.user_id === payload.data.user_id ? payload.data : b);
              }
              return [...prev, payload.data];
            });
            break;

          default:
            break;
        }
      });
    });

    ws.connect();
    wsRef.current = ws;
    setConnected(true);

    return () => {
      ws.disconnect();
      wsRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated, isAdmin]);

  /* ---- alert status mutation ---- */
  const updateAlertStatus = useCallback(
    async (alertId: string, update: AlertStatusUpdate) => {
      const updated = await apiUpdateAlertStatus(alertId, update);
      setAlerts((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
      return updated;
    },
    [],
  );

  /** Refresh alerts from the server. */
  const refreshAlerts = useCallback(async () => {
    const res = await getAlerts({ per_page: 100 });
    setAlerts(res.alerts);
  }, []);

  return {
    alerts,
    baselines,
    connected,
    loading,
    updateAlertStatus,
    refreshAlerts,
    lastMessage,
  };
}
