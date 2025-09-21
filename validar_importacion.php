<?php
/**
 * Script de Validación Post-Importación SQL
 * Verifica la integridad de los datos después de importación masiva
 */

require_once( dirname(__FILE__) . '/wp-load.php' );

class ValidadorImportacionSQL {
    
    private $wpdb;
    private $blog_id;
    private $errores = [];
    private $advertencias = [];
    
    public function __construct($blog_id) {
        global $wpdb;
        $this->wpdb = $wpdb;
        $this->blog_id = $blog_id;
    }
    
    /**
     * Ejecutar validación completa
     */
    public function validar_completo() {
        echo "=== VALIDACIÓN POST-IMPORTACIÓN ===\n";
        echo "Blog ID: {$this->blog_id}\n\n";
        
        $this->validar_productos_basicos();
        $this->validar_metadatos_criticos();
        $this->validar_precios();
        $this->validar_skus();
        $this->validar_cache_woocommerce();
        $this->validar_categorias();
        $this->mostrar_estadisticas();
        
        $this->mostrar_resumen();
    }
    
    /**
     * Validar productos básicos
     */
    private function validar_productos_basicos() {
        echo "📦 Validando productos básicos...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        
        // Contar productos totales
        $total_productos = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} 
            WHERE post_type = 'product'
        ");
        
        // Contar productos publicados
        $productos_publicados = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} 
            WHERE post_type = 'product' AND post_status = 'publish'
        ");
        
        // Productos sin título
        $sin_titulo = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} 
            WHERE post_type = 'product' AND (post_title = '' OR post_title IS NULL)
        ");
        
        echo "   ✓ Total productos: {$total_productos}\n";
        echo "   ✓ Productos publicados: {$productos_publicados}\n";
        
        if ($sin_titulo > 0) {
            $this->errores[] = "{$sin_titulo} productos sin título";
            echo "   ❌ Productos sin título: {$sin_titulo}\n";
        } else {
            echo "   ✓ Todos los productos tienen título\n";
        }
        
        // Productos con nombres muy largos
        $nombres_largos = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} 
            WHERE post_type = 'product' AND LENGTH(post_title) > 255
        ");
        
        if ($nombres_largos > 0) {
            $this->advertencias[] = "{$nombres_largos} productos con nombres muy largos (>255 chars)";
            echo "   ⚠️  Productos con nombres largos: {$nombres_largos}\n";
        }
        
        echo "\n";
    }
    
    /**
     * Validar metadatos críticos
     */
    private function validar_metadatos_criticos() {
        echo "🏷️  Validando metadatos críticos...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
        
        $metadatos_criticos = ['_sku', '_price', '_regular_price', '_stock_status'];
        
        foreach ($metadatos_criticos as $meta_key) {
            $productos_sin_meta = $this->wpdb->get_var($this->wpdb->prepare("
                SELECT COUNT(*) FROM {$table_posts} p
                LEFT JOIN {$table_postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = %s
                WHERE p.post_type = 'product' AND p.post_status = 'publish' 
                AND pm.meta_value IS NULL
            ", $meta_key));
            
            if ($productos_sin_meta > 0) {
                $this->errores[] = "{$productos_sin_meta} productos sin {$meta_key}";
                echo "   ❌ Productos sin {$meta_key}: {$productos_sin_meta}\n";
            } else {
                echo "   ✓ Todos los productos tienen {$meta_key}\n";
            }
        }
        
        echo "\n";
    }
    
    /**
     * Validar precios
     */
    private function validar_precios() {
        echo "💰 Validando precios...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
        
        // Productos con precio 0 o negativo
        $precios_invalidos = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} p
            INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id 
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key = '_regular_price' 
            AND (CAST(pm.meta_value AS DECIMAL(10,2)) <= 0 OR pm.meta_value = '')
        ");
        
        if ($precios_invalidos > 0) {
            $this->errores[] = "{$precios_invalidos} productos con precios inválidos (<=0)";
            echo "   ❌ Productos con precios inválidos: {$precios_invalidos}\n";
        } else {
            echo "   ✓ Todos los productos tienen precios válidos\n";
        }
        
        // Productos con _price != _regular_price
        $precios_desincronizados = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} p
            INNER JOIN {$table_postmeta} pm1 ON p.ID = pm1.post_id AND pm1.meta_key = '_price'
            INNER JOIN {$table_postmeta} pm2 ON p.ID = pm2.post_id AND pm2.meta_key = '_regular_price'
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm1.meta_value != pm2.meta_value
        ");
        
        if ($precios_desincronizados > 0) {
            $this->advertencias[] = "{$precios_desincronizados} productos con _price != _regular_price";
            echo "   ⚠️  Productos con precios desincronizados: {$precios_desincronizados}\n";
        } else {
            echo "   ✓ Precios _price y _regular_price sincronizados\n";
        }
        
        echo "\n";
    }
    
    /**
     * Validar SKUs
     */
    private function validar_skus() {
        echo "🏷️  Validando SKUs...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
        
        // SKUs duplicados
        $skus_duplicados = $this->wpdb->get_results("
            SELECT pm.meta_value as sku, COUNT(*) as count
            FROM {$table_posts} p
            INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key = '_sku' AND pm.meta_value != ''
            GROUP BY pm.meta_value
            HAVING COUNT(*) > 1
        ");
        
        if (!empty($skus_duplicados)) {
            $total_duplicados = count($skus_duplicados);
            $this->errores[] = "{$total_duplicados} SKUs duplicados encontrados";
            echo "   ❌ SKUs duplicados: {$total_duplicados}\n";
            
            foreach ($skus_duplicados as $dup) {
                echo "      - SKU '{$dup->sku}': {$dup->count} productos\n";
            }
        } else {
            echo "   ✓ No hay SKUs duplicados\n";
        }
        
        // SKUs vacíos
        $skus_vacios = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} p
            INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key = '_sku' AND (pm.meta_value = '' OR pm.meta_value IS NULL)
        ");
        
        if ($skus_vacios > 0) {
            $this->errores[] = "{$skus_vacios} productos con SKU vacío";
            echo "   ❌ SKUs vacíos: {$skus_vacios}\n";
        } else {
            echo "   ✓ Todos los productos tienen SKU\n";
        }
        
        echo "\n";
    }
    
    /**
     * Validar cache de WooCommerce
     */
    private function validar_cache_woocommerce() {
        echo "🔄 Validando cache de WooCommerce...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
        
        // Verificar si existe la tabla de lookup
        $tabla_existe = $this->wpdb->get_var("SHOW TABLES LIKE '{$table_wc_lookup}'");
        
        if (!$tabla_existe) {
            $this->advertencias[] = "Tabla de cache WooCommerce no existe: {$table_wc_lookup}";
            echo "   ⚠️  Tabla de cache no existe\n\n";
            return;
        }
        
        // Productos sin entrada en cache
        $sin_cache = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} p
            LEFT JOIN {$table_wc_lookup} wc ON p.ID = wc.product_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND wc.product_id IS NULL
        ");
        
        if ($sin_cache > 0) {
            $this->errores[] = "{$sin_cache} productos sin entrada en cache WooCommerce";
            echo "   ❌ Productos sin cache: {$sin_cache}\n";
        } else {
            echo "   ✓ Todos los productos están en cache\n";
        }
        
        // Entradas huérfanas en cache
        $cache_huerfano = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_wc_lookup} wc
            LEFT JOIN {$table_posts} p ON wc.product_id = p.ID
            WHERE p.ID IS NULL OR p.post_type != 'product' OR p.post_status != 'publish'
        ");
        
        if ($cache_huerfano > 0) {
            $this->advertencias[] = "{$cache_huerfano} entradas huérfanas en cache WooCommerce";
            echo "   ⚠️  Entradas huérfanas en cache: {$cache_huerfano}\n";
        } else {
            echo "   ✓ No hay entradas huérfanas en cache\n";
        }
        
        echo "\n";
    }
    
    /**
     * Validar categorías
     */
    private function validar_categorias() {
        echo "📂 Validando categorías...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_term_relationships = "EWJW2_{$this->blog_id}_term_relationships";
        $table_term_taxonomy = "EWJW2_{$this->blog_id}_term_taxonomy";
        
        // Productos sin categoría
        $sin_categoria = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_posts} p
            LEFT JOIN {$table_term_relationships} tr ON p.ID = tr.object_id
            LEFT JOIN {$table_term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND (tt.taxonomy != 'product_cat' OR tt.taxonomy IS NULL)
        ");
        
        if ($sin_categoria > 0) {
            $this->advertencias[] = "{$sin_categoria} productos sin categoría";
            echo "   ⚠️  Productos sin categoría: {$sin_categoria}\n";
        } else {
            echo "   ✓ Todos los productos tienen categoría\n";
        }
        
        // Contar categorías totales
        $total_categorias = $this->wpdb->get_var("
            SELECT COUNT(*) FROM {$table_term_taxonomy}
            WHERE taxonomy = 'product_cat'
        ");
        
        echo "   ✓ Total categorías: {$total_categorias}\n";
        
        echo "\n";
    }
    
    /**
     * Mostrar estadísticas generales
     */
    private function mostrar_estadisticas() {
        echo "📊 Estadísticas generales...\n";
        
        $table_posts = "EWJW2_{$this->blog_id}_posts";
        $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
        
        // Productos por sucursal
        $productos_por_sucursal = $this->wpdb->get_results("
            SELECT pm.meta_value as sucursal, COUNT(*) as count
            FROM {$table_posts} p
            INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key = '_sucursal_nombre'
            GROUP BY pm.meta_value
            ORDER BY count DESC
        ");
        
        if (!empty($productos_por_sucursal)) {
            echo "   📍 Productos por sucursal:\n";
            foreach ($productos_por_sucursal as $sucursal) {
                echo "      - {$sucursal->sucursal}: {$sucursal->count} productos\n";
            }
        }
        
        // Rango de precios
        $precio_stats = $this->wpdb->get_row("
            SELECT 
                MIN(CAST(pm.meta_value AS DECIMAL(10,2))) as precio_min,
                MAX(CAST(pm.meta_value AS DECIMAL(10,2))) as precio_max,
                AVG(CAST(pm.meta_value AS DECIMAL(10,2))) as precio_promedio
            FROM {$table_posts} p
            INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id
            WHERE p.post_type = 'product' AND p.post_status = 'publish'
            AND pm.meta_key = '_regular_price' AND pm.meta_value != ''
        ");
        
        if ($precio_stats) {
            echo "   💰 Rango de precios:\n";
            echo "      - Mínimo: $" . number_format($precio_stats->precio_min, 2) . "\n";
            echo "      - Máximo: $" . number_format($precio_stats->precio_max, 2) . "\n";
            echo "      - Promedio: $" . number_format($precio_stats->precio_promedio, 2) . "\n";
        }
        
        echo "\n";
    }
    
    /**
     * Mostrar resumen final
     */
    private function mostrar_resumen() {
        echo "=== RESUMEN DE VALIDACIÓN ===\n";
        
        $total_errores = count($this->errores);
        $total_advertencias = count($this->advertencias);
        
        if ($total_errores === 0 && $total_advertencias === 0) {
            echo "✅ VALIDACIÓN EXITOSA: No se encontraron errores ni advertencias\n";
        } else {
            if ($total_errores > 0) {
                echo "❌ ERRORES ENCONTRADOS ({$total_errores}):\n";
                foreach ($this->errores as $error) {
                    echo "   • {$error}\n";
                }
                echo "\n";
            }
            
            if ($total_advertencias > 0) {
                echo "⚠️  ADVERTENCIAS ({$total_advertencias}):\n";
                foreach ($this->advertencias as $advertencia) {
                    echo "   • {$advertencia}\n";
                }
                echo "\n";
            }
        }
        
        // Recomendaciones
        if ($total_errores > 0) {
            echo "🔧 RECOMENDACIONES:\n";
            echo "   1. Revisar y corregir los errores críticos antes de usar en producción\n";
            echo "   2. Ejecutar limpieza de cache: wp_cache_flush() y wc_delete_product_transients()\n";
            echo "   3. Reindexar búsquedas si usa plugins de búsqueda\n\n";
        }
        
        return $total_errores === 0;
    }
    
    /**
     * Generar reporte detallado
     */
    public function generar_reporte($archivo_salida = null) {
        if (!$archivo_salida) {
            $archivo_salida = "validacion_blog_{$this->blog_id}_" . date('Y-m-d_H-i-s') . ".txt";
        }
        
        ob_start();
        $this->validar_completo();
        $contenido = ob_get_clean();
        
        file_put_contents($archivo_salida, $contenido);
        echo "📄 Reporte guardado en: {$archivo_salida}\n";
        
        return $archivo_salida;
    }
}

// ===== SCRIPT DE EJECUCIÓN =====

if (php_sapi_name() === 'cli') {
    $blog_id = isset($argv[1]) ? intval($argv[1]) : 4;
    $generar_archivo = isset($argv[2]) && $argv[2] === '--archivo';
    
    try {
        $validador = new ValidadorImportacionSQL($blog_id);
        
        if ($generar_archivo) {
            $validador->generar_reporte();
        } else {
            $es_valido = $validador->validar_completo();
            exit($es_valido ? 0 : 1);
        }
        
    } catch (Exception $e) {
        echo "❌ Error durante la validación: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "Este script debe ejecutarse desde línea de comandos.\n";
    echo "Uso: php validar_importacion.php [blog_id] [--archivo]\n";
}
?>