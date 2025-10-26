#!/bin/bash

# Script para inspeccionar sesiones en Redis

echo "🔍 Inspeccionando sesiones en Redis..."
echo ""

# Verificar que Redis está corriendo
if ! docker ps | grep -q openid-redis; then
    echo "❌ Redis no está corriendo. Inicia con: docker-compose up -d"
    exit 1
fi

echo "✅ Redis está corriendo"
echo ""

# Contar sesiones
session_count=$(docker exec openid-redis redis-cli KEYS "session:*" | wc -l | tr -d ' ')
echo "📊 Total de sesiones activas: $session_count"
echo ""

if [ "$session_count" -eq "0" ]; then
    echo "ℹ️  No hay sesiones activas. Haz login en la aplicación primero."
    exit 0
fi

# Listar todas las sesiones
echo "📋 Lista de sesiones:"
echo "-------------------"
docker exec openid-redis redis-cli KEYS "session:*" | while read -r session_key; do
    if [ ! -z "$session_key" ]; then
        # Obtener TTL
        ttl=$(docker exec openid-redis redis-cli TTL "$session_key")
        echo "🔑 $session_key (expira en ${ttl}s)"
    fi
done
echo ""

# Opción para ver el contenido de una sesión
if [ "$1" == "--show" ] || [ "$1" == "-s" ]; then
    echo "📄 Contenido de las sesiones:"
    echo "----------------------------"
    docker exec openid-redis redis-cli KEYS "session:*" | while read -r session_key; do
        if [ ! -z "$session_key" ]; then
            echo ""
            echo "🔑 Session: $session_key"
            content=$(docker exec openid-redis redis-cli GET "$session_key")
            # Intentar formatear JSON si es posible
            if command -v jq &> /dev/null; then
                echo "$content" | jq '.' 2>/dev/null || echo "$content"
            else
                echo "$content"
            fi
            echo "---"
        fi
    done
elif [ "$1" == "--parse" ] || [ "$1" == "-p" ]; then
    echo "📄 Sesiones parseadas (requiere jq):"
    echo "-----------------------------------"
    if ! command -v jq &> /dev/null; then
        echo "❌ jq no está instalado. Instala con: brew install jq"
        exit 1
    fi
    
    docker exec openid-redis redis-cli KEYS "session:*" | while read -r session_key; do
        if [ ! -z "$session_key" ]; then
            echo ""
            echo "🔑 Session: $session_key"
            content=$(docker exec openid-redis redis-cli GET "$session_key")
            
            # Extraer información relevante
            echo "  👤 User ID: $(echo "$content" | jq -r '.user.id // "N/A"')"
            echo "  📧 Email: $(echo "$content" | jq -r '.user.email // "N/A"')"
            echo "  🏢 Provider: $(echo "$content" | jq -r '.user.provider // .user.identityProvider // "N/A"')"
            echo "  🎫 Has Access Token: $(echo "$content" | jq -r 'if .user.tokens.access_token then "✅ Yes" else "❌ No" end')"
            echo "  🎫 Has ID Token: $(echo "$content" | jq -r 'if .user.tokens.id_token then "✅ Yes" else "❌ No" end')"
            echo "  🔄 Has Refresh Token: $(echo "$content" | jq -r 'if .user.tokens.refresh_token then "✅ Yes" else "❌ No" end')"
            
            # Si hay tokens, mostrar cuando expiran
            expires_at=$(echo "$content" | jq -r '.user.tokens.expires_at // empty')
            if [ ! -z "$expires_at" ]; then
                current_time=$(date +%s)
                remaining=$((expires_at - current_time))
                if [ $remaining -gt 0 ]; then
                    echo "  ⏱️  Token expira en: ${remaining}s ($(date -r $expires_at))"
                else
                    echo "  ⏱️  Token expiró hace: $((-remaining))s"
                fi
            fi
            echo "---"
        fi
    done
else
    echo "💡 Opciones disponibles:"
    echo "  ./inspect-redis-sessions.sh         - Listar sesiones"
    echo "  ./inspect-redis-sessions.sh --show  - Ver contenido completo"
    echo "  ./inspect-redis-sessions.sh --parse - Ver información parseada (requiere jq)"
fi

echo ""
echo "🔧 Comandos útiles:"
echo "  docker exec -it openid-redis redis-cli KEYS \"session:*\"  - Listar sesiones"
echo "  docker exec -it openid-redis redis-cli FLUSHDB           - Limpiar todas las sesiones"
echo "  docker exec -it openid-redis redis-cli DBSIZE            - Contar todas las claves"
