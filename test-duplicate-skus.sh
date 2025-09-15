#!/bin/bash

# 🧪 Script de prueba para SKUs duplicados y errores de imagen
# Este script prueba el manejo automático de productos con SKUs duplicados y errores de imagen

echo "🧪 Iniciando prueba de manejo de SKUs duplicados y errores de imagen..."
echo "===================================================================="

# Verificar que el servidor esté corriendo
if ! curl -s http://localhost:3000/api/health > /dev/null; then
    echo "❌ Error: El servidor no está corriendo en puerto 3000"
    echo "💡 Ejecuta: npm run dev"
    exit 1
fi

echo "✅ Servidor detectado en puerto 3000"
echo ""

# Primera ejecución - Crear productos
echo "📤 Primera ejecución: Creando productos..."
RESULT1=$(curl -s -X POST http://localhost:3000/api/parser/parse-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./examples/yaguar precioswebfull/webprecautopista.json",
    "uploadToWoocommerce": true
  }')

echo "📥 Resultado primera ejecución:"
echo "$RESULT1" | jq '.'
echo ""

# Segunda ejecución - Actualizar productos (SKUs duplicados)
echo "📤 Segunda ejecución: Actualizando productos (SKUs duplicados)..."
RESULT2=$(curl -s -X POST http://localhost:3000/api/parser/parse-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./examples/yaguar precioswebfull/webprecautopista.json",
    "uploadToWoocommerce": true
  }')

echo "📥 Resultado segunda ejecución:"
echo "$RESULT2" | jq '.'
echo ""

# Analizar resultados
echo "🔍 Análisis de resultados:"
echo "========================="

# Extraer estadísticas de la segunda ejecución
UPDATED=$(echo "$RESULT2" | jq -r '.data.woocommerceResults.updatedCount // 0')
CREATED=$(echo "$RESULT2" | jq -r '.data.woocommerceResults.createdCount // 0')
FAILED=$(echo "$RESULT2" | jq -r '.data.woocommerceResults.failedCount // 0')

if [ "$UPDATED" -gt 0 ]; then
    echo "✅ Productos actualizados correctamente: $UPDATED"
    echo "✅ Manejo de SKUs duplicados: FUNCIONANDO"
else
    echo "❌ No se detectaron productos actualizados"
    echo "❌ Manejo de SKUs duplicados: FALLO"
fi

if [ "$FAILED" -eq 0 ]; then
    echo "✅ Sin productos fallidos: $FAILED"
    echo "✅ Tolerancia a errores: FUNCIONANDO"
else
    echo "❌ Productos fallidos detectados: $FAILED"
    echo "❌ Tolerancia a errores: REVISIÓN NECESARIA"
fi

echo ""
echo "📊 Resumen:"
echo "  - Productos creados: $CREATED"
echo "  - Productos actualizados: $UPDATED"  
echo "  - Productos fallidos: $FAILED"
echo ""

# Verificar logs
echo "📝 Verificando logs recientes:"
echo "=============================="

LOG_FILE=$(ls -t logs/yaguar-sync-*.log | head -1)
if [ -f "$LOG_FILE" ]; then
    echo "📄 Archivo de log: $LOG_FILE"
    echo ""
    
    echo "🔍 SKUs duplicados detectados:"
    grep "ya existe, intentando actualizar" "$LOG_FILE" | tail -3
    echo ""
    
    echo "🔄 Productos actualizados:"
    grep "Producto actualizado exitosamente" "$LOG_FILE" | tail -3
    echo ""
    
    echo "📊 Resumen de carga:"
    grep "Resumen de carga" "$LOG_FILE" | tail -1
else
    echo "❌ No se encontraron archivos de log"
fi

echo ""
echo "🎯 Prueba completada!"
echo "====================="
