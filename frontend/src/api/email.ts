/* ------------------------------------------------------------------
 *  Email API
 *  Fetches inbox/sent mail and sends mail via the mail service.
 * ------------------------------------------------------------------ */

import { MAIL_BASE, MSG_BASE } from '../lib/constants';
import { apiDelete, apiGet, apiGetBlob, apiPost } from '../lib/apiClient';
import type {
  EmailComposePayload,
  EmailListResponse,
  EmailMessage,
} from '../types/email.types';

export const MAIL_SYNC_EVENT = 'secp:mail-sync';

function broadcastMailSync() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MAIL_SYNC_EVENT));
}

interface MailListParams {
  page?: number;
  perPage?: number;
  unreadOnly?: boolean;
}

function withQuery(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {
      return utfMatch[1];
    }
  }

  const plainMatch = header.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? null;
}

export async function getInbox(params: MailListParams = {}): Promise<EmailListResponse> {
  return apiGet<EmailListResponse>(
    withQuery(`${MAIL_BASE}/mail/inbox`, {
      page: String(params.page ?? 1),
      per_page: String(params.perPage ?? 20),
      unread_only: String(params.unreadOnly ?? false),
    }),
  );
}

export async function getSent(params: MailListParams = {}): Promise<EmailListResponse> {
  return apiGet<EmailListResponse>(
    withQuery(`${MAIL_BASE}/mail/sent`, {
      page: String(params.page ?? 1),
      per_page: String(params.perPage ?? 20),
    }),
  );
}

export async function getEmail(
  emailId: string,
  options: { markRead?: boolean } = {},
): Promise<EmailMessage> {
  const email = await apiGet<EmailMessage>(
    withQuery(`${MAIL_BASE}/mail/${emailId}`, {
      mark_read: String(options.markRead ?? true),
    }),
  );
  if (options.markRead ?? true) {
    broadcastMailSync();
  }
  return email;
}

export async function sendEmail(data: EmailComposePayload): Promise<EmailMessage> {
  const formData = new FormData();
  formData.append('to', data.to);
  formData.append('subject', data.subject);
  formData.append('body', data.body);

  if (data.attachment) {
    formData.append('attachment', data.attachment);
  }

  const created = await apiPost<EmailMessage>(`${MAIL_BASE}/mail/send`, formData);
  broadcastMailSync();
  return created;
}

export async function deleteEmail(emailId: string): Promise<void> {
  await apiDelete(`${MAIL_BASE}/mail/${emailId}`);
  broadcastMailSync();
}

export async function downloadEmailAttachment(
  emailId: string,
  fallbackName = 'attachment',
): Promise<void> {
  const response = await apiGetBlob(`${MAIL_BASE}/mail/${emailId}/attachment`);
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName =
    fileNameFromDisposition(response.headers.get('Content-Disposition')) ?? fallbackName;

  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export async function getChatMessages(roomId: string): Promise<unknown[]> {
  return apiGet<unknown[]>(`${MSG_BASE}/rooms/${encodeURIComponent(roomId)}/messages`);
}
