# 🧪 Comandos de Prueba - Sistema de Sucursales

## 📋 Testing Rápido de Funcionalidades

### 1. **Listar archivos de sucursales disponibles**
```bash
curl -X GET http://localhost:3000/api/parser/sucursales-files \
  -H "Content-Type: application/json"
```

### 2. **Obtener información de la sucursal por defecto**
```bash
curl -X GET http://localhost:3000/api/parser/sucursal-info \
  -H "Content-Type: application/json"
```

### 3. **Obtener información de sucursal específica**
```bash
curl -X GET "http://localhost:3000/api/parser/sucursal-info?filePath=./examples/yaguar%20precioswebfull/webprecautopista.json" \
  -H "Content-Type: application/json"
```

### 4. **Parsear sucursal por defecto Y enviar a WooCommerce**
```bash
curl -X POST http://localhost:3000/api/parser/parse-default-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "uploadToWoocommerce": true
  }' \
  -w "\n\nStatus Code: %{http_code}\nTime: %{time_total}s\n"
```

### 5. **Parsear sucursal por defecto SIN enviar a WooCommerce (solo validación)**
```bash
curl -X POST http://localhost:3000/api/parser/parse-default-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "uploadToWoocommerce": false
  }'
```

### 6. **Parsear archivo específico de sucursal**
```bash
curl -X POST http://localhost:3000/api/parser/parse-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./examples/yaguar precioswebfull/webprecautopista.json",
    "uploadToWoocommerce": true
  }'
```

### 7. **Probar conexión con WooCommerce antes de procesar**
```bash
curl -X GET http://localhost:3000/api/woocommerce/test-connection \
  -H "Content-Type: application/json"
```

## 🔄 Flujo de Testing Completo

### **Paso 1: Verificar configuración**
```bash
# Verificar que el servicio está funcionando
curl -X GET http://localhost:3000/api/health

# Verificar configuración del parser
curl -X GET http://localhost:3000/api/parser/config
```

### **Paso 2: Explorar archivos disponibles**
```bash
# Listar archivos de sucursales
curl -X GET http://localhost:3000/api/parser/sucursales-files

# Ver información de la sucursal por defecto
curl -X GET http://localhost:3000/api/parser/sucursal-info
```

### **Paso 3: Probar conexión WooCommerce**
```bash
# Verificar que WooCommerce esté configurado correctamente
curl -X GET http://localhost:3000/api/woocommerce/test-connection
```

### **Paso 4: Testing sin subida (validación)**
```bash
# Parsear sin enviar a WooCommerce para verificar datos
curl -X POST http://localhost:3000/api/parser/parse-default-sucursal \
  -H "Content-Type: application/json" \
  -d '{"uploadToWoocommerce": false}'
```

### **Paso 5: Carga real a WooCommerce**
```bash
# Si todo está OK, procesar y enviar a WooCommerce
curl -X POST http://localhost:3000/api/parser/parse-default-sucursal \
  -H "Content-Type: application/json" \
  -d '{"uploadToWoocommerce": true}'
```

## 📊 Respuestas Esperadas

### **✅ Información de sucursal exitosa:**
```json
{
  "success": true,
  "message": "Información de sucursal obtenida exitosamente",
  "data": {
    "id": 10,
    "nombre": "Autopista",
    "totalProductos": 73885
  },
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

### **✅ Parsing exitoso CON subida:**
```json
{
  "success": true,
  "message": "Sucursal parseada y productos enviados a WooCommerce exitosamente",
  "data": {
    "sucursal": {
      "id": 10,
      "nombre": "Autopista"
    },
    "productsCount": 73885,
    "processedProducts": 73800,
    "failedProducts": 85,
    "duration": 245000,
    "woocommerceResults": {
      "uploadedCount": 73800,
      "failedCount": 85,
      "errors": ["Error details for failed products..."]
    },
    "sourceFile": "./examples/yaguar precioswebfull/webprecautopista.json"
  },
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

### **✅ Parsing exitoso SIN subida (solo validación):**
```json
{
  "success": true,
  "message": "Sucursal parseada exitosamente",
  "data": {
    "sucursal": {
      "id": 10,
      "nombre": "Autopista"
    },
    "productsCount": 73885,
    "processedProducts": 73800,
    "failedProducts": 85,
    "duration": 2500,
    "woocommerceResults": null
  },
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

### **❌ Error de archivo no encontrado:**
```json
{
  "success": false,
  "error": "Error al parsear archivo de sucursal",
  "message": "Archivo de sucursal no encontrado: /ruta/incorrecta.json",
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

### **❌ Error de WooCommerce:**
```json
{
  "success": false,
  "error": "No se pudo inicializar el controlador de WooCommerce"
}
```

## ⚙️ Variables de Entorno para Testing

Crear archivo `.env` con:
```env
# Servidor
PORT=3000
NODE_ENV=development

# WooCommerce (configurar con tus datos reales)
WOOCOMMERCE_URL=https://tu-tienda.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxx

# Sucursales
SUCURSALES_DIR=./examples/yaguar precioswebfull
SUCURSALES_DEFAULT_FILE=./examples/yaguar precioswebfull/webprecautopista.json
AUTO_UPLOAD_WOOCOMMERCE=true
WOOCOMMERCE_BATCH_SIZE=10
```

## 🚨 Consideraciones Importantes

1. **El archivo de ejemplo tiene ~73,885 productos**, el procesamiento puede tomar varios minutos
2. **Usar lotes pequeños** durante testing (`WOOCOMMERCE_BATCH_SIZE=5`)
3. **Probar primero sin subida** (`uploadToWoocommerce: false`)
4. **Verificar logs** en `./logs/` para debugging
5. **Tener backup de WooCommerce** antes de cargas masivas

## 🔧 Debugging

### Ver logs en tiempo real:
```bash
tail -f logs/yaguar-sync-$(date +%Y-%m-%d).log
```

### Ver solo errores:
```bash
tail -f logs/error-$(date +%Y-%m-%d).log
```

### Verificar estado del servicio:
```bash
curl -X GET http://localhost:3000/api/health/info
```
