import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Bell, Moon, Sun, MoreVertical, Plus,
  Lock, Shield, Info, AlertTriangle, Send,
  Menu, ArrowLeft
} from 'lucide-react';
import { useThemeContext } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { useAuth } from '../hooks/useAuth';
import {
  addUserToRoom,
  createMessagingSocket,
  createRoom,
  getRoomMembers,
  getMessages,
  getRooms,
  getDmUnreadCounts,
  getDmHistory,
  getOnlineUsers,
  listDmConversations,
  markDmRead,
  removeUserFromRoom,
} from '../api/messaging';
import { listUsers } from '../api/admin';
import type { Room, RoomMessage, DirectMessage, DmConversation, UnreadCount, MessagingWsInbound, MessagingWsOutbound } from '../types/messaging.types';
import type { User } from '../types/user.types';
import { listDirectoryUsers } from '../api/auth';
import type { WsManager } from '../lib/websocket';
import type { DirectoryUser } from '../types/user.types';
function ModalShell({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="relative w-[92vw] max-w-xl rounded-2xl border border-border bg-page shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-sm font-bold text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-bold text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function Messaging() {
  const { theme, toggleTheme } = useThemeContext();
  const { toggleSidebar } = useSidebar();
  const { user, isAdmin, isManagerOrAbove } = useAuth();
  const [activeKind, setActiveKind] = useState<'room' | 'dm'>('room');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDmUserId, setSelectedDmUserId] = useState<string | null>(null);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);

  const [dmConversations, setDmConversations] = useState<DmConversation[]>([]);
  const [dmUnread, setDmUnread] = useState<Record<string, UnreadCount>>({});
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [directoryUsers, setDirectoryUsers] = useState<DirectoryUser[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const [newDmOpen, setNewDmOpen] = useState(false);
  const [newDmSearch, setNewDmSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDept, setCreateDept] = useState(user?.department ?? 'SOC');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);

  const [addUsersOpen, setAddUsersOpen] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [addUsersError, setAddUsersError] = useState<string | null>(null);
  const [addingUsers, setAddingUsers] = useState(false);

  const [manageMembersOpen, setManageMembersOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const activeDm = useMemo(
    () => (selectedDmUserId ? dmConversations.find((c) => c.other_user === selectedDmUserId) ?? null : null),
    [dmConversations, selectedDmUserId],
  );

  const directoryMap = useMemo(() => {
    const map = new Map<string, DirectoryUser>();
    directoryUsers.forEach((u) => map.set(u.id, u));
    return map;
  }, [directoryUsers]);

  const activeDmUser = useMemo(
    () => (selectedDmUserId ? directoryMap.get(selectedDmUserId) : undefined),
    [directoryMap, selectedDmUserId],
  );

  const wsRef = useRef<WsManager | null>(null);
  const lastDmSendRef = useRef<{
    to: string;
    content: string;
    localId: string;
  } | null>(null);
  const dmPendingLocalIdsRef = useRef<Record<string, string[]>>({});
  const roomPendingLocalIdsRef = useRef<string[]>([]);
  const selectedDmUserIdRef = useRef<string | null>(null);
  const activeKindRef = useRef<'room' | 'dm'>('room');
  const userIdRef = useRef<string | null>(null);
  const usernameRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  async function refreshRooms() {
    setRoomsLoading(true);
    try {
      const next = await getRooms();
      setRooms(next);
      if (!selectedRoomId && next.length > 0) setSelectedRoomId(next[0].id);
    } finally {
      setRoomsLoading(false);
    }
  }

  async function refreshDms() {
    try {
      const [convos, unread] = await Promise.all([
        listDmConversations(),
        getDmUnreadCounts(),
      ]);
      setDmConversations(convos);
      const map: Record<string, UnreadCount> = {};
      unread.forEach((u) => {
        map[u.sender_id] = u;
      });
      setDmUnread(map);
    } catch (e) {
      // best-effort; don't block messaging UI
      console.error(e);
    }
  }

  useEffect(() => {
    refreshRooms().catch(console.error);
    refreshDms().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // load directory for DM display + new DM modal
    setDirectoryLoading(true);
    listDirectoryUsers()
      .then((u) => setDirectoryUsers(u.filter((x) => x.is_active)))
      .catch(console.error)
      .finally(() => setDirectoryLoading(false));
  }, []);

  useEffect(() => {
    selectedDmUserIdRef.current = selectedDmUserId;
  }, [selectedDmUserId]);

  useEffect(() => {
    activeKindRef.current = activeKind;
  }, [activeKind]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
    usernameRef.current = user?.username ?? null;
  }, [user?.id, user?.username]);

  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const res = await getOnlineUsers();
        if (!mounted) return;
        setOnlineUserIds(new Set(res.online_user_ids ?? []));
      } catch (e) {
        // presence is best-effort
      } finally {
        if (mounted) timer = window.setTimeout(tick, 5000);
      }
    };

    tick();
    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!selectedRoomId) return;
    setMessagesLoading(true);
    getMessages(selectedRoomId, 100)
      .then(setRoomMessages)
      .catch(console.error)
      .finally(() => setMessagesLoading(false));
  }, [selectedRoomId]);

  // Auto-load/refresh members when details panel is open on a room
  useEffect(() => {
    if (!detailsOpen) return;
    if (activeKind !== 'room') return;
    if (!selectedRoomId) return;

    let mounted = true;
    let timer: number | null = null;

    const load = async () => {
      try {
        setMembersError(null);
        setMembersLoading(true);
        const res = await getRoomMembers(selectedRoomId);
        if (!mounted) return;
        setMemberIds(res.members ?? []);
      } catch (e) {
        if (!mounted) return;
        setMembersError(e instanceof Error ? e.message : 'Failed to load members');
      } finally {
        if (!mounted) return;
        setMembersLoading(false);
        timer = window.setTimeout(load, 5000);
      }
    };

    load();
    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [detailsOpen, activeKind, selectedRoomId]);

  function scrollToBottom(behavior: ScrollBehavior = 'auto') {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  useEffect(() => {
    // WebSocket connection for realtime DM + room messages + history
    const ws = createMessagingSocket((raw) => {
      const msg = raw as MessagingWsInbound;
      const currentDmUserId = selectedDmUserIdRef.current;
      const currentKind = activeKindRef.current;
      const currentUserId = userIdRef.current;

      switch (msg.type) {
        case 'message': {
          // room broadcast — replace optimistic local message if it's our own echo
          const pendingIds = roomPendingLocalIdsRef.current;
          const localId = pendingIds.length > 0 ? pendingIds.shift() : undefined;
          roomPendingLocalIdsRef.current = pendingIds;

          const realMsg = {
            id: msg.message_id,
            room_id: msg.room_id,
            sender_id: msg.from,   // may be id or username depending on backend
            sender_username: msg.from,
            content: msg.content,
            timestamp: msg.timestamp,
            created_at: msg.timestamp,
          };

          if (localId) {
            // replace the optimistic placeholder with the confirmed server message
            setRoomMessages((prev) =>
              prev.map((m) => (m.id === localId ? { ...realMsg, sender_id: currentUserId ?? realMsg.sender_id } : m))
            );
          } else {
            setRoomMessages((prev) => [...prev, realMsg]);
          }
          break;
        }
        case 'dm': {
          // incoming DM
          const dm: DirectMessage = {
            id: msg.message_id,
            sender_id: msg.from,
            recipient_id: currentUserId ?? '',
            content: msg.content,
            is_read: false,
            is_deleted: false,
            created_at: msg.timestamp,
          };

          setDmMessages((prev) => {
            // if the active DM thread is with the sender, append
            if (currentKind === 'dm' && currentDmUserId && currentDmUserId === msg.from) return [...prev, dm];
            return prev;
          });

          // Update conversation list instantly
          setDmConversations((prev) => {
            const existing = prev.find((c) => c.other_user === msg.from);
            const nextItem: DmConversation = {
              other_user: msg.from,
              last_message: msg.content,
              last_message_at: msg.timestamp,
              is_read: currentKind === 'dm' && currentDmUserId === msg.from,
              sent_by_me: false,
            };
            const rest = prev.filter((c) => c.other_user !== msg.from);
            return existing ? [nextItem, ...rest] : [nextItem, ...rest];
          });
          setDmUnread((prev) => {
            // if not currently viewing that thread, increment
            if (currentKind === 'dm' && currentDmUserId === msg.from) return prev;
            const current = prev[msg.from];
            const nextCount = (current?.unread_count ?? 0) + 1;
            return {
              ...prev,
              [msg.from]: {
                sender_id: msg.from,
                unread_count: nextCount,
                latest_at: msg.timestamp,
              },
            };
          });
          break;
        }
        case 'read_ack': {
          // reader acks are useful for multi-device; nothing required for now
          break;
        }
        case 'dm_sent': {
          // Replace the last optimistic local message id with server message id
          const queue = dmPendingLocalIdsRef.current[msg.to] ?? [];
          const localId = queue.shift();
          dmPendingLocalIdsRef.current[msg.to] = queue;
          if (localId) {
            setDmMessages((prev) =>
              prev.map((m) =>
                m.id === localId
                  ? {
                    ...m,
                    id: msg.message_id,
                    created_at: msg.timestamp,
                  }
                  : m,
              ),
            );
          }
          break;
        }
        case 'message_read': {
          setDmMessages((prev) =>
            prev.map((m) =>
              m.id === msg.message_id && currentUserId && m.sender_id === currentUserId
                ? { ...m, is_read: true }
                : m,
            ),
          );
          setRoomMessages((prev) =>
            prev.map((m) =>
              m.id === msg.message_id && currentUserId && m.sender_id === currentUserId
                ? { ...m, is_read: true }
                : m,
            ),
          );
          break;
        }
        case 'history': {
          if (currentKind === 'dm' && currentDmUserId && msg.with === currentDmUserId) {
            setDmMessages(msg.messages);
            setDmLoading(false);
          }
          break;
        }
        case 'error': {
          setSendError(msg.message ?? 'Messaging error');
          break;
        }
        default:
          break;
      }
    });

    ws.connect();
    wsRef.current = ws;
    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
    // intentionally not depending on selectedDmUserId to avoid reconnect loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Track whether user is near the bottom (so we don't hijack scroll)
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      stickToBottomRef.current = distance < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // On room/DM switch or initial load, jump to bottom (latest messages)
  useEffect(() => {
    scrollToBottom('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind, selectedRoomId, selectedDmUserId, messagesLoading, dmLoading]);

  // When new messages arrive, keep pinned to bottom if user is near bottom
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    scrollToBottom('smooth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomMessages.length, dmMessages.length]);

  // When viewing a DM thread, mark incoming messages as read (WS per-message)
  useEffect(() => {
    if (activeKind !== 'dm') return;
    if (!selectedDmUserId) return;
    if (!user?.id) return;

    const unreadIncoming = dmMessages.filter(
      (m) => m.sender_id === selectedDmUserId && m.recipient_id === user.id && m.is_read === false,
    );

    if (unreadIncoming.length === 0) return;

    // best-effort: send per-message read receipts
    unreadIncoming.forEach((m) => {
      sendWs({ type: 'read', message_id: m.id, from: selectedDmUserId });
    });

    // update local state immediately
    setDmMessages((prev) =>
      prev.map((m) =>
        m.sender_id === selectedDmUserId && m.recipient_id === user.id ? { ...m, is_read: true } : m,
      ),
    );
  }, [activeKind, selectedDmUserId, user?.id, dmMessages]);

  const lastSelfDmMessageId = useMemo(() => {
    if (!user?.id) return null;
    for (let i = dmMessages.length - 1; i >= 0; i--) {
      if (dmMessages[i].sender_id === user.id) return dmMessages[i].id;
    }
    return null;
  }, [dmMessages, user?.id]);

  const lastSelfRoomMessageId = useMemo(() => {
    if (!user?.id || !selectedRoomId) return null;
    for (let i = roomMessages.length - 1; i >= 0; i--) {
      const m = roomMessages[i];
      if (m.sender_id === user.id && !m.id.startsWith('local-')) return m.id;
    }
    return null;
  }, [roomMessages, user?.id, selectedRoomId]);

  // When viewing a room, send read receipts for the latest message from others
  useEffect(() => {
    if (activeKind !== 'room' || !selectedRoomId || roomMessages.length === 0) return;
    const lastOtherMsg = [...roomMessages]
      .reverse()
      .find((m) => m.sender_id !== user?.id && !m.id.startsWith('local-'));
    if (!lastOtherMsg) return;
    wsRef.current?.send({ type: 'read', message_id: lastOtherMsg.id, from: lastOtherMsg.sender_id });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind, selectedRoomId, roomMessages.length]);

  function toDateKey(value: string | undefined | null): string {
    if (!value) return 'unknown';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'unknown';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function formatDayLabel(dateKey: string): string {
    if (dateKey === 'unknown') return 'Unknown date';
    const [y, m, d] = dateKey.split('-').map((x) => Number(x));
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfThat = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    const diffDays = Math.round((startOfToday.getTime() - startOfThat.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  async function openAddUsers() {
    if (!selectedRoomId) return;
    setAddUsersError(null);
    setSelectedUserIds(new Set());
    setAddUsersOpen(true);
    setUsersLoading(true);
    try {
      const [data, membersRes] = await Promise.all([
        listUsers(),
        getRoomMembers(selectedRoomId)
      ]);
      const memberSet = new Set(membersRes.members);
      setUsers(data.filter((u) => u.is_active && !memberSet.has(u.id)));
    } catch (e) {
      setAddUsersError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }

  async function submitCreateRoom() {
    setCreateError(null);
    const name = createName.trim();
    const dept = createDept.trim();
    if (!name) {
      setCreateError('Room name is required');
      return;
    }
    if (!dept) {
      setCreateError('Department is required');
      return;
    }

    setCreateSaving(true);
    try {
      const newRoom = await createRoom({ name, department: dept });
      await refreshRooms();
      setSelectedRoomId(newRoom.id);
      setCreateOpen(false);
      setCreateName('');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create room');
    } finally {
      setCreateSaving(false);
    }
  }

  async function submitAddUsers() {
    if (!selectedRoomId) return;
    setAddUsersError(null);
    const ids = Array.from(selectedUserIds);
    if (ids.length === 0) {
      setAddUsersError('Select at least one user');
      return;
    }
    setAddingUsers(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => addUserToRoom(selectedRoomId, id)),
      );
      const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      if (failures.length > 0) {
        setAddUsersError(`${failures.length} user(s) could not be added (already a member or not allowed).`);
      } else {
        setAddUsersOpen(false);
        // If the members modal is open, refresh members instantly
        if (manageMembersOpen && selectedRoomId) {
          getRoomMembers(selectedRoomId)
            .then((res) => setMemberIds(res.members ?? []))
            .catch(console.error);
        }
      }
    } finally {
      setAddingUsers(false);
    }
  }

  async function openManageMembers() {
    if (!selectedRoomId) return;
    setMembersError(null);
    setManageMembersOpen(true);
    setMembersLoading(true);
    try {
      const res = await getRoomMembers(selectedRoomId);
      setMemberIds(res.members ?? []);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }

  function sendWs(payload: MessagingWsOutbound) {
    setSendError(null);
    wsRef.current?.send(payload);
  }

  async function submitSend() {
    const content = draft.trim();
    if (!content) return;

    if (activeKind === 'room') {
      if (!selectedRoomId) return;
      sendWs({ type: 'room', room_id: selectedRoomId, content });
      setDraft('');
      // Optimistic update — appears on right immediately
      if (user?.id) {
        const localId = `local-room-${Date.now()}`;
        roomPendingLocalIdsRef.current = [...roomPendingLocalIdsRef.current, localId];
        setRoomMessages((prev) => [
          ...prev,
          {
            id: localId,
            room_id: selectedRoomId,
            sender_id: user.id,
            sender_username: user.username,
            content,
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString(),
          },
        ]);
      }
      return;
    }

    if (activeKind === 'dm') {
      if (!selectedDmUserId) return;
      sendWs({ type: 'dm', to: selectedDmUserId, content });
      setDraft('');
      // optimistic append
      if (user?.id) {
        const localId = `local-${Date.now()}`;
        lastDmSendRef.current = { to: selectedDmUserId, content, localId };
        dmPendingLocalIdsRef.current[selectedDmUserId] = [
          ...(dmPendingLocalIdsRef.current[selectedDmUserId] ?? []),
          localId,
        ];
        setDmMessages((prev) => [
          ...prev,
          {
            id: localId,
            sender_id: user.id,
            recipient_id: selectedDmUserId,
            content,
            is_read: false,
            is_deleted: false,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // Update conversation list instantly (no refresh required)
      const nowIso = new Date().toISOString();
      setDmConversations((prev) => {
        const nextItem: DmConversation = {
          other_user: selectedDmUserId,
          last_message: content,
          last_message_at: nowIso,
          is_read: true,
          sent_by_me: true,
        };
        const rest = prev.filter((c) => c.other_user !== selectedDmUserId);
        return [nextItem, ...rest];
      });
      setDmUnread((prev) => {
        // sending clears unread badge for that user (from them)
        if (!prev[selectedDmUserId]) return prev;
        const { [selectedDmUserId]: _omit, ...rest } = prev;
        return rest;
      });
    }
  }

  return (
    <div className="flex-1 min-w-0 bg-page h-screen flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 border-b border-border bg-page sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={toggleSidebar} className="md:hidden p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <h1 className="text-base font-bold text-primary hidden sm:block">Security Operations</h1>
            <div className="hidden sm:block h-4 w-px bg-border mx-4"></div>
            <span className="text-xs sm:text-sm font-medium text-muted">
              Communications <span className="mx-1">&gt;</span> <span className="text-[#4f8ef7]">Internal Comms</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-3">
          <div className="relative hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search threads..."
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] w-64 transition-all placeholder:text-muted"
            />
          </div>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><Bell className="w-4 h-4" /></button>
          <button onClick={toggleTheme} className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className="p-2.5 text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"><MoreVertical className="w-4 h-4" /></button>
        </div>
      </header>

      {/* Main Content Areas */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar - Rooms & DMs */}
        <div className={`${(selectedRoomId || selectedDmUserId) ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-border bg-page flex-col py-2 overflow-y-auto transition-colors`}>
          <div className="px-6 py-4 flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Security Rooms</h4>
            {isAdmin && (
              <button
                onClick={() => {
                  setCreateError(null);
                  setCreateDept(user?.department ?? 'SOC');
                  setCreateOpen(true);
                }}
                className="text-[#4f8ef7] hover:text-[#3b7ae5] transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <Plus className="w-4 h-4" /> Create
              </button>
            )}
          </div>
          <nav className="flex flex-col space-y-0.5">
            {roomsLoading && (
              <div className="px-6 py-3 text-xs font-medium text-muted">Loading rooms…</div>
            )}
            {!roomsLoading && rooms.length === 0 && (
              <div className="px-6 py-3 text-xs font-medium text-muted">No rooms yet.</div>
            )}
            {rooms.map((room) => {
              const isActive = room.id === selectedRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveKind('room');
                    setSelectedDmUserId(null);
                    setSelectedRoomId(room.id);
                  }}
                  className={`w-full flex items-start gap-4 px-6 py-3 transition-colors ${isActive
                    ? 'bg-red-500/5 border-l-2 border-l-red-500'
                    : 'border-l-2 border-l-transparent hover:bg-card hover:border-l-border text-muted hover:text-primary'
                    }`}
                >
                  <div className={`p-2 rounded-lg flex-shrink-0 ${isActive ? 'bg-red-500/10 text-red-500' : 'bg-card text-[#4f8ef7]'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col text-left flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm font-bold truncate pr-2 ${isActive ? 'text-primary' : ''}`}>{room.name}</span>
                      <span className="text-[10px] font-medium text-muted flex-shrink-0">
                        {(room.department ?? '—').toString()}
                      </span>
                    </div>
                    <span className="text-xs text-muted truncate">
                      Created {room.created_at ? new Date(room.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div className="px-6 mt-6 mb-2 flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest">Direct Messages</h4>
            <button
              onClick={() => setNewDmOpen(true)}
              className="text-[#4f8ef7] hover:text-[#3b7ae5] transition-colors"
              title="New direct message"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <nav className="flex flex-col space-y-0.5">
            {dmConversations.length === 0 && (
              <div className="px-6 py-3 text-xs font-medium text-muted">No conversations yet.</div>
            )}
            {dmConversations.map((c) => {
              const unread = dmUnread[c.other_user]?.unread_count ?? 0;
              const active = activeKind === 'dm' && selectedDmUserId === c.other_user;
              const other = directoryMap.get(c.other_user);
              const displayName = other?.username ?? c.other_user;
              const displaySub = c.last_message || '';
              return (
                <button
                  key={c.other_user}
                  onClick={async () => {
                    setActiveKind('dm');
                    setSelectedDmUserId(c.other_user);
                    setSelectedRoomId(null);
                    setDmLoading(true);
                    setDmMessages([]);
                    // Use REST history for reliability (WS history can be dropped on reconnect)
                    try {
                      const hist = await getDmHistory(c.other_user, 100, 0);
                      setDmMessages(hist);
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setDmLoading(false);
                    }
                    try {
                      await markDmRead(c.other_user);
                    } catch (e) {
                      // ignore; history still works
                      console.error(e);
                    } finally {
                      // Clear badge instantly for this sender
                      setDmUnread((prev) => {
                        if (!prev[c.other_user]) return prev;
                        const { [c.other_user]: _omit, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  className={`w-full flex items-start gap-4 px-6 py-3 transition-colors border-l-2 ${active
                    ? 'bg-[#4f8ef7]/5 border-l-[#4f8ef7]'
                    : 'border-l-transparent hover:bg-card hover:border-l-border text-muted hover:text-primary'
                    }`}
                >
                  <div className="relative w-8 h-8 rounded-full bg-card text-muted flex items-center justify-center text-xs font-bold flex-shrink-0 border border-border">
                    {displayName.slice(0, 2).toUpperCase()}
                    {onlineUserIds.has(c.other_user) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-page rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-primary truncate">{displayName}</div>
                      {unread > 0 && (
                        <div className="text-[10px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5">
                          {unread}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">{displaySub}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Chat Area */}
        <div className={`${selectedRoomId || selectedDmUserId ? 'flex' : 'hidden md:flex'} flex-1 bg-page flex-col transition-colors h-full overflow-hidden relative`}>

          {/* Chat Header */}
          <div className="px-3 sm:px-6 flex items-center justify-between border-b border-border bg-page transition-colors flex-shrink-0 h-20">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => setSelectedRoomId(null)}
                className="md:hidden flex items-center justify-center p-2 -ml-2 text-muted hover:text-primary hover:bg-card rounded-md transition-colors mr-1 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-xl flex items-center justify-center shadow-inner">
                <Lock className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-base font-bold text-primary leading-tight mb-0.5">
                  {activeKind === 'room'
                    ? (activeRoom?.name ?? 'Select a room')
                    : (activeDmUser?.username ?? 'Direct message')}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none mt-0.5">
                    {activeKind === 'room' ? (activeRoom?.department ?? '—') : 'Direct message'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {isManagerOrAbove && selectedRoomId && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openAddUsers}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
                    >
                      Add users
                    </button>
                    <button
                      onClick={openManageMembers}
                      className="px-3 py-2 rounded-lg text-xs font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
                    >
                      Manage users
                    </button>
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-border"></div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDetailsOpen((v) => !v)}
                  className="p-2 text-muted hover:text-primary transition-colors"
                  title="Conversation details"
                >
                  <Info className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Transcript Area */}
          <div className="flex-1 overflow-hidden flex">
            <div
              ref={transcriptRef}
              className={`flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6 ${detailsOpen ? 'border-r border-border' : ''}`}
            >

              {activeKind === 'room' && messagesLoading && (
                <div className="text-xs font-medium text-muted">Loading messages…</div>
              )}

              {activeKind === 'room' && !messagesLoading && roomMessages.length === 0 && (
                <div className="text-xs font-medium text-muted">No messages yet.</div>
              )}

              {activeKind === 'room' && roomMessages
                .filter((m) => (m as any).is_deleted !== true && m.content !== '[deleted]')
                .map((msg, idx, arr) => {
                  const dateKey = toDateKey(msg.created_at ?? msg.timestamp);
                  const prevKey = idx > 0 ? toDateKey(arr[idx - 1]?.created_at ?? arr[idx - 1]?.timestamp) : null;
                  const showDivider = idx === 0 || dateKey !== prevKey;
                  const isSelf = !!user && msg.sender_id === user.id;
                  const senderLabel = msg.username ?? msg.sender_username ?? msg.sender_id;

                  if ((msg as any).isSystemAlert) {
                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{msg.content}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id}>
                      {showDivider && (
                        <div className="flex items-center justify-center my-4 w-full">
                          <div className="h-px bg-border flex-1"></div>
                          <span className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest bg-page">
                            {formatDayLabel(dateKey)}
                          </span>
                          <div className="h-px bg-border flex-1"></div>
                        </div>
                      )}
                      <div className={`flex items-end gap-2 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        {!isSelf && (
                          <div className="w-7 h-7 rounded-full bg-card text-muted flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-border">
                            {senderLabel.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className={`flex flex-col gap-0.5 max-w-[70%] ${isSelf ? 'items-end' : 'items-start'}`}>
                          <span className="text-[11px] font-semibold text-muted px-1 flex items-center gap-1 opacity-80">
                            {isSelf ? '' : senderLabel}{' '}
                            <span className="font-normal">{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {timeStyle: 'short'}) : ''}</span>
                          </span>
                          <div className={`inline-block px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                            isSelf
                              ? 'bg-[#4f8ef7] text-white rounded-br-sm'
                              : 'bg-card border border-border text-primary rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                          {isSelf && msg.id === lastSelfRoomMessageId && msg.is_read && (
                            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted px-1">
                              Seen
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

              {activeKind === 'dm' && dmLoading && (
                <div className="text-xs font-medium text-muted">Loading conversation…</div>
              )}

              {activeKind === 'dm' && !dmLoading && dmMessages.length === 0 && (
                <div className="text-xs font-medium text-muted">No direct messages yet.</div>
              )}

              {activeKind === 'dm' && dmMessages
                .filter((m) => m.is_deleted !== true && m.content !== '[deleted]')
                .map((msg, idx, arr) => {
                  const dateKey = toDateKey(msg.created_at);
                  const prevKey = idx > 0 ? toDateKey(arr[idx - 1]?.created_at) : null;
                  const showDivider = idx === 0 || dateKey !== prevKey;
                  const isSelf = !!user && msg.sender_id === user.id;
                  const other = selectedDmUserId ? directoryMap.get(selectedDmUserId) : undefined;
                  const senderLabel = isSelf ? (user?.username ?? 'Me') : (other?.username ?? activeDm?.other_user ?? msg.sender_id);
                  const showSeen =
                    isSelf &&
                    msg.id === lastSelfDmMessageId &&
                    msg.is_read === true;
                  return (
                    <div key={msg.id}>
                      {showDivider && (
                        <div className="flex items-center justify-center my-4 w-full">
                          <div className="h-px bg-border flex-1"></div>
                          <span className="px-4 text-[10px] font-bold text-muted uppercase tracking-widest bg-page">
                            {formatDayLabel(dateKey)}
                          </span>
                          <div className="h-px bg-border flex-1"></div>
                        </div>
                      )}
                      <div className={`flex items-end gap-2 mb-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                        {!isSelf && (
                          <div className="w-7 h-7 rounded-full bg-card text-muted flex items-center justify-center text-[10px] font-bold flex-shrink-0 border border-border">
                            {senderLabel.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className={`flex flex-col gap-0.5 max-w-[70%] ${isSelf ? 'items-end' : 'items-start'}`}>
                          <span className="text-[11px] font-semibold text-muted px-1 flex items-center gap-1 opacity-80">
                            {!isSelf && <span className="text-primary">{senderLabel} </span>}
                            {new Date(msg.created_at).toLocaleTimeString([], {timeStyle: 'short'})}
                          </span>
                          <div className={`inline-block px-3 py-2 rounded-2xl text-sm leading-snug break-words ${
                            isSelf
                              ? 'bg-[#4f8ef7] text-white rounded-br-sm'
                              : 'bg-card border border-border text-primary rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                          {showSeen && (
                            <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-muted px-1">
                              Seen
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Inline details panel (no popup) */}
            {detailsOpen && (
              <aside className="hidden lg:flex w-80 flex-col bg-page">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="text-xs font-bold text-muted uppercase tracking-widest">
                    Details
                  </div>
                  <button
                    onClick={() => setDetailsOpen(false)}
                    className="px-2 py-1 text-xs font-bold text-muted hover:text-primary hover:bg-card rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>

                <div className="p-5 overflow-y-auto">
                  {activeKind === 'room' ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-sm font-bold text-primary">{activeRoom?.name ?? 'Room'}</div>
                        <div className="text-xs text-muted mt-1">
                          Department: <span className="text-primary font-medium">{activeRoom?.department ?? '—'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-muted uppercase tracking-widest">
                          Members
                        </div>
                      </div>

                      {membersError && (
                        <div className="text-xs font-medium text-red-500">{membersError}</div>
                      )}

                      {membersLoading && (
                        <div className="text-xs font-medium text-muted">Loading…</div>
                      )}

                      {!membersLoading && (
                        <div className="space-y-2">
                          {memberIds.length === 0 && (
                            <div className="text-xs font-medium text-muted">No members found.</div>
                          )}
                          {memberIds
                            .map((id) => directoryMap.get(id))
                            .filter((u): u is DirectoryUser => !!u && u.is_active)
                            .map((u) => (
                              <div key={u.id} className="flex items-center justify-between gap-2">
                                <div className="text-sm font-bold text-primary truncate">{u.username}</div>
                                <div className="text-[10px] font-bold text-muted uppercase tracking-widest flex-shrink-0">MEMBER</div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm font-bold text-primary">{activeDmUser?.username ?? 'Direct message'}</div>
                      <div className="text-xs text-muted">
                        Status:{' '}
                        <span className="text-primary font-medium">
                          {selectedDmUserId && onlineUserIds.has(selectedDmUserId) ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="text-xs text-muted">
                        Last message:{' '}
                        <span className="text-primary font-medium">
                          {activeDm?.last_message_at ? new Date(activeDm.last_message_at).toLocaleString() : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Chat Input Area */}
          <div className="p-6 pt-2 flex-shrink-0 bg-page">
            <div className="max-w-4xl mx-auto flex flex-col bg-page border border-border rounded-xl shadow-sm focus-within:border-[#4f8ef7] transition-colors focus-within:ring-1 focus-within:ring-[#4f8ef7]/20 overflow-hidden">
              <div className="flex items-center px-4 py-3 bg-card min-h-[60px]">
                <button className="p-1 text-muted hover:text-primary transition-colors flex-shrink-0">
                  <Plus className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  placeholder={
                    activeKind === 'room'
                      ? (activeRoom ? `Reply to ${activeRoom.name}...` : 'Select a room...')
                      : (activeDmUser ? `Message ${activeDmUser.username}...` : (activeDm ? `Message ${activeDm.other_user}...` : 'Select a conversation...'))
                  }
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void submitSend();
                    }
                  }}
                  disabled={activeKind === 'room' ? !selectedRoomId : !selectedDmUserId}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-primary px-3 placeholder:text-muted disabled:opacity-60"
                />
                <button
                  onClick={submitSend}
                  className="flex items-center justify-center gap-2 bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-md shadow-[#4f8ef7]/20 transition-all active:scale-95 flex-shrink-0"
                >
                  Send <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-w-4xl mx-auto flex justify-end mt-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Enter to send</span>
            </div>
            {sendError && (
              <div className="max-w-4xl mx-auto mt-2 text-xs font-medium text-red-500">
                {sendError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Room Modal (IT_ADMIN only) */}
      <ModalShell
        title="Create a room"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              Room name
            </label>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Incident Response"
              className="w-full px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] placeholder:text-muted"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-widest">
              Department
            </label>
            <input
              value={createDept}
              onChange={(e) => setCreateDept(e.target.value)}
              placeholder="e.g. SOC"
              className="w-full px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] placeholder:text-muted"
            />
          </div>

          {createError && (
            <div className="text-xs font-medium text-red-500">{createError}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              onClick={submitCreateRoom}
              disabled={createSaving}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white transition-colors disabled:opacity-60"
            >
              {createSaving ? 'Creating…' : 'Create room'}
            </button>
          </div>
        </div>
      </ModalShell>

      {/* New DM Modal */}
      <ModalShell
        title="New direct message"
        open={newDmOpen}
        onClose={() => setNewDmOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted" />
            <input
              value={newDmSearch}
              onChange={(e) => setNewDmSearch(e.target.value)}
              placeholder="Search users by username/email/department…"
              className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] placeholder:text-muted"
            />
          </div>

          <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
            {directoryLoading && (
              <div className="px-4 py-3 text-xs font-medium text-muted">Loading users…</div>
            )}
            {!directoryLoading && directoryUsers.length === 0 && (
              <div className="px-4 py-3 text-xs font-medium text-muted">No users found.</div>
            )}
            {!directoryLoading &&
              directoryUsers
                .filter((u) => u.id !== user?.id)
                .filter((u) => {
                  const q = newDmSearch.trim().toLowerCase();
                  if (!q) return true;
                  return u.username.toLowerCase().includes(q);
                })
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setNewDmOpen(false);
                      setActiveKind('dm');
                      setSelectedDmUserId(u.id);
                      setSelectedRoomId(null);
                      setDmLoading(true);
                      setDmMessages([]);
                      getDmHistory(u.id, 100, 0)
                        .then(setDmMessages)
                        .catch(console.error)
                        .finally(() => setDmLoading(false));

                      // Insert conversation instantly so it appears immediately in the list
                      setDmConversations((prev) => {
                        if (prev.some((c) => c.other_user === u.id)) return prev;
                        const nowIso = new Date().toISOString();
                        return [
                          {
                            other_user: u.id,
                            last_message: '',
                            last_message_at: nowIso,
                            is_read: true,
                            sent_by_me: true,
                          },
                          ...prev,
                        ];
                      });
                    }}
                    className="w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-card transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-primary truncate">{u.username}</div>
                      <div className="text-[10px] font-bold text-muted uppercase tracking-widest">USER</div>
                    </div>
                    <div className="text-xs text-muted truncate">Select to open chat</div>
                  </button>
                ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setNewDmOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
            >
              Close
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Add Users Modal (MANAGER + IT_ADMIN) */}
      <ModalShell
        title="Add users to room"
        open={addUsersOpen}
        onClose={() => setAddUsersOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted" />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by username, email, role, department…"
              className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-sm text-primary focus:outline-none focus:border-[#4f8ef7] placeholder:text-muted"
            />
          </div>

          {addUsersError && (
            <div className="text-xs font-medium text-red-500">{addUsersError}</div>
          )}

          <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
            {usersLoading && (
              <div className="px-4 py-3 text-xs font-medium text-muted">Loading users…</div>
            )}
            {!usersLoading && filteredUsers.length === 0 && (
              <div className="px-4 py-3 text-xs font-medium text-muted">No users found.</div>
            )}
            {!usersLoading && filteredUsers.map((u) => {
              const checked = selectedUserIds.has(u.id);
              return (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-card cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedUserIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(u.id)) next.delete(u.id);
                        else next.add(u.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-primary truncate">
                        {u.username}
                      </div>
                      <div className="text-[10px] font-bold text-muted uppercase tracking-widest flex-shrink-0">
                        {u.role}
                      </div>
                    </div>
                    <div className="text-xs text-muted truncate">
                      {u.email} • {u.department ?? '—'}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs font-medium text-muted">
              Selected: {selectedUserIds.size}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddUsersOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
              >
                Cancel
              </button>
              <button
                onClick={submitAddUsers}
                disabled={!selectedRoomId || addingUsers}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-[#4f8ef7] hover:bg-[#3b7ae5] text-white transition-colors disabled:opacity-60"
              >
                {addingUsers ? 'Adding…' : 'Add to room'}
              </button>
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Manage Room Members (remove) */}
      <ModalShell
        title="Room members"
        open={manageMembersOpen}
        onClose={() => setManageMembersOpen(false)}
      >
        <div className="space-y-4">
          {membersError && (
            <div className="text-xs font-medium text-red-500">{membersError}</div>
          )}

          <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
            {membersLoading && (
              <div className="px-4 py-3 text-xs font-medium text-muted">Loading members…</div>
            )}
            {!membersLoading && memberIds.length === 0 && (
              <div className="px-4 py-3 text-xs font-medium text-muted">No members found.</div>
            )}
            {!membersLoading && memberIds.map((id) => {
              const u = directoryMap.get(id);
              const name = u?.username ?? id;
              const isSelf = user?.id === id;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-primary truncate">{name}{isSelf ? ' (you)' : ''}</div>
                  </div>
                  <button
                    disabled={isSelf || removingMemberId === id}
                    onClick={async () => {
                      if (!selectedRoomId) return;
                      setRemovingMemberId(id);
                      setMembersError(null);
                      try {
                        await removeUserFromRoom(selectedRoomId, id);
                        const res = await getRoomMembers(selectedRoomId);
                        setMemberIds(res.members ?? []);
                      } catch (e) {
                        setMembersError(e instanceof Error ? e.message : 'Failed to remove user');
                      } finally {
                        setRemovingMemberId(null);
                      }
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/20 disabled:opacity-60"
                  >
                    {removingMemberId === id ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setManageMembersOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-card hover:bg-border text-primary transition-colors border border-border"
            >
              Close
            </button>
          </div>
        </div>
      </ModalShell>

    </div>
  );
}