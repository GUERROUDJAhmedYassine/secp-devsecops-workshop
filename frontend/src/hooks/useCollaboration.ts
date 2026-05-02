import { useState, useEffect, useCallback, useRef } from 'react';
import { getCollaborationState } from '../api/files';
import { WsManager } from '../lib/websocket';
import type { CollabWsPayload, CollaborationSessionResponse, CollaborationStateResponse } from '../types/files.types';

const CURRENT_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const CURRENT_PROTOCOL = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_HOST = `${CURRENT_PROTOCOL}//${CURRENT_HOST}`;

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<\/div>\s*<div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

export function useCollaboration(
  sessionInfo: CollaborationSessionResponse | null,
  onYjsUpdate?: (updateBase64: string) => void
) {
  const [state, setState] = useState<CollaborationStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsManagerRef = useRef<WsManager | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!sessionInfo) {
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
        wsManagerRef.current = null;
      }
      setState(null);
      setError(null);
      return;
    }

    const { file_id, session_id } = sessionInfo;

    // Fetch initial state first just to be sure we have the latest
    getCollaborationState(file_id, session_id)
      .then((initialState) => {
        if (!isMounted.current) return;
        setState(initialState);
      })
      .catch((err) => {
        if (!isMounted.current) return;
        console.error('[useCollaboration] Failed to get initial state', err);
        setError(`Failed to fetch document state: ${err.message}`);
      });

    // Build the correct WS URL through Nginx proxy
    const wsUrl = `${WS_HOST}:${typeof window !== 'undefined' && window.location.port ? window.location.port : '3000'}/api/files-ws/${file_id}/collaborate/ws/${session_id}`;

    const ws = new WsManager({
      url: wsUrl,
      onMessage: (msg: unknown) => {
        if (!isMounted.current) return;
        const payload = msg as CollabWsPayload;

        switch (payload.type) {
          case 'snapshot':
            setError(null);
            setState({
              session_id: payload.session_id,
              file_id: payload.file_id,
              mode: payload.mode,
              revision: payload.revision,
              text_content: payload.text_content,
              sheet_cells: payload.sheet_cells,
              yjs_updates: payload.yjs_updates ?? [],
              participants: payload.participants,
            });
            break;

          case 'editor_update':
            // Handle Y.js generic update payload without touching local component state
            if (payload.operation.type === 'yjs_update') {
              if (onYjsUpdate) onYjsUpdate(payload.operation.updateBase64);
              // Update participants / revision without changing content
              setState((prev) => {
                if (!prev || prev.session_id !== payload.session_id) return prev;
                return { ...prev, revision: payload.revision, participants: payload.participants };
              });
              break;
            }

            // Merge legacy operations into the state
            setState((prev) => {
              if (!prev || prev.session_id !== payload.session_id) return prev;

              const newState = { ...prev, revision: payload.revision, participants: payload.participants };

              if (payload.operation.type === 'replace_text' && newState.mode === 'word') {
                newState.text_content = payload.operation.content;
              } else if (payload.operation.type === 'replace_sheet' && newState.mode === 'excel') {
                newState.sheet_cells = payload.operation.cells;
              } else if (payload.operation.type === 'cell_update' && newState.mode === 'excel') {
                newState.sheet_cells = {
                  ...newState.sheet_cells,
                  [payload.operation.cell]: payload.operation.value,
                };
              }

              return newState;
            });
            break;

          case 'presence_joined':
          case 'presence_left':
            setState((prev) => {
              if (!prev || prev.session_id !== payload.session_id) return prev;
              return { ...prev, participants: payload.participants };
            });
            break;

          case 'error':
            setError(`Backend error: ${payload.detail}`);
            break;
        }
      },
      onError: () => {
        if (!isMounted.current) return;
        setError('WebSocket error occurred. Is the files service down?');
      },
      onClose: () => {
        console.log('[useCollaboration] WebSocket closed');
      }
    });

    // Small delay before connecting to prevent StrictMode racing
    const connectTimer = setTimeout(() => {
      ws.connect();
      wsManagerRef.current = ws;
    }, 100);

    return () => {
      isMounted.current = false;
      clearTimeout(connectTimer);
      ws.disconnect();
      wsManagerRef.current = null;
    };
  }, [sessionInfo, onYjsUpdate]);

  const updateText = useCallback((content: string) => {
    if (!wsManagerRef.current || !wsManagerRef.current.connected) return;
    wsManagerRef.current.send({
      operation: {
        type: 'replace_text',
        content,
      }
    });
  }, []);

  const updateCell = useCallback((cell: string, value: string) => {
    if (!wsManagerRef.current || !wsManagerRef.current.connected) return;
    wsManagerRef.current.send({
      operation: {
        type: 'cell_update',
        cell,
        value,
      }
    });
  }, []);

  const sendYjsUpdate = useCallback((updateBase64: string) => {
    if (!wsManagerRef.current || !wsManagerRef.current.connected) return;
    wsManagerRef.current.send({
      operation: {
        type: 'yjs_update',
        updateBase64,
      }
    });
  }, []);

  const sendSyncContent = useCallback((htmlContent: string) => {
    if (!wsManagerRef.current || !wsManagerRef.current.connected) return;
    const plainText = htmlToPlainText(htmlContent).trim();
    wsManagerRef.current.send({
      operation: {
        type: 'sync_content',
        content: htmlContent,
        plainText,
      }
    });
  }, []);

  return {
    state,
    error,
    updateText,
    updateCell,
    sendYjsUpdate,
    sendSyncContent,
  };
}
