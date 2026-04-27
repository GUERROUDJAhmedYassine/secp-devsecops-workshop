/* ------------------------------------------------------------------
 *  SIEM types
 * ------------------------------------------------------------------ */

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SiemEvent {
  id: string | number;
  event_type: string;
  source_ip: string | null;
  service: string;
  user_id: string | null;
  username: string | null;
  description: string;
  severity: AlertSeverity;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface Alert {
  id: string;
  alert_type: string;
  severity: AlertSeverity;
  user_id: string;
  username: string | null;
  description: string;
  evidence: any;
  status: AlertStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface AlertStatusUpdate {
  status: AlertStatus;
  note?: string;
}

export interface UserBaseline {
  user_id: string;
  username: string | null;
  avg_login_hour: number;
  known_ips: string[];
  avg_messages_day: number;
  avg_files_day: number;
  avg_emails_day: number;
  confidence: number;
  tx_count: number;
  last_updated: string;
}

/** Inbound SIEM WebSocket frames */
export type SiemWsPayload =
  | { type: 'new_alert';      data: Alert }
  | { type: 'alert_updated';  data: Alert }
  | { type: 'new_event';      data: SiemEvent }
  | { type: 'new_baseline';   data: UserBaseline }
  | { type: 'heartbeat';      data: { ts: string } };
