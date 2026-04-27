/* ------------------------------------------------------------------
 *  User & Auth types
 * ------------------------------------------------------------------ */

export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'IT_ADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  department: string | null;
  is_active: boolean;
  failed_logins: number;
  locked_until: string | null;
  vpn_public_key: string | null;
  last_login_at: string | null;
  created_at: string | null;
  risk_score: number;
}

export interface DirectoryUser {
  id: string;
  username: string;
  email: string;
  role: UserRole | string;
  department: string | null;
  is_active: boolean;
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
  email: string;
  department: string;
  role?: UserRole;
}

export interface PasswordChangePayload {
  old_password: string;
  new_password: string;
}
