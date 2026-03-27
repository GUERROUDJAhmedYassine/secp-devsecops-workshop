import { MOCK_USER, MOCK_STATS } from '../mocks/dashboard.mock';

export async function getUser() {
  // TODO: return axios.get('/auth/me').then(r => r.data)
  return MOCK_USER;
}

export async function getStats() {
  // TODO: return axios.get('/dashboard/stats').then(r => r.data)
  return MOCK_STATS;
}
