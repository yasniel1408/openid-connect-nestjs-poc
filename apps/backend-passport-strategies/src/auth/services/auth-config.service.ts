import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthConfigService {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  getCorsOrigin(): string {
    return this.config.getOrThrow<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  }

  getPort(): number {
    const raw = this.config.getOrThrow<string | number>('PORT');
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? Number(parsed) : 3001;
  }

  getProviders(): string[] {
    const raw = this.config.getOrThrow<string>('OIDC_PROVIDERS') ?? 'azure';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  getProviderSetting(provider: string, base: string): string {
    const specific = this.config.getOrThrow<string>(`${base}_${provider}`);
    if (specific) return specific;
    return this.config.getOrThrow<string>(base);
  }

  getIssuer(provider: string): string {
    const candidate = this.getProviderSetting(provider, 'OIDC_ISSUER');
    if (!candidate) {
      throw new Error(`Missing OIDC_ISSUER(_URL) for provider ${provider}`);
    }
    return candidate;
  }

  getRedirectUri(provider: string): string {
    return (
      this.getProviderSetting(provider, 'OIDC_REDIRECT_URI') ??
      `http://localhost:${this.getPort()}/auth/${provider}/callback`
    );
  }

  getScope(provider: string): string {
    return this.getProviderSetting(provider, 'OIDC_SCOPE') ?? 'openid profile email';
  }

  getPostLogoutRedirect(): string {
    return this.config.getOrThrow<string>('POST_LOGOUT_REDIRECT_URI') ?? this.getCorsOrigin();
  }

  getBoolean(key: string, fallback: boolean): boolean {
    const value = this.config.get<string | boolean>(key);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return fallback;
  }

  getAzureCredentials() {
    return {
      issuer: this.getProviderSetting('azure', 'OIDC_ISSUER'),
      clientId: this.getProviderSetting('azure', 'OIDC_CLIENT_ID'),
      clientSecret: this.getProviderSetting('azure', 'OIDC_CLIENT_SECRET'),
    };
  }
}
