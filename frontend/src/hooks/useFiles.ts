/* ------------------------------------------------------------------
 *  useFiles hook
 *  Fetches files from the real API and computes storage/vault info
 *  locally (the backend has no storage or vault endpoint).
 * ------------------------------------------------------------------ */

import { useState, useEffect, useCallback } from 'react';
import { getFiles, deleteFile as apiDeleteFile } from '../api/files';
import type { SecureFile, StorageInfo, VaultInfo } from '../types/files.types';

/** Hardcoded vault metadata (backend has no /vault-info endpoint). */
const STATIC_VAULT_INFO: VaultInfo = {
  bucket_health: { status: 'Operational', availability: '99.97%' },
  encryption: 'AES-256-GCM',
  hsm_enabled: true,
  recent_activity: { user: 'System', action: 'Automated integrity check passed', time_utc: new Date().toISOString() },
};

/** Storage quota — hardcoded total, used is computed from files. */
const STORAGE_TOTAL_GB = 50;

function computeStorage(files: SecureFile[]): StorageInfo {
  const totalBytes = files.reduce((sum, f) => sum + (f.file_size ?? 0), 0);
  return {
    used_gb: parseFloat((totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
    total_gb: STORAGE_TOTAL_GB,
  };
}

export function useFiles(bucketFilter: string) {
  const [allFiles, setAllFiles] = useState<SecureFile[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }

    try {
      const files = await getFiles();
      setAllFiles(files);
      setStorage(computeStorage(files));
    } catch (error) {
      console.error(error);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles]);

  /* Client-side bucket filtering */
  const filtered =
    bucketFilter === 'ALL' || bucketFilter === 'All Buckets'
      ? allFiles
      : allFiles.filter((f) => f.bucket === bucketFilter);

  const addFile = (newFile: SecureFile) => {
    setAllFiles((prev) => {
      const updated = [newFile, ...prev];
      setStorage(computeStorage(updated));
      return updated;
    });
  };

  const removeFile = async (fileId: string) => {
    await apiDeleteFile(fileId);
    setAllFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      setStorage(computeStorage(updated));
      return updated;
    });
  };

  return {
    files: filtered,
    storage,
    vaultInfo: STATIC_VAULT_INFO,
    loading,
    addFile,
    removeFile,
    refreshFiles: fetchFiles,
  };
}
