export type BucketType = 'CRITICAL_OPS' | 'LOGS_ARCHIVE' | 'USER_DATA';
export type FileCategory = 'pdf' | 'archive' | 'spreadsheet' | 'key' | 'image';

export interface SecureFile {
  id: string;
  filename: string;
  mime_type: string;
  category: FileCategory;
  bucket: BucketType;
  size_bytes: number;
  size_label: string;
  modified_at: string;
  owner_id: string;
}

export interface StorageInfo {
  used_gb: number;
  total_gb: number;
}

export interface VaultInfo {
  bucket_health: { status: string; availability: string };
  encryption: string;
  hsm_enabled: boolean;
  recent_activity: { user: string; action: string; time_utc: string };
}
