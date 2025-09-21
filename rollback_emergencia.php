<?php
/**
 * Script de Rollback de Emergencia
 * Para revertir rápidamente una importación fallida
 */

require_once( dirname(__FILE__) . '/wp-load.php' );

class RollbackEmergencia {
    
    private $wpdb;
    private $blog_id;
    
    public function __construct($blog_id) {
        global $wpdb;
        $this->wpdb = $wpdb;
        $this->blog_id = $blog_id;
    }
    
    /**
     * Rollback por timestamp - elimina productos creados después de una fecha
     */
    public function rollback_por_timestamp($timestamp) {
        echo "🔄 Iniciando rollback por timestamp: {$timestamp}\n";
        
        $this->wpdb->query("START TRANSACTION");
        
        try {
            $table_posts = "EWJW2_{$this->blog_id}_posts";
            $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
            $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
            
            // Obtener IDs de productos creados después del timestamp
            $productos_a_eliminar = $this->wpdb->get_col($this->wpdb->prepare("
                SELECT ID FROM {$table_posts} 
                WHERE post_type = 'product' 
                AND post_date > %s
            ", $timestamp));
            
            if (empty($productos_a_eliminar)) {
                echo "✅ No hay productos para eliminar.\n";
                $this->wpdb->query("ROLLBACK");
                return 0;
            }
            
            $count = count($productos_a_eliminar);
            echo "📋 Productos a eliminar: {$count}\n";
            
            // Confirmar antes de proceder
            echo "⚠️  ¿Confirma eliminación de {$count} productos? (y/N): ";
            $handle = fopen("php://stdin", "r");
            $confirmation = trim(fgets($handle));
            fclose($handle);
            
            if (strtolower($confirmation) !== 'y') {
                echo "❌ Operación cancelada.\n";
                $this->wpdb->query("ROLLBACK");
                return 0;
            }
            
            // Eliminar en lotes
            $lotes = array_chunk($productos_a_eliminar, 100);
            
            foreach ($lotes as $lote) {
                $ids_str = implode(',', array_map('intval', $lote));
                
                // Eliminar metadatos
                $this->wpdb->query("DELETE FROM {$table_postmeta} WHERE post_id IN ({$ids_str})");
                
                // Eliminar de cache WooCommerce
                $this->wpdb->query("DELETE FROM {$table_wc_lookup} WHERE product_id IN ({$ids_str})");
                
                // Eliminar posts
                $this->wpdb->query("DELETE FROM {$table_posts} WHERE ID IN ({$ids_str})");
                
                echo "✅ Eliminado lote de " . count($lote) . " productos\n";
            }
            
            $this->wpdb->query("COMMIT");
            
            echo "🎯 Rollback completado: {$count} productos eliminados\n";
            return $count;
            
        } catch (Exception $e) {
            $this->wpdb->query("ROLLBACK");
            throw $e;
        }
    }
    
    /**
     * Rollback por SKUs específicos
     */
    public function rollback_por_skus($skus_array) {
        echo "🔄 Iniciando rollback por SKUs específicos\n";
        
        $this->wpdb->query("START TRANSACTION");
        
        try {
            $table_posts = "EWJW2_{$this->blog_id}_posts";
            $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
            $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
            
            $skus_eliminados = 0;
            
            foreach ($skus_array as $sku) {
                // Buscar producto por SKU
                $product_id = $this->wpdb->get_var($this->wpdb->prepare("
                    SELECT p.ID FROM {$table_posts} p 
                    INNER JOIN {$table_postmeta} pm ON p.ID = pm.post_id 
                    WHERE pm.meta_key = '_sku' AND pm.meta_value = %s 
                    AND p.post_type = 'product' LIMIT 1
                ", $sku));
                
                if ($product_id) {
                    // Eliminar metadatos
                    $this->wpdb->query($this->wpdb->prepare("DELETE FROM {$table_postmeta} WHERE post_id = %d", $product_id));
                    
                    // Eliminar de cache WooCommerce
                    $this->wpdb->query($this->wpdb->prepare("DELETE FROM {$table_wc_lookup} WHERE product_id = %d", $product_id));
                    
                    // Eliminar post
                    $this->wpdb->query($this->wpdb->prepare("DELETE FROM {$table_posts} WHERE ID = %d", $product_id));
                    
                    $skus_eliminados++;
                    echo "✅ Eliminado producto SKU: {$sku} (ID: {$product_id})\n";
                } else {
                    echo "⚠️  SKU no encontrado: {$sku}\n";
                }
            }
            
            $this->wpdb->query("COMMIT");
            
            echo "🎯 Rollback por SKUs completado: {$skus_eliminados} productos eliminados\n";
            return $skus_eliminados;
            
        } catch (Exception $e) {
            $this->wpdb->query("ROLLBACK");
            throw $e;
        }
    }
    
    /**
     * Rollback completo - elimina TODOS los productos
     */
    public function rollback_completo() {
        echo "🚨 ROLLBACK COMPLETO - ELIMINARÁ TODOS LOS PRODUCTOS\n";
        echo "⚠️  Esta operación eliminará TODOS los productos del blog {$this->blog_id}\n";
        echo "⚠️  ¿Está ABSOLUTAMENTE SEGURO? Escriba 'ELIMINAR TODO': ";
        
        $handle = fopen("php://stdin", "r");
        $confirmation = trim(fgets($handle));
        fclose($handle);
        
        if ($confirmation !== 'ELIMINAR TODO') {
            echo "❌ Operación cancelada por seguridad.\n";
            return 0;
        }
        
        $this->wpdb->query("START TRANSACTION");
        
        try {
            $table_posts = "EWJW2_{$this->blog_id}_posts";
            $table_postmeta = "EWJW2_{$this->blog_id}_postmeta";
            $table_wc_lookup = "EWJW2_{$this->blog_id}_wc_product_meta_lookup";
            
            // Contar productos actuales
            $count_actual = $this->wpdb->get_var("SELECT COUNT(*) FROM {$table_posts} WHERE post_type = 'product'");
            
            echo "📋 Productos a eliminar: {$count_actual}\n";
            
            // Eliminar metadatos de productos
            $this->wpdb->query("
                DELETE pm FROM {$table_postmeta} pm 
                INNER JOIN {$table_posts} p ON pm.post_id = p.ID 
                WHERE p.post_type = 'product'
            ");
            
            // Eliminar de cache WooCommerce
            $this->wpdb->query("
                DELETE wc FROM {$table_wc_lookup} wc 
                INNER JOIN {$table_posts} p ON wc.product_id = p.ID 
                WHERE p.post_type = 'product'
            ");
            
            // Eliminar productos
            $this->wpdb->query("DELETE FROM {$table_posts} WHERE post_type = 'product'");
            
            $this->wpdb->query("COMMIT");
            
            echo "💥 ROLLBACK COMPLETO EJECUTADO: {$count_actual} productos eliminados\n";
            return $count_actual;
            
        } catch (Exception $e) {
            $this->wpdb->query("ROLLBACK");
            throw $e;
        }
    }
}

// ===== SCRIPT DE EJECUCIÓN =====

if (php_sapi_name() === 'cli') {
    $blog_id = isset($argv[1]) ? intval($argv[1]) : null;
    $tipo_rollback = isset($argv[2]) ? $argv[2] : 'timestamp';
    $parametro = isset($argv[3]) ? $argv[3] : null;
    
    if (!$blog_id) {
        echo "❌ Debe especificar el blog_id\n";
        echo "Uso:\n";
        echo "  php rollback_emergencia.php [blog_id] timestamp [fecha_hora]\n";
        echo "  php rollback_emergencia.php [blog_id] skus [sku1,sku2,sku3]\n";
        echo "  php rollback_emergencia.php [blog_id] completo\n";
        exit(1);
    }
    
    echo "=== ROLLBACK DE EMERGENCIA ===\n";
    echo "Blog ID: {$blog_id}\n";
    echo "Tipo: {$tipo_rollback}\n\n";
    
    try {
        $rollback = new RollbackEmergencia($blog_id);
        
        switch ($tipo_rollback) {
            case 'timestamp':
                $timestamp = $parametro ?: date('Y-m-d H:i:s', strtotime('-1 hour'));
                echo "Timestamp: {$timestamp}\n\n";
                $eliminados = $rollback->rollback_por_timestamp($timestamp);
                break;
                
            case 'skus':
                if (!$parametro) {
                    echo "❌ Debe especificar los SKUs separados por coma\n";
                    exit(1);
                }
                $skus = explode(',', $parametro);
                $eliminados = $rollback->rollback_por_skus($skus);
                break;
                
            case 'completo':
                $eliminados = $rollback->rollback_completo();
                break;
                
            default:
                echo "❌ Tipo de rollback no válido\n";
                exit(1);
        }
        
        echo "\n✅ Rollback completado: {$eliminados} productos procesados\n";
        
    } catch (Exception $e) {
        echo "❌ Error durante rollback: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "Este script debe ejecutarse desde línea de comandos.\n";
}
?>