/* ------------------------------------------------------------------
 *  Service base URLs
 *  Dynamically resolves to the hostname the user is currently visiting
 *  (e.g. 10.0.0.1 or 10.8.0.1) to support both LAN and VPN access.
 * ------------------------------------------------------------------ */

const CURRENT_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const CURRENT_PROTOCOL = typeof window !== 'undefined' ? window.location.protocol : 'http:';

const API_HOST = import.meta.env.VITE_API_HOST || `${CURRENT_PROTOCOL}//${CURRENT_HOST}`;

/** Auth service – JWT, bcrypt, account lockout */
const _host     = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const _protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
const _BASE     = `${_protocol}//${_host}`;

export const AUTH_BASE    = `${_BASE}:8001`;
export const MAIL_BASE    = `${_BASE}:8002`;
export const MSG_BASE     = `${_BASE}:8003`;
export const FILES_BASE   = `${_BASE}:8004`;
export const SIEM_BASE    = `${_BASE}:8005`;

/* ---- WebSocket ---- */
const _ws      = _protocol === 'https:' ? 'wss:' : 'ws:';
const _WS_BASE = `${_ws}//${_host}`;

export const MSG_WS_URL  = `${_WS_BASE}:8003/ws`;
export const SIEM_WS_URL = `${_WS_BASE}:8006`;

/* ---- WireGuard ---- */
export const WG_SERVER_PUBLIC_KEY = import.meta.env.VITE_WG_SERVER_PUBLIC_KEY || '';
export const WG_SERVER_ENDPOINT   = import.meta.env.VITE_WG_SERVER_ENDPOINT   || 'secp.abrdns.com:51820';
