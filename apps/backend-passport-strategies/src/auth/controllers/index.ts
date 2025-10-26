/**
 * Auth Controllers
 * 
 * Organizados por tipo de autenticación:
 * - LocalAuthController: Login con username/password (passport-local)
 * - OidcAuthController: OAuth 2.0 + OpenID Connect (Azure, Google, etc.)
 * - JwtAuthController: Validación y renovación de JWT (passport-jwt)
 * - CommonAuthController: Endpoints comunes (me, logout, client credentials)
 */

export { LocalAuthController } from './local-auth.controller';
export { OidcAuthController } from './oidc-auth.controller';
export { JwtAuthController } from './jwt-auth.controller';
export { CommonAuthController } from './common-auth.controller';
