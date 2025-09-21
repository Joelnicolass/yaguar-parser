<?php
// importar_productos_optimizado.php
require_once( dirname(__FILE__) . '/wp-load.php' ); 
require_once( ABSPATH . 'wp-admin/includes/taxonomy.php' );
require_once( ABSPATH . 'wp-admin/includes/image.php' );
require_once( ABSPATH . 'wp-admin/includes/file.php' );
require_once( ABSPATH . 'wp-admin/includes/media.php' );

// ==================== CONFIGURACIÓN DE OPTIMIZACIÓN ====================

// Desactivar hooks innecesarios durante la importación masiva
remove_action('save_post', 'wp_cache_post_change');
remove_action('save_post', 'wp_schedule_update_checks');

// Aumentar límites de memoria y tiempo
ini_set('memory_limit', '512M');
set_time_limit(0);

// Desactivar autocommit para transacciones por lotes
global $wpdb;
$wpdb->query('SET autocommit = 0;');

// ==================== DATOS DE CONFIGURACIÓN ====================

// Categorías por ID Autopista
$categorias_por_id_autopista = [
    72 => [ 'id' => 72, 'name' => "Dulces y Golosinas", 'slug' => "dulces-y-golosinas" ],
    73 => [ 'id' => 73, 'name' => "Dulces Premium", 'slug' => "dulces-premium" ],
    74 => [ 'id' => 74, 'name' => "Productos de Limpieza", 'slug' => "productos-de-limpieza" ],
    75 => [ 'id' => 75, 'name' => "Lácteos y Derivados", 'slug' => "lacteos-y-derivados" ],
    76 => [ 'id' => 76, 'name' => "Panificados", 'slug' => "panificados" ],
    77 => [ 'id' => 77, 'name' => "Bebidas y Edulcorantes", 'slug' => "bebidas-y-edulcorantes" ],
    78 => [ 'id' => 78, 'name' => "Carnes y Embutidos", 'slug' => "carnes-y-embutidos" ],
    79 => [ 'id' => 79, 'name' => "Verduras y Frutas", 'slug' => "verduras-y-frutas" ],
    80 => [ 'id' => 80, 'name' => "Congelados", 'slug' => "congelados" ],
    81 => [ 'id' => 81, 'name' => "Alimentos Básicos", 'slug' => "alimentos-basicos" ],
    82 => [ 'id' => 82, 'name' => "Condimentos y Especias", 'slug' => "condimentos-y-especias" ],
    83 => [ 'id' => 83, 'name' => "Productos Varios", 'slug' => "productos-varios" ],
    84 => [ 'id' => 84, 'name' => "Higiene Personal", 'slug' => "higiene-personal" ],
    85 => [ 'id' => 85, 'name' => "Cosméticos y Belleza", 'slug' => "cosmeticos-y-belleza" ],
    86 => [ 'id' => 86, 'name' => "Medicamentos", 'slug' => "medicamentos" ],
    87 => [ 'id' => 87, 'name' => "Suplementos", 'slug' => "suplementos" ],
    88 => [ 'id' => 88, 'name' => "Productos para Bebés", 'slug' => "productos-para-bebes" ],
    89 => [ 'id' => 89, 'name' => "Mascotas", 'slug' => "mascotas" ],
    90 => [ 'id' => 90, 'name' => "Hogar y Decoración", 'slug' => "hogar-y-decoracion" ],
    91 => [ 'id' => 91, 'name' => "Electrónicos", 'slug' => "electronicos" ],
    92 => [ 'id' => 92, 'name' => "Vinos", 'slug' => "vinos" ],
    93 => [ 'id' => 93, 'name' => "Cervezas", 'slug' => "cervezas" ],
    94 => [ 'id' => 94, 'name' => "Licores", 'slug' => "licores" ],
    95 => [ 'id' => 95, 'name' => "Bebidas sin Alcohol", 'slug' => "bebidas-sin-alcohol" ],
    96 => [ 'id' => 96, 'name' => "Snacks y Aperitivos", 'slug' => "snacks-y-aperitivos" ],
    97 => [ 'id' => 97, 'name' => "Cereales y Granolas", 'slug' => "cereales-y-granolas" ],
    98 => [ 'id' => 98, 'name' => "Conservas", 'slug' => "conservas" ],
    99 => [ 'id' => 99, 'name' => "Aceites y Vinagres", 'slug' => "aceites-y-vinagres" ],
    100 => [ 'id' => 100, 'name' => "Pastas", 'slug' => "pastas" ],
    101 => [ 'id' => 101, 'name' => "Harinas y Premezclas", 'slug' => "harinas-y-premezclas" ],
    102 => [ 'id' => 102, 'name' => "Postres y Repostería", 'slug' => "postres-y-reposteria" ],
    103 => [ 'id' => 103, 'name' => "Té y Café", 'slug' => "te-y-cafe" ],
    104 => [ 'id' => 104, 'name' => "Productos Orgánicos", 'slug' => "productos-organicos" ],
    105 => [ 'id' => 105, 'name' => "Productos Dietéticos", 'slug' => "productos-dieteticos" ],
    106 => [ 'id' => 106, 'name' => "Productos sin TACC", 'slug' => "productos-sin-tacc" ],
    107 => [ 'id' => 107, 'name' => "Productos Importados", 'slug' => "productos-importados" ],
    108 => [ 'id' => 108, 'name' => "Productos de Temporada", 'slug' => "productos-de-temporada" ],
    109 => [ 'id' => 109, 'name' => "Productos Gourmet", 'slug' => "productos-gourmet" ],
    110 => [ 'id' => 110, 'name' => "Productos Artesanales", 'slug' => "productos-artesanales" ],
    111 => [ 'id' => 111, 'name' => "Productos Regionales", 'slug' => "productos-regionales" ],
    112 => [ 'id' => 112, 'name' => "Comida Preparada", 'slug' => "comida-preparada" ],
    113 => [ 'id' => 113, 'name' => "Productos de Panadería", 'slug' => "productos-de-panaderia" ],
    114 => [ 'id' => 114, 'name' => "Productos de Pastelería", 'slug' => "productos-de-pasteleria" ],
    115 => [ 'id' => 115, 'name' => "Productos Frescos", 'slug' => "productos-frescos" ],
    116 => [ 'id' => 116, 'name' => "Productos Secos", 'slug' => "productos-secos" ],
    117 => [ 'id' => 117, 'name' => "Frutos Secos", 'slug' => "frutos-secos" ],
    118 => [ 'id' => 118, 'name' => "Semillas", 'slug' => "semillas" ],
    119 => [ 'id' => 119, 'name' => "Legumbres", 'slug' => "legumbres" ],
    120 => [ 'id' => 120, 'name' => "Productos de Granja", 'slug' => "productos-de-granja" ],
    121 => [ 'id' => 121, 'name' => "Productos Marinados", 'slug' => "productos-marinados" ],
    122 => [ 'id' => 122, 'name' => "Productos Ahumados", 'slug' => "productos-ahumados" ],
    123 => [ 'id' => 123, 'name' => "Productos en Salmuera", 'slug' => "productos-en-salmuera" ],
    124 => [ 'id' => 124, 'name' => "Productos Encurtidos", 'slug' => "productos-encurtidos" ],
    125 => [ 'id' => 125, 'name' => "Productos Fermentados", 'slug' => "productos-fermentados" ],
    126 => [ 'id' => 126, 'name' => "Pack Promocional", 'slug' => "pack-promocional" ],
    127 => [ 'id' => 127, 'name' => "Productos de Ofertas", 'slug' => "productos-de-ofertas" ],
    128 => [ 'id' => 128, 'name' => "Productos de Liquidación", 'slug' => "productos-de-liquidacion" ],
    129 => [ 'id' => 129, 'name' => "Productos Especiales", 'slug' => "productos-especiales" ],
    130 => [ 'id' => 130, 'name' => "Productos de Regalo", 'slug' => "productos-de-regalo" ],
    131 => [ 'id' => 131, 'name' => "Productos Premium", 'slug' => "productos-premium" ],
    132 => [ 'id' => 132, 'name' => "Productos Exclusivos", 'slug' => "productos-exclusivos" ],
    133 => [ 'id' => 133, 'name' => "Productos de Lujo", 'slug' => "productos-de-lujo" ],
    134 => [ 'id' => 134, 'name' => "Productos de Colección", 'slug' => "productos-de-coleccion" ],
];

// Categorías por ID
$categorias_por_id = [
    1 => [ 'id' => 1, 'name' => "Dulces y Golosinas", 'slug' => "dulces-y-golosinas" ],
    2 => [ 'id' => 2, 'name' => "Dulces Premium", 'slug' => "dulces-premium" ],
    3 => [ 'id' => 3, 'name' => "Productos de Limpieza", 'slug' => "productos-de-limpieza" ],
    4 => [ 'id' => 4, 'name' => "Lácteos y Derivados", 'slug' => "lacteos-y-derivados" ],
    5 => [ 'id' => 5, 'name' => "Panificados", 'slug' => "panificados" ],
    6 => [ 'id' => 6, 'name' => "Bebidas y Edulcorantes", 'slug' => "bebidas-y-edulcorantes" ],
    7 => [ 'id' => 7, 'name' => "Carnes y Embutidos", 'slug' => "carnes-y-embutidos" ],
    8 => [ 'id' => 8, 'name' => "Verduras y Frutas", 'slug' => "verduras-y-frutas" ],
    9 => [ 'id' => 9, 'name' => "Congelados", 'slug' => "congelados" ],
    10 => [ 'id' => 10, 'name' => "Alimentos Básicos", 'slug' => "alimentos-basicos" ],
    11 => [ 'id' => 11, 'name' => "Condimentos y Especias", 'slug' => "condimentos-y-especias" ],
    12 => [ 'id' => 12, 'name' => "Productos Varios", 'slug' => "productos-varios" ],
    13 => [ 'id' => 13, 'name' => "Higiene Personal", 'slug' => "higiene-personal" ],
    14 => [ 'id' => 14, 'name' => "Cosméticos y Belleza", 'slug' => "cosmeticos-y-belleza" ],
    15 => [ 'id' => 15, 'name' => "Medicamentos", 'slug' => "medicamentos" ],
    16 => [ 'id' => 16, 'name' => "Suplementos", 'slug' => "suplementos" ],
    17 => [ 'id' => 17, 'name' => "Productos para Bebés", 'slug' => "productos-para-bebes" ],
    18 => [ 'id' => 18, 'name' => "Mascotas", 'slug' => "mascotas" ],
    19 => [ 'id' => 19, 'name' => "Hogar y Decoración", 'slug' => "hogar-y-decoracion" ],
    20 => [ 'id' => 20, 'name' => "Electrónicos", 'slug' => "electronicos" ],
    21 => [ 'id' => 21, 'name' => "Vinos", 'slug' => "vinos" ],
    22 => [ 'id' => 22, 'name' => "Cervezas", 'slug' => "cervezas" ],
    23 => [ 'id' => 23, 'name' => "Licores", 'slug' => "licores" ],
    24 => [ 'id' => 24, 'name' => "Bebidas sin Alcohol", 'slug' => "bebidas-sin-alcohol" ],
    25 => [ 'id' => 25, 'name' => "Snacks y Aperitivos", 'slug' => "snacks-y-aperitivos" ],
    26 => [ 'id' => 26, 'name' => "Cereales y Granolas", 'slug' => "cereales-y-granolas" ],
    27 => [ 'id' => 27, 'name' => "Conservas", 'slug' => "conservas" ],
    28 => [ 'id' => 28, 'name' => "Aceites y Vinagres", 'slug' => "aceites-y-vinagres" ],
    29 => [ 'id' => 29, 'name' => "Pastas", 'slug' => "pastas" ],
    30 => [ 'id' => 30, 'name' => "Harinas y Premezclas", 'slug' => "harinas-y-premezclas" ],
    31 => [ 'id' => 31, 'name' => "Postres y Repostería", 'slug' => "postres-y-reposteria" ],
    32 => [ 'id' => 32, 'name' => "Té y Café", 'slug' => "te-y-cafe" ],
    33 => [ 'id' => 33, 'name' => "Productos Orgánicos", 'slug' => "productos-organicos" ],
    35 => [ 'id' => 35, 'name' => "Productos Dietéticos", 'slug' => "productos-dieteticos" ],
    36 => [ 'id' => 36, 'name' => "Productos sin TACC", 'slug' => "productos-sin-tacc" ],
    38 => [ 'id' => 38, 'name' => "Productos Importados", 'slug' => "productos-importados" ],
    40 => [ 'id' => 40, 'name' => "Productos de Temporada", 'slug' => "productos-de-temporada" ],
    42 => [ 'id' => 42, 'name' => "Productos Gourmet", 'slug' => "productos-gourmet" ],
    44 => [ 'id' => 44, 'name' => "Productos Artesanales", 'slug' => "productos-artesanales" ],
    45 => [ 'id' => 45, 'name' => "Productos Regionales", 'slug' => "productos-regionales" ],
    48 => [ 'id' => 48, 'name' => "Comida Preparada", 'slug' => "comida-preparada" ],
    50 => [ 'id' => 50, 'name' => "Productos de Panadería", 'slug' => "productos-de-panaderia" ],
    54 => [ 'id' => 54, 'name' => "Productos de Pastelería", 'slug' => "productos-de-pasteleria" ],
    56 => [ 'id' => 56, 'name' => "Productos Frescos", 'slug' => "productos-frescos" ],
    60 => [ 'id' => 60, 'name' => "Productos Secos", 'slug' => "productos-secos" ],
    62 => [ 'id' => 62, 'name' => "Frutos Secos", 'slug' => "frutos-secos" ],
    64 => [ 'id' => 64, 'name' => "Semillas", 'slug' => "semillas" ],
    65 => [ 'id' => 65, 'name' => "Legumbres", 'slug' => "legumbres" ],
    70 => [ 'id' => 70, 'name' => "Productos de Granja", 'slug' => "productos-de-granja" ],
    72 => [ 'id' => 72, 'name' => "Productos Marinados", 'slug' => "productos-marinados" ],
    75 => [ 'id' => 75, 'name' => "Productos Ahumados", 'slug' => "productos-ahumados" ],
    80 => [ 'id' => 80, 'name' => "Productos en Salmuera", 'slug' => "productos-en-salmuera" ],
    81 => [ 'id' => 81, 'name' => "Productos Encurtidos", 'slug' => "productos-encurtidos" ],
    84 => [ 'id' => 84, 'name' => "Productos Fermentados", 'slug' => "productos-fermentados" ],
    96 => [ 'id' => 96, 'name' => "Pack Promocional", 'slug' => "pack-promocional" ],
    100 => [ 'id' => 100, 'name' => "Productos de Ofertas", 'slug' => "productos-de-ofertas" ],
    108 => [ 'id' => 108, 'name' => "Productos de Liquidación", 'slug' => "productos-de-liquidacion" ],
    120 => [ 'id' => 120, 'name' => "Productos Especiales", 'slug' => "productos-especiales" ],
    144 => [ 'id' => 144, 'name' => "Productos de Regalo", 'slug' => "productos-de-regalo" ],
    192 => [ 'id' => 192, 'name' => "Productos Premium", 'slug' => "productos-premium" ],
    216 => [ 'id' => 216, 'name' => "Productos Exclusivos", 'slug' => "productos-exclusivos" ],
    240 => [ 'id' => 240, 'name' => "Productos de Lujo", 'slug' => "productos-de-lujo" ],
    288 => [ 'id' => 288, 'name' => "Productos de Colección", 'slug' => "productos-de-coleccion" ],
];

// ==================== CACHÉ PARA OPTIMIZACIONES ====================

// Cache para categorías ya verificadas/creadas
$cache_categorias_existentes = [];

// Cache para mapeo de categorías
$cache_mapeo_categorias = [];

// ==================== FUNCIONES OPTIMIZADAS ====================

// Función optimizada para mapear categorías con cache
function mapear_categoria_optimizado($meta_data_categoria_id) {
    global $categorias_por_id, $categorias_por_id_autopista, $cache_mapeo_categorias;
    
    // Verificar cache primero
    if (isset($cache_mapeo_categorias[$meta_data_categoria_id])) {
        return $cache_mapeo_categorias[$meta_data_categoria_id];
    }
    
    // Buscar la categoría base por ID
    if (!isset($categorias_por_id[$meta_data_categoria_id])) {
        $cache_mapeo_categorias[$meta_data_categoria_id] = null;
        return null; // Categoría no encontrada
    }
    
    $categoria_base = $categorias_por_id[$meta_data_categoria_id];
    $nombre_categoria = $categoria_base['name'];
    
    // Buscar la categoría correspondiente en autopista por nombre
    foreach ($categorias_por_id_autopista as $id_autopista => $categoria_autopista) {
        if ($categoria_autopista['name'] === $nombre_categoria) {
            $resultado = [
                'category_id' => $id_autopista,
                'name' => $categoria_autopista['name'],
                'slug' => $categoria_autopista['slug'],
                'original_id' => $meta_data_categoria_id
            ];
            $cache_mapeo_categorias[$meta_data_categoria_id] = $resultado;
            return $resultado;
        }
    }
    
    $cache_mapeo_categorias[$meta_data_categoria_id] = null;
    return null; // No se encontró equivalencia en autopista
}

// Función para obtener o crear categoría con cache
function obtener_o_crear_categoria($categoria_info) {
    global $cache_categorias_existentes;
    
    $categoria_name = $categoria_info['name'];
    
    // Verificar cache primero
    if (isset($cache_categorias_existentes[$categoria_name])) {
        return $cache_categorias_existentes[$categoria_name];
    }
    
    // Verificar si la categoría existe en WordPress
    $term_exists = term_exists($categoria_name, 'product_cat');
    
    if (!$term_exists) {
        // Crear la categoría si no existe
        $new_term = wp_insert_term(
            $categoria_name,
            'product_cat',
            array('slug' => $categoria_info['slug'])
        );
        
        if (!is_wp_error($new_term)) {
            $term_id = $new_term['term_id'];
            $cache_categorias_existentes[$categoria_name] = $term_id;
            return $term_id;
        } else {
            error_log("Error creando categoría: " . $new_term->get_error_message());
            return null;
        }
    } else {
        $term_id = $term_exists['term_id'];
        $cache_categorias_existentes[$categoria_name] = $term_id;
        return $term_id;
    }
}

// Función optimizada para insertar posts por lotes
function insertar_productos_por_lotes($productos_procesados, $sucursal_info) {
    global $wpdb, $categorias_por_id_autopista;
    
    $batch_size = 50; // Procesar de a 50 productos
    $total_productos = count($productos_procesados);
    $productos_insertados = 0;
    
    echo "Iniciando inserción de {$total_productos} productos en lotes de {$batch_size}...\n";
    
    for ($i = 0; $i < $total_productos; $i += $batch_size) {
        $batch = array_slice($productos_procesados, $i, $batch_size);
        
        // Iniciar transacción
        $wpdb->query('START TRANSACTION');
        
        try {
            foreach ($batch as $woocommerce_product) {
                // Insertar producto
                $product_id = wp_insert_post([
                    'post_title'   => $woocommerce_product['name'],
                    'post_content' => $woocommerce_product['description'],
                    'post_excerpt' => $woocommerce_product['short_description'],
                    'post_status'  => $woocommerce_product['status'],
                    'post_type'    => 'product'
                ], true);

                if (is_wp_error($product_id)) {
                    throw new Exception("Error creando producto: " . $product_id->get_error_message());
                }

                // Preparar todos los meta values para inserción por lotes
                $meta_values = [
                    ['post_id' => $product_id, 'meta_key' => '_sku', 'meta_value' => $woocommerce_product['sku']],
                    ['post_id' => $product_id, 'meta_key' => '_regular_price', 'meta_value' => $woocommerce_product['regular_price']],
                    ['post_id' => $product_id, 'meta_key' => '_price', 'meta_value' => $woocommerce_product['regular_price']],
                    ['post_id' => $product_id, 'meta_key' => '_stock_status', 'meta_value' => $woocommerce_product['stock_status']],
                ];

                // Agregar meta_data adicional
                foreach ($woocommerce_product['meta_data'] as $meta) {
                    $meta_values[] = [
                        'post_id' => $product_id, 
                        'meta_key' => $meta['key'], 
                        'meta_value' => $meta['value']
                    ];
                }

                // Insertar todos los meta values de una vez
                foreach ($meta_values as $meta) {
                    update_post_meta($meta['post_id'], $meta['meta_key'], $meta['meta_value']);
                }

                // Asignar categorías optimizado
                if (!empty($woocommerce_product['categories'])) {
                    $category_ids = [];

                    foreach ($woocommerce_product['categories'] as $category) {
                        $category_id = $category['id'];

                        // Buscar información de la categoría en autopista
                        if (isset($categorias_por_id_autopista[$category_id])) {
                            $categoria_info = $categorias_por_id_autopista[$category_id];
                            $term_id = obtener_o_crear_categoria($categoria_info);
                            if ($term_id) {
                                $category_ids[] = $term_id;
                            }
                        }
                    }

                    // Asignar todas las categorías al producto
                    if (!empty($category_ids)) {
                        wp_set_object_terms($product_id, $category_ids, 'product_cat');
                    }
                }

                // Manejar imagen (solo si existe)
                if (!empty($woocommerce_product['images'])) {
                    $sku = $woocommerce_product['sku'];
                    $image_path = "/var/www/vhosts/vd.com.ar/ftp-incoming/{$sku}.png";

                    if (file_exists($image_path)) {
                        $upload_file = wp_upload_bits(basename($image_path), null, file_get_contents($image_path));
                        if (!$upload_file['error']) {
                            $wp_filetype = wp_check_filetype($upload_file['file'], null);
                            $attachment = [
                                'post_mime_type' => $wp_filetype['type'],
                                'post_title'     => sanitize_file_name(basename($image_path)),
                                'post_content'   => '',
                                'post_status'    => 'inherit'
                            ];
                            $attach_id = wp_insert_attachment($attachment, $upload_file['file'], $product_id);
                            if ($attach_id) {
                                $attach_data = wp_generate_attachment_metadata($attach_id, $upload_file['file']);
                                wp_update_attachment_metadata($attach_id, $attach_data);
                                set_post_thumbnail($product_id, $attach_id);
                            }
                        }
                    }
                }

                $productos_insertados++;
            }
            
            // Commit la transacción
            $wpdb->query('COMMIT');
            
            echo "Lote completado: {$productos_insertados}/{$total_productos} productos procesados\n";
            
        } catch (Exception $e) {
            // Rollback en caso de error
            $wpdb->query('ROLLBACK');
            error_log("Error en lote: " . $e->getMessage());
            throw $e;
        }
        
        // Limpiar cache cada cierto número de lotes para evitar sobrecarga de memoria
        if (($i / $batch_size) % 10 === 0) {
            wp_cache_flush();
        }
    }
    
    return $productos_insertados;
}

// Función para convertir producto a formato WooCommerce (sin cambios)
function convertir_a_formato_woocommerce($product_data, $sucursal_info) {
    // Limpiar y formatear descripciones
    $clean_description = trim($product_data["description"]);
    $clean_short_description = trim($product_data["short_description"]);
    $product_name = !empty($clean_description) ? $clean_description : $clean_short_description;
    
    // Generar URL de imagen basada en SKU
    $image_url = "/var/www/vhosts/vd.com.ar/ftp-incoming/{$product_data["sku"]}.png";
    
    // Mapear categoría con cache
    $categoria_mapeada = mapear_categoria_optimizado($product_data["meta_data"]);
    $categories = [];
    if ($categoria_mapeada) {
        $categories[] = ['id' => $categoria_mapeada['category_id']];
    }
    
    // Crear modelo compatible con WooCommerce
    return [
        'sku' => (string)$product_data["sku"],
        'name' => $product_name,
        'regular_price' => (string)$product_data["regular_price"],
        'description' => $clean_description,
        'short_description' => $clean_short_description,
        'categories' => $categories,
        'type' => 'simple',
        'status' => 'publish',
        'stock_status' => 'instock',
        'images' => [
            [
                'src' => $image_url
            ]
        ],
        'meta_data' => [
            ['key' => '_sucursal_id', 'value' => (string)$sucursal_info['id']],
            ['key' => '_sucursal_nombre', 'value' => (string)$sucursal_info['nombre']],
            ['key' => '_meta_data_original', 'value' => (string)$product_data["meta_data"]],
            ['key' => '_meta_data_2_original', 'value' => (string)$product_data["meta_data_2"]],
            ['key' => '_unidad_medida', 'value' => trim($product_data["meta_data_2"])],
            ['key' => '_image_url', 'value' => $image_url]
        ]
    ];
}

// ==================== SCRIPT PRINCIPAL OPTIMIZADO ====================

$start_time = microtime(true);

// 1. Configuración de la sucursal
$blog_id = 4; // cambiar según sucursal
switch_to_blog($blog_id);

$archivo_a_sucursal_id = [
    "productos_sucursal_autopista.json"    => 4,
    "productos_sucursal_bahiablanca.json"  => 13,
    "productos_sucursal_campana.json"      => 3,
    "productos_sucursal_chacabuco.json"    => 24,
    "productos_sucursal_chaco.json"        => 15,
    "productos_sucursal_cordoba.json"      => 6,
    "productos_sucursal_gralroca.json"     => 20,
    "productos_sucursal_josecpaz.json"     => 4,
    "productos_sucursal_jujuy.json"        => 23,
    "productos_sucursal_mardelplata.json"  => 12,
    "productos_sucursal_maschwitz.json"    => 19,
    "productos_sucursal_mendoza.json"      => 14,
    "productos_sucursal_moreno.json"       => 18,
    "productos_sucursal_neuquen.json"      => 8,
    "productos_sucursal_posadas.json"      => 21,
    "productos_sucursal_salta.json"        => 9,
    "productos_sucursal_sanjuan.json"      => 16,
    "productos_sucursal_santafe.json"      => 5,
    "productos_sucursal_trelew.json"       => 22,
];

$sucursal_id_a_archivo = array_flip($archivo_a_sucursal_id);

// Información de la sucursal
$sucursal_info = [
    'id' => $blog_id,
    'nombre' => 'Autopista'
];

// 2. Cargar y procesar datos
$json_file_path = '/var/www/vhosts/vd.com.ar/ftp-incoming/uploads/' . $sucursal_id_a_archivo[$blog_id];

if (file_exists($json_file_path)) {
    echo "Cargando archivo: {$json_file_path}\n";
    
    $json_content = file_get_contents($json_file_path);
    $json_data = json_decode($json_content, true);

    if (is_array($json_data) && isset($json_data['productos']) && is_array($json_data['productos'])) {
        $productos = $json_data['productos'];
        $total_productos = count($productos);
        
        echo "Preparando {$total_productos} productos para inserción...\n";
        
        // 3. Pre-procesar todos los productos (convertir a formato WooCommerce)
        $productos_procesados = [];
        
        foreach ($productos as $product_data) {
            $productos_procesados[] = convertir_a_formato_woocommerce($product_data, $sucursal_info);
        }
        
        echo "Productos pre-procesados: " . count($productos_procesados) . "\n";
        
        // 4. Insertar productos por lotes
        try {
            $productos_insertados = insertar_productos_por_lotes($productos_procesados, $sucursal_info);
            
            // Commit final
            $wpdb->query('COMMIT');
            
            $end_time = microtime(true);
            $execution_time = round($end_time - $start_time, 2);
            $productos_por_segundo = round($productos_insertados / $execution_time, 2);
            
            echo "\n=== RESUMEN DE IMPORTACIÓN ===\n";
            echo "Productos insertados: {$productos_insertados}\n";
            echo "Tiempo de ejecución: {$execution_time} segundos\n";
            echo "Velocidad: {$productos_por_segundo} productos/segundo\n";
            echo "Promedio por producto: " . round($execution_time / $productos_insertados, 4) . " segundos\n";
            
        } catch (Exception $e) {
            error_log("Error durante la inserción masiva: " . $e->getMessage());
            echo "Error durante la inserción masiva: " . $e->getMessage() . "\n";
        }
        
    } else {
        error_log("El archivo JSON no contiene un array de productos válido.");
        echo "El archivo JSON no contiene un array de productos válido.\n";
    }
} else {
    error_log("No se encontró el archivo de productos en la ruta: {$json_file_path}");
    echo "No se encontró el archivo de productos en la ruta: {$json_file_path}\n";
}

// Limpiar y restaurar
wp_cache_flush();
restore_current_blog();

// Restaurar autocommit
$wpdb->query('SET autocommit = 1;');

echo "Importación completada.\n";
?>
