export type MailFolder = 'inbox' | 'sent';

export interface EmailMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_email: string;
  recipient_id: string;
  recipient_username: string;
  recipient_email: string;
  subject: string;
  body: string;
  has_attachment: boolean;
  attachment_name: string | null;
  attachment_size: string | null;
  is_read: boolean;
  sent_at: string;
}

export interface EmailListResponse {
  emails: EmailMessage[];
  total: number;
  unread_count: number;
}

export interface EmailComposePayload {
  to: string;
  subject: string;
  body: string;
  attachment?: File | null;
}
