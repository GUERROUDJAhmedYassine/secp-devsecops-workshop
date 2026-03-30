export interface ChatUser {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  isOnline: boolean;
}

export interface SecurityRoom {
  id: string;
  name: string;
  preview: string;
  time: string;
  iconType: 'lock' | 'shield';
  isActive: boolean;
  statusText?: string;
  participants?: ChatUser[];
}

export interface DirectMessage {
  id: string;
  user: ChatUser;
  preview: string;
  isActive: boolean;
}

export interface ChatMessage {
  id: string;
  sender: ChatUser;
  time: string;
  content: string;
  isSelf: boolean;
  isSystemAlert?: boolean;
}

export const messagingUsers = {
  jd: { id: 'u1', name: 'John Doe', initials: 'JD', avatarColor: 'bg-slate-500', isOnline: true },
  sv: { id: 'u2', name: 'Sarah Vance', initials: 'SV', avatarColor: 'bg-slate-400', isOnline: false },
  mk: { id: 'u3', name: 'Mark Kapur', initials: 'MK', avatarColor: 'bg-slate-600', isOnline: true },
  ab: { id: 'u4', name: 'Ahmed Benali', initials: 'AB', avatarColor: 'bg-[#4f8ef7]', isOnline: true },
};

export const securityRooms: SecurityRoom[] = [
  {
    id: 'r1',
    name: 'Incident Response',
    preview: 'Critical vulnerability found in...',
    time: '14:02',
    iconType: 'lock',
    isActive: true,
    statusText: 'ACTIVE BREACH DRILL',
    participants: [
      messagingUsers.jd,
      messagingUsers.sv,
      messagingUsers.ab,
    ],
  },
  {
    id: 'r2',
    name: 'Global SOC',
    preview: 'Standard monitoring protocol...',
    time: '09:15',
    iconType: 'shield',
    isActive: false,
  }
];

export const directMessages: DirectMessage[] = [
  { id: 'dm1', user: messagingUsers.jd, preview: 'Are the logs available?', isActive: false },
  { id: 'dm2', user: messagingUsers.sv, preview: 'The firewall rule is updated.', isActive: false },
  { id: 'dm3', user: messagingUsers.mk, preview: 'Ready for the audit?', isActive: false },
];

export const incidentResponseChat: ChatMessage[] = [
  {
    id: 'm1',
    sender: messagingUsers.jd,
    time: '14:02',
    content: "We've detected unusual outbound traffic on port 443 from the staging server. IP is 192.168.1.45. Can anyone confirm if this is expected?",
    isSelf: false,
  },
  {
    id: 'm2',
    sender: messagingUsers.sv,
    time: '14:05',
    content: "I just checked the deployment logs. No deployments scheduled for today. This looks like an anomaly. Initiating lockdown protocol for the segment.",
    isSelf: false,
  },
  {
    id: 'm3',
    sender: messagingUsers.ab,
    time: '14:07',
    content: "Acknowledged. I'm reviewing the firewall logs now. Segregating the VLAN 14 segment immediately to prevent lateral movement.",
    isSelf: true,
  },
  {
    id: 'sys1',
    sender: messagingUsers.ab, // Not really used for system alert
    time: '14:08',
    content: "VLAN 14 LOCKED DOWN BY AHMED BENALI",
    isSelf: false,
    isSystemAlert: true,
  },
  {
    id: 'm4',
    sender: messagingUsers.jd,
    time: '14:10',
    content: "Thanks Ahmed. I'm pulling the packet capture for forensic analysis.",
    isSelf: false,
  }
];
