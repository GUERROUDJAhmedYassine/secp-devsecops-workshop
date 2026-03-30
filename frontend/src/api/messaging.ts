/* ------------------------------------------------------------------
 *  Messaging API
 *  REST calls for rooms / DMs + WebSocket connection helper.
 * ------------------------------------------------------------------ */

import { MSG_BASE, MSG_WS_URL } from '../lib/constants';
import { apiGet, apiPost } from '../lib/apiClient';
import { WsManager, type WsMessageHandler } from '../lib/websocket';
import type {
  Room,
  Message,
  CreateRoomPayload,
} from '../types/messaging.types';

/* ---- REST endpoints ---- */

/** List all rooms the current user belongs to. */
export async function getRooms(): Promise<Room[]> {
  return apiGet<Room[]>(`${MSG_BASE}/rooms`);
}

/** Get a single room by ID. */
export async function getRoom(roomId: string): Promise<Room> {
  return apiGet<Room>(`${MSG_BASE}/rooms/${roomId}`);
}

/** Create a new room or DM channel. */
export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  return apiPost<Room>(`${MSG_BASE}/rooms`, payload);
}

/** Fetch message history for a room. */
export async function getMessages(
  roomId: string,
  limit = 50,
  offset = 0,
): Promise<Message[]> {
  return apiGet<Message[]>(
    `${MSG_BASE}/rooms/${roomId}/messages?limit=${limit}&offset=${offset}`,
  );
}

/** Send a message via REST (alternative to WebSocket). */
export async function sendMessageRest(
  roomId: string,
  content: string,
): Promise<Message> {
  return apiPost<Message>(`${MSG_BASE}/rooms/${roomId}/messages`, { content });
}

/* ---- WebSocket ---- */

/**
 * Create a WsManager instance for the messaging service.
 * Caller is responsible for calling `.connect()` and `.disconnect()`.
 */
export function createMessagingSocket(onMessage: WsMessageHandler): WsManager {
  return new WsManager({
    url: MSG_WS_URL,
    onMessage,
    maxRetries: 10,
    baseDelay: 1000,
  });
}
