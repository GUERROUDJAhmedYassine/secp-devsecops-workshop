/* ------------------------------------------------------------------
 *  Dashboard API
 *  Fetches the current user and dashboard stats from real endpoints.
 * ------------------------------------------------------------------ */

import { AUTH_BASE, SIEM_BASE } from '../lib/constants';
import { apiGet } from '../lib/apiClient';
import type { User } from '../types/user.types';

export interface SystemMonitorInfo {
  status: string;
  service: string;
  hostname: string;
  platform: string;
  platform_release: string;
  python_version: string;
  cpu_cores: number;
  cpu_load_1m: number | null;
  cpu_load_5m: number | null;
  cpu_load_15m: number | null;
  cpu_usage_percent: number | null;
  server_time: string;
  uptime_seconds: number;
}

export async function getUser(): Promise<User> {
  return apiGet<User>(`${AUTH_BASE}/auth/me`);
}

export async function getStats(): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>(`${SIEM_BASE}/dashboard/stats`);
}

export async function getSystemMonitor(): Promise<SystemMonitorInfo> {
  return apiGet<SystemMonitorInfo>(`${SIEM_BASE}/dashboard/system`);
}
