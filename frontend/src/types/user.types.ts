/* ------------------------------------------------------------------
 *  User & Auth types
 * ------------------------------------------------------------------ */

export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'IT_ADMIN';

export interface User {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  vpn_status: 'Active' | 'Inactive';
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  full_name: string;
  email: string;
  department: string;
  role?: UserRole;
}

export interface PasswordChangePayload {
  current_password: string;
  new_password: string;
}
