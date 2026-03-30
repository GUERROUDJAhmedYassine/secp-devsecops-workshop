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
  Message,
  WebSocketPayload,
  WsSendPayload,
} from '../types/messaging.types';
import { useAuth } from './useAuth';

export function useMessaging(activeRoomId: string | null) {
  const { isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
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
      const payload = raw as WebSocketPayload;

      switch (payload.type) {
        case 'message':
          setMessages((prev) => [...prev, payload.data]);
          /* bump the room's last_message_at */
          setRooms((prev) =>
            prev.map((r) =>
              r.id === payload.data.room_id
                ? { ...r, last_message_at: payload.data.timestamp }
                : r,
            ),
          );
          break;

        case 'room_created':
          setRooms((prev) => [...prev, payload.data]);
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
      const payload: WsSendPayload = {
        type: 'send_message',
        room_id: roomId,
        content,
      };
      wsRef.current?.send(payload);
    },
    [],
  );

  /** Join a room via WebSocket. */
  const joinRoom = useCallback((roomId: string) => {
    const payload: WsSendPayload = { type: 'join_room', room_id: roomId };
    wsRef.current?.send(payload);
  }, []);

  /** Notify others that the user is typing. */
  const sendTyping = useCallback((roomId: string) => {
    const payload: WsSendPayload = { type: 'typing', room_id: roomId };
    wsRef.current?.send(payload);
  }, []);

  return {
    rooms,
    messages,
    connected,
    loading,
    sendMessage,
    joinRoom,
    sendTyping,
  };
}
