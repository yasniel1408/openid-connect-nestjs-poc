export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
}

type Base64Decoder = (value: string) => string;

function decodeBase64(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = normalized + '='.repeat(padding);

  const decode: Base64Decoder = typeof window === 'undefined'
    ? (v) => Buffer.from(v, 'base64').toString('utf8')
    : (v) => {
        const binary = atob(v);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new TextDecoder().decode(bytes);
      };

  return decode(padded);
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
    const json = decodeBase64(value);
    const data = JSON.parse(json);
    return typeof data === 'object' && data ? data : undefined;
  } catch {
    return undefined;
  }
}
