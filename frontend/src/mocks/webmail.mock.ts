export const webmailFolders = [
  { name: 'Inbox', count: 12 },
  { name: 'Sent', count: 0 },
  { name: 'Drafts', count: 3 },
  { name: 'Spam', count: 0 },
  { name: 'Trash', count: 0 },
];

export const webmailLabels = [
  { name: 'Critical', color: '#ef4444' },
  { name: 'High Priority', color: '#f59e0b' },
  { name: 'Infrastructure', color: '#3b82f6' },
];

export interface WebmailEmail {
  id: number;
  sender: string;
  subject: string;
  preview: string;
  time: string;
  isRead: boolean;
  label?: string;
  body: string;
  from: string;
  to: string;
  folder?: 'Inbox' | 'Sent' | 'Drafts' | 'Spam' | 'Trash';
  attachments?: { name: string; size: string }[];
  technical?: { label: string; value: string }[];
}

export const webmailEmails: WebmailEmail[] = [
  {
    id: 1,
    sender: 'Security Operations Center',
    subject: 'ALERT: Potential Data Exfiltration Detected',
    preview: 'System ID: SECP-7892. A high-volume data transfer has been flagged from Subnet-B to an external IP...',
    time: '14:22',
    isRead: false,
    label: 'Critical',
    from: 'soc-alerts@secp-internal.com',
    to: 'Ahmed Benali',
    body: `Ahmed,

The Automated Threat Response (ATR) system has detected an anomalous data transfer pattern originating from **Subnet-B (Endpoint ID: 192.168.4.12)**. Current telemetry indicates approximately 4.2GB of encrypted payload has been transmitted to an unidentified external node.

Immediate action is required to verify the legitimacy of this transfer. Please review the attached network logs and confirm if this was an authorized backup procedure or if we need to initiate protocol **DELTA-9** lockdown.

Best regards,
SOC Automation Lead`,
    technical: [
      { label: 'Event Class', value: 'NETWORK_EXFIL' },
      { label: 'Source Host', value: 'PROD-DB-NODE-01' },
      { label: 'Protocol', value: 'HTTPS (443)' },
      { label: 'Destination', value: '82.16.44.201' },
    ],
    attachments: [
      { name: 'traffic_logs_1422.csv', size: '341 KB' },
      { name: 'trace_route_viz.png', size: '12 MB' },
    ],
  },
  {
    id: 2,
    sender: 'Sarah Jenkins (Compliance)',
    subject: 'Quarterly Security Audit Requirements',
    preview: 'Hi Ahmed, just a reminder that the Q3 security audit documentation is due by end of week...',
    time: '11:06',
    isRead: true,
    from: 'sarah.jenkins@secp-internal.com',
    to: 'Ahmed Benali',
    body: `Hi Ahmed,

Just a reminder that the Q3 security audit documentation is due by end of week. Please ensure all access logs, patch records, and incident reports are compiled and submitted to the compliance portal before Friday COB.

Let me know if you need any extensions or clarification on the requirements.

Best,
Sarah Jenkins
Compliance Officer`,
  },
  {
    id: 3,
    sender: 'System Administrator',
    subject: 'Scheduled Server Maintenance Tonight',
    preview: 'Please be advised that the main vault servers will be undergoing scheduled maintenance starting at 02:00...',
    time: '09:12',
    isRead: false,
    label: 'Infrastructure',
    from: 'sysadmin@secp-internal.com',
    to: 'All Staff',
    body: `Team,

Please be advised that the main vault servers will be undergoing scheduled maintenance tonight starting at 02:00 AM UTC. Expected downtime is 45 minutes.

Affected systems:
- Secure Vault (Primary & Replica)
- Authentication Gateway
- Audit Log Forwarder

Please save your work and log out before midnight to avoid session disruption.

— Sys Admin Team`,
  },
  {
    id: 4,
    sender: 'Microsoft Security',
    subject: 'New Sign-in detected for SECP-Admin',
    preview: 'A new sign-in was detected for your account from a new device or location. If this was you...',
    time: 'Yesterday',
    isRead: true,
    from: 'security@microsoft.com',
    to: 'Ahmed Benali',
    body: `A new sign-in was detected for your Microsoft account associated with SECP-Admin.

Device: Windows 11 — Chrome 122
Location: Amsterdam, Netherlands
Time: March 21, 2026, 18:44 UTC

If this was you, no action is required. If you don't recognize this activity, please secure your account immediately.

Microsoft Security Team`,
  },
  {
    id: 5,
    sender: 'HR Department',
    subject: 'Annual Security Training Completion',
    preview: 'Thank you for completing your mandatory annual security awareness training. Your certificate...',
    time: 'Oct 12',
    isRead: true,
    from: 'hr@secp-internal.com',
    to: 'Ahmed Benali',
    body: `Hi Ahmed,

Thank you for completing your mandatory annual security awareness training. Your certificate of completion has been recorded in our HR system.

Your next training cycle is due: April 2027.

Please keep this email for your records.

HR Department — SECP Platform`,
  },
  {
    id: 6,
    sender: 'Ahmed Benali',
    subject: 'Re: Firewall Rules Review',
    preview: 'I have updated the rules according to your specifications. Please review...',
    time: 'Monday',
    isRead: true,
    folder: 'Sent',
    from: 'ahmed.benali@secp-ops.enterprise',
    to: 'john.doe@secp-internal.com',
    body: `John,

I've pushed the new firewall configurations to the staging environment. Let me know when you have time to review the logs.

Regards,
Ahmed Benali`,
  },
  {
    id: 7,
    sender: 'Ahmed Benali',
    subject: 'Draft: Q4 Security Budget Proposal',
    preview: 'Attached is the initial draft for the security tools budget...',
    time: 'Last Week',
    isRead: true,
    folder: 'Drafts',
    from: 'ahmed.benali@secp-ops.enterprise',
    to: '',
    body: `Attached is the initial draft for the security tools budget. We need to allocate funds for the new SIEM platform and upgrade our EDR licenses.`,
  },
  {
    id: 8,
    sender: 'Crypto Promo',
    subject: 'Earn 500% Returns on SECP Tokens',
    preview: 'Don\'t miss out on this exclusive offer. Click here to claim your tokens...',
    time: '2h ago',
    isRead: false,
    folder: 'Spam',
    from: 'promo@crypto-spam-xyz.com',
    to: 'Ahmed Benali',
    body: `Click here to claim your tokens immediately! 500% returns guaranteed!`,
  },
  {
    id: 9,
    sender: 'Vendor Notifications',
    subject: 'Your Subscription has Expired',
    preview: 'Your recent payment method failed. Please update your billing info...',
    time: '1h ago',
    isRead: false,
    folder: 'Trash',
    from: 'billing@random-vendor.com',
    to: 'Ahmed Benali',
    body: `Your payment was declined. Update your billing info to continue your subscription.`,
  }
];
