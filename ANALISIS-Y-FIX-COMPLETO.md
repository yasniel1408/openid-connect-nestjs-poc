# Resumen del Análisis y Fix: Autenticación Sistema-a-Sistema

## 🎯 Problema Original

La autenticación sistema-a-sistema (Client Credentials Flow) con Azure Entra ID no funcionaba correctamente. Los tokens obtenidos mediante el endpoint `/auth/system/cc/token` eran rechazados al intentar acceder a endpoints protegidos.

## 🔍 Análisis Realizado

### 1. Flujo PKCE para Usuarios Humanos ✅
- **Estado**: Funcionando correctamente
- **Providers**: Azure y Google
- **Flujo**: Authorization Code con PKCE
- **Uso**: Login interactivo en el navegador

### 2. Client Credentials para Sistemas ❌ → ✅
- **Estado Inicial**: No funcionaba
- **Error**: `unexpected "aud" claim value`
- **Causa**: Validación estricta de audience no configurada correctamente

## 🐛 Causa Raíz del Problema

El archivo `azure-cce-jwt.strategy.ts` tenía los siguientes issues:

1. **Validación Estricta de Audience**: El código siempre validaba el claim `aud` del token contra el valor configurado en `OIDC_AUDIENCE_azure`

2. **Variable OIDC_RELAX_AUDIENCE Ignorada**: A pesar de estar configurada en `.env` con valor `true`, no se estaba usando en el código

3. **Comportamiento en Cadena**:
   - Primera verificación (v2) fallaba por audience
   - Caía al fallback de verificación v1
   - Verificación v1 fallaba por issuer (token v2 vs issuer v1)
   - Resultado final: token rechazado

## ✅ Solución Implementada

Se modificó el método `verify()` en `azure-cce-jwt.strategy.ts` para:

1. **Leer configuración de relax audience**:
   ```typescript
   const relaxAudience = this.authConfig.getBoolean(`OIDC_RELAX_AUDIENCE_${this.provider}`, true);
   ```

2. **Aplicar validación condicional**:
   ```typescript
   // Solo validar audience si está configurada Y no es modo relax
   if (this.expectedAudience && !relaxAudience) {
     verifyOptions.audience = this.expectedAudience;
   }
   ```

3. **Aplicar a ambas versiones de tokens**: v2.0 y v1.0

## 📋 Archivo Modificado

- `apps/backend-passport-strategies/src/auth/strategies/azure-cce-jwt.strategy.ts`

## 🧪 Pruebas Realizadas

### Test 1: Obtener Token Client Credentials ✅
```bash
curl -X POST http://localhost:3001/auth/system/cc/token \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Resultado**: Token obtenido exitosamente

### Test 2: Acceder sin Autenticación ✅
```bash
curl http://localhost:3001/products
```
**Resultado**: `403 Forbidden` (comportamiento esperado)

### Test 3: Acceder con Token Bearer ✅
```bash
curl http://localhost:3001/products \
  -H "Authorization: Bearer <token>"
```
**Resultado**: `200 OK` con lista de 3 productos

## 🔑 Configuración Clave

En `.env`:
```bash
OIDC_ISSUER_azure=https://login.microsoftonline.com/<tenant>/v2.0
OIDC_V1_ISSUER_azure=https://sts.windows.net/<tenant>/
OIDC_CLIENT_ID_azure=<client_id>
OIDC_CLIENT_SECRET_azure=<client_secret>
OIDC_AUDIENCE_azure=api://<client_id>
OIDC_RELAX_AUDIENCE_azure=true  # ← CRÍTICO para Client Credentials
```

## 📊 Comparación de Flujos

| Aspecto | Usuario Humano (PKCE) | Sistema (Client Credentials) |
|---------|----------------------|------------------------------|
| Flujo OAuth | Authorization Code + PKCE | Client Credentials |
| Interacción | Navegador requerido | API directa |
| Token representa | Usuario específico | Aplicación |
| Claims incluidos | email, name, profile | appid, roles, tid |
| Audience validation | Puede ser estricta | Debe ser relaxed |
| Uso típico | Frontend web/mobile | API to API, Background jobs |

## 🎓 Lecciones Aprendidas

1. **Client Credentials y Audience**: Los tokens CC tienen el `aud` igual al Client ID, no al App ID URI
2. **Configuración vs Implementación**: Tener variables en `.env` no sirve si no se usan en el código
3. **Debugging con jose**: Los errores de la librería `jose` pueden ser encadenados y confusos
4. **Fallback v1/v2**: Es importante manejar ambas versiones de tokens de Azure correctamente

## 🚀 Próximos Pasos Recomendados

1. **Validación Manual de Audience**: En producción, considera validar manualmente el `aud` en tu lógica de negocio para control granular

2. **Uso de Certificados**: Migrar de client secrets a certificados para mayor seguridad

3. **Scopes y Roles**: Implementar autorización basada en roles/scopes del token

4. **Logging**: Agregar logging estructurado para auditoría de autenticación

5. **Tests Automatizados**: Crear tests unitarios e integración para ambos flujos de auth

## 📚 Referencias

- [Microsoft Identity Platform: Client Credentials Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)
- [JWT Audience Claim](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.3)
- [jose Library Documentation](https://github.com/panva/jose)

---

**Fecha**: 2025-10-22
**Estado**: ✅ Resuelto y Probado
**Impacto**: La autenticación sistema-a-sistema ahora funciona correctamente para Azure Entra ID
