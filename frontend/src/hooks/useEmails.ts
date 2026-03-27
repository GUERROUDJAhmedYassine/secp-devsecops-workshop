import { useState, useEffect } from 'react';
import { getEmails, getChatMessages } from '../api/email';
import type { Email } from '../types/email.types';

export function useEmails() {
  const [emails, setEmails] = useState<Email[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chat, setChat] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getEmails(), getChatMessages('engineering-team')])
      .then(([e, c]) => {
        setEmails(e as Email[]);
        setChat(c);
      })
      .finally(() => setLoading(false));
  }, []);

  return { emails, chat, loading };
}
