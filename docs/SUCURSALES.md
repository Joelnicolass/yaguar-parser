# 🏪 Sistema de Parsing de Sucursales - Documentación

## 📋 Descripción

El sistema ha sido extendido para manejar archivos JSON con estructura de sucursales, permitiendo la lectura, procesamiento y envío directo de productos a WooCommerce desde archivos con el formato específico de Yaguar.

## 🎯 Estructura de Datos Soportada

### Formato JSON de Sucursal
```json
{
  "sucursal_id": 10,
  "nombre_sucursal": "Autopista",
  "productos": [
    {
      "sku": 6,
      "regular_price": 5303.3101,
      "description": "ESPUMA AFEITAR GILLETTE FOAMY REGULAR 312GR",
      "short_description": "ESPU.AFE.GILLETTE FOAMY REGULAR 312GR",
      "meta_data": 12,
      "meta_data_2": "GRM "
    }
  ]
}
```

## 🚀 Nuevas Funcionalidades

### 1. **SucursalService** - Servicio Principal
Ubicación: `src/services/sucursal/sucursal_service.ts`

**Métodos principales:**
- `parseSucursalFile()` - Parsea archivo y opcionalmente envía a WooCommerce
- `getSucursalInfo()` - Obtiene información básica sin procesar
- `getSucursalesFiles()` - Lista archivos disponibles
- `validateProducts()` - Valida productos antes del procesamiento
- `convertToWooCommerceFormat()` - Convierte a formato WooCommerce

### 2. **ParserController** - Controlador Extendido
Ubicación: `src/controllers/parser_controller.ts`

**Nuevos endpoints:**
- `POST /api/parser/parse-sucursal` - Parsear sucursal específica
- `POST /api/parser/parse-default-sucursal` - Parsear sucursal por defecto
- `GET /api/parser/sucursal-info` - Información de sucursal
- `GET /api/parser/sucursales-files` - Listar archivos disponibles

### 3. **WoocommerceController** - Métodos Adicionales
Ubicación: `src/controllers/woocommerce_controller.ts`

**Nuevos métodos públicos:**
- `createSingleProduct()` - Crear producto individual
- `findProductBySku()` - Buscar producto por SKU

## 🌐 API Endpoints Detallados

### **POST /api/parser/parse-sucursal**
Parsea un archivo JSON de sucursal específico.

**Body:**
```json
{
  "filePath": "/ruta/al/archivo.json",  // Opcional, usa default si no se especifica
  "uploadToWoocommerce": true          // Opcional, default: true
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Sucursal parseada y productos enviados a WooCommerce exitosamente",
  "data": {
    "sucursal": {
      "id": 10,
      "nombre": "Autopista"
    },
    "productsCount": 15000,
    "processedProducts": 14950,
    "failedProducts": 50,
    "duration": 45000,
    "woocommerceResults": {
      "uploadedCount": 14950,
      "failedCount": 50,
      "errors": ["Error details..."]
    }
  },
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

### **POST /api/parser/parse-default-sucursal**
Parsea el archivo de sucursal configurado por defecto.

**Body:**
```json
{
  "uploadToWoocommerce": true  // Opcional, default: true
}
```

### **GET /api/parser/sucursal-info**
Obtiene información básica de una sucursal sin procesar productos.

**Query params:**
- `filePath` (opcional) - Ruta del archivo, usa default si no se especifica

**Respuesta:**
```json
{
  "success": true,
  "message": "Información de sucursal obtenida exitosamente",
  "data": {
    "id": 10,
    "nombre": "Autopista",
    "totalProductos": 15000
  },
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

### **GET /api/parser/sucursales-files**
Lista todos los archivos JSON disponibles en el directorio de sucursales.

**Respuesta:**
```json
{
  "success": true,
  "message": "Archivos de sucursales obtenidos exitosamente",
  "data": {
    "totalFiles": 3,
    "files": [
      {
        "fullPath": "/path/to/webprecautopista.json",
        "fileName": "webprecautopista.json",
        "directory": "/path/to/"
      }
    ],
    "defaultFile": "/path/to/webprecautopista.json"
  },
  "timestamp": "2025-08-25T10:30:00.000Z"
}
```

## ⚙️ Configuración

### Variables de Entorno Nuevas
```env
# Directorio de archivos de sucursales
SUCURSALES_DIR=./examples/yaguar precioswebfull

# Archivo por defecto
SUCURSALES_DEFAULT_FILE=./examples/yaguar precioswebfull/webprecautopista.json

# Auto-subida a WooCommerce
AUTO_UPLOAD_WOOCOMMERCE=true

# Tamaño de lote para WooCommerce
WOOCOMMERCE_BATCH_SIZE=10
```

### Estructura de Directorios
```
examples/
└── yaguar precioswebfull/
    ├── webprecautopista.json
    ├── webpreccentro.json
    └── otros_archivos.json
```

## 🔄 Flujo de Procesamiento

1. **Lectura del archivo JSON** - Carga y valida estructura
2. **Validación de productos** - Verifica SKU, precios, descripciones
3. **Conversión de formato** - Transforma a estructura WooCommerce
4. **Procesamiento por lotes** - Envía productos en grupos configurables
5. **Logging detallado** - Registra todo el proceso
6. **Reporte de resultados** - Retorna estadísticas completas

## 🛍️ Conversión a WooCommerce

### Mapeo de Campos
- `sku` → `sku` (string)
- `description` → `name` y `description`
- `short_description` → `short_description`
- `regular_price` → `regular_price` (string)
- `sucursal_id` → `meta_data._sucursal_id`
- `nombre_sucursal` → `categories` y `meta_data._sucursal_nombre`

### Metadatos Adicionales
- `_sucursal_id` - ID de la sucursal
- `_sucursal_nombre` - Nombre de la sucursal
- `_meta_data_original` - Valor original de meta_data
- `_meta_data_2_original` - Valor original de meta_data_2
- `_unidad_medida` - Unidad de medida del producto

## 📊 Ejemplo de Uso Completo

### 1. Verificar archivos disponibles
```bash
curl -X GET http://localhost:3000/api/parser/sucursales-files
```

### 2. Obtener información de sucursal
```bash
curl -X GET "http://localhost:3000/api/parser/sucursal-info?filePath=/path/to/file.json"
```

### 3. Parsear y enviar a WooCommerce
```bash
curl -X POST http://localhost:3000/api/parser/parse-default-sucursal \
  -H "Content-Type: application/json" \
  -d '{"uploadToWoocommerce": true}'
```

### 4. Parsear sin enviar (solo validación)
```bash
curl -X POST http://localhost:3000/api/parser/parse-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "/custom/path/sucursal.json",
    "uploadToWoocommerce": false
  }'
```

## 🔍 Validaciones Implementadas

### Productos
- SKU debe ser numérico y mayor a 0
- Precio debe ser numérico y mayor a 0
- Descripción debe tener al menos 3 caracteres
- Campos requeridos no pueden estar vacíos

### Archivos
- Debe existir en el sistema de archivos
- Debe tener estructura JSON válida
- Debe contener campos obligatorios: `sucursal_id`, `nombre_sucursal`, `productos`

## 🚨 Manejo de Errores

- **Producto inválido**: Se omite y se registra en logs
- **Error de conexión WooCommerce**: Se reintenta y se reporta
- **Archivo no encontrado**: Error inmediato
- **JSON inválido**: Error de parsing
- **Rate limiting**: Pausas automáticas entre lotes

## 📈 Monitoreo y Logs

Todos los procesos se registran detalladamente:
- Inicio y fin de operaciones
- Productos procesados vs fallidos
- Errores específicos por producto
- Tiempos de ejecución
- Estadísticas de WooCommerce

## 🎯 Próximas Mejoras

- [ ] Soporte para múltiples sucursales en un archivo
- [ ] Actualización de productos existentes por comparación
- [ ] Programación automática de sincronización
- [ ] Dashboard web para monitoreo
- [ ] Notificaciones por email/Slack
- [ ] Backup automático antes de actualizaciones masivas
