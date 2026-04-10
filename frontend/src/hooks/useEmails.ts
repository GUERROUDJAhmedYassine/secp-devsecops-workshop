/* ------------------------------------------------------------------
 *  useEmails hook
 *  Fetches inbox emails and chat messages from the real API.
 * ------------------------------------------------------------------ */

import { useState, useEffect } from 'react';
import { getEmails, getChatMessages } from '../api/email';
import type { Email } from '../types/email.types';

export function useEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [chat, setChat] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getEmails(), getChatMessages('engineering-team')])
      .then(([e, c]) => {
        setEmails(e);
        setChat(c);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { emails, chat, loading };
}
