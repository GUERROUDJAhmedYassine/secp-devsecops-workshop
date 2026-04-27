import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Moon,
  Sun,
  MoreVertical,
  Plus,
  Mail,
  MessageSquare,
  Vault,
  Shield,
  Send,
  Menu,
  Activity,
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../hooks/useAuth';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { getSystemMonitor, type SystemMonitorInfo } from '../api/dashboard';
import { getInbox } from '../api/email';
import { getFiles } from '../api/files';
import { getDmUnreadCounts, getMessages, getOnlineUsers, getRooms } from '../api/messaging';
import { MSG_WS_URL } from '../lib/constants';
import { WsManager } from '../lib/websocket';
import type { EmailMessage } from '../types/email.types';
import { formatFileSize, type SecureFile } from '../types/files.types';
import type { MessagingWsInbound, MessagingWsOutbound, Room, RoomMessage } from '../types/messaging.types';

function toMillis(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortRoomsByActivity(items: Room[]): Room[] {
  return [...items].sort((a, b) => {
    const delta = toMillis(b.last_message_at ?? b.created_at) - toMillis(a.last_message_at ?? a.created_at);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name);
  });
}

function formatMessageTime(value?: string | null): string {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatRelativeLabel(value?: string | null): string {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';

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

function formatEmailPreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim() || 'No preview available';
}

function senderName(message: RoomMessage): string {
  if (message.sender_username?.trim()) return message.sender_username;
  if (message.username?.trim()) return message.username;
  return message.sender_id || 'Unknown';
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatUptime(seconds?: number | null): string {
  if (!seconds || seconds < 1) return 'Just started';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  const { user, isAdmin, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [unreadEmailCount, setUnreadEmailCount] = useState(0);
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dmUnreadTotal, setDmUnreadTotal] = useState(0);
  const [serviceHealth, setServiceHealth] = useState({
    mail: false,
    files: false,
    messaging: false,
    unread: false,
    presence: false,
  });
  const [systemMonitor, setSystemMonitor] = useState<SystemMonitorInfo | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<RoomMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatConnected, setChatConnected] = useState(false);

  const wsRef = useRef<WsManager | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);

  const ownedFiles = useMemo(
    () => files.filter((file) => file.owner_id === user?.id),
    [files, user?.id],
  );
  const ownedBytes = useMemo(
    () => ownedFiles.reduce((sum, file) => sum + file.file_size, 0),
    [ownedFiles],
  );
  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) ?? null,
    [rooms, activeRoomId],
  );
  const roomsWithMessages = useMemo(
    () => rooms.filter((room) => Boolean(room.last_message_at)).length,
    [rooms],
  );
  const projectRoomCount = useMemo(
    () => rooms.filter((room) => room.is_project).length,
    [rooms],
  );
  const healthyServiceCount = useMemo(
    () => Object.values(serviceHealth).filter(Boolean).length,
    [serviceHealth],
  );
  const serviceReachPercent = clampPercent((healthyServiceCount / 5) * 100);
  const cpuPercent = clampPercent(systemMonitor?.cpu_usage_percent ?? 0);
  const latestEmail = emails[0] ?? null;
  const vpnConfigured = Boolean(user?.vpn_public_key);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  const loadDashboardData = useCallback(async () => {
    if (!user?.id) return;

    const results = await Promise.allSettled([
      getInbox({ perPage: 6 }),
      getFiles(),
      getRooms(),
      getDmUnreadCounts(),
      getOnlineUsers(),
      getSystemMonitor(),
    ]);

    const failed: string[] = [];

    const [inboxResult, filesResult, roomsResult, unreadResult, onlineResult, systemResult] = results;
    const nextServiceHealth = {
      mail: inboxResult.status === 'fulfilled',
      files: filesResult.status === 'fulfilled',
      messaging: roomsResult.status === 'fulfilled',
      unread: unreadResult.status === 'fulfilled',
      presence: onlineResult.status === 'fulfilled',
    };
    setServiceHealth(nextServiceHealth);

    if (inboxResult.status === 'fulfilled') {
      setEmails(inboxResult.value.emails);
      setUnreadEmailCount(inboxResult.value.unread_count);
    } else {
      failed.push('mail');
      setEmails([]);
      setUnreadEmailCount(0);
    }

    if (filesResult.status === 'fulfilled') {
      setFiles(filesResult.value);
    } else {
      failed.push('files');
      setFiles([]);
    }

    if (roomsResult.status === 'fulfilled') {
      const nextRooms = sortRoomsByActivity(roomsResult.value);
      setRooms(nextRooms);
      setActiveRoomId((current) => {
        if (current && nextRooms.some((room) => room.id === current)) return current;
        return nextRooms.find((room) => room.last_message_at)?.id ?? nextRooms[0]?.id ?? null;
      });
    } else {
      failed.push('messaging');
      setRooms([]);
      setActiveRoomId(null);
    }

    if (unreadResult.status === 'fulfilled') {
      setDmUnreadTotal(
        unreadResult.value.reduce((sum, item) => sum + item.unread_count, 0),
      );
    } else {
      failed.push('dm unread');
      setDmUnreadTotal(0);
    }

    if (onlineResult.status === 'fulfilled') {
    } else {
      failed.push('presence');
    }

    if (systemResult.status === 'fulfilled') {
      setSystemMonitor(systemResult.value);
    } else {
      failed.push('system monitor');
      setSystemMonitor(null);
    }

    setLoadWarning(
      failed.length > 0
        ? `Some live widgets could not refresh: ${failed.join(', ')}.`
        : null,
    );
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;

    let cancelled = false;

    const run = async () => {
      try {
        await loadDashboardData();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    run().catch((error) => {
      console.error(error);
      if (!cancelled) {
        setLoadWarning(error instanceof Error ? error.message : 'Failed to load dashboard data.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, loadDashboardData, user?.id]);

  useLiveRefresh(
    async () => {
      await loadDashboardData();
    },
    {
      enabled: Boolean(user?.id),
      intervalMs: 5000,
    },
  );

  useEffect(() => {
    if (!activeRoomId) {
      setChatMessages([]);
      setChatLoading(false);
      return;
    }

    let cancelled = false;
    setChatLoading(true);
    setChatError(null);

    getMessages(activeRoomId, 25)
      .then((messages) => {
        if (cancelled) return;
        setChatMessages(messages);
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setChatMessages([]);
          setChatError(error instanceof Error ? error.message : 'Failed to load room messages.');
        }
      })
      .finally(() => {
        if (!cancelled) setChatLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoomId]);

  useEffect(() => {
    if (!user?.id) return;

    const ws = new WsManager({
      url: MSG_WS_URL,
      maxRetries: 10,
      baseDelay: 1000,
      onOpen: () => setChatConnected(true),
      onClose: () => setChatConnected(false),
      onError: () => setChatConnected(false),
      onMessage: (raw) => {
        const message = raw as MessagingWsInbound;

        if (message.type === 'message') {
          setRooms((current) =>
            sortRoomsByActivity(
              current.map((room) =>
                room.id === message.room_id
                  ? { ...room, last_message_at: message.timestamp }
                  : room,
              ),
            ),
          );
          if (message.room_id !== activeRoomIdRef.current) {
            setActiveRoomId(message.room_id);
            return;
          }

          setChatMessages((current) => {
            if (current.some((entry) => entry.id === message.message_id)) return current;
            return [
              ...current,
              {
                id: message.message_id,
                room_id: message.room_id,
                sender_id: message.sender_id ?? message.from,
                sender_username: message.sender_username ?? message.from,
                content: message.content,
                created_at: message.timestamp,
                timestamp: message.timestamp,
                is_read: false,
              },
            ];
          });
          return;
        }

        if (message.type === 'dm') {
          setDmUnreadTotal((current) => current + 1);
          return;
        }

        if (message.type === 'error') {
          setChatError(message.message ?? 'Messaging error');
        }
      },
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
      wsRef.current = null;
      setChatConnected(false);
    };
  }, [user?.id]);

  async function submitTeamMessage() {
    const content = chatDraft.trim();
    if (!content || !activeRoomId) return;
    if (!wsRef.current?.connected) {
      setChatError('Team chat is reconnecting. Try again in a moment.');
      return;
    }

    setChatError(null);
    const payload: MessagingWsOutbound = {
      type: 'room',
      room_id: activeRoomId,
      content,
    };
    wsRef.current.send(payload);
    setChatDraft('');
  }

  if (authLoading || loading) {
    return <div className="p-8 flex items-center justify-center h-full text-muted font-medium bg-page transition-colors duration-200">Loading Dashboard...</div>;
  }

  return (
    <div className="flex-1 min-w-0 bg-page h-screen overflow-y-auto transition-colors duration-200">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors duration-200">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-primary hidden sm:block">Dashboard</h1>
          <button
            onClick={() => navigate('/webmail')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-[#4f8ef7]/20"
          >
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Compose</span>
          </button>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><Bell className="w-5 h-5" /></button>
          <button onClick={toggleTheme} className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-6">
        {loadWarning && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-sm font-medium text-amber-200">
            {loadWarning}
          </div>
        )}

        {isAdmin && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="text-red-500 font-bold text-sm tracking-wide">ADMIN OPERATIONS VIEW</h3>
                <p className="text-muted text-xs font-semibold">Live data below now comes from mail, messaging, files, and your signed-in account.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-4 border-r border-red-500/20">
                <span className="block text-[10px] text-red-400 font-bold uppercase tracking-wider">Rooms</span>
                <span className="text-xl font-bold text-primary">{rooms.length}</span>
              </div>
              <div className="text-center px-4">
                <span className="block text-[10px] text-[#4f8ef7] font-bold uppercase tracking-wider">Project Spaces</span>
                <span className="text-xl font-bold text-primary">{projectRoomCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">Unread Emails</span>
              <Mail className="w-4 h-4 text-[#4f8ef7]" />
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-3xl font-bold text-primary">{unreadEmailCount}</span>
              <span className="text-sm font-medium text-[#4f8ef7]">{latestEmail ? `Latest ${formatRelativeLabel(latestEmail.sent_at)}` : 'Inbox clear'}</span>
            </div>
          </div>
          
          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">New Messages</span>
              <MessageSquare className="w-4 h-4 text-[#4f8ef7]" />
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-3xl font-bold text-primary">{dmUnreadTotal}</span>
              <span className="text-sm font-medium text-[#ef4444]">{roomsWithMessages} active room{roomsWithMessages === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">My Files</span>
              <Vault className="w-4 h-4 text-[#4f8ef7]" />
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className="text-3xl font-bold text-primary">{ownedFiles.length}</span>
              <span className="text-sm font-medium text-muted">{formatFileSize(ownedBytes)}</span>
            </div>
          </div>

          <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-32 hover:border-[#4f8ef7]/50 transition-colors shadow-sm cursor-pointer group">
            <div className="flex justify-between items-start text-muted">
              <span className="text-xs font-bold tracking-wider uppercase group-hover:text-[#4f8ef7] transition-colors">VPN Status</span>
              <Shield className={`w-4 h-4 ${vpnConfigured ? 'text-[#22c55e]' : 'text-amber-400'}`} />
            </div>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${vpnConfigured ? 'bg-[#22c55e] shadow-[0_0_10px_#22c55e]' : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]'}`}></div>
                <span className="text-sm font-bold text-primary">{vpnConfigured ? 'Configured' : 'Not configured'}</span>
              </div>
              <span className="text-xs font-mono text-muted bg-page px-2 py-1 rounded transition-colors duration-200">
                {user?.last_login_at ? formatRelativeLabel(user.last_login_at) : 'Never signed in'}
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
             <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between group cursor-pointer hover:border-[#4f8ef7]/50 transition-colors">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                   <Activity className="w-5 h-5 text-purple-500" />
                   System Health Monitor
                 </h2>
                 <span className="text-[10px] font-bold text-purple-500 bg-purple-500/10 px-2 py-1 rounded-full uppercase tracking-widest">
                   {healthyServiceCount === 5 ? 'Running' : 'Degraded'}
                 </span>
               </div>
               <div className="space-y-4">
                 <div>
                   <div className="flex justify-between text-xs font-bold text-muted mb-1 uppercase tracking-widest">
                     <span>CPU Usage</span>
                     <span className="text-primary">
                       {systemMonitor?.cpu_usage_percent != null ? `${systemMonitor.cpu_usage_percent.toFixed(1)}%` : '--'}
                     </span>
                   </div>
                   <div className="w-full h-1.5 bg-page rounded-full overflow-hidden">
                     <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${cpuPercent}%` }}></div>
                   </div>
                 </div>
                 <div>
                   <div className="flex justify-between text-xs font-bold text-muted mb-1 uppercase tracking-widest">
                     <span>Service Reachability</span>
                     <span className="text-primary">{healthyServiceCount}/5 online</span>
                   </div>
                   <div className="w-full h-1.5 bg-page rounded-full overflow-hidden">
                     <div className="h-full bg-[#4f8ef7] transition-all duration-300" style={{ width: `${serviceReachPercent}%` }}></div>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                   <div className="rounded-lg border border-border bg-page px-3 py-3">
                     <div className="text-[10px] font-bold uppercase tracking-widest text-muted">CPU Cores</div>
                     <div className="mt-2 text-lg font-bold text-primary">{systemMonitor?.cpu_cores ?? '--'}</div>
                   </div>
                   <div className="rounded-lg border border-border bg-page px-3 py-3">
                     <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Server Host</div>
                     <div className="mt-2 text-sm font-bold text-primary truncate">{systemMonitor?.hostname ?? '--'}</div>
                   </div>
                   <div className="rounded-lg border border-border bg-page px-3 py-3">
                     <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Platform</div>
                     <div className="mt-2 text-sm font-bold text-primary truncate">
                       {systemMonitor ? `${systemMonitor.platform} ${systemMonitor.platform_release}` : '--'}
                     </div>
                   </div>
                   <div className="rounded-lg border border-border bg-page px-3 py-3">
                     <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Server Uptime</div>
                     <div className="mt-2 text-sm font-bold text-primary">{formatUptime(systemMonitor?.uptime_seconds)}</div>
                   </div>
                 </div>
               </div>
             </div>

             <div className="bg-card border border-border rounded-xl p-6 shadow-sm flex flex-col justify-between group cursor-pointer hover:border-red-500/50 transition-colors">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                   <Shield className="w-5 h-5 text-red-500" />
                   Account Security Snapshot
                 </h2>
                 <button
                   onClick={() => navigate('/profile')}
                   className="text-[11px] font-bold text-red-500 tracking-widest uppercase hover:text-red-400 transition-colors"
                 >
                   OPEN PROFILE
                 </button>
               </div>
               <div className="space-y-3">
                 <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                   <div className={`w-2 h-2 rounded-full ${user?.risk_score && user.risk_score > 50 ? 'bg-red-500 animate-pulse' : 'bg-[#22c55e]'}`}></div>
                   <div className="flex-1">
                     <p className="text-sm font-bold text-primary">Risk score</p>
                     <p className="text-xs text-muted">Current authenticated account risk level.</p>
                   </div>
                   <span className="text-xs font-bold text-red-500">{user?.risk_score ?? 0}</span>
                 </div>
                 <div className="flex items-center gap-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                   <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                   <div className="flex-1">
                     <p className="text-sm font-bold text-primary">Failed logins</p>
                     <p className="text-xs text-muted">Failed login attempts currently recorded on your account.</p>
                   </div>
                   <span className="text-xs font-bold text-orange-500">{user?.failed_logins ?? 0}</span>
                 </div>
                 <div className="flex items-center gap-3 p-3 bg-[#4f8ef7]/5 border border-[#4f8ef7]/10 rounded-lg">
                   <div className="w-2 h-2 rounded-full bg-[#4f8ef7]"></div>
                   <div className="flex-1">
                     <p className="text-sm font-bold text-primary">Department</p>
                     <p className="text-xs text-muted">Current scope tied to your authenticated account.</p>
                   </div>
                   <span className="text-xs font-bold text-[#4f8ef7]">{user?.department ?? 'Unassigned'}</span>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Panels */}
        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          <div className="w-full lg:w-3/5 bg-card border border-border rounded-xl flex flex-col h-[600px] overflow-hidden shadow-sm transition-colors duration-200">
            <div className="px-6 py-5 flex justify-between items-center border-b border-border">
              <h2 className="text-lg font-bold text-primary">Recent Emails</h2>
              <button
                onClick={() => navigate('/webmail')}
                className="text-[11px] font-bold text-[#4f8ef7] tracking-widest uppercase hover:text-[#3b7ae5] transition-colors"
              >
                VIEW ALL
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-card">
              {emails.length === 0 && (
                <div className="h-full flex items-center justify-center px-6 text-sm font-medium text-muted">
                  No inbox activity yet.
                </div>
              )}
              {emails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => navigate('/webmail')}
                  className="group px-6 py-5 border-b border-border last:border-0 hover:bg-page transition-colors cursor-pointer relative"
                >
                  {!email.is_read && <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#4f8ef7]"></div>}
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="font-semibold text-primary group-hover:text-[#4f8ef7] transition-colors text-sm">
                      {email.sender_username || email.sender_email}
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{formatRelativeLabel(email.sent_at)}</span>
                  </div>
                  <div className="text-sm font-semibold text-primary mb-1.5">{email.subject}</div>
                  <div className="text-sm text-muted line-clamp-1 leading-relaxed">{formatEmailPreview(email.body)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full lg:w-2/5 bg-card border border-border rounded-xl flex flex-col h-[600px] overflow-hidden shadow-sm transition-colors duration-200">
            <div className="px-6 py-5 flex justify-between items-center border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-lg font-bold text-primary">Team Chat</h2>
                <div className={`w-2 h-2 rounded-full ${chatConnected ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]'}`}></div>
                <span className="truncate text-xs font-medium text-muted">
                  {activeRoom ? `${activeRoom.name}${activeRoom.department ? ` • ${activeRoom.department}` : ''}` : 'No room available'}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadDashboardData().catch(console.error)}
                  className="px-3 py-1.5 text-[11px] font-bold text-muted hover:text-primary hover:bg-border rounded-md transition-colors uppercase tracking-widest"
                >
                  Refresh
                </button>
                <button
                  onClick={() => navigate('/messaging', { state: activeRoom ? { roomId: activeRoom.id } : undefined })}
                  className="px-3 py-1.5 text-[11px] font-bold text-[#4f8ef7] hover:text-[#3b7ae5] hover:bg-border rounded-md transition-colors uppercase tracking-widest"
                >
                  Open Room
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-card">
              {!activeRoom && (
                <div className="h-full flex items-center justify-center text-sm font-medium text-muted">
                  Join or create a room to see live team chat here.
                </div>
              )}
              {activeRoom && chatLoading && chatMessages.length === 0 && (
                <div className="h-full flex items-center justify-center text-sm font-medium text-muted">
                  Loading the latest room activity...
                </div>
              )}
              {activeRoom && !chatLoading && chatMessages.length === 0 && (
                <div className="h-full flex items-center justify-center text-sm font-medium text-muted">
                  This room has no messages yet.
                </div>
              )}
              {chatMessages.map((msg) => {
                const mine = msg.sender_id === user?.id;
                const label = senderName(msg);
                const stamp = msg.created_at ?? msg.timestamp ?? null;

                return (
                  <div key={msg.id} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && (
                    <div className="w-8 h-8 rounded-full bg-[#4f8ef7]/10 flex items-center justify-center text-xs font-bold text-[#4f8ef7] border border-[#4f8ef7]/20 flex-shrink-0">
                      {(label[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[85%] ${mine ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-xs font-semibold text-muted">{mine ? 'You' : label}</span>
                      <span className="text-[10px] uppercase font-bold text-muted">{formatMessageTime(stamp)}</span>
                    </div>
                    <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${mine ? 'bg-[#4f8ef7] text-white rounded-2xl rounded-tr-sm' : 'bg-page border border-border text-primary rounded-2xl rounded-tl-sm transition-colors duration-200'}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
            <div className="p-4 bg-card border-t border-border flex gap-3 items-center transition-colors duration-200">
              <input 
                type="text" 
                placeholder={activeRoom ? `Message ${activeRoom.name}...` : 'Select a room in Messaging...'} 
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submitTeamMessage();
                  }
                }}
                disabled={!activeRoom}
                className="flex-1 bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-[#4f8ef7] transition-colors placeholder:text-muted disabled:opacity-60" 
              />
              <button
                onClick={() => void submitTeamMessage()}
                disabled={!activeRoom || !chatDraft.trim()}
                className="p-2.5 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white rounded-lg transition-colors shadow-lg shadow-[#4f8ef7]/20 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {chatError && (
              <div className="px-4 pb-4 text-xs font-medium text-red-500">
                {chatError}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
