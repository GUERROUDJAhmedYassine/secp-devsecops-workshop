/* ------------------------------------------------------------------
 *  Dashboard API
 *  Fetches the current user and dashboard stats from real endpoints.
 * ------------------------------------------------------------------ */

import { AUTH_BASE, SIEM_BASE } from '../lib/constants';
import { apiGet } from '../lib/apiClient';
import type { User } from '../types/user.types';

export async function getUser(): Promise<User> {
  return apiGet<User>(`${AUTH_BASE}/auth/me`);
}

export async function getStats(): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>(`${SIEM_BASE}/dashboard/stats`);
}
