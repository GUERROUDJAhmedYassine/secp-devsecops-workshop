import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from security.jwt_handler import verify_token
from websocket.manager import connect, disconnect
from websocket.handler import handle_message

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
) -> None:
    """Main WebSocket entry point — validates JWT then handles messages."""

    # Step 1 — Validate token before accepting connection
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=1008)
        logger.warning(f"WebSocket rejected — invalid token from {websocket.client.host}")
        return

    user_id = payload.get("sub")
    username = payload.get("username", user_id)
    if not user_id:
        await websocket.close(code=1008)
        logger.warning("WebSocket rejected — missing user_id in token")
        return

    # Step 2 — Accept and register connection
    await connect(user_id, websocket)
    logger.info(f"WebSocket accepted for {username} ({user_id}) from {websocket.client.host}")

    # Step 3 — Notify user they are connected
    await websocket.send_json({
        "type": "system",
        "message": "Connected successfully",
        "user_id": user_id
    })

    # Step 4 — Listen for messages
    try:
        while True:
            data = await websocket.receive_json()

            # Ignore empty or malformed messages
            if not isinstance(data, dict) or "type" not in data:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid message format"
                })
                continue

            await handle_message(websocket, user_id, data)

    except WebSocketDisconnect:
        logger.info(f"User {username} disconnected normally")

    except Exception as e:
        logger.error(f"WebSocket error for {username}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": "Internal server error"
            })
        except Exception:
            pass

    finally:
        # Step 5 — Always clean up on exit
        await disconnect(user_id, websocket)
        logger.info(f"Cleaned up connection for {username}")