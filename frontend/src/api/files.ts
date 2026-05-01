/* ------------------------------------------------------------------
 *  Files API
 *  File listing, upload, download, delete via the files service.
 * ------------------------------------------------------------------ */

import { FILES_BASE } from '../lib/constants';
import { apiGet, apiGetBlob, apiPost, apiDelete } from '../lib/apiClient';
import type { SecureFile, UploadResponse, CollaborationSessionResponse, CollaborationStateResponse, FilePreviewResponse, FileVersionRecord } from '../types/files.types';

/** Backend wraps the list in `{ items: [...] }`. */
interface FileListResponse {
  items: SecureFile[];
}

interface FileVersionListResponse {
  items: FileVersionRecord[];
}

export async function getFiles(bucket?: string): Promise<SecureFile[]> {
  const url = bucket
    ? `${FILES_BASE}/files?bucket=${encodeURIComponent(bucket)}`
    : `${FILES_BASE}/files`;
  const res = await apiGet<FileListResponse>(url);
  return res.items;
}

function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try { return decodeURIComponent(utfMatch[1]); } catch { return utfMatch[1]; }
  }
  const plainMatch = header.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? null;
}

export async function downloadFile(fileId: string, fallbackName = 'download'): Promise<void> {
  const response = await apiGetBlob(`${FILES_BASE}/files/${fileId}`);
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName =
    fileNameFromDisposition(response.headers.get('Content-Disposition')) ?? fallbackName;

  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export async function listFileVersions(fileId: string): Promise<FileVersionRecord[]> {
  const res = await apiGet<FileVersionListResponse>(`${FILES_BASE}/files/${fileId}/versions`);
  return res.items;
}

export async function downloadFileVersion(fileId: string, versionId: string, fallbackName = 'download'): Promise<void> {
  const response = await apiGetBlob(`${FILES_BASE}/files/${fileId}/versions/${versionId}`);
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const fileName =
    fileNameFromDisposition(response.headers.get('Content-Disposition')) ?? fallbackName;

  link.href = downloadUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export async function uploadFile(file: File, bucket = 'personal'): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiPost<UploadResponse>(
    `${FILES_BASE}/files/upload?bucket=${encodeURIComponent(bucket)}`,
    formData,
  );
}

export async function deleteFile(fileId: string): Promise<{ ok: boolean; id: string }> {
  return apiDelete<{ ok: boolean; id: string }>(`${FILES_BASE}/files/${fileId}`);
}

export async function getFileBlob(fileId: string): Promise<Blob> {
  const response = await apiGetBlob(`${FILES_BASE}/files/${fileId}`);
  return response.blob();
}

export async function getFilePreview(fileId: string): Promise<FilePreviewResponse> {
  return apiGet<FilePreviewResponse>(`${FILES_BASE}/files/${fileId}/preview`);
}

/* ------------------------------------------------------------------
 *  Collaboration API
 * ------------------------------------------------------------------ */

export async function startCollaboration(fileId: string): Promise<CollaborationSessionResponse> {
  return apiPost<CollaborationSessionResponse>(`${FILES_BASE}/files/${fileId}/collaborate`);
}

export async function getCollaborationState(fileId: string, sessionId: string): Promise<CollaborationStateResponse> {
  return apiGet<CollaborationStateResponse>(`${FILES_BASE}/files/${fileId}/collaborate/${sessionId}`);
}
