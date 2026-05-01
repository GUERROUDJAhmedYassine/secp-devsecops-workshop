/* ------------------------------------------------------------------
 *  Service base URLs
 *  Dynamically resolves to the hostname the user is currently visiting
 *  (e.g. 10.0.0.1 or 10.8.0.1) to support both LAN and VPN access.
 * ------------------------------------------------------------------ */

const CURRENT_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const CURRENT_PROTOCOL = typeof window !== 'undefined' ? window.location.protocol : 'http:';

const API_HOST = import.meta.env.VITE_API_HOST || `${CURRENT_PROTOCOL}//${CURRENT_HOST}`;

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

const WS_PROTOCOL = CURRENT_PROTOCOL === 'https:' ? 'wss:' : 'ws:';
const WS_HOST = import.meta.env.VITE_WS_HOST || `${WS_PROTOCOL}//${CURRENT_HOST}`;

/** Messaging WebSocket */
export const MSG_WS_URL   = `${WS_HOST}:8003/ws`;

/** SIEM real-time alert push */
export const SIEM_WS_URL  = `${WS_HOST}:8006`;

/* ---- WireGuard VPN Settings ---- */
export const WG_SERVER_PUBLIC_KEY = import.meta.env.VITE_WG_SERVER_PUBLIC_KEY || '2UlMAQixriuFu1X0PWOkxxDEPN0Y+KH8DghpOs6al0I=';
export const WG_SERVER_ENDPOINT   = import.meta.env.VITE_WG_SERVER_ENDPOINT   || 'secp.abrdns.com:51820';
