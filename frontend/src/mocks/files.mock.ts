export const MOCK_FILES = [
  {
    id: 'f1',
    filename: 'incident_report_0923.pdf',
    mime_type: 'application/pdf',
    category: 'pdf',
    bucket: 'CRITICAL_OPS',
    size_bytes: 1258291,
    size_label: '1.2 MB',
    modified_at: '2023-10-24 14:32:01',
    owner_id: 'ahmed.benali',
  },
  {
    id: 'f2',
    filename: 'network_logs_backup_q3.tar.gz',
    mime_type: 'application/gzip',
    category: 'archive',
    bucket: 'LOGS_ARCHIVE',
    size_bytes: 446693376,
    size_label: '425.8 MB',
    modified_at: '2023-10-22 09:15:44',
    owner_id: 'ahmed.benali',
  },
  {
    id: 'f3',
    filename: 'employee_access_matrix.xlsx',
    mime_type: 'application/spreadsheet',
    category: 'spreadsheet',
    bucket: 'USER_DATA',
    size_bytes: 86016,
    size_label: '84 KB',
    modified_at: '2023-10-21 17:00:12',
    owner_id: 'ahmed.benali',
  },
  {
    id: 'f4',
    filename: 'rsa_public_key_server_v4.pem',
    mime_type: 'text/plain',
    category: 'key',
    bucket: 'CRITICAL_OPS',
    size_bytes: 3482,
    size_label: '3.4 KB',
    modified_at: '2023-10-18 11:22:56',
    owner_id: 'ahmed.benali',
  },
  {
    id: 'f5',
    filename: 'security_perimeter_blueprint.png',
    mime_type: 'image/png',
    category: 'image',
    bucket: 'USER_DATA',
    size_bytes: 13107200,
    size_label: '12.5 MB',
    modified_at: '2023-10-15 08:44:21',
    owner_id: 'ahmed.benali',
  },
];

export const MOCK_STORAGE = {
  used_gb: 42.8,
  total_gb: 100,
};

export const MOCK_VAULT_INFO = {
  bucket_health: {
    status: 'All Systems Operational',
    availability: '99.9%',
  },
  encryption: 'AES-256 GCM',
  hsm_enabled: true,
  recent_activity: {
    user: 'Ahmed Benali',
    action: 'accessed CRITICAL_OPS',
    time_utc: '09:12:44 UTC',
  },
};
