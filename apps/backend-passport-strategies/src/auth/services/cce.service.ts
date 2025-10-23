import { Inject, Injectable } from '@nestjs/common';
import {ClientSecretCredential} from '@azure/identity';
import { AuthConfigService } from './auth-config.service.js';

type CceTokenResponse =
  | { access_token: string; token_type: string; expires_in: number; ext_expires_in?: number; scope?: string }
  | { error: string; error_description?: string };

type CceTokenOptions = {
  provider?: string;
  scope?: string;
  abortMs?: number;
};

function ensureDefaultScope(scopeOrAppIdUri: string): string {
  return scopeOrAppIdUri.endsWith('/.default') ? scopeOrAppIdUri : `${scopeOrAppIdUri}/.default`;
}

function tenantFromIssuer(issuer: string): string | undefined {
  const match = issuer.match(/[0-9a-fA-F-]{36}/);
  if (match) return match[0];
  try {
    const url = new URL(issuer);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length ? segments[0] : undefined;
  } catch {
    return undefined;
  }
}

@Injectable()
export class CceTokenService {
  private credentials = new Map<string, ClientSecretCredential>();

  constructor(@Inject(AuthConfigService) private readonly auth: AuthConfigService) {}

  private getCredential(provider: string, tenantId: string, clientId: string, clientSecret: string) {
    if (!this.credentials.has(provider)) {
      this.credentials.set(provider, new ClientSecretCredential(tenantId, clientId, clientSecret));
    }
    return this.credentials.get(provider)!;
  }

  async getClientCredentialsToken(options: CceTokenOptions = {}): Promise<CceTokenResponse> {
    const provider = options.provider ?? 'azure';
    const abortMs = options.abortMs ?? 5000;

    const issuer = this.auth.getIssuer(provider);
    const clientId = this.auth.getProviderSetting(provider, 'OIDC_CLIENT_ID');
    const clientSecret = this.auth.getProviderSetting(provider, 'OIDC_CLIENT_SECRET');
    const audience = this.auth.getProviderSetting(provider, 'OIDC_AUDIENCE');

    if (!issuer || !clientId || !clientSecret) {
      return { error: 'config_error', error_description: 'issuer/clientId/clientSecret faltan' };
    }

    const scopeCandidate = options.scope?.trim() || audience;
    if (!scopeCandidate) {
      return { error: 'config_error', error_description: 'scope/audience faltan' };
    }

    const tenantId = tenantFromIssuer(issuer);
    if (!tenantId) {
      return { error: 'config_error', error_description: 'No se pudo derivar tenantId desde issuer' };
    }

    const credential = this.getCredential(provider, tenantId, clientId, clientSecret);
    const scope = ensureDefaultScope(scopeCandidate);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), abortMs);
    timeout.unref?.();

    try {
      const token = await credential.getToken(scope, { abortSignal: controller.signal });
      if (!token) {
        return { error: 'no_access_token', error_description: 'Azure Identity no retornó token' };
      }
      const expiresIn = Math.max(0, Math.floor((token.expiresOnTimestamp - Date.now()) / 1000));
      return {
        access_token: token.token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        ext_expires_in: expiresIn,
        scope,
      };
    } catch (err: any) {
      const description = err?.message || 'token acquisition failed';
      return { error: 'token_request_failed', error_description: description };
    } finally {
      clearTimeout(timeout);
    }
  }
}
