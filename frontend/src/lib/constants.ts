/* ------------------------------------------------------------------
 *  Service base URLs
 *  In production these should come from env vars; for local dev the
 *  backend services bind to localhost on the ports below.
 * ------------------------------------------------------------------ */

const API_HOST = import.meta.env.VITE_API_HOST ?? 'http://localhost';

/** Auth service – JWT, bcrypt, account lockout */
export const AUTH_BASE    = `${API_HOST}:8001`;

/** Mail service – MailHog-backed internal email */
export const MAIL_BASE    = `${API_HOST}:8002`;

/** Messaging service – REST + WebSocket real-time chat */
export const MSG_BASE     = `${API_HOST}:8003`;

/** Files service – upload / download with RBAC */
export const FILES_BASE   = `${API_HOST}:8004`;

/** SIEM engine – events, alerts, baselines */
export const SIEM_BASE    = `${API_HOST}:8005`;

/* ---- WebSocket endpoints ---- */

const WS_HOST = import.meta.env.VITE_WS_HOST ?? 'ws://localhost';

/** Messaging WebSocket */
export const MSG_WS_URL   = `${WS_HOST}:8003/ws`;

/** SIEM real-time alert push */
export const SIEM_WS_URL  = `${WS_HOST}:8006`;
