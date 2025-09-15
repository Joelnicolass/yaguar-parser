#!/bin/bash

# 🚀 Script de Prueba - Optimización con Batch API
# Este script valida el rendimiento y funcionamiento del sistema batch

echo "🚀 Iniciando prueba de optimización con Batch API..."
echo "=================================================="

# Colors para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Función para medir tiempo
measure_time() {
    local start_time=$(date +%s%N)
    "$@"
    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # convertir a milisegundos
    echo "⏱️ Duración: ${duration}ms"
    return $duration
}

# Verificar que el servidor esté corriendo
log_info "🌐 Verificando servidor..."
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    log_error "❌ El servidor no está corriendo en puerto 3000"
    log_info "💡 Por favor ejecuta: npm run dev"
    exit 1
fi

log_info "✅ Servidor funcionando"

echo ""
log_info "🧪 Ejecutando prueba de batch optimization..."
echo "=============================================="

# Limpiar logs anteriores para análisis limpio
if [ -d "logs" ]; then
    log_debug "🧹 Limpiando logs anteriores..."
    > logs/yaguar-sync-$(date +%Y-%m-%d).log 2>/dev/null || true
    > logs/error-$(date +%Y-%m-%d).log 2>/dev/null || true
fi

# Ejecutar prueba con medición de tiempo
log_info "⏰ Iniciando carga con sistema batch optimizado (ASÍNCRONO)..."

START_TIME=$(date +%s%N)

# Hacer petición al endpoint ASÍNCRONO
RESPONSE=$(curl -X POST \
    http://localhost:3000/api/parser/parse-sucursal-async \
    -H "Content-Type: application/json" \
    -d '{
        "sucursalId": 10,
        "uploadToWooCommerce": true
    }' \
    -w "\nHTTP Status: %{http_code}\nTotal Time: %{time_total}s\n" \
    -s)

END_TIME=$(date +%s%N)
TOTAL_DURATION=$(( (END_TIME - START_TIME) / 1000000 )) # ms

echo ""
log_info "📊 Respuesta del servidor:"
echo "$RESPONSE"

# Extraer jobId de la respuesta
JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)

if [ -n "$JOB_ID" ]; then
    log_info "🎯 Job iniciado con ID: $JOB_ID"
    log_info "⏳ Monitoreando progreso del job..."
    
    # Monitorear el job hasta completarse
    JOB_COMPLETED=false
    CHECK_COUNT=0
    MAX_CHECKS=60 # Máximo 10 minutos (60 checks * 10 segundos)
    
    while [ "$JOB_COMPLETED" = false ] && [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
        sleep 10 # Esperar 10 segundos entre checks
        CHECK_COUNT=$((CHECK_COUNT + 1))
        
        # Consultar estado del job
        JOB_STATUS=$(curl -s http://localhost:3000/api/jobs/status/$JOB_ID)
        STATUS=$(echo "$JOB_STATUS" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        PROGRESS=$(echo "$JOB_STATUS" | grep -o '"progress":[0-9]*' | cut -d':' -f2)
        
        log_info "📊 Job $JOB_ID - Estado: $STATUS - Progreso: ${PROGRESS}%"
        
        if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
            JOB_COMPLETED=true
            
            # Obtener resultado final
            FINAL_RESPONSE=$(curl -s http://localhost:3000/api/jobs/status/$JOB_ID)
            echo ""
            log_info "🎯 Resultado final del job:"
            echo "$FINAL_RESPONSE"
            
            # Calcular tiempo total del job
            START_TIME_JOB=$(echo "$FINAL_RESPONSE" | grep -o '"startTime":"[^"]*"' | cut -d'"' -f4)
            END_TIME_JOB=$(echo "$FINAL_RESPONSE" | grep -o '"endTime":"[^"]*"' | cut -d'"' -f4)
            
            if [ -n "$END_TIME_JOB" ]; then
                log_info "✅ Job completado exitosamente"
            fi
        fi
    done
    
    if [ $CHECK_COUNT -ge $MAX_CHECKS ]; then
        log_warn "⚠️ Timeout: El job no se completó en el tiempo esperado"
    fi
else
    log_error "❌ No se pudo obtener el jobId de la respuesta"
fi

echo ""
log_info "⏱️ Tiempo total medido: ${TOTAL_DURATION}ms"

echo ""
echo "📈 Analizando rendimiento..."
echo "=========================="

# Buscar en logs información sobre batches
if [ -d "logs" ]; then
    log_info "🔍 Analizando logs de batch processing..."
    
    # Buscar información de lotes
    BATCH_COUNT=$(grep -c "Procesando lote" logs/*.log 2>/dev/null || echo "0")
    BATCH_PRODUCTS=$(grep "productos usando Batch API" logs/*.log 2>/dev/null | tail -1 | grep -o '[0-9]\+' | head -1 || echo "0")
    
    # Buscar estadísticas finales
    CREATED_COUNT=$(grep "Resumen de carga optimizada" logs/*.log 2>/dev/null | tail -1 | grep -o '[0-9]\+ creados' | grep -o '[0-9]\+' || echo "0")
    UPDATED_COUNT=$(grep "Resumen de carga optimizada" logs/*.log 2>/dev/null | tail -1 | grep -o '[0-9]\+ actualizados' | grep -o '[0-9]\+' || echo "0")
    FAILED_COUNT=$(grep "Resumen de carga optimizada" logs/*.log 2>/dev/null | tail -1 | grep -o '[0-9]\+ fallaron' | grep -o '[0-9]\+' || echo "0")
    
    # Verificar si se usó fallback
    FALLBACK_USED=$(grep -c "fallback" logs/*.log 2>/dev/null || echo "0")
    
    # Asegurar que todas las variables sean números válidos
    BATCH_COUNT=${BATCH_COUNT:-0}
    BATCH_PRODUCTS=${BATCH_PRODUCTS:-0}
    CREATED_COUNT=${CREATED_COUNT:-0}
    UPDATED_COUNT=${UPDATED_COUNT:-0}
    FAILED_COUNT=${FAILED_COUNT:-0}
    FALLBACK_USED=${FALLBACK_USED:-0}
    
    # Validar que son números
    if ! [[ "$BATCH_COUNT" =~ ^[0-9]+$ ]]; then BATCH_COUNT=0; fi
    if ! [[ "$BATCH_PRODUCTS" =~ ^[0-9]+$ ]]; then BATCH_PRODUCTS=0; fi
    if ! [[ "$CREATED_COUNT" =~ ^[0-9]+$ ]]; then CREATED_COUNT=0; fi
    if ! [[ "$UPDATED_COUNT" =~ ^[0-9]+$ ]]; then UPDATED_COUNT=0; fi
    if ! [[ "$FAILED_COUNT" =~ ^[0-9]+$ ]]; then FAILED_COUNT=0; fi
    if ! [[ "$FALLBACK_USED" =~ ^[0-9]+$ ]]; then FALLBACK_USED=0; fi
    
    echo ""
    echo "📊 Estadísticas de Batch Processing:"
    echo "=================================="
    echo "🏗️ Total de productos procesados: $BATCH_PRODUCTS"
    echo "📦 Número de lotes procesados: $BATCH_COUNT"
    echo "✅ Productos creados: $CREATED_COUNT"
    echo "🔄 Productos actualizados: $UPDATED_COUNT"
    echo "❌ Productos fallidos: $FAILED_COUNT"
    echo "🔄 Fallback activado: $([ "$FALLBACK_USED" -gt 0 ] && echo "Sí ($FALLBACK_USED veces)" || echo "No")"
    
    # Calcular eficiencia
    if [ "$BATCH_PRODUCTS" -gt 0 ]; then
        SUCCESS_RATE=$(( (CREATED_COUNT + UPDATED_COUNT) * 100 / BATCH_PRODUCTS ))
        echo "📈 Tasa de éxito: ${SUCCESS_RATE}%"
        
        if [ "$BATCH_COUNT" -gt 0 ]; then
            PRODUCTS_PER_BATCH=$(( BATCH_PRODUCTS / BATCH_COUNT ))
            echo "📦 Productos por lote promedio: $PRODUCTS_PER_BATCH"
        fi
    fi
    
    echo ""
    echo "🔍 Análisis de Logs Relevantes:"
    echo "=============================="
    
    # Mostrar logs de batch más importantes
    echo ""
    log_debug "🚀 Inicio de batch processing:"
    grep "usando Batch API" logs/*.log 2>/dev/null | tail -3 || log_warn "No se encontraron logs de inicio de batch"
    
    echo ""
    log_debug "📦 Información de lotes:"
    grep "Procesando lote" logs/*.log 2>/dev/null | head -5 || log_warn "No se encontraron logs de procesamiento de lotes"
    
    echo ""
    log_debug "🎯 Resumen final:"
    grep "Resumen de carga optimizada" logs/*.log 2>/dev/null | tail -1 || log_warn "No se encontró resumen final"
    
    # Verificar errores específicos de batch
    echo ""
    log_debug "🔧 Errores específicos de batch:"
    BATCH_ERRORS=$(grep -c "Error en batch\|batch.*error" logs/*.log 2>/dev/null || echo "0")
    if [ "$BATCH_ERRORS" -gt 0 ]; then
        log_warn "⚠️ Se encontraron $BATCH_ERRORS errores de batch"
        grep "Error en batch\|batch.*error" logs/*.log 2>/dev/null | tail -3
    else
        log_info "✅ No se encontraron errores específicos de batch"
    fi
    
else
    log_warn "⚠️ No se encontró directorio de logs"
fi

echo ""
echo "🎯 Evaluación de Rendimiento"
echo "============================"

# Estimar mejora de rendimiento
# Asegurar que las variables sean números válidos
BATCH_PRODUCTS=${BATCH_PRODUCTS:-0}
BATCH_COUNT=${BATCH_COUNT:-0}
TOTAL_DURATION=${TOTAL_DURATION:-0}

if [ "$BATCH_PRODUCTS" -gt 0 ] && [ "$BATCH_COUNT" -gt 0 ] && [ "$TOTAL_DURATION" -gt 0 ]; then
    OLD_METHOD_TIME=$(( BATCH_PRODUCTS * 1000 )) # 1 segundo por producto (método anterior)
    NEW_METHOD_TIME=$TOTAL_DURATION
    
    # Verificar que no sea división por cero
    if [ "$NEW_METHOD_TIME" -gt 0 ]; then
        IMPROVEMENT_FACTOR=$(( OLD_METHOD_TIME / NEW_METHOD_TIME ))
        IMPROVEMENT_PERCENT=$(( (OLD_METHOD_TIME - NEW_METHOD_TIME) * 100 / OLD_METHOD_TIME ))
        
        echo "⚡ Tiempo estimado método anterior: ${OLD_METHOD_TIME}ms"
        echo "🚀 Tiempo real método optimizado: ${NEW_METHOD_TIME}ms"
        echo "📈 Mejora de rendimiento: ${IMPROVEMENT_FACTOR}x más rápido"
        echo "💯 Reducción de tiempo: ${IMPROVEMENT_PERCENT}%"
        
        # Evaluación final
        if [ "$IMPROVEMENT_FACTOR" -ge 5 ]; then
            log_info "🎉 EXCELENTE: Optimización muy exitosa (${IMPROVEMENT_FACTOR}x mejora)"
        elif [ "$IMPROVEMENT_FACTOR" -ge 2 ]; then
            log_info "✅ BUENO: Optimización exitosa (${IMPROVEMENT_FACTOR}x mejora)"
        else
            log_warn "⚠️ MEJORABLE: Optimización parcial (${IMPROVEMENT_FACTOR}x mejora)"
        fi
    else
        log_warn "⚠️ No se pudo calcular mejora de rendimiento (tiempo = 0)"
    fi
else
    log_warn "⚠️ Datos insuficientes para calcular mejora de rendimiento"
    echo "📊 Datos disponibles:"
    echo "   - Productos: $BATCH_PRODUCTS"
    echo "   - Lotes: $BATCH_COUNT" 
    echo "   - Tiempo: ${TOTAL_DURATION}ms"
fi

echo ""
echo "💡 Comandos útiles para análisis:"
echo "================================"
echo "📄 Ver logs completos:           tail -f logs/*.log"
echo "🚀 Ver logs de batch:            grep -n 'batch\|lote' logs/*.log"
echo "📊 Ver estadísticas:             grep -n 'Resumen.*optimizada' logs/*.log"
echo "🔧 Ver errores:                  grep -n 'Error\|error' logs/*.log"
echo "⏱️ Ver tiempos:                  grep -n 'Duración\|tiempo' logs/*.log"

echo ""
log_info "🏁 Prueba de optimización completada"

# Resultado final basado en éxito
# Asegurar que las variables tengan valores por defecto
SUCCESS_RATE=${SUCCESS_RATE:-0}
IMPROVEMENT_FACTOR=${IMPROVEMENT_FACTOR:-0}

if [ "$SUCCESS_RATE" -ge 80 ] 2>/dev/null && [ "$IMPROVEMENT_FACTOR" -ge 2 ] 2>/dev/null; then
    log_info "🎉 PRUEBA EXITOSA: Sistema batch optimizado funcionando correctamente"
    exit 0
elif [ "$SUCCESS_RATE" -ge 50 ] 2>/dev/null; then
    log_warn "⚠️ PRUEBA PARCIAL: Sistema funcionando pero con margen de mejora"
    exit 1
else
    log_error "❌ PRUEBA FALLIDA: Revisar configuración y logs"
    echo "📊 Datos finales: SUCCESS_RATE=$SUCCESS_RATE%, IMPROVEMENT_FACTOR=${IMPROVEMENT_FACTOR}x"
    exit 2
fi
