# Monorepo: Next.js (Frontend) + NestJS (Backend) con OIDC PKCE

Este monorepo contiene:
- apps/frontend: Next.js (App Router) con enlaces al backend.
- apps/backend: NestJS con módulo de auth (OIDC PKCE via `openid-client` + sesiones) y endpoint protegido `/products`.
- **apps/backend-passport-strategies**: ⭐ Backend principal con soporte completo para autenticación de usuarios humanos (PKCE) y sistemas (Client Credentials)

## 🚀 Inicio Rápido

### 1. Levantar Redis
```bash
docker-compose up -d
```

### 2. Configurar variables de entorno
Copia el archivo de ejemplo y ajusta los valores:
```bash
cp apps/backend-passport-strategies/.env.example apps/backend-passport-strategies/.env
```

Asegúrate de tener la variable `REDIS_URL` (por defecto: `redis://localhost:6379`)

### 3. Instalar dependencias e iniciar
```bash
npm install
npm run dev2  # Backend passport + Frontend passport
```

## ⚠️ IMPORTANTE: Fix Autenticación Sistema-a-Sistema

Si necesitas autenticación sistema-a-sistema (Client Credentials Flow), revisa:

📖 **[ÍNDICE DE DOCUMENTACIÓN](./INDICE-DOCUMENTACION.md)** - Guía completa de toda la documentación

**Documentos principales:**
- 📄 **[RESUMEN-EJECUTIVO.md](./RESUMEN-EJECUTIVO.md)** - Resumen de 2 minutos
- 📄 **[FIX-SISTEMA-A-SISTEMA.md](./FIX-SISTEMA-A-SISTEMA.md)** - Guía de configuración paso a paso
- 📄 **[ANALISIS-Y-FIX-COMPLETO.md](./ANALISIS-Y-FIX-COMPLETO.md)** - Análisis técnico completo

**TL;DR**: Asegúrate de tener `OIDC_RELAX_AUDIENCE_azure=true` en tu `.env` para que funcione el Client Credentials Flow.

## 🔧 Redis para Sesiones Persistentes

Las sesiones ahora se guardan en Redis, lo que permite:
- ✅ Persistencia entre reinicios del servidor
- ✅ Las cookies funcionan después de reiniciar el backend
- ✅ Escalabilidad horizontal (múltiples instancias del backend)
- ✅ TTL automático de sesiones

### Comandos útiles de Redis:
```bash
# Ver todas las sesiones
docker exec -it openid-redis redis-cli KEYS "session:*"

# Ver una sesión específica
docker exec -it openid-redis redis-cli GET "session:SESSION_ID"

# Limpiar todas las sesiones
docker exec -it openid-redis redis-cli FLUSHDB

# Detener Redis
docker-compose down

# Detener y limpiar datos
docker-compose down -v
```

## Requisitos
- Node.js 18+

## Variables de entorno

Copia los archivos de ejemplo y ajusta valores:

Backend (`apps/backend/.env.example`):
```
# Modo de autenticación: 'mock' (para probar) u 'oidc' (real)
AUTH_MODE=mock
# Token de prueba aceptado si AUTH_MODE=mock
MOCK_ACCEPT_TOKEN=dev-token

# Configuración OIDC para modo real (ejemplo)
OIDC_ISSUER_URL=https://login.example.com/realms/demo
OIDC_CLIENT_ID=frontend-public-client
OIDC_AUDIENCE=api-audience
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

Frontend (`apps/frontend/.env.local.example`):
```
# Backend base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Para probar rápidamente sin IdP real:
1. Deja `AUTH_MODE=mock` y usa el botón "Usar login mock" en el frontend, que coloca `Bearer dev-token`.
2. El backend protegerá `/products` pero aceptará ese token mock.

## Scripts
En la raíz:
- `npm run backend:dev` — backend en desarrollo (Nest).
- `npm run frontend:dev` — frontend en desarrollo (Next).
- `npm run dev` — ambos a la vez.

## Flujo (real OIDC)
- Frontend redirige a `backend /auth/:provider/login` (ej: `azure`).
- Backend (Nest, `openid-client`) inicia PKCE (state/nonce/code_verifier) y redirige al IdP.
- Backend recibe `/auth/:provider/callback`, canjea el `code` por tokens y guarda sesión (cookie httpOnly `axis-cookie`).
- `GET /products` (protegido) funciona con sesión o `Bearer` válido.

## Configuración Entra ID (Azure AD)
1) App del Frontend (Next + Auth.js)
- Tipo de plataforma: Web
- Redirect URI (registra ambas para evitar mismatch por id del provider):
  - `http://localhost:3000/api/auth/callback/azure`
  - `http://localhost:3000/api/auth/callback/azure-ad`
- Client ID: usa el de tu app (ej: `a9ce2dde-...`)
- Client Secret: crea un secret y colócalo en `AUTH_CLIENT_SECRET`.

2) App del Backend (API) — para aud estricta
- En “Expose an API” define App ID URI (por ej. `api://<api-client-id>`)
- Crea un scope (ej. `Products.Read`)
- Otorga “Grant admin consent” al frontend si hace falta.

3) Variables Frontend (`apps/frontend/.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

4) Variables Backend (`apps/backend/.env`)
```
AUTH_MODE=oidc
OIDC_ISSUER_URL=https://login.microsoftonline.com/<tenant>/v2.0/.well-known/openid-configuration
OIDC_CLIENT_ID=<api_client_id_o_front_si_valida_issuer>
# Estricto: valida `aud`; permite múltiples valores separados por coma
OIDC_AUDIENCE=api://<api-client-id>, <otro-valor-si-aplica>
OIDC_RELAX_AUDIENCE=false
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

5) Endpoints backend
- `GET /auth/:provider/login` — inicia flujo OIDC (PKCE)
- `GET /auth/:provider/callback` — canjea código, crea sesión y redirige a `CORS_ORIGIN`
- `GET /auth/:provider/logout` — destruye sesión y, si se puede, cierra sesión en IdP
- `GET /auth/me` — devuelve usuario/tokens en sesión (JSON)

6) Multi-IdP
- Define `OIDC_PROVIDERS` con lista separada por coma (ej: `azure,google`).
- Para cada `:provider` define variables con sufijo `_<provider>`:
  - `OIDC_ISSUER_<provider>`, `OIDC_CLIENT_ID_<provider>`, `OIDC_CLIENT_SECRET_<provider>`
  - `OIDC_SCOPE_<provider>` (opcional)
  - `OIDC_REDIRECT_URI_<provider>` (si no, se asume `http://localhost:3001/auth/<provider>/callback`)
  - `OIDC_AUDIENCE_<provider>`, `OIDC_RELAX_AUDIENCE_<provider>` (para validar `Bearer`)

## Notas
- No se incluyen dependencias instaladas. Ejecuta `npm install` en la raíz para instalar todo (workspaces).
- El endpoint `/products` devuelve productos mockeados pero está protegido por guard.
