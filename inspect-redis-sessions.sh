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

# Buscar sesiones con ambos prefijos (legacy y nuevo)
session_count_old=$(docker exec openid-redis redis-cli KEYS "session:*" 2>/dev/null | wc -l | tr -d ' ')
session_count_new=$(docker exec openid-redis redis-cli KEYS "axis-session:*" 2>/dev/null | wc -l | tr -d ' ')
session_count=$((session_count_old + session_count_new))

echo "📊 Total de sesiones activas: $session_count"
echo "   - Prefijo 'session:*': $session_count_old"
echo "   - Prefijo 'axis-session:*': $session_count_new"
echo ""

if [ "$session_count" -eq "0" ]; then
    echo "ℹ️  No hay sesiones activas. Haz login en la aplicación primero."
    exit 0
fi

# Función para mostrar sesiones
show_sessions() {
    local prefix=$1
    docker exec openid-redis redis-cli KEYS "$prefix" 2>/dev/null | while read -r session_key; do
        if [ ! -z "$session_key" ]; then
            # Obtener TTL
            ttl=$(docker exec openid-redis redis-cli TTL "$session_key")
            ttl_human=$((ttl / 60))
            echo "🔑 $session_key"
            echo "   ⏱️  TTL: ${ttl}s (${ttl_human}m)"
            
            # Mostrar fecha de expiración
            if [ "$ttl" -gt 0 ]; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    expires_date=$(date -v+${ttl}S "+%Y-%m-%d %H:%M:%S")
                else
                    # Linux
                    expires_date=$(date -d "+${ttl} seconds" "+%Y-%m-%d %H:%M:%S")
                fi
                echo "   📅 Expira: $expires_date"
            fi
        fi
    done
}

# Listar todas las sesiones
echo "📋 Lista de sesiones:"
echo "-------------------"
show_sessions "session:*"
show_sessions "axis-session:*"
echo ""

# Opción para ver el contenido de una sesión
if [ "$1" == "--show" ] || [ "$1" == "-s" ]; then
    echo "📄 Contenido de las sesiones:"
    echo "----------------------------"
    
    for prefix in "session:*" "axis-session:*"; do
        docker exec openid-redis redis-cli KEYS "$prefix" 2>/dev/null | while read -r session_key; do
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
    done
elif [ "$1" == "--parse" ] || [ "$1" == "-p" ]; then
    echo "📄 Sesiones parseadas (requiere jq):"
    echo "-----------------------------------"
    if ! command -v jq &> /dev/null; then
        echo "❌ jq no está instalado. Instala con: brew install jq"
        exit 1
    fi
    
    for prefix in "session:*" "axis-session:*"; do
        docker exec openid-redis redis-cli KEYS "$prefix" 2>/dev/null | while read -r session_key; do
            if [ ! -z "$session_key" ]; then
                echo ""
                echo "🔑 Session: $session_key"
                ttl=$(docker exec openid-redis redis-cli TTL "$session_key")
                echo "  ⏱️  Redis TTL: ${ttl}s ($((ttl / 60))m)"
                
                content=$(docker exec openid-redis redis-cli GET "$session_key")
                
                # Extraer información relevante
                echo "  👤 User ID: $(echo "$content" | jq -r '.user.id // "N/A"')"
                echo "  📧 Email: $(echo "$content" | jq -r '.user.email // "N/A"')"
                echo "  🏢 Provider: $(echo "$content" | jq -r '.user.provider // .user.identityProvider // "N/A"')"
                
                # Cookie info
                cookie_expires=$(echo "$content" | jq -r '.cookie.expires // "N/A"')
                cookie_maxage=$(echo "$content" | jq -r '.cookie.maxAge // "N/A"')
                echo "  🍪 Cookie MaxAge: ${cookie_maxage}ms ($((cookie_maxage / 1000))s)"
                echo "  🍪 Cookie Expires: $cookie_expires"
                
                # Tokens
                echo "  🎫 Has Access Token: $(echo "$content" | jq -r 'if .user.tokens.access_token then "✅ Yes" else "❌ No" end')"
                echo "  🎫 Has ID Token: $(echo "$content" | jq -r 'if .user.tokens.id_token then "✅ Yes" else "❌ No" end')"
                echo "  🎫 Has Refresh Token: $(echo "$content" | jq -r 'if .user.tokens.refresh_token then "✅ Yes" else "❌ No" end')"
                
                echo "---"
            fi
        done
    done
elif [ "$1" == "--watch" ] || [ "$1" == "-w" ]; then
    echo "👀 Watching sessions (Ctrl+C to stop)..."
    echo ""
    while true; do
        clear
        echo "🔍 Sesiones en Redis (actualizando cada 2s)"
        echo "=========================================="
        echo ""
        
        for prefix in "session:*" "axis-session:*"; do
            docker exec openid-redis redis-cli KEYS "$prefix" 2>/dev/null | while read -r session_key; do
                if [ ! -z "$session_key" ]; then
                    ttl=$(docker exec openid-redis redis-cli TTL "$session_key")
                    echo "🔑 $(echo $session_key | cut -c1-50)..."
                    echo "   ⏱️  TTL: ${ttl}s ($((ttl / 60))m $((ttl % 60))s)"
                    
                    if command -v jq &> /dev/null; then
                        content=$(docker exec openid-redis redis-cli GET "$session_key")
                        email=$(echo "$content" | jq -r '.user.email // "N/A"')
                        echo "   📧 $email"
                    fi
                    echo ""
                fi
            done
        done
        
        echo "Última actualización: $(date '+%H:%M:%S')"
        sleep 2
    done
else
    echo "💡 Opciones disponibles:"
    echo "  ./inspect-redis-sessions.sh         - Listar sesiones"
    echo "  ./inspect-redis-sessions.sh --show  - Ver contenido completo"
    echo "  ./inspect-redis-sessions.sh --parse - Ver información parseada (requiere jq)"
    echo "  ./inspect-redis-sessions.sh --watch - Monitorear en tiempo real"
fi

echo ""
echo "🔧 Comandos útiles:"
echo "  docker exec -it openid-redis redis-cli KEYS \"*session:*\"  - Listar todas las sesiones"
echo "  docker exec -it openid-redis redis-cli FLUSHDB             - Limpiar todas las sesiones"
echo "  docker exec -it openid-redis redis-cli DBSIZE              - Contar todas las claves"
