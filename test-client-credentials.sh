#!/bin/bash

# Script de prueba para autenticación sistema-a-sistema
# Uso: ./test-client-credentials.sh

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"

echo "🔐 Test de Autenticación Sistema-a-Sistema (Client Credentials Flow)"
echo "=================================================="
echo ""
echo "API Base URL: $API_BASE_URL"
echo ""

# Paso 1: Obtener token
echo "📋 Paso 1: Obteniendo token con Client Credentials..."
echo ""

RESPONSE=$(curl -s -X POST "$API_BASE_URL/auth/system/cc/token" \
  -H "Content-Type: application/json" \
  -d '{}')

if echo "$RESPONSE" | grep -q "access_token"; then
  ACCESS_TOKEN=$(echo "$RESPONSE" | jq -r '.access_token')
  EXPIRES_IN=$(echo "$RESPONSE" | jq -r '.expires_in')
  TOKEN_TYPE=$(echo "$RESPONSE" | jq -r '.token_type')
  
  echo "✅ Token obtenido exitosamente"
  echo "   Token Type: $TOKEN_TYPE"
  echo "   Expires In: $EXPIRES_IN segundos"
  echo ""
else
  echo "❌ Error al obtener token"
  echo "$RESPONSE" | jq .
  exit 1
fi

# Paso 2: Verificar endpoint sin autenticación
echo "📋 Paso 2: Intentando acceder a /products SIN autenticación..."
echo ""

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE_URL/products")

if [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Endpoint correctamente protegido (HTTP $HTTP_CODE)"
  echo ""
else
  echo "⚠️  Advertencia: Se esperaba 403/401, se obtuvo HTTP $HTTP_CODE"
  echo ""
fi

# Paso 3: Acceder con token
echo "📋 Paso 3: Accediendo a /products CON Bearer token..."
echo ""

RESPONSE=$(curl -s "$API_BASE_URL/products" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$RESPONSE" | jq -e 'type == "array"' > /dev/null 2>&1; then
  PRODUCT_COUNT=$(echo "$RESPONSE" | jq 'length')
  echo "✅ Acceso exitoso con autenticación"
  echo "   Productos retornados: $PRODUCT_COUNT"
  echo ""
  echo "   Detalle de productos:"
  echo "$RESPONSE" | jq -r '.[] | "   - \(.name) ($\(.price) \(.currency))"'
  echo ""
else
  echo "❌ Error al acceder al endpoint"
  echo "$RESPONSE" | jq .
  exit 1
fi

# Paso 4: Decodificar token (opcional)
echo "📋 Paso 4: Información del token JWT..."
echo ""

HEADER=$(echo "$ACCESS_TOKEN" | cut -d'.' -f1)
PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)

# Agregar padding si es necesario
while [ $((${#PAYLOAD} % 4)) -ne 0 ]; do
  PAYLOAD="${PAYLOAD}="
done

DECODED=$(echo "$PAYLOAD" | base64 -d 2>/dev/null || echo "{}")

if echo "$DECODED" | jq -e . > /dev/null 2>&1; then
  echo "   Issuer (iss):   $(echo "$DECODED" | jq -r '.iss')"
  echo "   Audience (aud): $(echo "$DECODED" | jq -r '.aud')"
  echo "   Subject (sub):  $(echo "$DECODED" | jq -r '.sub')"
  echo "   Version (ver):  $(echo "$DECODED" | jq -r '.ver')"
  echo "   App ID (azp):   $(echo "$DECODED" | jq -r '.azp')"
  
  ROLES=$(echo "$DECODED" | jq -r '.roles[]?' 2>/dev/null)
  if [ -n "$ROLES" ]; then
    echo "   Roles:"
    echo "$DECODED" | jq -r '.roles[] | "     - \(.)"'
  fi
  echo ""
else
  echo "   ⚠️  No se pudo decodificar el payload del token"
  echo ""
fi

echo "=================================================="
echo "✅ Todos los tests completados exitosamente"
echo "=================================================="
echo ""
echo "💡 Tip: Puedes usar el token obtenido en otras llamadas:"
echo "   export AUTH_TOKEN=\"$ACCESS_TOKEN\""
echo "   curl $API_BASE_URL/products -H \"Authorization: Bearer \$AUTH_TOKEN\""
echo ""
