<?php
/**
 * Script de Backup Previo a Importación
 * Crea respaldo completo antes de ejecutar importaciones masivas
 */

require_once( dirname(__FILE__) . '/wp-load.php' );

class BackupImportacion {
    
    private $wpdb;
    private $blog_id;
    private $backup_dir;
    
    public function __construct($blog_id) {
        global $wpdb;
        $this->wpdb = $wpdb;
        $this->blog_id = $blog_id;
        $this->backup_dir = dirname(__FILE__) . '/backups/';
        
        // Crear directorio de backup si no existe
        if (!is_dir($this->backup_dir)) {
            mkdir($this->backup_dir, 0755, true);
        }
    }
    
    /**
     * Crear backup completo de las tablas afectadas
     */
    public function crear_backup_completo() {
        $timestamp = date('Y-m-d_H-i-s');
        $backup_file = $this->backup_dir . "backup_blog_{$this->blog_id}_{$timestamp}.sql";
        
        echo "Creando backup en: {$backup_file}\n";
        
        // Tablas a respaldar
        $tablas = [
            "EWJW2_{$this->blog_id}_posts",
            "EWJW2_{$this->blog_id}_postmeta", 
            "EWJW2_{$this->blog_id}_wc_product_meta_lookup"
        ];
        
        $backup_content = "-- Backup creado: " . date('Y-m-d H:i:s') . "\n";
        $backup_content .= "-- Blog ID: {$this->blog_id}\n\n";
        
        foreach ($tablas as $tabla) {
            $backup_content .= $this->backup_tabla($tabla);
        }
        
        file_put_contents($backup_file, $backup_content);
        
        echo "✅ Backup creado exitosamente: {$backup_file}\n";
        echo "Tamaño: " . round(filesize($backup_file) / 1024 / 1024, 2) . " MB\n";
        
        return $backup_file;
    }
    
    /**
     * Backup de una tabla específica
     */
    private function backup_tabla($tabla) {
        $backup_sql = "\n-- Backup de tabla: {$tabla}\n";
        $backup_sql .= "DROP TABLE IF EXISTS {$tabla}_backup;\n";
        $backup_sql .= "CREATE TABLE {$tabla}_backup LIKE {$tabla};\n";
        $backup_sql .= "INSERT INTO {$tabla}_backup SELECT * FROM {$tabla};\n\n";
        
        // También crear script de restauración
        $backup_sql .= "-- Para restaurar: \n";
        $backup_sql .= "-- DELETE FROM {$tabla};\n";
        $backup_sql .= "-- INSERT INTO {$tabla} SELECT * FROM {$tabla}_backup;\n";
        $backup_sql .= "-- DROP TABLE {$tabla}_backup;\n\n";
        
        return $backup_sql;
    }
    
    /**
     * Crear punto de restauración con conteo de registros
     */
    public function crear_punto_restauracion() {
        $timestamp = date('Y-m-d_H-i-s');
        $info_file = $this->backup_dir . "punto_restauracion_blog_{$this->blog_id}_{$timestamp}.json";
        
        $tablas = [
            "EWJW2_{$this->blog_id}_posts",
            "EWJW2_{$this->blog_id}_postmeta", 
            "EWJW2_{$this->blog_id}_wc_product_meta_lookup"
        ];
        
        $info_restauracion = [
            'timestamp' => $timestamp,
            'blog_id' => $this->blog_id,
            'tablas' => []
        ];
        
        foreach ($tablas as $tabla) {
            // Contar registros actuales
            $count = $this->wpdb->get_var("SELECT COUNT(*) FROM {$tabla}");
            
            // Contar productos específicamente
            if (strpos($tabla, '_posts') !== false) {
                $productos_count = $this->wpdb->get_var("SELECT COUNT(*) FROM {$tabla} WHERE post_type = 'product'");
            } else {
                $productos_count = null;
            }
            
            $info_restauracion['tablas'][$tabla] = [
                'registros_totales' => intval($count),
                'productos' => $productos_count ? intval($productos_count) : null,
                'ultimo_id' => $this->wpdb->get_var("SELECT MAX(ID) FROM {$tabla}")
            ];
        }
        
        file_put_contents($info_file, json_encode($info_restauracion, JSON_PRETTY_PRINT));
        
        echo "📊 Punto de restauración creado: {$info_file}\n";
        echo "Estado actual:\n";
        foreach ($info_restauracion['tablas'] as $tabla => $info) {
            echo "  - {$tabla}: {$info['registros_totales']} registros";
            if ($info['productos']) {
                echo " ({$info['productos']} productos)";
            }
            echo "\n";
        }
        
        return $info_file;
    }
    
    /**
     * Restaurar desde backup
     */
    public function restaurar_desde_backup($backup_file) {
        if (!file_exists($backup_file)) {
            throw new Exception("Archivo de backup no encontrado: {$backup_file}");
        }
        
        echo "Iniciando restauración desde: {$backup_file}\n";
        
        // Ejecutar script SQL de backup
        $sql_content = file_get_contents($backup_file);
        $queries = explode(';', $sql_content);
        
        $this->wpdb->query("START TRANSACTION");
        
        try {
            foreach ($queries as $query) {
                $query = trim($query);
                if (!empty($query) && !str_starts_with($query, '--')) {
                    $resultado = $this->wpdb->query($query);
                    if ($resultado === false) {
                        throw new Exception("Error ejecutando query: " . $this->wpdb->last_error);
                    }
                }
            }
            
            $this->wpdb->query("COMMIT");
            echo "✅ Restauración completada exitosamente.\n";
            
        } catch (Exception $e) {
            $this->wpdb->query("ROLLBACK");
            throw $e;
        }
    }
}

// ===== SCRIPT DE EJECUCIÓN =====

if (php_sapi_name() === 'cli') {
    $blog_id = isset($argv[1]) ? intval($argv[1]) : 4;
    $accion = isset($argv[2]) ? $argv[2] : 'backup';
    
    echo "=== BACKUP E IMPORTACIÓN ===\n";
    echo "Blog ID: {$blog_id}\n";
    echo "Acción: {$accion}\n\n";
    
    try {
        $backup = new BackupImportacion($blog_id);
        
        switch ($accion) {
            case 'backup':
                $backup_file = $backup->crear_backup_completo();
                $info_file = $backup->crear_punto_restauracion();
                break;
                
            case 'restaurar':
                $backup_file = isset($argv[3]) ? $argv[3] : null;
                if (!$backup_file) {
                    echo "❌ Debe especificar el archivo de backup para restaurar.\n";
                    echo "Uso: php backup_antes_importacion.php [blog_id] restaurar [archivo_backup]\n";
                    exit(1);
                }
                $backup->restaurar_desde_backup($backup_file);
                break;
                
            default:
                echo "❌ Acción no válida. Use 'backup' o 'restaurar'.\n";
                exit(1);
        }
        
    } catch (Exception $e) {
        echo "❌ Error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "Este script debe ejecutarse desde línea de comandos.\n";
}
?>