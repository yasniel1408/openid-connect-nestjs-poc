#!/bin/bash

# Script para iniciar el backend con verificación de Redis

echo "🔍 Verificando Redis..."

# Intentar conectar a Redis
if command -v redis-cli &> /dev/null; then
    if redis-cli -h localhost -p 6379 ping &> /dev/null; then
        echo "✅ Redis está corriendo"
    else
        echo "⚠️  Redis no está corriendo en localhost:6379"
        echo ""
        echo "Opciones:"
        echo "1. Iniciar con Docker: docker-compose up -d"
        echo "2. Instalar Redis local: brew install redis && brew services start redis"
        echo ""
        read -p "¿Deseas continuar sin Redis? (las sesiones serán en memoria) [y/N]: " response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo "⚠️  redis-cli no está instalado, no se puede verificar Redis"
    echo "El backend intentará conectarse a Redis en el inicio"
fi

echo ""
echo "🚀 Iniciando backend..."
npm run start:dev
