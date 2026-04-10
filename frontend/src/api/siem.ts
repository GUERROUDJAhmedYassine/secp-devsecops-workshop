/* ------------------------------------------------------------------
 *  SIEM API
 *  Events, alerts, alert status updates, baselines,
 *  plus WebSocket for live alert push.
 * ------------------------------------------------------------------ */

import { SIEM_BASE, SIEM_WS_URL } from '../lib/constants';
import { apiGet, apiPatch } from '../lib/apiClient';
import { WsManager, type WsMessageHandler } from '../lib/websocket';
import type {
  SiemEvent,
  Alert,
  AlertStatusUpdate,
  UserBaseline,
} from '../types/siem.types';

/* ---- Events ---- */

export interface EventListParams {
  page?: number;
  per_page?: number;
  severity?: string;
  event_type?: string;
  from?: string;
  to?: string;
}

export async function getEvents(params: EventListParams = {}): Promise<{
  events: SiemEvent[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.per_page !== undefined) qs.set('per_page', String(params.per_page));
  if (params.severity) qs.set('severity', params.severity);
  if (params.event_type) qs.set('event_type', params.event_type);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);

  return apiGet<{ events: SiemEvent[]; total: number }>(
    `${SIEM_BASE}/events?${qs.toString()}`,
  );
}

/* ---- Alerts ---- */

export interface AlertListParams {
  page?: number;
  per_page?: number;
  status?: string;
  severity?: string;
}

export async function getAlerts(params: AlertListParams = {}): Promise<{
  alerts: Alert[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.per_page !== undefined) qs.set('per_page', String(params.per_page));
  if (params.status) qs.set('status', params.status);
  if (params.severity) qs.set('severity', params.severity);

  return apiGet<{ alerts: Alert[]; total: number }>(
    `${SIEM_BASE}/alerts?${qs.toString()}`,
  );
}

export async function getAlert(alertId: string): Promise<Alert> {
  return apiGet<Alert>(`${SIEM_BASE}/alerts/${alertId}`);
}

/** Update alert status (acknowledge, resolve, dismiss). */
export async function updateAlertStatus(
  alertId: string,
  update: AlertStatusUpdate,
): Promise<Alert> {
  return apiPatch<Alert>(`${SIEM_BASE}/alerts/${alertId}/status`, update);
}

/* ---- Baselines ---- */

export async function getBaselines(): Promise<UserBaseline[]> {
  return apiGet<UserBaseline[]>(`${SIEM_BASE}/baselines`);
}

export async function getBaseline(userId: string): Promise<UserBaseline> {
  return apiGet<UserBaseline>(`${SIEM_BASE}/baselines/${userId}`);
}

/* ---- WebSocket ---- */

/**
 * Create a WsManager instance for the SIEM live alert feed.
 * Caller is responsible for calling `.connect()` and `.disconnect()`.
 */
export function createSiemSocket(onMessage: WsMessageHandler): WsManager {
  return new WsManager({
    url: SIEM_WS_URL,
    onMessage,
    maxRetries: 10,
    baseDelay: 1500,
  });
}
