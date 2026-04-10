/* ------------------------------------------------------------------
 *  Admin API
 *  User management endpoints (IT_ADMIN only).
 * ------------------------------------------------------------------ */

import { AUTH_BASE } from '../lib/constants';
import { apiGet, apiPost, apiPut, apiDelete } from '../lib/apiClient';
import type { User, UserRole, RegisterPayload } from '../types/user.types';

export async function registerUser(payload: RegisterPayload): Promise<User> {
  return apiPost<User>(`${AUTH_BASE}/auth/register`, payload);
}

/* ---- list / search ---- */

export async function listUsers(): Promise<User[]> {
  return apiGet<User[]>(`${AUTH_BASE}/admin/users`);
}

/** Get a single user by ID. */
export async function getUser(userId: string): Promise<User> {
  return apiGet<User>(`${AUTH_BASE}/admin/users/${userId}`);
}

/* ---- mutations ---- */

/** Update a user's role and/or department. */
export async function updateUser(
  userId: string,
  body: { role?: UserRole; department?: string },
): Promise<User> {
  return apiPut<User>(`${AUTH_BASE}/admin/users/${userId}`, body);
}

/** Suspend (deactivate) a user account. */
export async function suspendUser(userId: string): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`${AUTH_BASE}/admin/users/${userId}/suspend`);
}

/** Re-activate (unsuspend) a previously suspended user. */
export async function unsuspendUser(userId: string): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`${AUTH_BASE}/admin/users/${userId}/unsuspend`);
}

/** Unlock a locked-out user account. */
export async function unlockUser(userId: string): Promise<{ message: string }> {
  return apiPut<{ message: string }>(`${AUTH_BASE}/admin/users/${userId}/unlock`);
}

/** Permanently delete a user. */
export async function deleteUser(userId: string): Promise<void> {
  await apiDelete(`${AUTH_BASE}/admin/users/${userId}`);
}
