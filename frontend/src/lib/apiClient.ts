/* ------------------------------------------------------------------
 *  Central API client
 *  A thin wrapper around fetch that auto-attaches the JWT Bearer
 *  header and retries once on 401 via silent token refresh.
 * ------------------------------------------------------------------ */

import { getAccessToken, silentRefresh, clearTokens } from './tokenManager';

export interface ApiRequestInit extends RequestInit {
  /** When true the Authorization header is NOT attached. */
  skipAuth?: boolean;
}

async function sendRequest(
  url: string,
  init: ApiRequestInit = {},
): Promise<Response> {
  const { skipAuth, headers: extraHeaders, ...rest } = init;

  const headers = new Headers(extraHeaders);
  if (!headers.has('Content-Type') && !(rest.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  let res = await fetch(url, { ...rest, headers });

  /* ---- auto-retry once on 401 ---- */
  if (res.status === 401 && !skipAuth) {
    try {
      await silentRefresh();
      const retryHeaders = new Headers(headers);
      const newToken = getAccessToken();
      if (newToken) {
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
      }
      res = await fetch(url, { ...rest, headers: retryHeaders });
    } catch {
      clearTokens();
      window.location.href = '/';
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as Record<string, string>).detail ??
      (body as Record<string, string>).message ??
      res.statusText;
    throw new Error(msg);
  }

  return res;
}

async function request<T = unknown>(
  url: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const res = await sendRequest(url, init);

  /* 204 No Content */
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

/* ---- convenience verbs ---- */

export function apiGet<T = unknown>(url: string, init?: ApiRequestInit) {
  return request<T>(url, { ...init, method: 'GET' });
}

export function apiPost<T = unknown>(
  url: string,
  body?: unknown,
  init?: ApiRequestInit,
) {
  return request<T>(url, {
    ...init,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export function apiPut<T = unknown>(
  url: string,
  body?: unknown,
  init?: ApiRequestInit,
) {
  return request<T>(url, {
    ...init,
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function apiPatch<T = unknown>(
  url: string,
  body?: unknown,
  init?: ApiRequestInit,
) {
  return request<T>(url, {
    ...init,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function apiDelete<T = unknown>(url: string, init?: ApiRequestInit) {
  return request<T>(url, { ...init, method: 'DELETE' });
}

export function apiGetBlob(url: string, init?: ApiRequestInit) {
  return sendRequest(url, { ...init, method: 'GET' });
}
