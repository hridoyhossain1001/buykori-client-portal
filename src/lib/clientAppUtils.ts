import type { Suggestion } from '../types';

const suggestionDedupeKey = (item: Suggestion) => [
  item.platform || 'global',
  item.title,
  item.explanation,
  item.fixAction,
].map(value => String(value || '').trim().toLowerCase()).join('|');

export const uniqueSuggestions = (items: Suggestion[] = []) => {
  const byContent = new Map<string, Suggestion>();
  items.forEach((item) => {
    const key = suggestionDedupeKey(item) || item.id;
    const existing = byContent.get(key);
    if (!existing) {
      byContent.set(key, item);
      return;
    }

    byContent.set(key, {
      ...existing,
      ...item,
      id: existing.id,
      resolved: existing.resolved && item.resolved,
    });
  });
  return Array.from(byContent.values());
};

export const normalizePluginVersion = (version?: string) => (version || '').replace(/^v/i, '').trim();

export const comparePluginVersions = (left: string, right: string) => {
  const leftParts = left.split('.').map(part => Number.parseInt(part, 10) || 0);
  const rightParts = right.split('.').map(part => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const readCookie = (name: string) => {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length) || '';
};

export const jsonHeadersWithClientCsrf = () => {
  const csrf = readCookie('buykori_client_csrf');
  return {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-Client-CSRF-Token': csrf } : {}),
  };
};
