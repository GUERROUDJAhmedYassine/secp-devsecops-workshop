/* ------------------------------------------------------------------
 *  Service base URLs — dynamically resolved from the browser's
 *  current host so the app works from any IP (LAN or VPN).
 * ------------------------------------------------------------------ */

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
