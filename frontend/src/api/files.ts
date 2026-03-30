/* ------------------------------------------------------------------
 *  Files API
 *  File listing, storage info, vault info, upload, download via
 *  the files service.
 * ------------------------------------------------------------------ */

import { FILES_BASE } from '../lib/constants';
import { apiGet, apiPost } from '../lib/apiClient';
import type { SecureFile, StorageInfo, VaultInfo } from '../types/files.types';

export async function getFiles(): Promise<SecureFile[]> {
  return apiGet<SecureFile[]>(`${FILES_BASE}/files`);
}

export async function getStorageInfo(): Promise<StorageInfo> {
  return apiGet<StorageInfo>(`${FILES_BASE}/files/storage`);
}

export async function getVaultInfo(): Promise<VaultInfo> {
  return apiGet<VaultInfo>(`${FILES_BASE}/files/vault-info`);
}

export async function downloadFile(fileId: string): Promise<void> {
  /* Open in a new tab – the backend should return the file stream */
  window.open(`${FILES_BASE}/files/${fileId}/download`, '_blank');
}

export async function uploadFile(file: File): Promise<SecureFile> {
  const formData = new FormData();
  formData.append('file', file);

  return apiPost<SecureFile>(`${FILES_BASE}/files/upload`, formData);
}
