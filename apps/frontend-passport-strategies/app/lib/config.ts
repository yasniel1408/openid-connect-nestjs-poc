export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
}

export type UserInfo = {
  id?: string;
  identityProvider?: string;
  name?: string;
  email?: string;
  roles?: string[];
  type?: number;
};

export function decodeUserInfo(value?: string | null): UserInfo | undefined {
  if (!value) return undefined;
  try {
    const data = JSON.parse(value);
    return typeof data === 'object' && data ? data : undefined;
  } catch {
    return undefined;
  }
}
