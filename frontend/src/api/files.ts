import { MOCK_FILES, MOCK_STORAGE, MOCK_VAULT_INFO } from '../mocks/files.mock';

export async function getFiles() {
  // TODO: return axios.get('/files').then(r => r.data)
  return MOCK_FILES;
}

export async function getStorageInfo() {
  // TODO: return axios.get('/files/storage').then(r => r.data)
  return MOCK_STORAGE;
}

export async function getVaultInfo() {
  // TODO: return axios.get('/files/vault-info').then(r => r.data)
  return MOCK_VAULT_INFO;
}

export async function downloadFile(fileId: string) {
  // TODO: window.open(`/files/${fileId}/download`)
  console.log('Download:', fileId);
}

export async function uploadFile(file: File) {
  // TODO: axios.post('/files/upload', formData)
  console.log('Upload:', file.name);
}
