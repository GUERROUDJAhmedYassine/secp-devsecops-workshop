export const MOCK_EMAILS = [
  {
    id: 'e1',
    sender: 'Sarah Connor',
    subject: 'Weekly Security Audit Report',
    preview: 'Attached is the comprehensive audit for the Istanbul network infrastructure...',
    timestamp: '09:32 AM',
    is_read: false,
  },
  {
    id: 'e2',
    sender: 'IT System Alert',
    subject: 'Password Rotation Notification',
    preview: 'Your vault credentials will expire in 48 hours. Please update them at your earliest...',
    timestamp: 'Yesterday',
    is_read: true,
  },
  {
    id: 'e3',
    sender: 'Product Team',
    subject: 'Sprint Q4 Planning Session',
    preview: 'Meeting link for tomorrows planning session on the Sovereign Vault features...',
    timestamp: 'Oct 22',
    is_read: true,
  },
  {
    id: 'e4',
    sender: 'Legal Dept.',
    subject: 'NDA Update Required',
    preview: 'Please review the updated non-disclosure template in the document management portal...',
    timestamp: 'Oct 11',
    is_read: true,
  },
];

export const MOCK_CHAT = [
  {
    id: 'c1',
    sender: 'Sarah C.',
    avatar: 'SC',
    message: 'Has anyone reviewed the new firewall rules for the staging environment? I noticed some packet drops in the logs.',
    time: '11:14',
    is_me: false,
  },
  {
    id: 'c2',
    sender: 'Ahmed Benali',
    avatar: 'AB',
    message: "I'm checking it now. The IP 192.168.1.45 seems to be flagged for rate limiting. I'll adjust the policy.",
    time: '11:19',
    is_me: true,
  },
  {
    id: 'c3',
    sender: 'Marcus T.',
    avatar: 'MT',
    message: "Thanks Ahmed. Let me know when the policy is updated so I can re-run the health checks on the staging pods.",
    time: '11:41',
    is_me: false,
  },
];
