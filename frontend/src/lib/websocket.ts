/* ------------------------------------------------------------------
 *  WebSocket Manager
 *  Provides a reconnecting WebSocket wrapper used for:
 *    • Messaging   (:8003/ws)
 *    • SIEM alerts  (:8006)
 *  Authentication uses the HttpOnly access-token cookie.
 * ------------------------------------------------------------------ */

export type WsMessageHandler = (data: unknown) => void;

export interface WsManagerOptions {
  /** Base WebSocket URL (e.g. ws://localhost:8003/ws) */
  url: string;
  /** Called on every inbound message (already JSON-parsed) */
  onMessage: WsMessageHandler;
  /** Called when the connection opens */
  onOpen?: () => void;
  /** Called when the connection closes (before reconnect) */
  onClose?: (ev: CloseEvent) => void;
  /** Called on error */
  onError?: (ev: Event) => void;
  /** Max reconnect attempts (0 = infinite). @default 10 */
  maxRetries?: number;
  /** Base delay in ms between retries (doubled each attempt). @default 1000 */
  baseDelay?: number;
}

export class WsManager {
  private ws: WebSocket | null = null;
  private retries = 0;
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly url: string;
  private readonly onMessage: WsMessageHandler;
  private readonly onOpen?: () => void;
  private readonly onClose?: (ev: CloseEvent) => void;
  private readonly onError?: (ev: Event) => void;
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  constructor(opts: WsManagerOptions) {
    this.url        = opts.url;
    this.onMessage  = opts.onMessage;
    this.onOpen     = opts.onOpen;
    this.onClose    = opts.onClose;
    this.onError    = opts.onError;
    this.maxRetries = opts.maxRetries ?? 10;
    this.baseDelay  = opts.baseDelay  ?? 1000;
  }

  /* ---- public API ---- */

  /** Open (or re-open) the WebSocket connection. */
  connect(): void {
    this.disposed = false;
    this.open();
  }

  /** Send a JSON-serialisable payload. */
  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WsManager] Cannot send – socket not open');
    }
  }

  /** Permanently close the socket and stop reconnecting. */
  disconnect(): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;   // prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /* ---- internals ---- */

  private open(): void {
    if (this.disposed) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.retries = 0;
      this.onOpen?.();
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data as string);
        this.onMessage(parsed);
      } catch {
        // If not JSON, forward raw
        this.onMessage(ev.data);
      }
    };

    this.ws.onerror = (ev) => {
      this.onError?.(ev);
    };

    this.ws.onclose = (ev) => {
      this.onClose?.(ev);
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    if (this.maxRetries > 0 && this.retries >= this.maxRetries) {
      console.warn('[WsManager] Max retries reached – giving up');
      return;
    }

    const delay = this.baseDelay * Math.pow(2, Math.min(this.retries, 8));
    this.retries += 1;

    this.reconnectTimer = setTimeout(() => {
      this.open();
    }, delay);
  }
}
