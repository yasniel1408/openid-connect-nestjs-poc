#!/bin/bash

# Script para probar diferentes opciones de simplificación
# Uso: ./test-strategy-options.sh [1|2|3|current]

set -e

STRATEGY_DIR="apps/backend-passport-strategies/src/auth/strategies"
BACKUP_FILE="$STRATEGY_DIR/azure-cce-jwt.strategy.BACKUP.ts"
CURRENT_FILE="$STRATEGY_DIR/azure-cce-jwt.strategy.ts"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

function print_header() {
  echo -e "${BLUE}================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================================${NC}"
  echo ""
}

function print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

function print_error() {
  echo -e "${RED}✗ $1${NC}"
}

function print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

function print_info() {
  echo -e "  $1"
}

function backup_current() {
  if [ -f "$CURRENT_FILE" ]; then
    if [ ! -f "$BACKUP_FILE" ]; then
      print_info "Creando backup de la versión actual..."
      cp "$CURRENT_FILE" "$BACKUP_FILE"
      print_success "Backup creado: $BACKUP_FILE"
    else
      print_info "Backup ya existe, no se sobreescribe"
    fi
  fi
}

function restore_backup() {
  if [ -f "$BACKUP_FILE" ]; then
    print_info "Restaurando versión original desde backup..."
    cp "$BACKUP_FILE" "$CURRENT_FILE"
    print_success "Versión original restaurada"
  else
    print_error "No se encontró el backup"
    exit 1
  fi
}

function switch_to_option() {
  local option=$1
  local option_file="$STRATEGY_DIR/azure-cce-jwt.strategy.OPCION${option}.ts"
  
  if [ ! -f "$option_file" ]; then
    print_error "No se encontró el archivo: $option_file"
    exit 1
  fi
  
  # Hacer backup si no existe
  backup_current
  
  # Copiar la opción
  print_info "Cambiando a Opción $option..."
  cp "$option_file" "$CURRENT_FILE"
  print_success "Estrategia cambiada a Opción $option"
}

function show_current_option() {
  if [ ! -f "$CURRENT_FILE" ]; then
    print_error "No se encontró el archivo de estrategia actual"
    return
  fi
  
  # Detectar qué opción está activa
  if grep -q "OPCIÓN 1:" "$CURRENT_FILE" 2>/dev/null; then
    echo -e "${GREEN}Opción 1${NC} - passport-jwt + jwks-rsa"
  elif grep -q "OPCIÓN 2:" "$CURRENT_FILE" 2>/dev/null; then
    echo -e "${GREEN}Opción 2${NC} - passport-azure-ad (oficial)"
  elif grep -q "OPCIÓN 3:" "$CURRENT_FILE" 2>/dev/null; then
    echo -e "${GREEN}Opción 3${NC} - jose mejorado"
  elif [ -f "$BACKUP_FILE" ]; then
    echo -e "${GREEN}Versión Original${NC} (backup disponible)"
  else
    echo -e "${YELLOW}Versión Desconocida${NC}"
  fi
}

function run_tests() {
  print_header "Ejecutando Tests de Autenticación"
  
  # Verificar si el backend está corriendo
  if ! curl -s http://localhost:3001/auth/me > /dev/null 2>&1; then
    print_warning "El backend no está corriendo en localhost:3001"
    print_info "Inicia el backend con: npm run backend2:dev"
    echo ""
    read -p "¿Iniciar backend ahora? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      print_info "Iniciando backend..."
      cd apps/backend-passport-strategies && npm run start:dev &
      BACKEND_PID=$!
      print_info "Backend iniciando (PID: $BACKEND_PID)..."
      print_info "Esperando 10 segundos para que inicie..."
      sleep 10
    else
      print_error "Tests cancelados. Inicia el backend primero."
      exit 1
    fi
  fi
  
  # Ejecutar script de test
  if [ -f "./test-client-credentials.sh" ]; then
    ./test-client-credentials.sh
  else
    print_error "No se encontró el script de test: ./test-client-credentials.sh"
    exit 1
  fi
}

function show_usage() {
  echo "Uso: $0 [COMANDO]"
  echo ""
  echo "Comandos:"
  echo "  1           Cambiar a Opción 1 (passport-jwt + jwks-rsa)"
  echo "  2           Cambiar a Opción 2 (passport-azure-ad) - RECOMENDADA"
  echo "  3           Cambiar a Opción 3 (jose mejorado)"
  echo "  current     Restaurar versión original desde backup"
  echo "  status      Mostrar qué opción está activa"
  echo "  test        Ejecutar tests de autenticación"
  echo "  compare     Mostrar comparación de opciones"
  echo ""
  echo "Ejemplos:"
  echo "  $0 2              # Cambiar a Opción 2"
  echo "  $0 test           # Ejecutar tests"
  echo "  $0 current        # Volver a versión original"
}

function show_comparison() {
  print_header "Comparación de Opciones"
  
  cat << 'EOF'
┌─────────┬──────────────────────┬─────────────┬─────────────┬──────────────┐
│ Opción  │ Tecnología           │ Simplicidad │ Flexibilidad│ Recomendado  │
├─────────┼──────────────────────┼─────────────┼─────────────┼──────────────┤
│ Actual  │ jose (manual)        │ ★★☆☆☆       │ ★★★★★       │              │
│ 1       │ passport-jwt         │ ★★★★☆       │ ★★★☆☆       │              │
│ 2       │ passport-azure-ad    │ ★★★★★       │ ★★☆☆☆       │ ✓ Azure-only │
│ 3       │ jose (mejorado)      │ ★★★★☆       │ ★★★★★       │ ✓ Multi-IDP  │
└─────────┴──────────────────────┴─────────────┴─────────────┴──────────────┘

Detalles completos en: COMPARACION-OPCIONES-SIMPLIFICACION.md
EOF
}

# Main
case "${1:-}" in
  1)
    print_header "Cambiando a Opción 1: passport-jwt + jwks-rsa"
    switch_to_option 1
    echo ""
    print_info "Recuerda: passport-jwt y jwks-rsa ya están instalados"
    print_info "No necesitas instalar nada adicional"
    echo ""
    read -p "¿Ejecutar tests ahora? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      run_tests
    fi
    ;;
    
  2)
    print_header "Cambiando a Opción 2: passport-azure-ad (RECOMENDADA)"
    
    # Verificar si passport-azure-ad está instalado
    if ! npm list passport-azure-ad > /dev/null 2>&1; then
      print_warning "passport-azure-ad no está instalado"
      echo ""
      read -p "¿Instalar passport-azure-ad ahora? (y/n) " -n 1 -r
      echo ""
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Instalando passport-azure-ad..."
        npm install passport-azure-ad
        print_success "Instalación completada"
      else
        print_error "Operación cancelada. Instala passport-azure-ad primero:"
        print_info "npm install passport-azure-ad"
        exit 1
      fi
    fi
    
    switch_to_option 2
    echo ""
    print_success "Opción 2 activada!"
    echo ""
    read -p "¿Ejecutar tests ahora? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      run_tests
    fi
    ;;
    
  3)
    print_header "Cambiando a Opción 3: jose mejorado"
    switch_to_option 3
    echo ""
    print_info "Esta opción usa jose (ya instalado)"
    print_info "No necesitas instalar dependencias adicionales"
    echo ""
    read -p "¿Ejecutar tests ahora? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      run_tests
    fi
    ;;
    
  current|original|restore)
    print_header "Restaurando Versión Original"
    restore_backup
    echo ""
    print_success "Versión original restaurada"
    ;;
    
  status)
    print_header "Estado Actual"
    echo -n "Estrategia activa: "
    show_current_option
    echo ""
    ;;
    
  test)
    print_header "Tests de Autenticación"
    echo -n "Estrategia activa: "
    show_current_option
    echo ""
    run_tests
    ;;
    
  compare|comparison)
    show_comparison
    ;;
    
  help|--help|-h)
    show_usage
    ;;
    
  *)
    print_error "Comando no reconocido: ${1:-}"
    echo ""
    show_usage
    exit 1
    ;;
esac
