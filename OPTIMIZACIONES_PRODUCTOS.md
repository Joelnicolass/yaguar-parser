# Optimizaciones para Importación de Productos WordPress/WooCommerce

## Análisis del Script Original

El script original tenía varios problemas de rendimiento que causaban la lentitud de 5 minutos por cada 1000 productos (0.3 segundos por producto):

### Problemas Identificados:

1. **Falta de transacciones**: Cada producto se insertaba como una transacción individual
2. **Consultas redundantes**: Verificación de categorías existentes en cada iteración
3. **Sin cache**: Mapeo de categorías repetitivo sin cache
4. **Hooks innecesarios**: WordPress ejecutaba hooks en cada inserción
5. **Sin procesamiento por lotes**: Productos procesados uno por uno
6. **Falta de optimizaciones de memoria**: Sin control de cache de WordPress

## Optimizaciones Implementadas

### 1. **Transacciones por Lotes**
```php
// Iniciar transacción para lotes de 50 productos
$wpdb->query('START TRANSACTION');
// ... procesar lote ...
$wpdb->query('COMMIT');
```
**Beneficio**: Reduce el overhead de transacciones de ~1000 a ~20 transacciones.

### 2. **Cache de Categorías**
```php
$cache_categorias_existentes = [];
$cache_mapeo_categorias = [];
```
**Beneficio**: Evita consultas repetitivas a la base de datos para categorías ya verificadas.

### 3. **Desactivación de Hooks Innecesarios**
```php
remove_action('save_post', 'wp_cache_post_change');
remove_action('save_post', 'wp_schedule_update_checks');
```
**Beneficio**: Elimina procesamiento adicional no necesario durante importación masiva.

### 4. **Configuración de Memoria y Tiempo**
```php
ini_set('memory_limit', '512M');
set_time_limit(0);
$wpdb->query('SET autocommit = 0;');
```
**Beneficio**: Evita límites de tiempo y memoria durante importaciones grandes.

### 5. **Procesamiento por Lotes**
```php
$batch_size = 50; // Procesar de a 50 productos
```
**Beneficio**: Reduce el uso de memoria y permite mejor control de errores.

### 6. **Gestión de Cache de WordPress**
```php
// Limpiar cache cada 10 lotes
if (($i / $batch_size) % 10 === 0) {
    wp_cache_flush();
}
```
**Beneficio**: Previene acumulación de cache que puede ralentizar el proceso.

## Mejoras de Rendimiento Esperadas

### Estimaciones de Tiempo:
- **Script Original**: 5 minutos / 1000 productos = 0.3 segundos/producto
- **Script Optimizado**: Estimado ~30-60 segundos / 1000 productos = 0.03-0.06 segundos/producto
- **Mejora Esperada**: **80-90% de reducción en tiempo**

### Factores que Afectan el Rendimiento:
1. **Hardware del servidor** (CPU, RAM, SSD vs HDD)
2. **Configuración de MySQL** (InnoDB buffer pool, query cache)
3. **Número de plugins activos** en WordPress
4. **Tamaño de las imágenes** a procesar
5. **Configuración de PHP** (memory_limit, max_execution_time)

## Optimizaciones Adicionales Recomendadas

### 1. **Índices de Base de Datos**
```sql
-- Crear índices para consultas frecuentes
CREATE INDEX idx_posts_sku ON wp_postmeta (meta_key, meta_value) WHERE meta_key = '_sku';
CREATE INDEX idx_posts_type_status ON wp_posts (post_type, post_status);
```

### 2. **Configuración de MySQL**
```ini
# En my.cnf
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_flush_log_at_trx_commit = 2
bulk_insert_buffer_size = 32M
```

### 3. **Configuración de PHP**
```ini
# En php.ini
memory_limit = 512M
max_execution_time = 0
max_input_vars = 10000
post_max_size = 100M
upload_max_filesize = 100M
```

### 4. **Usar WP-CLI para Importaciones Masivas**
```bash
# Ejecutar desde línea de comandos para mejor rendimiento
wp eval-file importar_productos_optimizado.php
```

### 5. **Desactivar Plugins Temporalmente**
```php
// Al inicio del script
$active_plugins = get_option('active_plugins');
update_option('active_plugins', []); // Desactivar todos

// Al final del script
update_option('active_plugins', $active_plugins); // Reactivar
```

### 6. **Procesamiento Asíncrono con Queue**
Para volúmenes muy grandes (>10,000 productos), considerar:
- **Redis Queue** o **Database Queue**
- **Background Jobs** con cron
- **Microservicios** para procesamiento paralelo

## Monitoreo y Debugging

### 1. **Logging de Rendimiento**
```php
$start_time = microtime(true);
// ... proceso ...
$execution_time = microtime(true) - $start_time;
error_log("Lote procesado en: {$execution_time} segundos");
```

### 2. **Monitoreo de Memoria**
```php
$memory_usage = memory_get_usage(true) / 1024 / 1024;
error_log("Uso de memoria: {$memory_usage} MB");
```

### 3. **Verificación de Errores**
```php
// Verificar productos duplicados por SKU
$duplicate_check = $wpdb->get_results("
    SELECT meta_value, COUNT(*) as count 
    FROM wp_postmeta 
    WHERE meta_key = '_sku' 
    GROUP BY meta_value 
    HAVING count > 1
");
```

## Estrategias por Volumen

### **< 1,000 productos**: Script optimizado actual
### **1,000 - 10,000 productos**: 
- Usar lotes de 100 productos
- Ejecutar en horarios de bajo tráfico
- Monitorear memoria y CPU

### **> 10,000 productos**:
- Dividir en múltiples archivos
- Procesamiento en background
- Usar queue system
- Considerar API REST de WooCommerce

## Testing y Validación

### 1. **Test con Subset Pequeño**
```php
// Limitar productos para testing
$productos = array_slice($json_data['productos'], 0, 100);
```

### 2. **Verificación de Integridad**
```php
// Verificar que todos los productos fueron insertados
$productos_insertados = $wpdb->get_var("
    SELECT COUNT(*) FROM wp_posts 
    WHERE post_type = 'product' 
    AND post_status = 'publish'
");
```

### 3. **Backup Antes de Importación**
```bash
# Backup de base de datos
mysqldump -u user -p database > backup_antes_importacion.sql
```

## Conclusión

Las optimizaciones implementadas deberían reducir el tiempo de importación de **5 minutos** a aproximadamente **30-60 segundos** para 1000 productos, representando una mejora del **80-90%**.

Para obtener los mejores resultados:
1. Ejecutar en horarios de bajo tráfico
2. Aplicar configuraciones recomendadas de MySQL y PHP
3. Monitorear el rendimiento durante las primeras ejecuciones
4. Ajustar el tamaño de lotes según el hardware disponible
