import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { useSiem } from '../hooks/useSiem';
import type { Alert, SiemWsPayload } from '../types/siem.types';

function isPopupSeverity(alert: Alert): boolean {
  return alert.severity === 'HIGH' || alert.severity === 'CRITICAL';
}

function isActiveAlert(alert: Alert): boolean {
  return alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED';
}

function isEligibleAlert(alert: Alert): boolean {
  return isPopupSeverity(alert) && isActiveAlert(alert);
}

function formatAlertType(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatAlertTime(value?: string | null): string {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function enqueueAlert(
  nextAlert: Alert,
  dismissedIdsRef: MutableRefObject<Set<string>>,
  queuedIdsRef: MutableRefObject<Set<string>>,
  setQueue: Dispatch<SetStateAction<Alert[]>>,
) {
  if (!isEligibleAlert(nextAlert)) return;
  if (dismissedIdsRef.current.has(nextAlert.id)) return;
  if (queuedIdsRef.current.has(nextAlert.id)) return;

  queuedIdsRef.current.add(nextAlert.id);
  setQueue((current) => [...current, nextAlert]);
}

export default function AdminAlertPopup() {
  const { isAdmin, isAuthenticated } = useAuth();
  const { alerts, lastMessage, refreshAlerts } = useSiem();

  const [queue, setQueue] = useState<Alert[]>([]);

  const initializedRef = useRef(false);
  const trackedIdsRef = useRef<Set<string>>(new Set());
  const queuedIdsRef = useRef<Set<string>>(new Set());
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isAdmin) {
      setQueue([]);
      initializedRef.current = false;
      trackedIdsRef.current.clear();
      queuedIdsRef.current.clear();
      dismissedIdsRef.current.clear();
    }
  }, [isAdmin]);

  useLiveRefresh(
    async () => {
      await refreshAlerts();
    },
    {
      enabled: isAuthenticated && isAdmin,
      intervalMs: 8000,
    },
  );

  useEffect(() => {
    if (!isAdmin) return;

    const eligibleAlerts = alerts.filter(isEligibleAlert);

    if (!initializedRef.current) {
      trackedIdsRef.current = new Set(eligibleAlerts.map((alert) => alert.id));
      initializedRef.current = true;
      return;
    }

    eligibleAlerts.forEach((alert) => {
      if (!trackedIdsRef.current.has(alert.id)) {
        trackedIdsRef.current.add(alert.id);
        enqueueAlert(alert, dismissedIdsRef, queuedIdsRef, setQueue);
      }
    });
  }, [alerts, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !lastMessage) return;

    const payloads = Array.isArray(lastMessage) ? lastMessage : [lastMessage];
    payloads.forEach((payload) => {
      const message = payload as SiemWsPayload;
      if (message.type !== 'new_alert' && message.type !== 'alert_updated') return;
      trackedIdsRef.current.add(message.data.id);
      enqueueAlert(message.data, dismissedIdsRef, queuedIdsRef, setQueue);
    });
  }, [isAdmin, lastMessage]);

  const activeAlert = queue[0] ?? null;

  if (!isAdmin || !activeAlert) {
    return null;
  }

  const pendingCount = Math.max(0, queue.length - 1);
  const severityTone = {
    border: 'border-red-500/30',
    panel: 'bg-red-500/10',
    text: 'text-red-400',
    badge: 'bg-red-500/15 border-red-500/20 text-red-400',
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-4">
      <div className={`w-full max-w-2xl overflow-hidden rounded-2xl border ${severityTone.border} bg-page shadow-2xl`}>
        <div className={`border-b border-border px-6 py-5 ${severityTone.panel}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`rounded-2xl border ${severityTone.border} bg-page p-3 ${severityTone.text}`}>
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-[0.24em] ${severityTone.text}`}>
                  Security Alert Popup
                </div>
                <h2 className="mt-1 text-xl font-bold text-primary">
                  {formatAlertType(activeAlert.alert_type)}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${severityTone.badge}`}>
                    {activeAlert.severity}
                  </span>
                  <span className="rounded-full border border-border bg-page px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-muted">
                    {activeAlert.status}
                  </span>
                  {pendingCount > 0 && (
                    <span className="rounded-full border border-[#4f8ef7]/20 bg-[#4f8ef7]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-[#4f8ef7]">
                      {pendingCount} more pending
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Triggered
              </div>
              <div className="mt-1 text-xs font-semibold text-primary">
                {formatAlertTime(activeAlert.created_at)}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted">
              <AlertTriangle className={`h-4 w-4 ${severityTone.text}`} />
              Description
            </div>
            <p className="text-sm leading-7 text-primary">
              {activeAlert.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Affected User</div>
              <div className="mt-2 text-sm font-semibold text-primary">
                {activeAlert.username ?? activeAlert.user_id}
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Alert Id</div>
              <div className="mt-2 break-all text-sm font-semibold text-primary">
                {activeAlert.id}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                dismissedIdsRef.current.add(activeAlert.id);
                queuedIdsRef.current.delete(activeAlert.id);
                setQueue((current) => current.filter((alert) => alert.id !== activeAlert.id));
              }}
              className="rounded-xl bg-[#4f8ef7] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#3b7ae5]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
