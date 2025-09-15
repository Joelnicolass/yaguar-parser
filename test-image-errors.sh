#!/bin/bash

# 🧪 Script de Prueba - Manejo de Errores de Imagen
# Este script valida que el sistema maneje correctamente los errores de ID de imagen inválido

echo "🧪 Iniciando pruebas de manejo de errores de imagen..."
echo "================================================"

# Colors para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para logging
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Función para hacer petición POST
test_image_error() {
    echo ""
    log_info "🔧 Probando manejo de errores de imagen..."
    
    # Hacer petición al endpoint de parseo
    curl -X POST \
        http://localhost:3000/api/parser/sucursal \
        -H "Content-Type: application/json" \
        -d '{
            "sucursalId": 10,
            "uploadToWooCommerce": true
        }' \
        -w "\nHTTP Status: %{http_code}\n" \
        -s
}

# Verificar que el servidor esté corriendo
log_info "🌐 Verificando que el servidor esté en funcionamiento..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    log_error "❌ El servidor no está corriendo en puerto 3000"
    log_info "💡 Por favor ejecuta: npm run dev"
    exit 1
fi

log_info "✅ Servidor está funcionando"

# Ejecutar prueba
test_image_error

echo ""
echo "📊 Verificando logs de errores de imagen..."
echo "============================================"

# Buscar en logs evidencia del manejo de errores de imagen
if grep -q "ID de imagen inválido" logs/*.log 2>/dev/null; then
    log_info "✅ Se detectaron logs de manejo de errores de imagen"
    echo ""
    echo "🔍 Últimos logs relevantes:"
    grep -n "imagen inválido\|woocommerce_product_invalid_image_id\|reintentando sin imágenes" logs/*.log | tail -5
else
    log_warn "⚠️ No se encontraron logs de errores de imagen específicos"
fi

echo ""
echo "📋 Verificando estadísticas de productos..."
echo "=========================================="

# Buscar estadísticas en los logs
if grep -q "Resumen de carga.*creados.*actualizados" logs/*.log 2>/dev/null; then
    log_info "✅ Se encontraron estadísticas de carga"
    echo ""
    echo "📊 Últimas estadísticas:"
    grep -n "Resumen de carga" logs/*.log | tail -3
else
    log_warn "⚠️ No se encontraron estadísticas de carga recientes"
fi

echo ""
echo "🎯 Resultados de la Prueba"
echo "========================="

# Contar tipos de logs para determinar éxito
ERROR_COUNT=$(grep -c "❌ Error al" logs/*.log 2>/dev/null || echo "0")
WARNING_COUNT=$(grep -c "⚠️.*imagen.*inválido" logs/*.log 2>/dev/null || echo "0")
SUCCESS_COUNT=$(grep -c "✅.*exitosamente" logs/*.log 2>/dev/null || echo "0")

echo "❌ Errores totales: $ERROR_COUNT"
echo "⚠️ Warnings de imagen: $WARNING_COUNT"
echo "✅ Productos procesados: $SUCCESS_COUNT"

if [ "$WARNING_COUNT" -gt 0 ] && [ "$SUCCESS_COUNT" -gt 0 ]; then
    log_info "🎉 PRUEBA EXITOSA: El sistema maneja correctamente los errores de imagen"
    log_info "📝 Los productos se procesan sin imágenes cuando hay IDs inválidos"
elif [ "$ERROR_COUNT" -eq 0 ] && [ "$SUCCESS_COUNT" -gt 0 ]; then
    log_info "✅ PRUEBA EXITOSA: Productos procesados sin errores de imagen"
else
    log_error "❌ PRUEBA FALLIDA: Revisar logs para identificar problemas"
fi

echo ""
echo "💡 Comandos útiles para debugging:"
echo "================================"
echo "📄 Ver logs completos:    tail -f logs/*.log"
echo "🔍 Buscar errores:        grep 'Error\|error' logs/*.log"
echo "🖼️ Ver errores de imagen: grep 'imagen.*inválido' logs/*.log"
echo "📊 Ver estadísticas:      grep 'Resumen de carga' logs/*.log"

echo ""
log_info "🏁 Prueba de manejo de errores de imagen completada"
