import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  FileText,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { MAIL_SYNC_EVENT, getInbox } from '../api/email';
import { getFiles } from '../api/files';
import { getDmUnreadCounts } from '../api/messaging';
import { useAuth } from '../hooks/useAuth';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { useSiem } from '../hooks/useSiem';
import type { EmailMessage } from '../types/email.types';
import type { SecureFile } from '../types/files.types';
import type { UnreadCount } from '../types/messaging.types';
import type { Alert } from '../types/siem.types';

interface NotificationDropdownProps {
  buttonClassName?: string;
  iconClassName?: string;
}

interface GeneralNotificationItem {
  id: string;
  title: string;
  detail: string;
  timestamp?: string | null;
  path: string;
  kind: 'mail' | 'message' | 'file';
}

function toMillis(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatBadge(value: number): string {
  if (value > 99) return '99+';
  return String(value);
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatAlertType(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function alertSeverityClass(severity: Alert['severity']): string {
  switch (severity) {
    case 'CRITICAL':
      return 'text-red-400';
    case 'HIGH':
      return 'text-orange-400';
    case 'MEDIUM':
      return 'text-amber-400';
    default:
      return 'text-[#4f8ef7]';
  }
}

export default function NotificationDropdown({
  buttonClassName = 'p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors',
  iconClassName = 'w-5 h-5',
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { alerts, refreshAlerts } = useSiem();

  const [open, setOpen] = useState(false);
  const [generalLoading, setGeneralLoading] = useState(true);
  const [unreadEmails, setUnreadEmails] = useState<EmailMessage[]>([]);
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);
  const [dmUnread, setDmUnread] = useState<UnreadCount[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SecureFile[]>([]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const didLoadRef = useRef(false);

  const loadGeneralNotifications = useCallback(async () => {
    if (!user?.id) return;

    if (!didLoadRef.current) {
      setGeneralLoading(true);
    }

    const results = await Promise.allSettled([
      getInbox({ perPage: 3, unreadOnly: true }),
      getDmUnreadCounts(),
      getFiles(),
    ]);

    const [inboxResult, dmResult, filesResult] = results;

    if (inboxResult.status === 'fulfilled') {
      setUnreadEmails(inboxResult.value.emails);
      setUnreadEmailCount(inboxResult.value.unread_count);
    }

    if (dmResult.status === 'fulfilled') {
      setDmUnread(dmResult.value);
    }

    if (filesResult.status === 'fulfilled') {
      const visibleSharedFiles = filesResult.value
        .filter((file) => !file.is_deleted)
        .filter((file) => file.bucket !== 'personal' || file.owner_id !== user.id)
        .sort((a, b) => toMillis(b.uploaded_at) - toMillis(a.uploaded_at));
      setSharedFiles(visibleSharedFiles.slice(0, 3));
    }

    didLoadRef.current = true;
    setGeneralLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadGeneralNotifications();
  }, [loadGeneralNotifications]);

  useLiveRefresh(
    async () => {
      await loadGeneralNotifications();
    },
    {
      enabled: Boolean(user?.id),
      intervalMs: 8000,
    },
  );

  useEffect(() => {
    if (!open) return;

    void loadGeneralNotifications();
    if (isAdmin) {
      void refreshAlerts();
    }
  }, [isAdmin, loadGeneralNotifications, open, refreshAlerts]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const handleMailSync = () => {
      void loadGeneralNotifications();
    };

    window.addEventListener(MAIL_SYNC_EVENT, handleMailSync);
    return () => {
      window.removeEventListener(MAIL_SYNC_EVENT, handleMailSync);
    };
  }, [loadGeneralNotifications]);

  const activeAlerts = useMemo(
    () =>
      isAdmin
        ? [...alerts]
            .filter((alert) => alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED')
            .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at))
        : [],
    [alerts, isAdmin],
  );

  const unreadDmTotal = useMemo(
    () => dmUnread.reduce((sum, item) => sum + item.unread_count, 0),
    [dmUnread],
  );

  const latestUnreadDmAt = useMemo(
    () => dmUnread.reduce((latest, item) => (toMillis(item.latest_at) > toMillis(latest) ? item.latest_at : latest), ''),
    [dmUnread],
  );

  const generalItems = useMemo<GeneralNotificationItem[]>(() => {
    const items: GeneralNotificationItem[] = [];

    if (unreadEmailCount > 0) {
      const latestEmail = unreadEmails[0];
      items.push({
        id: 'unread-emails',
        title: `${unreadEmailCount} unread email${unreadEmailCount === 1 ? '' : 's'}`,
        detail: latestEmail
          ? `${latestEmail.sender_username || latestEmail.sender_email}: ${latestEmail.subject}`
          : 'New inbox activity is waiting for you.',
        timestamp: latestEmail?.sent_at ?? null,
        path: '/webmail',
        kind: 'mail',
      });
    }

    if (unreadDmTotal > 0) {
      items.push({
        id: 'unread-messages',
        title: `${unreadDmTotal} unread message${unreadDmTotal === 1 ? '' : 's'}`,
        detail: `${dmUnread.length} direct conversation${dmUnread.length === 1 ? '' : 's'} need attention.`,
        timestamp: latestUnreadDmAt,
        path: '/messaging',
        kind: 'message',
      });
    }

    if (sharedFiles.length > 0) {
      items.push({
        id: 'shared-files',
        title: `${sharedFiles.length} shared/project file${sharedFiles.length === 1 ? '' : 's'}`,
        detail: sharedFiles[0]?.filename ?? 'Shared file activity is available.',
        timestamp: sharedFiles[0]?.uploaded_at ?? null,
        path: '/files',
        kind: 'file',
      });
    }

    return items.sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));
  }, [dmUnread.length, latestUnreadDmAt, sharedFiles, unreadDmTotal, unreadEmailCount, unreadEmails]);

  const generalBadgeCount = unreadEmailCount + unreadDmTotal;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((value) => !value)}
        className={buttonClassName}
      >
        <div className="relative">
          <Bell className={iconClassName} />
          {activeAlerts.length > 0 && (
            <span className="absolute -right-2 -top-2 min-w-[18px] rounded-full border border-page bg-red-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-[0_0_10px_rgba(239,68,68,0.45)]">
              {formatBadge(activeAlerts.length)}
            </span>
          )}
          {generalBadgeCount > 0 && (
            <span className="absolute -bottom-2 -right-2 min-w-[18px] rounded-full border border-page bg-[#4f8ef7] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white shadow-[0_0_10px_rgba(79,142,247,0.45)]">
              {formatBadge(generalBadgeCount)}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-[22rem] overflow-hidden rounded-2xl border border-border bg-page shadow-2xl">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-primary">Notifications</div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-red-400">
                    {activeAlerts.length} alert{activeAlerts.length === 1 ? '' : 's'}
                  </span>
                )}
                <span className="rounded-full border border-[#4f8ef7]/20 bg-[#4f8ef7]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#4f8ef7]">
                  {generalBadgeCount} unread
                </span>
              </div>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {isAdmin && (
              <div className="border-b border-border px-4 py-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                    Security Alerts
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate('/admin/alerts');
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-300"
                  >
                    View all
                  </button>
                </div>

                {activeAlerts.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card px-3 py-3 text-xs text-muted">
                    No active alerts right now.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeAlerts.slice(0, 3).map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate('/admin/alerts');
                        }}
                        className="w-full rounded-xl border border-red-500/10 bg-red-500/5 px-3 py-3 text-left transition-colors hover:bg-red-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${alertSeverityClass(alert.severity)}`} />
                              <span className="truncate text-xs font-bold text-primary">
                                {formatAlertType(alert.alert_type)}
                              </span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs text-muted">
                              {alert.description}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-red-400">
                            {formatRelativeTime(alert.created_at)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-4 py-3">
              <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#4f8ef7]">
                Messages, Mail, Files
              </div>

              {generalLoading ? (
                <div className="rounded-xl border border-border bg-card px-3 py-3 text-xs text-muted">
                  Loading notifications...
                </div>
              ) : generalItems.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-3 py-3 text-xs text-muted">
                  No new mail or messages right now.
                </div>
              ) : (
                <div className="space-y-2">
                  {generalItems.map((item) => {
                    const Icon = item.kind === 'mail'
                      ? Mail
                      : item.kind === 'message'
                        ? MessageSquare
                        : FileText;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          navigate(item.path);
                        }}
                        className="flex w-full items-start gap-3 rounded-xl border border-[#4f8ef7]/10 bg-[#4f8ef7]/5 px-3 py-3 text-left transition-colors hover:bg-[#4f8ef7]/10"
                      >
                        <div className="rounded-lg bg-[#4f8ef7]/10 p-2 text-[#4f8ef7]">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <span className="truncate text-xs font-bold text-primary">{item.title}</span>
                            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-widest text-[#4f8ef7]">
                              {formatRelativeTime(item.timestamp)}
                            </span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted">
                            {item.detail}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
