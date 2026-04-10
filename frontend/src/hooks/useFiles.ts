/* ------------------------------------------------------------------
 *  useFiles hook
 *  Fetches files, storage info, and vault info from the real API.
 * ------------------------------------------------------------------ */

import { useState, useEffect } from 'react';
import { getFiles, getStorageInfo, getVaultInfo } from '../api/files';
import type { SecureFile, StorageInfo, VaultInfo } from '../types/files.types';

export function useFiles(bucketFilter: string) {
  const [files, setFiles] = useState<SecureFile[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFiles(), getStorageInfo(), getVaultInfo()])
      .then(([f, s, v]) => {
        setFiles(f);
        setStorage(s);
        setVaultInfo(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    bucketFilter === 'ALL' || bucketFilter === 'All Buckets'
      ? files
      : files.filter((f) => f.bucket === bucketFilter);

  const addFile = (newFile: SecureFile) => {
    setFiles((prev) => [newFile, ...prev]);
  };

  return { files: filtered, storage, vaultInfo, loading, addFile };
}
