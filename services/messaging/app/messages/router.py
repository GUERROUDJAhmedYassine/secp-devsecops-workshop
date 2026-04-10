import logging
from fastapi import APIRouter, Depends, HTTPException, status
from security.dependencies import get_current_user
from messages import dm_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dm", tags=["direct_messages"])


@router.get("/conversations")
async def list_conversations(current_user: dict = Depends(get_current_user)):
    """Get all conversations for current user with latest message snippet."""
    user_id = str(current_user["id"])
    return await dm_repository.get_conversation_list(user_id)


@router.get("/unread")
async def get_unread_counts(current_user: dict = Depends(get_current_user)):
    """Get unread message counts broken down by sender."""
    user_id = str(current_user["id"])
    return await dm_repository.get_all_unread_counts(user_id)

@router.get("/history/{other_user_id}")
async def get_dm_history(
    other_user_id: str,
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    """Fetch DM history with another user (stable REST alternative to WS history)."""
    user_id = str(current_user["id"])
    return await dm_repository.get_dm_history(
        user1_id=user_id,
        user2_id=other_user_id,
        limit=limit,
        offset=offset,
    )


@router.post("/read/{sender_id}")
async def mark_messages_read(sender_id: str, current_user: dict = Depends(get_current_user)):
    """Mark all messages from a specific sender as read."""
    user_id = str(current_user["id"])
    count = await dm_repository.mark_as_read(user_id, sender_id)
    return {"status": "success", "messages_marked": count}


@router.delete("/{message_id}")
async def delete_direct_message(message_id: str, current_user: dict = Depends(get_current_user)):
    """Soft delete a message you sent."""
    user_id = str(current_user["id"])
    try:
        success = await dm_repository.soft_delete_message(message_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Message not found")
        return {"status": "success"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
