import { jsonHeadersWithClientCsrf } from '../lib/clientAppUtils';
import type { ClientConnection, UserProfile } from '../types';

export interface ProfileUpdateInput {
  name: string;
  email: string;
  notificationEmail: string;
  ownerNotifyWhatsapp: boolean;
  ownerWhatsappNumber: string;
  emailCode: string | null;
  currentPassword: string | null;
}

const readObject = async (response: Response): Promise<Record<string, unknown>> => {
  const payload: unknown = await response.json().catch(() => ({}));
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
};

const requireOk = async (response: Response, fallback: string) => {
  if (response.ok) return;
  const payload = await readObject(response);
  throw new Error(typeof payload.detail === 'string' ? payload.detail : fallback);
};

export async function requestProfileEmailCode(email: string) {
  const response = await fetch('/api/profile/email-code', {
    method: 'POST',
    headers: jsonHeadersWithClientCsrf(),
    body: JSON.stringify({ email }),
  });
  await requireOk(response, 'Could not send email verification code.');
}

export async function updateClientProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  const response = await fetch('/api/profile', {
    method: 'POST',
    headers: jsonHeadersWithClientCsrf(),
    body: JSON.stringify(input),
  });
  await requireOk(response, 'Profile save failed.');
  const payload = await readObject(response);
  if (!payload.profile || typeof payload.profile !== 'object') {
    throw new Error('Profile save returned an invalid response.');
  }
  return payload.profile as UserProfile;
}

export async function resetDemoProfile() {
  const response = await fetch('/api/profile/reset-demo', { method: 'POST' });
  await requireOk(response, 'Reset failed. Please try again.');
}

export async function revokeClientConnection(): Promise<ClientConnection> {
  const response = await fetch('/api/connection/revoke', {
    method: 'POST',
    headers: jsonHeadersWithClientCsrf(),
  });
  await requireOk(response, 'API key reset failed.');
  const payload = await readObject(response);
  if (!payload.connection || typeof payload.connection !== 'object') {
    throw new Error('API key reset returned an invalid response.');
  }
  return payload.connection as ClientConnection;
}

export async function requestAccountDeletion(): Promise<string> {
  const response = await fetch('/api/account/delete-request', {
    method: 'POST',
    headers: jsonHeadersWithClientCsrf(),
  });
  await requireOk(response, 'Could not submit deletion request.');
  const payload = await readObject(response);
  return typeof payload.message === 'string'
    ? payload.message
    : 'Deletion request received. Support will review it.';
}

export async function updateClientPassword(currentPassword: string, newPassword: string) {
  const response = await fetch('/api/account/password', {
    method: 'POST',
    headers: jsonHeadersWithClientCsrf(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await requireOk(response, 'Password update failed.');
}

export async function sendPasswordResetEmail(email: string) {
  const response = await fetch('/api/v1/auth/client/password/forgot', {
    method: 'POST',
    headers: jsonHeadersWithClientCsrf(),
    body: JSON.stringify({ email }),
  });
  await requireOk(response, 'Could not send reset email.');
}
