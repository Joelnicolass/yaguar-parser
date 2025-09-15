# 🖼️ Sistema de Imágenes para Productos - Documentación

## 📋 Descripción

Se ha implementado el soporte automático de imágenes para productos de sucursales. Cada producto ahora incluye automáticamente una imagen basada en su SKU que apunta al servidor de imágenes de Yaguar.

## 🎯 Estructura de Imagen Generada

Para cada producto procesado, se genera automáticamente un objeto `images` con la siguiente estructura:

```json
{
  "images": [
    {
      "id": 1,                    // SKU del producto como ID
      "date_created": "2025-08-25T10:30:00.000Z",
      "date_created_gmt": "2025-08-25T10:30:00.000Z", 
      "date_modified": "2025-08-25T10:30:00.000Z",
      "date_modified_gmt": "2025-08-25T10:30:00.000Z",
      "src": "https://shop.yaguar.com.ar/common/img/Productos/1/250x250.jpg",
      "name": "PRODUCTO PRUEBA 1",
      "alt": "PRODUCTO PRUEBA 1"
    }
  ]
}
```

## 🔗 URL de Imágenes

### Patrón de URL
```
https://shop.yaguar.com.ar/common/img/Productos/{SKU}/250x250.jpg
```

### Ejemplos por SKU:
- **SKU: 1** → `https://shop.yaguar.com.ar/common/img/Productos/1/250x250.jpg`
- **SKU: 2** → `https://shop.yaguar.com.ar/common/img/Productos/2/250x250.jpg`
- **SKU: 123** → `https://shop.yaguar.com.ar/common/img/Productos/123/250x250.jpg`

## 📊 Ejemplo Completo de Producto con Imagen

### Entrada JSON (sucursal):
```json
{
  "sku": 1,
  "regular_price": 100.50,
  "description": "PRODUCTO DE PRUEBA NUMERO 1 - DESCRIPCION COMPLETA",
  "short_description": "PRODUCTO PRUEBA 1",
  "meta_data": 12,
  "meta_data_2": "UNI"
}
```

### Salida WooCommerce (generada automáticamente):
```json
{
  "sku": "1",
  "name": "PRODUCTO PRUEBA 1",
  "regular_price": "100.50",
  "description": "PRODUCTO DE PRUEBA NUMERO 1 - DESCRIPCION COMPLETA",
  "short_description": "PRODUCTO PRUEBA 1",
  "categories": [{"name": "Sucursal Autopista"}],
  "type": "simple",
  "status": "publish",
  "manage_stock": true,
  "stock_status": "instock",
  "images": [
    {
      "id": 1,
      "date_created": "2025-08-25T14:30:00.000Z",
      "date_created_gmt": "2025-08-25T14:30:00.000Z",
      "date_modified": "2025-08-25T14:30:00.000Z", 
      "date_modified_gmt": "2025-08-25T14:30:00.000Z",
      "src": "https://shop.yaguar.com.ar/common/img/Productos/1/250x250.jpg",
      "name": "PRODUCTO PRUEBA 1",
      "alt": "PRODUCTO PRUEBA 1"
    }
  ],
  "meta_data": [
    {"key": "_sucursal_id", "value": 10},
    {"key": "_sucursal_nombre", "value": "Autopista"},
    {"key": "_meta_data_original", "value": 12},
    {"key": "_meta_data_2_original", "value": "UNI"},
    {"key": "_unidad_medida", "value": "UNI"},
    {"key": "_image_url", "value": "https://shop.yaguar.com.ar/common/img/Productos/1/250x250.jpg"}
  ]
}
```

## 🔧 Características Implementadas

### ✅ **Generación Automática**
- Las imágenes se generan automáticamente para cada producto
- No requiere configuración adicional
- Usa el SKU del producto como identificador único

### ✅ **Timestamps Dinámicos**
- `date_created`, `date_modified`: Fecha actual en formato ISO
- Se actualizan automáticamente en cada procesamiento

### ✅ **Metadatos Adicionales**
- La URL de imagen también se guarda en `meta_data` como `_image_url`
- Facilita consultas y referencias posteriores

### ✅ **Compatibilidad WooCommerce**
- Formato completamente compatible con la API de WooCommerce
- Estructura estándar de imágenes de productos

## 🧪 Prueba de Funcionamiento

### Comando de prueba:
```bash
curl -X POST http://localhost:3000/api/parser/parse-sucursal \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "./examples/test_sucursal.json",
    "uploadToWoocommerce": false
  }'
```

### Respuesta esperada (extracto):
```json
{
  "success": true,
  "message": "Sucursal parseada exitosamente",
  "data": {
    "sucursal": {"id": 10, "nombre": "Autopista - Prueba"},
    "productsCount": 3,
    "processedProducts": 3,
    "failedProducts": 0
  }
}
```

## 🔍 Verificación en WooCommerce

Cuando los productos se suban a WooCommerce, cada uno tendrá:

1. **Imagen principal** configurada automáticamente
2. **URL de imagen** accesible desde metadatos  
3. **Alt text** igual al nombre del producto
4. **Timestamps** de creación y modificación

## 📝 Logs y Debugging

El sistema registra la generación de imágenes:

```
🛍️ Creando producto individual en WooCommerce: PRODUCTO PRUEBA 1 (SKU: 1)
🖼️ Imagen generada: https://shop.yaguar.com.ar/common/img/Productos/1/250x250.jpg
✅ Producto creado exitosamente: PRODUCTO PRUEBA 1 (ID: 123)
```

## 🎯 Ventajas del Sistema

- **Consistencia**: Todas las imágenes siguen el mismo patrón
- **Escalabilidad**: Funciona para cualquier cantidad de productos
- **Mantenimiento**: No requiere gestión manual de imágenes
- **Performance**: URLs optimizadas para carga rápida (250x250px)
- **SEO**: Alt text automático para mejor indexación

## 🔧 Personalización Futura

El sistema está preparado para futuras mejoras:

- [ ] Múltiples tamaños de imagen (thumbnails, medium, large)
- [ ] Imágenes de galería adicionales
- [ ] Validación de existencia de imagen
- [ ] Fallback a imagen por defecto
- [ ] Compresión y optimización automática
