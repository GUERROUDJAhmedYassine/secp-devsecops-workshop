/* ------------------------------------------------------------------
 *  Messaging types
 * ------------------------------------------------------------------ */

export interface Room {
  id: string;
  name: string;
  /** Department scope for the room (nullable in DB). */
  department?: string | null;
  /** Creator user id (uuid string). */
  created_by?: string | null;
  created_at: string;
  /** Optional metadata used by some UIs. */
  last_message_at?: string | null;
}

export interface RoomMessage {
  id: string;
  room_id: string | null;
  sender_id: string;
  content: string;
  /** REST shape from messaging service */
  created_at?: string;
  /** REST adds username field in room history */
  username?: string;
  /** WebSocket broadcast may provide sender username differently */
  sender_username?: string;
  timestamp?: string;
  edited?: boolean;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface CreateRoomPayload {
  name: string;
  department: string;
}

export interface DmConversation {
  other_user: string;
  last_message: string;
  last_message_at: string;
  is_read: boolean;
  sent_by_me: boolean;
}

export interface UnreadCount {
  sender_id: string;
  unread_count: number;
  latest_at: string;
}

/** Inbound WebSocket frames (matches services/messaging/app/websocket/handler.py) */
export type MessagingWsInbound =
  | { type: 'system'; message: string; user_id: string }
  | { type: 'pong'; timestamp: string }
  | { type: 'error'; code?: number; message: string; timestamp?: string }
  | { type: 'dm'; from: string; content: string; message_id: string; timestamp: string }
  | { type: 'dm_sent'; message_id: string; to: string; delivered: boolean; timestamp: string }
  | { type: 'message_read'; message_id: string; by: string; timestamp: string }
  | { type: 'read_ack'; message_id: string; status: 'success' | 'already_read'; timestamp?: string }
  | { type: 'room_sent'; room_id: string; timestamp: string }
  // room broadcast payload is sent via rooms.service.handle_room_message()
  | { type: 'message'; from: string; room_id: string; content: string; timestamp: string; message_id: string }
  | { type: 'history'; with: string; messages: DirectMessage[]; limit: number; offset: number; count: number };

/** Outbound WebSocket payloads */
export type MessagingWsOutbound =
  | { type: 'ping' }
  | { type: 'room'; room_id: string; content: string }
  | { type: 'dm'; to: string; content: string }
  | { type: 'history'; with: string; limit?: number; offset?: number }
  | { type: 'read'; message_id: string; from: string };
