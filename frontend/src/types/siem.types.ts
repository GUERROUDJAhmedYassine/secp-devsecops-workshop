/* ------------------------------------------------------------------
 *  SIEM types
 * ------------------------------------------------------------------ */

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SiemEvent {
  id: string;
  event_type: string;
  source_ip: string;
  user_id: string | null;
  username: string | null;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface Alert {
  id: string;
  event_id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertStatusUpdate {
  status: AlertStatus;
  note?: string;
}

export interface UserBaseline {
  user_id: string;
  username: string;
  avg_login_hour: number;
  usual_ips: string[];
  avg_emails_per_day: number;
  avg_files_per_day: number;
  risk_score: number;
  last_updated: string;
}

/** Inbound SIEM WebSocket frames */
export type SiemWsPayload =
  | { type: 'new_alert';      data: Alert }
  | { type: 'alert_updated';  data: Alert }
  | { type: 'new_event';      data: SiemEvent }
  | { type: 'heartbeat';      data: { ts: string } };
