import { MOCK_EMAILS, MOCK_CHAT } from '../mocks/email.mock';

export async function getEmails() {
  // TODO: return axios.get('/mail/inbox').then(r => r.data)
  return MOCK_EMAILS;
}

export async function getChatMessages(_roomId: string) {
  // TODO: return axios.get(`/messages/rooms/${roomId}`).then(r => r.data)
  return MOCK_CHAT;
}

export async function sendEmail(data: any) {
  // TODO: return axios.post('/mail/send', data)
  console.log('Send email:', data);
}
