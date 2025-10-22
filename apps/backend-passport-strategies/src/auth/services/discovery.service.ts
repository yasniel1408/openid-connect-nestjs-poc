import { Inject, Injectable } from '@nestjs/common';
import { Issuer } from 'openid-client';
import { AuthConfigService } from './auth-config.service.js';

@Injectable()
export class DiscoveryService {
  private readonly issuers = new Map<string, Promise<Issuer<any>>>();

  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {}

  private getProviders(): string[] {
    return this.authConfig.getProviders();
  }

  private getSetting(provider: string, key: string): string | undefined {
    return this.authConfig.getProviderSetting(provider, key);
  }

  async getIssuer(provider: string): Promise<Issuer> {
    if (!this.issuers.has(provider)) {
      this.issuers.set(
        provider,
        (async () => {
          const issuerUrl = this.getSetting(provider, 'OIDC_ISSUER') ?? this.getSetting(provider, 'OIDC_ISSUER_URL');
          if (!issuerUrl) {
            throw new Error(`Missing OIDC_ISSUER for provider ${provider}`);
          }
          return Issuer.discover(issuerUrl);
        })(),
      );
    }
    return this.issuers.get(provider)!;
  }

  providerFromIssuer(iss: string): string | undefined {
    const providers = this.getProviders();
    for (const provider of providers) {
      const issuerUrl = this.getSetting(provider, 'OIDC_ISSUER') ?? this.getSetting(provider, 'OIDC_ISSUER_URL');
      if (!issuerUrl) continue;
      const base = issuerUrl.replace('/.well-known/openid-configuration', '');
      if (iss.startsWith(base)) return provider;
      const match = issuerUrl.match(/[0-9a-fA-F-]{36}/);
      const tenant = match ? match[0] : undefined;
      if (tenant && (iss.startsWith(`https://sts.windows.net/${tenant}/`) || iss.startsWith(`https://login.microsoftonline.com/${tenant}/`))) {
        return provider;
      }
    }
    return undefined;
  }
}
