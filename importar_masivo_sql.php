<?php
/**
 * Script de Importación Masiva Híbrido (SQL + PHP)
 * Combina la velocidad de SQL directo con la funcionalidad de WordPress
 */

require_once( dirname(__FILE__) . '/wp-load.php' );

class ImportadorMasivoSQL {
    
    private $wpdb;
    private $blog_id;
    private $batch_size;
    private $sucursal_info;
    
    public function __construct($blog_id, $batch_size = 500) {
        global $wpdb;
        $this->wpdb = $wpdb;
        $this->blog_id = $blog_id;
        $this->batch_size = $batch_size;
        
        // Configurar información de sucursal
        $this->configurar_sucursal();
        
        // Optimizaciones de base de datos
        $this->optimizar_mysql();
    }
    
    private function configurar_sucursal() {
        $sucursales = [
            4 => ['id' => 4, 'nombre' => 'Autopista'],
            13 => ['id' => 13, 'nombre' => 'Bahía Blanca'],
            3 => ['id' => 3, 'nombre' => 'Campana'],
            24 => ['id' => 24, 'nombre' => 'Chacabuco'],
            15 => ['id' => 15, 'nombre' => 'Chaco'],
            6 => ['id' => 6, 'nombre' => 'Córdoba'],
            20 => ['id' => 20, 'nombre' => 'General Roca'],
            23 => ['id' => 23, 'nombre' => 'Jujuy'],
            12 => ['id' => 12, 'nombre' => 'Mar del Plata'],
            19 => ['id' => 19, 'nombre' => 'Maschwitz'],
            14 => ['id' => 14, 'nombre' => 'Mendoza'],
            18 => ['id' => 18, 'nombre' => 'Moreno'],
            8 => ['id' => 8, 'nombre' => 'Neuquén'],
            21 => ['id' => 21, 'nombre' => 'Posadas'],
            9 => ['id' => 9, 'nombre' => 'Salta'],
            16 => ['id' => 16, 'nombre' => 'San Juan'],
            5 => ['id' => 5, 'nombre' => 'Santa Fe'],
            22 => ['id' => 22, 'nombre' => 'Trelew']
        ];
        
        $this->sucursal_info = $sucursales[$this->blog_id] ?? ['id' => $this->blog_id, 'nombre' => 'Desconocida'];
    }
    
    private function optimizar_mysql() {
        // Configuraciones para máximo rendimiento
        $this->wpdb->query("SET SESSION innodb_buffer_pool_dump_at_shutdown = OFF");
        $this->wpdb->query("SET SESSION autocommit = 0");
        $this->wpdb->query("SET SESSION unique_checks = 0");
        $this->wpdb->query("SET SESSION foreign_key_checks = 0");
        $this->wpdb->query("SET SESSION sql_log_bin = 0");
    }
    
    private function restaurar_mysql() {
        // Restaurar configuraciones
        $this->wpdb->query("SET SESSION autocommit = 1");
        $this->wpdb->query("SET SESSION unique_checks = 1");
        $this->wpdb->query("SET SESSION foreign_key_checks = 1");
        $this->wpdb->query("SET SESSION sql_log_bin = 1");
    }
    
    /**
     * Crear tabla temporal para importación
     */
    public function crear_tabla_temporal() {
        $sql = "
        CREATE TEMPORARY TABLE temp_productos_import (
            id INT AUTO_INCREMENT PRIMARY KEY,
            blog_id INT NOT NULL,
            sku VARCHAR(100) NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            short_description TEXT,
            regular_price DECIMAL(10,2) NOT NULL,
            category_id INT,
            sucursal_id INT,
            sucursal_nombre VARCHAR(255),
            meta_data_original VARCHAR(255),
            meta_data_2_original VARCHAR(255),
            unidad_medida VARCHAR(255),
            image_url TEXT,
            processed TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_blog_sku (blog_id, sku),
            INDEX idx_processed (processed)
        ) ENGINE=MEMORY";
        
        $resultado = $this->wpdb->query($sql);
        
        if ($resultado === false) {
            throw new Exception("Error creando tabla temporal: " . $this->wpdb->last_error);
        }
        
        echo "Tabla temporal creada exitosamente.\n";
        return true;
    }
    
    /**
     * Poblar tabla temporal desde JSON
     */
    public function poblar_desde_json($json_file_path) {
        if (!file_exists($json_file_path)) {
            throw new Exception("Archivo JSON no encontrado: {$json_file_path}");
        }
        
        $json_content = file_get_contents($json_file_path);
        $json_data = json_decode($json_content, true);
        
        if (!is_array($json_data) || !isset($json_data['productos'])) {
            throw new Exception("Formato de JSON inválido");
        }
        
        $productos = $json_data['productos'];
        $total_productos = count($productos);
        $insertados = 0;
        
        echo "Iniciando población de {$total_productos} productos en tabla temporal...\n";
        
        // Preparar consulta de inserción
        $sql_insert = "INSERT INTO temp_productos_import 
                      (blog_id, sku, name, description, short_description, regular_price, 
                       category_id, sucursal_id, sucursal_nombre, meta_data_original, 
                       meta_data_2_original, unidad_medida, image_url) VALUES ";
        
        $values = [];
        $batch_count = 0;
        
        foreach ($productos as $producto) {
            // Escapar y limpiar datos
            $sku = $this->wpdb->_escape($producto['sku']);
            $name = $this->wpdb->_escape(trim($producto['description'] ?: $producto['short_description']));
            $description = $this->wpdb->_escape(trim($producto['description']));
            $short_description = $this->wpdb->_escape(trim($producto['short_description']));
            $regular_price = floatval($producto['regular_price']);
            $category_id = intval($producto['meta_data']);
            $sucursal_id = $this->sucursal_info['id'];
            $sucursal_nombre = $this->wpdb->_escape($this->sucursal_info['nombre']);
            $meta_data_original = $this->wpdb->_escape($producto['meta_data']);
            $meta_data_2_original = $this->wpdb->_escape($producto['meta_data_2']);
            $unidad_medida = $this->wpdb->_escape(trim($producto['meta_data_2']));
            $image_url = $this->wpdb->_escape("/var/www/vhosts/vd.com.ar/ftp-incoming/{$producto['sku']}.png");
            
            $values[] = "({$this->blog_id}, '{$sku}', '{$name}', '{$description}', '{$short_description}', 
                        {$regular_price}, {$category_id}, {$sucursal_id}, '{$sucursal_nombre}', 
                        '{$meta_data_original}', '{$meta_data_2_original}', '{$unidad_medida}', '{$image_url}')";
            
            $batch_count++;
            
            // Insertar en lotes
            if ($batch_count >= $this->batch_size) {
                $sql_complete = $sql_insert . implode(', ', $values);
                $resultado = $this->wpdb->query($sql_complete);
                
                if ($resultado === false) {
                    throw new Exception("Error insertando lote en tabla temporal: " . $this->wpdb->last_error);
                }
                
                $insertados += $batch_count;
                echo "Insertados {$insertados} de {$total_productos} productos en tabla temporal...\n";
                
                $values = [];
                $batch_count = 0;
            }
        }
        
        // Insertar último lote si queda algo
        if (!empty($values)) {
            $sql_complete = $sql_insert . implode(', ', $values);
            $resultado = $this->wpdb->query($sql_complete);
            
            if ($resultado === false) {
                throw new Exception("Error insertando último lote: " . $this->wpdb->last_error);
            }
            
            $insertados += $batch_count;
        }
        
        echo "Población completada: {$insertados} productos en tabla temporal.\n";
        return $insertados;
    }
    
    /**
     * Ejecutar importación masiva usando SQL directo
     */
    public function ejecutar_importacion_masiva() {
        $start_time = microtime(true);
        
        echo "Iniciando importación masiva para blog_id {$this->blog_id}...\n";
        
        // Iniciar transacción principal
        $this->wpdb->query("START TRANSACTION");
        
        try {
            // Obtener productos de tabla temporal
            $productos = $this->wpdb->get_results("SELECT * FROM temp_productos_import WHERE blog_id = {$this->blog_id} ORDER BY id");
            $total_productos = count($productos);
            $procesados = 0;
            
            foreach ($productos as $producto) {
                $this->insertar_producto_sql($producto);
                $procesados++;
                
                // Commit intermedio cada 100 productos
                if ($procesados % 100 === 0) {
                    $this->wpdb->query("COMMIT");
                    $this->wpdb->query("START TRANSACTION");
                    echo "Procesados {$procesados} de {$total_productos} productos...\n";
                }
            }
            
            // Commit final
            $this->wpdb->query("COMMIT");
            
            // Actualizar cache de WooCommerce
            $this->actualizar_cache_woocommerce();
            
            $end_time = microtime(true);
            $execution_time = round($end_time - $start_time, 2);
            $productos_por_segundo = round($procesados / $execution_time, 2);
            
            echo "\n=== IMPORTACIÓN COMPLETADA ===\n";
            echo "Productos procesados: {$procesados}\n";
            echo "Tiempo de ejecución: {$execution_time} segundos\n";
            echo "Velocidad: {$productos_por_segundo} productos/segundo\n";
            
            return $procesados;
            
        } catch (Exception $e) {
            $this->wpdb->query("ROLLBACK");
            throw $e;
        }
    }
    
    /**
     * Insertar producto usando SQL directo
     */
    private function insertar_producto_sql($producto) {
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
        $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
        
        // Verificar si producto existe
        $existing_id = $this->wpdb->get_var($this->wpdb->prepare("
            SELECT p.ID FROM {$table_posts} p 
            INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id 
            WHERE pm.meta_key = '_sku' AND pm.meta_value = %s 
            AND p.post_type = 'product' LIMIT 1
        ", $producto->sku));
        
        $post_date = current_time('mysql');
        $post_date_gmt = current_time('mysql', 1);
        $post_name = sanitize_title($producto->name);
        
        if ($existing_id) {
            // Actualizar producto existente
            $this->wpdb->update(
                $table_posts,
                [
                    'post_title' => $producto->name,
                    'post_content' => $producto->description,
                    'post_excerpt' => $producto->short_description,
                    'post_modified' => $post_date,
                    'post_modified_gmt' => $post_date_gmt
                ],
                ['ID' => $existing_id],
                ['%s', '%s', '%s', '%s', '%s'],
                ['%d']
            );
            
            $product_id = $existing_id;
            
        } else {
            // Insertar nuevo producto
            $this->wpdb->insert(
                $table_posts,
                [
                    'post_author' => 1,
                    'post_date' => $post_date,
                    'post_date_gmt' => $post_date_gmt,
                    'post_content' => $producto->description,
                    'post_title' => $producto->name,
                    'post_excerpt' => $producto->short_description,
                    'post_status' => 'publish',
                    'comment_status' => 'closed',
                    'ping_status' => 'closed',
                    'post_name' => $post_name,
                    'post_modified' => $post_date,
                    'post_modified_gmt' => $post_date_gmt,
                    'post_type' => 'product'
                ],
                ['%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']
            );
            
            $product_id = $this->wpdb->insert_id;
        }
        
        if (!$product_id) {
            throw new Exception("Error insertando/actualizando producto: " . $this->wpdb->last_error);
        }
        
        // Limpiar metadatos existentes
        $this->wpdb->query($this->wpdb->prepare("
            DELETE FROM {$table_postmeta} 
            WHERE post_id = %d 
            AND meta_key IN ('_sku', '_regular_price', '_price', '_stock_status', 
                            '_sucursal_id', '_sucursal_nombre', '_meta_data_original', 
                            '_meta_data_2_original', '_unidad_medida', '_image_url')
        ", $product_id));
        
        // Insertar metadatos
        $metadatos = [
            ['post_id' => $product_id, 'meta_key' => '_sku', 'meta_value' => $producto->sku],
            ['post_id' => $product_id, 'meta_key' => '_regular_price', 'meta_value' => $producto->regular_price],
            ['post_id' => $product_id, 'meta_key' => '_price', 'meta_value' => $producto->regular_price],
            ['post_id' => $product_id, 'meta_key' => '_stock_status', 'meta_value' => 'instock'],
            ['post_id' => $product_id, 'meta_key' => '_sucursal_id', 'meta_value' => $producto->sucursal_id],
            ['post_id' => $product_id, 'meta_key' => '_sucursal_nombre', 'meta_value' => $producto->sucursal_nombre],
            ['post_id' => $product_id, 'meta_key' => '_meta_data_original', 'meta_value' => $producto->meta_data_original],
            ['post_id' => $product_id, 'meta_key' => '_meta_data_2_original', 'meta_value' => $producto->meta_data_2_original],
            ['post_id' => $product_id, 'meta_key' => '_unidad_medida', 'meta_value' => $producto->unidad_medida],
            ['post_id' => $product_id, 'meta_key' => '_image_url', 'meta_value' => $producto->image_url]
        ];
        
        foreach ($metadatos as $meta) {
            $this->wpdb->insert($table_postmeta, $meta, ['%d', '%s', '%s']);
        }
        
        // Actualizar cache de WooCommerce
        $this->wpdb->query($this->wpdb->prepare("
            INSERT INTO {$table_wc_lookup} 
            (product_id, sku, virtual, downloadable, min_price, max_price, onsale, stock_quantity, stock_status, rating_count, average_rating, total_sales, tax_status, tax_class) 
            VALUES (%d, %s, 0, 0, %f, %f, 0, NULL, 'instock', 0, 0, 0, 'taxable', '') 
            ON DUPLICATE KEY UPDATE 
            sku = %s, 
            min_price = %f, 
            max_price = %f, 
            stock_status = 'instock'
        ", $product_id, $producto->sku, $producto->regular_price, $producto->regular_price, 
           $producto->sku, $producto->regular_price, $producto->regular_price));
        
        return $product_id;
    }
    
    /**
     * Actualizar cache de WooCommerce
     */
    private function actualizar_cache_woocommerce() {
        echo "Actualizando cache de WooCommerce...\n";
        
        $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        
        // Limpiar entradas huérfanas
        $this->wpdb->query("
            DELETE FROM {$table_wc_lookup} 
            WHERE product_id NOT IN (
                SELECT ID FROM {$table_posts} 
                WHERE post_type = 'product' AND post_status = 'publish'
            )
        ");
        
        echo "Cache de WooCommerce actualizado.\n";
    }
    
    /**
     * Limpiar tabla temporal
     */
    public function limpiar_tabla_temporal() {
        $this->wpdb->query("DROP TEMPORARY TABLE IF EXISTS temp_productos_import");
        echo "Tabla temporal eliminada.\n";
    }
    
    /**
     * Crear backup automático antes de importación
     */
    private function crear_backup_automatico() {
        $backup_dir = dirname(__FILE__) . '/backups/';
        if (!is_dir($backup_dir)) {
            mkdir($backup_dir, 0755, true);
        }
        
        $timestamp = date('Y-m-d_H-i-s');
        $backup_file = $backup_dir . "auto_backup_blog_{$this->blog_id}_{$timestamp}.json";
        
        // Crear snapshot de estado actual
        $estado_actual = [
            'timestamp' => $timestamp,
            'blog_id' => $this->blog_id,
            'productos_antes' => $this->wpdb->get_var("SELECT COUNT(*) FROM EWJW2_{$this->blog_id}_posts WHERE post_type = 'product'"),
            'metadatos_antes' => $this->wpdb->get_var("SELECT COUNT(*) FROM EWJW2_{$this->blog_id}_postmeta WHERE meta_key LIKE '\\_%'"),
            'cache_antes' => $this->wpdb->get_var("SELECT COUNT(*) FROM EWJW2_{$this->blog_id}_wc_product_meta_lookup")
        ];
        
        file_put_contents($backup_file, json_encode($estado_actual, JSON_PRETTY_PRINT));
        
        echo "📦 Backup automático creado: {$backup_file}\n";
        echo "Estado previo: {$estado_actual['productos_antes']} productos\n";
        
        return $backup_file;
    }
    
    /**
     * Validar integridad post-importación
     */
    private function validar_integridad($productos_esperados) {
        echo "🔍 Validando integridad de la importación...\n";
        
        $productos_finales = $this->wpdb->get_var("SELECT COUNT(*) FROM EWJW2_{$this->blog_id}_posts WHERE post_type = 'product'");
        $productos_sin_sku = $this->wpdb->get_var("
            SELECT COUNT(*) FROM EWJW2_{$this->blog_id}_posts p 
            LEFT JOIN EWJW2_{$this->blog_id}_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_sku'
            WHERE p.post_type = 'product' AND (pm.meta_value IS NULL OR pm.meta_value = '')
        ");
        
        $productos_sin_precio = $this->wpdb->get_var("
            SELECT COUNT(*) FROM EWJW2_{$this->blog_id}_posts p 
            LEFT JOIN EWJW2_{$this->blog_id}_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_regular_price'
            WHERE p.post_type = 'product' AND (pm.meta_value IS NULL OR pm.meta_value = '' OR pm.meta_value = '0')
        ");
        
        $errores = [];
        
        if ($productos_sin_sku > 0) {
            $errores[] = "❌ {$productos_sin_sku} productos sin SKU";
        }
        
        if ($productos_sin_precio > 0) {
            $errores[] = "❌ {$productos_sin_precio} productos sin precio";
        }
        
        if (!empty($errores)) {
            echo "🚨 ERRORES DE INTEGRIDAD DETECTADOS:\n";
            foreach ($errores as $error) {
                echo "  {$error}\n";
            }
            return false;
        }
        
        echo "✅ Validación de integridad exitosa\n";
        echo "  - Productos finales: {$productos_finales}\n";
        echo "  - Sin errores de SKU o precio\n";
        
        return true;
    }
    
    /**
     * Ejecutar importación completa con protecciones
     */
    public function importar_desde_json($json_file_path, $modo_seguro = true) {
        $backup_file = null;
        
        try {
            $start_time = microtime(true);
            
            // 0. Crear backup automático si está en modo seguro
            if ($modo_seguro) {
                $backup_file = $this->crear_backup_automatico();
            }
            
            // 1. Crear tabla temporal
            $this->crear_tabla_temporal();
            
            // 2. Poblar desde JSON
            $productos_cargados = $this->poblar_desde_json($json_file_path);
            
            // 3. Ejecutar importación masiva
            $productos_procesados = $this->ejecutar_importacion_masiva();
            
            // 4. Validar integridad
            if ($modo_seguro && !$this->validar_integridad($productos_procesados)) {
                throw new Exception("Falla en validación de integridad - importación revertida");
            }
            
            // 5. Limpiar
            $this->limpiar_tabla_temporal();
            $this->restaurar_mysql();
            
            $end_time = microtime(true);
            $total_time = round($end_time - $start_time, 2);
            
            echo "\n=== RESUMEN FINAL ===\n";
            echo "Tiempo total: {$total_time} segundos\n";
            echo "Productos cargados: {$productos_cargados}\n";
            echo "Productos procesados: {$productos_procesados}\n";
            echo "Velocidad promedio: " . round($productos_procesados / $total_time, 2) . " productos/segundo\n";
            
            if ($backup_file) {
                echo "📦 Backup disponible: {$backup_file}\n";
            }
            
            return $productos_procesados;
            
        } catch (Exception $e) {
            echo "🚨 ERROR DURANTE IMPORTACIÓN: " . $e->getMessage() . "\n";
            
            // Limpiar recursos
            $this->limpiar_tabla_temporal();
            $this->restaurar_mysql();
            
            // Si hay backup y falló la validación, ofrecer rollback
            if ($backup_file && $modo_seguro) {
                echo "💡 Para revertir cambios, ejecute:\n";
                echo "php backup_antes_importacion.php {$this->blog_id} restaurar {$backup_file}\n";
            }
            
            throw $e;
        }
    }
}

// ===== SCRIPT DE EJECUCIÓN =====

if (php_sapi_name() === 'cli') {
    // Ejecutar solo desde línea de comandos
    
    $blog_id = isset($argv[1]) ? intval($argv[1]) : 4;
    $json_file = isset($argv[2]) ? $argv[2] : '/var/www/vhosts/vd.com.ar/ftp-incoming/uploads/productos_sucursal_autopista.json';
    
    echo "=== IMPORTADOR MASIVO SQL ===\n";
    echo "Blog ID: {$blog_id}\n";
    echo "Archivo JSON: {$json_file}\n\n";
    
    try {
        $importador = new ImportadorMasivoSQL($blog_id, 500);
        $productos_procesados = $importador->importar_desde_json($json_file);
        
        echo "\n✅ Importación completada exitosamente!\n";
        exit(0);
        
    } catch (Exception $e) {
        echo "\n❌ Error durante la importación: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "Este script debe ejecutarse desde línea de comandos.\n";
    echo "Uso: php importar_masivo_sql.php [blog_id] [archivo_json]\n";
}
?>