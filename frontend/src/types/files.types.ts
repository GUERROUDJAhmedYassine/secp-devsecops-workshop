/* ------------------------------------------------------------------
 *  Files types
 *  Aligned with the backend FileRecord / UploadResponse models.
 * ------------------------------------------------------------------ */

/** File category — derived on the frontend from mime_type. */
export type FileCategory = 'pdf' | 'archive' | 'spreadsheet' | 'key' | 'image' | 'document' | 'other';

/**
 * Matches the backend `FileRecord` shape returned by `GET /files`.
 * The backend wraps these in `{ items: FileRecord[] }`.
 */
export interface SecureFile {
  id: string;
  owner_id: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  storage_path: string;
  bucket: string;
  is_deleted: boolean;
  uploaded_at: string;
}

/** Response from `POST /files/upload`. */
export interface UploadResponse {
  id: string;
  filename: string;
  bucket: string;
  uploaded_at: string;
}

export type FilePreviewKind = 'image' | 'pdf' | 'text' | 'html' | 'unsupported';

export interface FilePreviewResponse {
  kind: 'text' | 'html';
  filename: string;
  mime_type: string | null;
  content: string;
}

export interface FileVersionRecord {
  id: string;
  file_id: string;
  filename: string;
  file_size: number;
  created_at: string;
}

/** Frontend-computed storage info (derived from the file list). */
export interface StorageInfo {
  used_gb: number;
  total_gb: number;
}

/** Frontend-static vault info (backend has no vault endpoint). */
export interface VaultInfo {
  bucket_health: { status: string; availability: string };
  encryption: string;
  hsm_enabled: boolean;
  recent_activity: { user: string; action: string; time_utc: string };
}

/* ------------------------------------------------------------------
 *  Collaboration Types
 * ------------------------------------------------------------------ */

export type CollabMode = 'word' | 'excel';

export interface CollaborationSessionResponse {
  session_id: string;
  file_id: string;
  mode: CollabMode;
  status: 'solo' | 'collaborative';
  participants: string[];
  opened_at: string;
  websocket_path: string;
  revision: number;
  message: string;
}

export interface CollaborationStateResponse {
  session_id: string;
  file_id: string;
  mode: CollabMode;
  revision: number;
  text_content: string;
  sheet_cells: Record<string, string>;
  yjs_updates?: string[];
  participants: string[];
}

/** Inbound WebSocket Payloads */
export type CollabWsPayload =
  | {
      type: 'snapshot';
      session_id: string;
      file_id: string;
      mode: CollabMode;
      revision: number;
      text_content: string;
      sheet_cells: Record<string, string>;
      yjs_updates?: string[];
      participants: string[];
    }
  | {
      type: 'editor_update';
      session_id: string;
      file_id: string;
      mode: CollabMode;
      revision: number;
      author_user_id: string;
      operation: Record<string, any>;
      participants: string[];
    }
  | {
      type: 'presence_joined' | 'presence_left';
      session_id: string;
      file_id: string;
      user_id: string;
      participants: string[];
    }
  | {
      type: 'error';
      detail: string;
    };

/* ---- Helpers ---- */

/** Derive a visual file category from the mime_type and filename. */
export function deriveCategory(mimeType: string | null, filename: string): FileCategory {
  const mt = (mimeType ?? '').toLowerCase();
  const fn = filename.toLowerCase();

  if (mt.includes('pdf') || fn.endsWith('.pdf')) return 'pdf';
  if (mt.includes('image') || /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/.test(fn)) return 'image';
  if (mt.includes('spreadsheet') || mt.includes('csv') || /\.(xlsx?|csv|ods)$/.test(fn)) return 'spreadsheet';
  if (/\.(key|pem|crt|cer|p12|pfx)$/.test(fn)) return 'key';
  if (/\.(zip|tar|gz|rar|7z|bz2)$/.test(fn) || mt.includes('zip') || mt.includes('archive') || mt.includes('compressed')) return 'archive';
  if (mt.includes('word') || mt.includes('document') || /\.(docx?|odt|rtf|txt|md)$/.test(fn)) return 'document';

  return 'other';
}

export function supportsCollaboration(mimeType: string | null, filename: string): boolean {
  const mt = (mimeType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const fn = filename.toLowerCase();

  return (
    /\.(txt|md|html?|docx)$/.test(fn) ||
    fn.endsWith('.csv') ||
    mt === 'text/plain' ||
    mt === 'text/markdown' ||
    mt === 'text/html' ||
    mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mt === 'text/csv' ||
    mt === 'application/csv'
  );
}

export function getPreviewKind(mimeType: string | null, filename: string): FilePreviewKind {
  const mt = (mimeType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const fn = filename.toLowerCase();

  if (mt.includes('pdf') || fn.endsWith('.pdf')) return 'pdf';
  if (mt.includes('image') || /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/.test(fn)) return 'image';
  if (fn.endsWith('.docx') || mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'html';
  if (/\.(txt|md|csv)$/.test(fn) || mt === 'text/plain' || mt === 'text/markdown' || mt === 'text/csv' || mt === 'application/csv') return 'text';
  if (/\.(html?)$/.test(fn) || mt === 'text/html') return 'html';
  return 'unsupported';
}

export function supportsPreview(mimeType: string | null, filename: string): boolean {
  return getPreviewKind(mimeType, filename) !== 'unsupported';
}

/** Format raw byte count into a human-readable label. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
