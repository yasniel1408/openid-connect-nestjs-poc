# Fix: Autenticación Sistema-a-Sistema (Client Credentials Flow)

## Problema Identificado

La autenticación sistema-a-sistema con Azure Entra ID (Client Credentials Flow) fallaba con el error:
```
unexpected "aud" claim value
```

### Causa Raíz

La estrategia `AzureCceJwtStrategy` estaba validando estrictamente el claim `audience` en los tokens JWT, pero:

1. Los tokens obtenidos mediante Client Credentials Flow tienen el `aud` igual al Client ID de la aplicación
2. La configuración tenía `OIDC_RELAX_AUDIENCE_azure=true` pero esta variable NO estaba siendo utilizada en el código
3. La validación estricta de `audience` causaba que el primer intento de verificación (v2) fallara
4. Luego intentaba con el issuer v1 (`https://sts.windows.net/...`) pero el token tenía issuer v2 (`https://login.microsoftonline.com/.../v2.0`), causando el segundo error

## Solución Implementada

Se modificó el método `verify()` en `azure-cce-jwt.strategy.ts` para:

1. **Leer la configuración `OIDC_RELAX_AUDIENCE_<provider>`**: Ahora el código verifica si el modo "relax" está activado
2. **Aplicar validación condicional de audience**: Solo valida el `audience` si:
   - Está configurado un `expectedAudience` Y
   - El modo `relaxAudience` es `false`
3. **Aplicar la misma lógica a ambas versiones**: Tanto para tokens v2.0 como v1.0

### Código Modificado

```typescript
private async verify(token: string) {
  const tolerance = Number(this.authConfig.getProviderSetting(this.provider, 'OIDC_CLOCK_TOLERANCE')) || 60;
  const relaxAudience = this.authConfig.getBoolean(`OIDC_RELAX_AUDIENCE_${this.provider}`, true);

  // Intentar primero con issuer/JWKS v2 (tokens ver = 2.0)
  try {
    const verifyOptions: any = {
      algorithms: ['RS256'],
      issuer: this.issuerV2,
      clockTolerance: tolerance,
    };
    
    // Solo validar audience si está configurada Y no es modo relax
    if (this.expectedAudience && !relaxAudience) {
      verifyOptions.audience = this.expectedAudience;
    }

    const result = await jose.jwtVerify(token, this.getJwksV2(), verifyOptions);
    return { ...result, version: '2.0' as const };
  } catch (err) {
    // continuar con v1
  }

  // Tokens emitidos desde /sts.windows.net/<tenant>/ (ver 1.0)
  if (!this.issuerV1) {
    throw new UnauthorizedException('TOKEN_INVALID');
  }

  const verifyOptionsV1: any = {
    algorithms: ['RS256'],
    issuer: this.issuerV1,
    clockTolerance: tolerance,
  };
  
  // Solo validar audience si está configurada Y no es modo relax
  if (this.expectedAudience && !relaxAudience) {
    verifyOptionsV1.audience = this.expectedAudience;
  }

  const resultV1 = await jose.jwtVerify(token, this.getJwksV1(), verifyOptionsV1);
  return { ...resultV1, version: '1.0' as const };
}
```

## Configuración Recomendada

Para que la autenticación sistema-a-sistema funcione correctamente, asegúrate de tener en tu `.env`:

```bash
# Azure (Entra ID)
OIDC_ISSUER_azure=https://login.microsoftonline.com/<tenant_id>/v2.0
OIDC_V1_ISSUER_azure=https://sts.windows.net/<tenant_id>/
OIDC_CLIENT_ID_azure=<client_id>
OIDC_CLIENT_SECRET_azure=<client_secret>
OIDC_AUDIENCE_azure=api://<client_id>
OIDC_RELAX_AUDIENCE_azure=true  # ← Crucial para Client Credentials
```

## Flujo de Autenticación Sistema-a-Sistema

### 1. Obtener Token
```bash
curl -X POST http://localhost:3001/auth/system/cc/token \
  -H "Content-Type: application/json" \
  -d '{}'
```

Respuesta:
```json
{
  "access_token": "eyJ0eXAiOiJKV1Q...",
  "token_type": "Bearer",
  "expires_in": 3599,
  "scope": "api://68c962bd-3508-4622-8057-5ca330b623ca/.default"
}
```

### 2. Usar Token en Endpoints Protegidos
```bash
curl http://localhost:3001/products \
  -H "Authorization: Bearer <access_token>"
```

## Diferencias: Usuario Humano vs Sistema

### Usuario Humano (PKCE)
- Usa flujo Authorization Code con PKCE
- Requiere interacción del navegador
- Token incluye claims del usuario (email, name, etc.)
- Audience puede ser más específico

### Sistema (Client Credentials)
- Flujo directo de credenciales de cliente
- No requiere interacción humana
- Token representa la aplicación, no un usuario
- Audience típicamente es el App ID URI
- **Requiere `OIDC_RELAX_AUDIENCE=true`** en desarrollo/testing

## Verificación

Para verificar que funciona:

```bash
# 1. Obtener token
TOKEN=$(curl -s -X POST http://localhost:3001/auth/system/cc/token \
  -H "Content-Type: application/json" -d '{}' | jq -r '.access_token')

# 2. Usar token
curl http://localhost:3001/products -H "Authorization: Bearer $TOKEN"

# Debe retornar:
# [{"id":"p1","name":"Cafetera Pro","price":129.99,"currency":"USD"},...]
```

## Notas de Seguridad

- En **producción**, considera cambiar `OIDC_RELAX_AUDIENCE_azure=false` y configurar audiences específicos
- Valida manualmente el claim `aud` en el código de negocio si necesitas control granular
- Los tokens Client Credentials tienen el claim `azpacr: "1"` que indica autenticación por secret
- Considera usar certificados en lugar de secrets para mayor seguridad en producción

## Archivos Modificados

- `apps/backend-passport-strategies/src/auth/strategies/azure-cce-jwt.strategy.ts`
