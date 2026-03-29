/* ------------------------------------------------------------------
 *  Email API
 *  Fetches emails, chat messages, and sends email via the mail service.
 * ------------------------------------------------------------------ */

import { MAIL_BASE, MSG_BASE } from '../lib/constants';
import { apiGet, apiPost } from '../lib/apiClient';
import type { Email } from '../types/email.types';

export async function getEmails(): Promise<Email[]> {
  return apiGet<Email[]>(`${MAIL_BASE}/mail/inbox`);
}

export async function getChatMessages(roomId: string): Promise<unknown[]> {
  return apiGet<unknown[]>(`${MSG_BASE}/rooms/${roomId}/messages`);
}

export async function sendEmail(data: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  await apiPost(`${MAIL_BASE}/mail/send`, data);
}
