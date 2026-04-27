/* ------------------------------------------------------------------
 *  useMessaging hook
 *  WebSocket state, incoming messages, room list, send function.
 * ------------------------------------------------------------------ */

import { useState, useEffect, useRef, useCallback } from 'react';
import { WsManager } from '../lib/websocket';
import {
  getRooms,
  getMessages,
  createMessagingSocket,
} from '../api/messaging';
import type {
  Room,
  RoomMessage,
  MessagingWsInbound,
  MessagingWsOutbound,
} from '../types/messaging.types';
import { useAuth } from './useAuth';

export function useMessaging(activeRoomId: string | null) {
  const { isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WsManager | null>(null);

  /* ---- fetch rooms ---- */
  useEffect(() => {
    if (!isAuthenticated) return;
    getRooms()
      .then(setRooms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  /* ---- fetch message history when active room changes ---- */
  useEffect(() => {
    if (!activeRoomId || !isAuthenticated) return;
    setLoading(true);
    getMessages(activeRoomId)
      .then(setMessages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeRoomId, isAuthenticated]);

  /* ---- WebSocket lifecycle ---- */
  useEffect(() => {
    if (!isAuthenticated) return;

    const ws = createMessagingSocket((raw: unknown) => {
      const payload = raw as MessagingWsInbound;

      switch (payload.type) {
        case 'message':
          // room broadcast
          setMessages((prev) => [
            ...prev,
            {
              id: payload.message_id,
              room_id: payload.room_id,
              sender_id: payload.sender_id ?? payload.from,
              sender_username: payload.sender_username ?? payload.from,
              content: payload.content,
              timestamp: payload.timestamp,
              created_at: payload.timestamp,
              is_read: false,
            },
          ]);
          setRooms((prev) =>
            prev.map((r) =>
              r.id === payload.room_id
                ? { ...r, last_message_at: payload.timestamp }
                : r,
            ),
          );
          break;

        default:
          break;
      }
    });

    ws.connect();
    wsRef.current = ws;
    setConnected(true);

    return () => {
      ws.disconnect();
      wsRef.current = null;
      setConnected(false);
    };
  }, [isAuthenticated]);

  /* ---- send helper ---- */
  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      const payload: MessagingWsOutbound = { type: 'room', room_id: roomId, content };
      wsRef.current?.send(payload);
    },
    [],
  );

  return {
    rooms,
    messages,
    connected,
    loading,
    sendMessage,
  };
}
