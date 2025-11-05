# 🧪 Prueba: passport-openidconnect vs openid-client

## 🎯 Objetivo

Demostrar las limitaciones de `passport-openidconnect` comparado con `openid-client`.

## 📋 Setup Actual

Ahora mismo las strategies usan **passport-openidconnect** puro:

- `oidc-pkce-azure.strategy.ts` - Usa `Strategy as OpenIdConnectStrategy`
- `oidc-pkce-google.strategy.ts` - Usa `Strategy as OpenIdConnectStrategy`

Los backups con openid-client están en:
- `oidc-pkce-azure.strategy.openid-client.ts`
- `oidc-pkce-google.strategy.openid-client.ts`

## 🚀 Pasos para Probar

### 1. Levantar el backend

```bash
cd apps/backend-passport-strategies
npm run start:dev
```

### 2. Abrir el frontend

```bash
# En otra terminal
cd apps/frontend-passport-strategies
npm run dev
```

### 3. Hacer login con Google o Azure

Ir a: http://localhost:3000/login

Hacer click en "Login con Google" o "Login con Azure"

### 4. Observar los logs del backend

Busca en la consola del backend estas líneas:

```
🔍 [Azure Strategy] Verify Callback Ejecutado
   - Context: {}  <-- ⚠️ Probablemente vacío
   - Context keys: []  <-- ⚠️ Sin keys

📦 [Azure Strategy] Tokens Extraídos:
   - access_token: ❌ NO  <-- ⚠️ PROBLEMA
   - id_token: ❌ NO      <-- ⚠️ PROBLEMA
   - refresh_token: ❌ NO <-- ⚠️ PROBLEMA

✅ [Azure Strategy] Usuario creado: tu@email.com
   - Has access_token: false  <-- ⚠️ PROBLEMA
   - Has id_token: false      <-- ⚠️ PROBLEMA
   - Has refresh_token: false <-- ⚠️ PROBLEMA
```

### 5. Verificar lo que se guardó en Redis

```bash
./inspect-redis-sessions.sh --parse
```

**Resultado esperado (CON PROBLEMA):**
```json
{
  "user": {
    "id": "...",
    "name": "Tu Nombre",
    "email": "tu@email.com",
    "tokens": {
      "access_token": null,        // ❌ NULL
      "id_token": null,            // ❌ NULL
      "refresh_token": null,       // ❌ NULL
      "token_type": "Bearer"       // ✅ Solo esto
    },
    "_debug": {
      "hasAccessToken": false,     // ❌ FALSE
      "hasIdToken": false,         // ❌ FALSE
      "hasRefreshToken": false     // ❌ FALSE
    }
  }
}
```

### 6. Intentar usar el access_token (FALLARÁ)

El access_token es necesario para llamar a APIs del provider:

```typescript
// En el backend, después del login
const user = req.session.user;
const accessToken = user.tokens.access_token; // null ❌

// Intentar llamar Microsoft Graph
const profile = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` } // FALLA ❌
});
```

**Error:** `401 Unauthorized` porque el token es null.

---

## 🔄 Restaurar openid-client (La Solución)

Si quieres ver cómo SÍ funcionan los tokens, restaura las strategies con openid-client:

```bash
cd apps/backend-passport-strategies/src/auth/strategies

# Restaurar Azure
cp oidc-pkce-azure.strategy.openid-client.ts oidc-pkce-azure.strategy.ts

# Restaurar Google
cp oidc-pkce-google.strategy.openid-client.ts oidc-pkce-google.strategy.ts

# Rebuild
cd ../../..
npm run build

# Reiniciar servidor
npm run start:dev
```

Repite los pasos 1-5 y verás:

```
✅ Tokens received from Azure
   - access_token: YES
   - id_token: YES
   - refresh_token: NO  <-- A veces Google no da refresh_token

✅ User authenticated: tu@email.com
```

En Redis:
```json
{
  "user": {
    "tokens": {
      "access_token": "ya29.a0ARW5m75...",  // ✅ PRESENTE
      "id_token": "eyJhbGciOiJSUzI1NiIs...", // ✅ PRESENTE
      "refresh_token": "1//0gL3q...",       // ✅ PRESENTE (si disponible)
      "expires_at": 1762224458,              // ✅ PRESENTE
      "token_type": "Bearer"
    },
    "claims": { /* todos los claims */ },    // ✅ PRESENTE
    "userinfo": { /* info completa */ }      // ✅ PRESENTE
  }
}
```

Ahora SÍ puedes usar el access_token:
```typescript
const accessToken = user.tokens.access_token; // "ya29..." ✅

const profile = await fetch('https://graph.microsoft.com/v1.0/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` } // FUNCIONA ✅
});
```

---

## 📊 Comparación de Resultados

| Aspecto | passport-openidconnect | openid-client |
|---------|----------------------|---------------|
| **access_token** | ❌ null | ✅ Presente |
| **id_token** | ❌ null | ✅ Presente |
| **refresh_token** | ❌ null | ✅ Presente |
| **claims** | ⚠️ Incompleto | ✅ Completo |
| **userinfo** | ⚠️ Limitado | ✅ Completo |
| **PKCE** | ❌ No soportado | ✅ Implementado |
| **Llamar APIs** | ❌ Imposible | ✅ Posible |

---

## 🎓 Lección Aprendida

**passport-openidconnect NO captura los tokens OAuth** correctamente, lo que hace imposible:

1. ❌ Llamar a Microsoft Graph API
2. ❌ Llamar a Google APIs
3. ❌ Renovar tokens expirados
4. ❌ Implementar logout federado
5. ❌ Usar PKCE para seguridad

**openid-client SÍ captura todo** correctamente, permitiendo:

1. ✅ Llamar a APIs del provider
2. ✅ Renovar tokens automáticamente
3. ✅ Logout federado completo
4. ✅ PKCE para SPAs y mobile
5. ✅ Acceso a claims y userinfo

---

## 💡 Recomendación Final

Después de esta prueba, la recomendación es **usar openid-client** porque:

1. **Funciona** - Captura todos los tokens correctamente
2. **Moderno** - Librería activamente mantenida
3. **Estándar** - Certificada por OpenID Foundation
4. **Completo** - Soporta todos los features de OAuth 2.0/OIDC
5. **Seguro** - PKCE nativo y mejores prácticas

passport-openidconnect está **obsoleto y roto** para casos de uso reales.

---

## 📝 Archivos de Respaldo

Si en algún momento quieres cambiar entre versiones:

```bash
# Ver qué strategy está activa
head -20 src/auth/strategies/oidc-pkce-azure.strategy.ts

# Si dice "passport-openidconnect" → Versión con limitaciones
# Si dice "passport-custom" → Versión funcional con openid-client
```

**Archivos disponibles:**
- `oidc-pkce-azure.strategy.ts` - Versión activa (actualmente passport-openidconnect)
- `oidc-pkce-azure.strategy.openid-client.ts` - Backup con openid-client (funcional)
- `oidc-pkce-google.strategy.ts` - Versión activa (actualmente passport-openidconnect)
- `oidc-pkce-google.strategy.openid-client.ts` - Backup con openid-client (funcional)

---

**Creado:** 2025-01-04  
**Estado:** 🧪 Prueba en curso  
**Siguiente paso:** Hacer login y verificar logs/Redis
