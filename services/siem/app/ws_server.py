"""
SIEM — WebSocket Alert Push Server
Runs on port 8006, separate from the REST API on 8005.
Pushes new alerts to all connected admin clients in real-time.
Also polls the engine's pending alert buffer and broadcasts.
"""
import asyncio
import json
import logging
import sys
import os
from http.cookies import SimpleCookie

# Add app directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import websockets
from security.auth import verify_ws_token
from engine.scheduler import get_and_flush_alerts, get_and_flush_events, start_engine
from core.config import WS_ALERT_PORT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [SIEM-WS] %(message)s")
logger = logging.getLogger(__name__)

# All connected admin WebSocket clients
connected_clients: set = set()
ACCESS_COOKIE = "secp_access_token"


def _get_cookie_token(websocket) -> str | None:
    headers = getattr(websocket, "request_headers", None)
    cookie_header = None
    if headers:
        cookie_header = headers.get("Cookie") or headers.get("cookie")
    elif hasattr(websocket, "request"):
        req_headers = getattr(websocket.request, "headers", None)
        if req_headers:
            cookie_header = req_headers.get("Cookie") or req_headers.get("cookie")

    if not cookie_header:
        return None

    cookies = SimpleCookie()
    cookies.load(cookie_header)
    morsel = cookies.get(ACCESS_COOKIE)
    return morsel.value if morsel else None


async def handler(websocket):
    """Handle incoming WebSocket connections."""
    # Extract token from query params
    path = websocket.request.path if hasattr(websocket, 'request') else ""
    query = ""
    try:
        # websockets >= 11.x
        query = str(websocket.request.path)
    except Exception:
        pass

    # Try to get token from query string
    token = None
    raw_path = str(getattr(websocket, 'path', ''))
    if 'token=' in raw_path:
        token = raw_path.split('token=')[-1].split('&')[0]
    elif hasattr(websocket, 'request'):
        req_path = str(websocket.request.path)
        if 'token=' in req_path:
            token = req_path.split('token=')[-1].split('&')[0]

    # Also check request headers for query params
    if not token:
        try:
            from urllib.parse import urlparse, parse_qs
            url = str(websocket.request.path)
            if '?' in url:
                params = parse_qs(url.split('?', 1)[1])
                token = params.get('token', [None])[0]
        except Exception:
            pass

    if not token:
        token = _get_cookie_token(websocket)

    if not token:
        await websocket.close(1008, "Missing token")
        return

    payload = verify_ws_token(token)
    if not payload:
        await websocket.close(1008, "Invalid or insufficient permissions")
        return

    connected_clients.add(websocket)
    user_id = payload.get("sub", "unknown")
    logger.info(f"Admin connected: {user_id} (total: {len(connected_clients)})")

    try:
        # Send initial heartbeat
        await websocket.send(json.dumps({
            "type": "heartbeat",
            "data": {"ts": __import__("datetime").datetime.utcnow().isoformat()}
        }))

        # Keep connection alive
        async for message in websocket:
            # Client can send pings
            try:
                data = json.loads(message)
                if data.get("type") == "ping":
                    await websocket.send(json.dumps({
                        "type": "heartbeat",
                        "data": {"ts": __import__("datetime").datetime.utcnow().isoformat()}
                    }))
            except Exception:
                pass

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Admin disconnected: {user_id} (total: {len(connected_clients)})")


async def broadcast(message: dict):
    """Send a message to all connected admin clients."""
    if not connected_clients:
        return
    payload = json.dumps(message, default=str)
    dead = set()
    for ws in connected_clients:
        try:
            await ws.send(payload)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


async def alert_pump():
    """Periodically flush pending alerts from the engine and broadcast."""
    while True:
        await asyncio.sleep(2)
        alerts = get_and_flush_alerts()
        for alert in alerts:
            await broadcast({
                "type": "new_alert",
                "data": alert,
            })
            
        events = get_and_flush_events()
        for event in events:
            await broadcast({
                "type": "new_event",
                "data": event,
            })
            
        # Heartbeat every 30s
        if int(asyncio.get_event_loop().time()) % 30 < 2:
            await broadcast({
                "type": "heartbeat",
                "data": {"ts": __import__("datetime").datetime.utcnow().isoformat()}
            })


async def main():
    """Start WS server + alert pump + detection engine."""
    start_engine()

    server = await websockets.serve(handler, "0.0.0.0", WS_ALERT_PORT)
    logger.info(f"SIEM WebSocket server running on :{WS_ALERT_PORT}")

    await asyncio.gather(
        server.wait_closed() if hasattr(server, 'wait_closed') else asyncio.Future(),
        alert_pump(),
    )


if __name__ == "__main__":
    asyncio.run(main())
