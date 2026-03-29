/* ------------------------------------------------------------------
 *  Admin API
 *  User management endpoints (IT_ADMIN only).
 * ------------------------------------------------------------------ */

import { AUTH_BASE } from '../lib/constants';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/apiClient';
import type { User, UserRole } from '../types/user.types';

/* ---- list / search ---- */

export interface UserListParams {
  page?: number;
  per_page?: number;
  search?: string;
  role?: UserRole;
  is_active?: boolean;
}

export async function listUsers(params: UserListParams = {}): Promise<{
  users: User[];
  total: number;
}> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.per_page !== undefined) qs.set('per_page', String(params.per_page));
  if (params.search) qs.set('search', params.search);
  if (params.role) qs.set('role', params.role);
  if (params.is_active !== undefined) qs.set('is_active', String(params.is_active));

  return apiGet<{ users: User[]; total: number }>(
    `${AUTH_BASE}/admin/users?${qs.toString()}`,
  );
}

/** Get a single user by ID. */
export async function getUser(userId: string): Promise<User> {
  return apiGet<User>(`${AUTH_BASE}/admin/users/${userId}`);
}

/* ---- mutations ---- */

/** Suspend (deactivate) a user account. */
export async function suspendUser(userId: string): Promise<User> {
  return apiPatch<User>(`${AUTH_BASE}/admin/users/${userId}/suspend`);
}

/** Re-activate a previously suspended user. */
export async function activateUser(userId: string): Promise<User> {
  return apiPatch<User>(`${AUTH_BASE}/admin/users/${userId}/activate`);
}

/** Update a user's role. */
export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<User> {
  return apiPatch<User>(`${AUTH_BASE}/admin/users/${userId}/role`, { role });
}

/** Permanently delete a user. */
export async function deleteUser(userId: string): Promise<void> {
  await apiDelete(`${AUTH_BASE}/admin/users/${userId}`);
}

/** Unlock a locked-out user account. */
export async function unlockUser(userId: string): Promise<User> {
  return apiPost<User>(`${AUTH_BASE}/admin/users/${userId}/unlock`);
}
