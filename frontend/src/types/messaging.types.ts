/* ------------------------------------------------------------------
 *  Messaging types
 * ------------------------------------------------------------------ */

export interface Room {
  id: string;
  name: string;
  description: string;
  is_direct: boolean;
  members: string[];
  created_at: string;
  last_message_at: string | null;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_username: string;
  content: string;
  timestamp: string;
  edited: boolean;
}

export interface CreateRoomPayload {
  name: string;
  description?: string;
  is_direct?: boolean;
  member_ids: string[];
}

/** Discriminated union for inbound WebSocket frames */
export type WebSocketPayload =
  | { type: 'message';        data: Message }
  | { type: 'room_created';   data: Room }
  | { type: 'user_joined';    data: { room_id: string; user_id: string } }
  | { type: 'user_left';      data: { room_id: string; user_id: string } }
  | { type: 'typing';         data: { room_id: string; user_id: string } }
  | { type: 'error';          data: { message: string } };

/** Outbound message sent over the WebSocket */
export interface WsSendPayload {
  type: 'send_message' | 'join_room' | 'leave_room' | 'typing';
  room_id: string;
  content?: string;
}
