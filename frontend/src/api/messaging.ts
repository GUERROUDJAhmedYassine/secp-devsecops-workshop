/* ------------------------------------------------------------------
 *  Messaging API
 *  REST calls for rooms / DMs + WebSocket connection helper.
 * ------------------------------------------------------------------ */

import { MSG_BASE, MSG_WS_URL } from '../lib/constants';
import { apiDelete, apiGet, apiPost } from '../lib/apiClient';
import { WsManager, type WsMessageHandler } from '../lib/websocket';
import type {
  Room,
  RoomMessage,
  CreateRoomPayload,
  DmConversation,
  UnreadCount,
  DirectMessage,
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

/** Add a user to a room (admin/manager action). */
export async function addUserToRoom(
  roomId: string,
  userId: string,
): Promise<{ room_id: string; user_id: string; status: string }> {
  return apiPost(`${MSG_BASE}/rooms/${roomId}/join`, { user_id: userId });
}

export async function getRoomMembers(roomId: string): Promise<{ room_id: string; members: string[] }> {
  return apiGet(`${MSG_BASE}/rooms/${roomId}/members`);
}

export async function removeUserFromRoom(
  roomId: string,
  userId: string,
): Promise<{ room_id: string; user_id: string; status: string }> {
  return apiDelete(`${MSG_BASE}/rooms/${roomId}/members/${userId}`);
}

/** Fetch message history for a room. */
export async function getMessages(
  roomId: string,
  limit = 50,
  offset = 0,
): Promise<RoomMessage[]> {
  return apiGet<RoomMessage[]>(
    `${MSG_BASE}/rooms/${roomId}/messages?limit=${limit}&offset=${offset}`,
  );
}

/** Send a message via REST (alternative to WebSocket). */
export async function sendMessageRest(
  roomId: string,
  content: string,
): Promise<RoomMessage> {
  return apiPost<RoomMessage>(`${MSG_BASE}/rooms/${roomId}/messages`, { content });
}

/* ---- Direct Messages (REST) ---- */

export async function listDmConversations(): Promise<DmConversation[]> {
  return apiGet<DmConversation[]>(`${MSG_BASE}/dm/conversations`);
}

export async function getDmUnreadCounts(): Promise<UnreadCount[]> {
  return apiGet<UnreadCount[]>(`${MSG_BASE}/dm/unread`);
}

export async function markDmRead(senderId: string): Promise<{ status: string; messages_marked: number }> {
  return apiPost(`${MSG_BASE}/dm/read/${senderId}`);
}

export async function deleteDirectMessage(messageId: string): Promise<{ status: string }> {
  return apiDelete<{ status: string }>(`${MSG_BASE}/dm/${messageId}`);
}

export async function getDmHistory(
  otherUserId: string,
  limit = 100,
  offset = 0,
): Promise<DirectMessage[]> {
  return apiGet<DirectMessage[]>(
    `${MSG_BASE}/dm/history/${otherUserId}?limit=${limit}&offset=${offset}`,
  );
}

export async function getOnlineUsers(): Promise<{ online_user_ids: string[] }> {
  return apiGet(`${MSG_BASE}/presence/online`);
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
