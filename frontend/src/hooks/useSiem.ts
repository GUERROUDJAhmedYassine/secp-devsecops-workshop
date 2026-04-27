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

const ALERT_SYNC_EVENT = 'secp:siem-alert-sync';

interface AlertSyncDetail {
  alert: Alert;
}

function sortAlertsByCreatedAt(items: Alert[]): Alert[] {
  return [...items].sort((a, b) => {
    const left = Date.parse(a.created_at);
    const right = Date.parse(b.created_at);
    const safeLeft = Number.isNaN(left) ? 0 : left;
    const safeRight = Number.isNaN(right) ? 0 : right;
    return safeRight - safeLeft;
  });
}

function upsertAlert(items: Alert[], nextAlert: Alert): Alert[] {
  const remaining = items.filter((alert) => alert.id !== nextAlert.id);
  return sortAlertsByCreatedAt([nextAlert, ...remaining]);
}

function broadcastAlertSync(alert: Alert) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AlertSyncDetail>(ALERT_SYNC_EVENT, {
      detail: { alert },
    }),
  );
}

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
            setAlerts((prev) => upsertAlert(prev, payload.data));
            broadcastAlertSync(payload.data);
            break;

          case 'alert_updated':
            setAlerts((prev) =>
              upsertAlert(prev, payload.data),
            );
            broadcastAlertSync(payload.data);
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

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const handleAlertSync = (event: Event) => {
      const detail = (event as CustomEvent<AlertSyncDetail>).detail;
      if (!detail?.alert) return;
      setAlerts((prev) => upsertAlert(prev, detail.alert));
    };

    window.addEventListener(ALERT_SYNC_EVENT, handleAlertSync as EventListener);
    return () => {
      window.removeEventListener(ALERT_SYNC_EVENT, handleAlertSync as EventListener);
    };
  }, [isAuthenticated, isAdmin]);

  /* ---- alert status mutation ---- */
  const updateAlertStatus = useCallback(
    async (alertId: string, update: AlertStatusUpdate) => {
      const updated = await apiUpdateAlertStatus(alertId, update);
      setAlerts((prev) => upsertAlert(prev, updated));
      broadcastAlertSync(updated);
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
