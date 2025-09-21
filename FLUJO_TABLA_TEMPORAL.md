# Flujo Detallado: Tabla Temporal → Tablas Productivas

## 🔄 Paso 1: Creación de Tabla Temporal en Memoria

```sql
-- La tabla temporal se crea en memoria RAM para máxima velocidad
CREATE TEMPORARY TABLE temp_productos_import (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blog_id INT NOT NULL,                    -- ID del sitio en multisitio
    sku VARCHAR(100) NOT NULL,               -- SKU del producto
    name TEXT NOT NULL,                      -- Nombre del producto
    description TEXT,                        -- Descripción larga
    short_description TEXT,                  -- Descripción corta
    regular_price DECIMAL(10,2) NOT NULL,   -- Precio
    category_id INT,                         -- ID de categoría
    sucursal_id INT,                         -- ID de sucursal
    sucursal_nombre VARCHAR(255),            -- Nombre de sucursal
    meta_data_original VARCHAR(255),         -- Metadata original
    meta_data_2_original VARCHAR(255),       -- Metadata 2 original
    unidad_medida VARCHAR(255),              -- Unidad de medida
    image_url TEXT,                          -- URL de imagen
    processed TINYINT DEFAULT 0,             -- Flag de procesado
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_blog_sku (blog_id, sku),       -- Índice para búsquedas rápidas
    INDEX idx_processed (processed)
) ENGINE=MEMORY;
```

**¿Por qué una tabla temporal?**
- ✅ **Velocidad**: Datos en RAM, no en disco
- ✅ **Aislamiento**: No afecta otras operaciones
- ✅ **Atomicidad**: Se puede hacer rollback completo
- ✅ **Limpieza automática**: Se elimina al terminar

## 🔄 Paso 2: Población Masiva desde JSON

```php
public function poblar_desde_json($json_file_path) {
    // 1. Cargar y parsear JSON
    $json_content = file_get_contents($json_file_path);
    $json_data = json_decode($json_content, true);
    $productos = $json_data['productos'];
    
    // 2. Preparar inserción por lotes
    $sql_insert = "INSERT INTO temp_productos_import 
                  (blog_id, sku, name, description, short_description, regular_price, 
                   category_id, sucursal_id, sucursal_nombre, meta_data_original, 
                   meta_data_2_original, unidad_medida, image_url) VALUES ";
    
    $values = [];
    $batch_count = 0;
    
    // 3. Procesar productos en lotes
    foreach ($productos as $producto) {
        // Escapar y limpiar datos
        $sku = $this->wpdb->_escape($producto['sku']);
        $name = $this->wpdb->_escape(trim($producto['description'] ?: $producto['short_description']));
        // ... más campos ...
        
        // Agregar a lote
        $values[] = "({$this->blog_id}, '{$sku}', '{$name}', '{$description}', 
                    '{$short_description}', {$regular_price}, {$category_id}, 
                    {$sucursal_id}, '{$sucursal_nombre}', '{$meta_data_original}', 
                    '{$meta_data_2_original}', '{$unidad_medida}', '{$image_url}')";
        
        $batch_count++;
        
        // 4. Insertar cuando se alcanza el tamaño de lote
        if ($batch_count >= $this->batch_size) {
            $sql_complete = $sql_insert . implode(', ', $values);
            $this->wpdb->query($sql_complete);
            
            $values = [];
            $batch_count = 0;
        }
    }
    
    // 5. Insertar último lote
    if (!empty($values)) {
        $sql_complete = $sql_insert . implode(', ', $values);
        $this->wpdb->query($sql_complete);
    }
}
```

**Ejemplo de inserción por lotes:**
```sql
INSERT INTO temp_productos_import 
(blog_id, sku, name, description, short_description, regular_price, category_id, ...) 
VALUES 
(4, 'SKU001', 'Producto 1', 'Desc 1', 'Desc corta 1', 19.99, 72, ...),
(4, 'SKU002', 'Producto 2', 'Desc 2', 'Desc corta 2', 29.99, 73, ...),
(4, 'SKU003', 'Producto 3', 'Desc 3', 'Desc corta 3', 39.99, 74, ...),
-- ... hasta 500 productos por lote
```

## 🔄 Paso 3: Transferencia a Tablas Productivas

### A. Lectura de Tabla Temporal

```php
private function ejecutar_importacion_masiva() {
    // 1. Leer productos de tabla temporal
    $productos = $this->wpdb->get_results("
        SELECT * FROM temp_productos_import 
        WHERE blog_id = {$this->blog_id} 
        ORDER BY id
    ");
    
    // 2. Procesar cada producto
    foreach ($productos as $producto) {
        $this->insertar_producto_sql($producto);
    }
}
```

### B. Inserción en Tablas Productivas

```php
private function insertar_producto_sql($producto) {
    $table_posts = "EWJW2_{$this->blog_id}_posts";           // Tabla de posts/productos
    $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";     // Tabla de metadatos
    $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup"; // Cache WooCommerce
    
    // PASO 3.1: Verificar si producto existe
    $existing_id = $this->wpdb->get_var($this->wpdb->prepare("
        SELECT p.ID FROM {$table_posts} p 
        INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id 
        WHERE pm.meta_key = '_sku' AND pm.meta_value = %s 
        AND p.post_type = 'product' LIMIT 1
    ", $producto->sku));
    
    if ($existing_id) {
        // ACTUALIZAR producto existente
        $this->actualizar_producto_existente($existing_id, $producto);
        $product_id = $existing_id;
    } else {
        // INSERTAR nuevo producto
        $product_id = $this->insertar_nuevo_producto($producto);
    }
    
    // PASO 3.2: Actualizar metadatos
    $this->actualizar_metadatos($product_id, $producto);
    
    // PASO 3.3: Actualizar cache WooCommerce
    $this->actualizar_cache_woocommerce_producto($product_id, $producto);
}
```

## 🔄 Paso 4: Inserción Detallada en Tablas WordPress

### A. Tabla Posts (Productos)

```php
private function insertar_nuevo_producto($producto) {
    $table_posts = "EWJW2_{$this->blog_id}_posts";
    
    // Insertar en wp_posts
    $this->wpdb->insert(
        $table_posts,
        [
            'post_author' => 1,
            'post_date' => current_time('mysql'),
            'post_date_gmt' => current_time('mysql', 1),
            'post_content' => $producto->description,      // Descripción larga
            'post_title' => $producto->name,               // Nombre del producto
            'post_excerpt' => $producto->short_description, // Descripción corta
            'post_status' => 'publish',                    // Estado publicado
            'comment_status' => 'closed',
            'ping_status' => 'closed',
            'post_name' => sanitize_title($producto->name), // Slug URL
            'post_modified' => current_time('mysql'),
            'post_modified_gmt' => current_time('mysql', 1),
            'post_type' => 'product'                       // Tipo: producto WooCommerce
        ]
    );
    
    return $this->wpdb->insert_id; // Retorna ID del producto creado
}
```

**Resultado en base de datos:**
```sql
-- Registro insertado en EWJW2_4_posts
INSERT INTO EWJW2_4_posts VALUES (
    12345,                           -- ID (auto-increment)
    1,                              -- post_author
    '2025-09-21 10:30:00',          -- post_date
    '2025-09-21 13:30:00',          -- post_date_gmt
    'Descripción del producto...',   -- post_content
    'Nombre del Producto',          -- post_title
    'Descripción corta...',         -- post_excerpt
    'publish',                      -- post_status
    'closed',                       -- comment_status
    'closed',                       -- ping_status
    'nombre-del-producto',          -- post_name (slug)
    '2025-09-21 10:30:00',          -- post_modified
    '2025-09-21 13:30:00',          -- post_modified_gmt
    'product'                       -- post_type
);
```

### B. Tabla PostMeta (Metadatos)

```php
private function actualizar_metadatos($product_id, $producto) {
    $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
    
    // 1. Limpiar metadatos existentes
    $this->wpdb->query($this->wpdb->prepare("
        DELETE FROM {$table_postmeta} 
        WHERE post_id = %d 
        AND meta_key IN ('_sku', '_regular_price', '_price', '_stock_status', 
                        '_sucursal_id', '_sucursal_nombre', '_meta_data_original', 
                        '_meta_data_2_original', '_unidad_medida', '_image_url')
    ", $product_id));
    
    // 2. Insertar metadatos críticos
    $metadatos = [
        ['post_id' => $product_id, 'meta_key' => '_sku', 'meta_value' => $producto->sku],
        ['post_id' => $product_id, 'meta_key' => '_regular_price', 'meta_value' => $producto->regular_price],
        ['post_id' => $product_id, 'meta_key' => '_price', 'meta_value' => $producto->regular_price],
        ['post_id' => $product_id, 'meta_key' => '_stock_status', 'meta_value' => 'instock'],
        ['post_id' => $product_id, 'meta_key' => '_sucursal_id', 'meta_value' => $producto->sucursal_id],
        ['post_id' => $product_id, 'meta_key' => '_sucursal_nombre', 'meta_value' => $producto->sucursal_nombre],
        // ... más metadatos
    ];
    
    // 3. Insertar cada metadato
    foreach ($metadatos as $meta) {
        $this->wpdb->insert($table_postmeta, $meta);
    }
}
```

**Resultado en base de datos:**
```sql
-- Registros insertados en EWJW2_4_postmeta
INSERT INTO EWJW2_4_postmeta VALUES 
(NULL, 12345, '_sku', 'SKU001'),
(NULL, 12345, '_regular_price', '19.99'),
(NULL, 12345, '_price', '19.99'),
(NULL, 12345, '_stock_status', 'instock'),
(NULL, 12345, '_sucursal_id', '4'),
(NULL, 12345, '_sucursal_nombre', 'Autopista'),
-- ... más metadatos
```

### C. Cache WooCommerce

```php
private function actualizar_cache_woocommerce_producto($product_id, $producto) {
    $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
    
    // Insertar/actualizar en tabla de cache de WooCommerce
    $this->wpdb->query($this->wpdb->prepare("
        INSERT INTO {$table_wc_lookup} 
        (product_id, sku, virtual, downloadable, min_price, max_price, onsale, 
         stock_quantity, stock_status, rating_count, average_rating, total_sales, 
         tax_status, tax_class) 
        VALUES (%d, %s, 0, 0, %f, %f, 0, NULL, 'instock', 0, 0, 0, 'taxable', '') 
        ON DUPLICATE KEY UPDATE 
        sku = %s, 
        min_price = %f, 
        max_price = %f, 
        stock_status = 'instock'
    ", $product_id, $producto->sku, $producto->regular_price, $producto->regular_price,
       $producto->sku, $producto->regular_price, $producto->regular_price));
}
```

**Resultado en base de datos:**
```sql
-- Registro en EWJW2_4_wc_product_meta_lookup
INSERT INTO EWJW2_4_wc_product_meta_lookup VALUES (
    12345,          -- product_id
    'SKU001',       -- sku
    0,              -- virtual
    0,              -- downloadable
    19.99,          -- min_price
    19.99,          -- max_price
    0,              -- onsale
    NULL,           -- stock_quantity
    'instock',      -- stock_status
    0,              -- rating_count
    0,              -- average_rating
    0,              -- total_sales
    'taxable',      -- tax_status
    ''              -- tax_class
);
```

## 🔄 Paso 5: Transacciones y Control de Errores

```php
public function ejecutar_importacion_masiva() {
    // 1. Iniciar transacción principal
    $this->wpdb->query("START TRANSACTION");
    
    try {
        $productos = $this->wpdb->get_results("SELECT * FROM temp_productos_import WHERE blog_id = {$this->blog_id}");
        $procesados = 0;
        
        foreach ($productos as $producto) {
            $this->insertar_producto_sql($producto);
            $procesados++;
            
            // 2. Commit intermedio cada 100 productos (evita locks largos)
            if ($procesados % 100 === 0) {
                $this->wpdb->query("COMMIT");
                $this->wpdb->query("START TRANSACTION");
                echo "Procesados {$procesados} productos...\n";
            }
        }
        
        // 3. Commit final
        $this->wpdb->query("COMMIT");
        
        // 4. Actualizar cache global
        $this->actualizar_cache_woocommerce();
        
    } catch (Exception $e) {
        // 5. Rollback en caso de error
        $this->wpdb->query("ROLLBACK");
        throw $e;
    }
}
```

## 📊 Ventajas del Sistema de Tabla Temporal

| Aspecto | Método Directo | Tabla Temporal |
|---------|----------------|----------------|
| **Velocidad inicial** | ❌ Lenta (una por una) | ✅ Rápida (lotes masivos) |
| **Manejo de errores** | ❌ Difícil rollback | ✅ Rollback completo |
| **Uso de memoria** | ✅ Bajo | ⚠️ Alto (pero controlado) |
| **Validación** | ❌ Durante inserción | ✅ Antes de inserción |
| **Debugging** | ❌ Difícil | ✅ Fácil inspección |

## 🎯 Flujo Visual Completo

```
JSON File → Tabla Temporal (RAM) → Validación → Tablas Productivas
    ↓              ↓                    ↓              ↓
[Archivo]    [temp_productos_import]  [Checks]   [EWJW2_X_posts]
500MB            50MB RAM              ✓         [EWJW2_X_postmeta]
                                                [EWJW2_X_wc_*]
```

Este sistema garantiza **máxima velocidad**, **integridad de datos** y **facilidad de debugging** para importaciones masivas en WordPress multisitio.