<?php
// Variable para controlar el estado de importación
$importing_products = true;

// importar_productos.php
require_once( dirname(__FILE__) . '/wp-load.php' ); 
require_once( ABSPATH . 'wp-admin/includes/taxonomy.php' );
require_once( ABSPATH . 'wp-admin/includes/image.php' );
require_once( ABSPATH . 'wp-admin/includes/file.php' );
require_once( ABSPATH . 'wp-admin/includes/media.php' );

// Variables para almacenar hooks removidos
$removed_hooks = [];

// Función para remover hooks de forma controlada
function disable_hooks_for_import() {
    global $removed_hooks;
    
    // Guardar hooks existentes antes de removerlos
    $removed_hooks['save_post'] = $GLOBALS['wp_filter']['save_post'] ?? null;
    $removed_hooks['save_post_product'] = $GLOBALS['wp_filter']['save_post_product'] ?? null;
    $removed_hooks['woocommerce_product_object_save'] = $GLOBALS['wp_filter']['woocommerce_product_object_save'] ?? null;
    $removed_hooks['woocommerce_update_product'] = $GLOBALS['wp_filter']['woocommerce_update_product'] ?? null;
    $removed_hooks['woocommerce_new_product'] = $GLOBALS['wp_filter']['woocommerce_new_product'] ?? null;
    
    // Remover hooks específicos que ralentizan la importación
    remove_all_actions('woocommerce_product_object_save');
    remove_all_actions('save_post_product');
    remove_all_actions('woocommerce_update_product');
    remove_all_actions('woocommerce_new_product');
    
    // Solo remover algunos hooks críticos de save_post, no todos
    remove_action('save_post', 'wp_cache_post_change');
    remove_action('save_post', 'wp_schedule_update_checks');
}

// Función para restaurar hooks
function restore_hooks_after_import() {
    global $removed_hooks;
    
    // Restaurar hooks guardados
    if (!empty($removed_hooks['save_post'])) {
        $GLOBALS['wp_filter']['save_post'] = $removed_hooks['save_post'];
    }
    if (!empty($removed_hooks['save_post_product'])) {
        $GLOBALS['wp_filter']['save_post_product'] = $removed_hooks['save_post_product'];
    }
    if (!empty($removed_hooks['woocommerce_product_object_save'])) {
        $GLOBALS['wp_filter']['woocommerce_product_object_save'] = $removed_hooks['woocommerce_product_object_save'];
    }
    if (!empty($removed_hooks['woocommerce_update_product'])) {
        $GLOBALS['wp_filter']['woocommerce_update_product'] = $removed_hooks['woocommerce_update_product'];
    }
    if (!empty($removed_hooks['woocommerce_new_product'])) {
        $GLOBALS['wp_filter']['woocommerce_new_product'] = $removed_hooks['woocommerce_new_product'];
    }
}

// Antes de iniciar el bucle de importación
if ($importing_products) {
    disable_hooks_for_import();
}
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

// Función para mapear categorías basado en meta_data
function mapear_categoria($meta_data_categoria_id) {
    global $categorias_por_id, $categorias_por_id_autopista;
    
    // Buscar la categoría base por ID
    if (!isset($categorias_por_id[$meta_data_categoria_id])) {
        return null; // Categoría no encontrada
    }
    
    $categoria_base = $categorias_por_id[$meta_data_categoria_id];
    $nombre_categoria = $categoria_base['name'];
    
    // Buscar la categoría correspondiente en autopista por nombre
    foreach ($categorias_por_id_autopista as $id_autopista => $categoria_autopista) {
        if ($categoria_autopista['name'] === $nombre_categoria) {
            return [
                'category_id' => $id_autopista,
                'name' => $categoria_autopista['name'],
                'slug' => $categoria_autopista['slug'],
                'original_id' => $meta_data_categoria_id
            ];
        }
    }
    
    return null; // No se encontró equivalencia en autopista
}

// Función para convertir producto a formato WooCommerce
function convertir_a_formato_woocommerce($product_data, $sucursal_info) {
    // Limpiar y formatear descripciones
    $clean_description = trim($product_data["description"]);
    $clean_short_description = trim($product_data["short_description"]);
    $product_name = !empty($clean_description) ? $clean_description : $clean_short_description;
    
    // Generar URL de imagen basada en SKU
    $image_url = "/var/www/vhosts/vd.com.ar/ftp-incoming/{$product_data["sku"]}.png";
    
    // Mapear categoría
    $categoria_mapeada = mapear_categoria($product_data["meta_data"]);
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

// 1. Elegir la sucursal (blog_id)
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

// Crear objeto inverso: id => nombre de archivo
$sucursal_id_a_archivo = array_flip($archivo_a_sucursal_id);

// Variables blog_id_sucursal
$blog_id_sucursal_autopista    = 4;
$blog_id_sucursal_bahiablanca  = 13;
$blog_id_sucursal_campana      = 3;
$blog_id_sucursal_chacabuco    = 24;
$blog_id_sucursal_chaco        = 15;
$blog_id_sucursal_cordoba      = 6;
$blog_id_sucursal_gralroca     = 20;
$blog_id_sucursal_josecpaz     = 4;
$blog_id_sucursal_jujuy        = 23;
$blog_id_sucursal_mardelplata  = 12;
$blog_id_sucursal_maschwitz    = 19;
$blog_id_sucursal_mendoza      = 14;
$blog_id_sucursal_moreno       = 18;
$blog_id_sucursal_neuquen      = 8;
$blog_id_sucursal_posadas      = 21;
$blog_id_sucursal_salta        = 9;
$blog_id_sucursal_sanjuan      = 16;
$blog_id_sucursal_santafe      = 5;
$blog_id_sucursal_trelew       = 22;
// Información de la sucursal
$sucursal_info = [
    'id' => 4,
    'nombre' => 'Autopista'
];

// 2. Importar el JSON con los productos desde la ruta especificada
$json_file_path = '/var/www/vhosts/vd.com.ar/ftp-incoming/uploads/' . $sucursal_id_a_archivo[$blog_id];
$ultimo_producto_id = null; // Variable para rastrear el último producto creado
$productos_insertados = 0;

if (file_exists($json_file_path)) {
    $json_content = file_get_contents($json_file_path);
    $json_data = json_decode($json_content, true);

    if (is_array($json_data) && isset($json_data['productos']) && is_array($json_data['productos'])) {
        $productos = $json_data['productos'];
        $total_productos = count($productos);
        
        echo "Iniciando importación de {$total_productos} productos...\n";
        
        foreach ($productos as $index => $product_data) {
            // 2.1. Convertir a formato WooCommerce (similar al servicio TypeScript)
            $woocommerce_product = convertir_a_formato_woocommerce($product_data, $sucursal_info);

            // 3. Crear el producto usando el modelo WooCommerce generado
            $product_id = wp_insert_post([
                'post_title'   => $woocommerce_product['name'],
                'post_content' => $woocommerce_product['description'],
                'post_excerpt' => $woocommerce_product['short_description'],
                'post_status'  => $woocommerce_product['status'],
                'post_type'    => 'product'
            ]);

            if ($product_id && !is_wp_error($product_id)) {
                $ultimo_producto_id = $product_id; // Guardar el último ID exitoso
                $productos_insertados++;
                
                // 4. Aplicar meta campos desde el modelo WooCommerce
                update_post_meta($product_id, '_sku', $woocommerce_product['sku']);
                update_post_meta($product_id, '_regular_price', $woocommerce_product['regular_price']);
                update_post_meta($product_id, '_price', $woocommerce_product['regular_price']);
                update_post_meta($product_id, '_stock_status', $woocommerce_product['stock_status']);

                // Aplicar meta_data adicional del modelo
                foreach ($woocommerce_product['meta_data'] as $meta) {
                    update_post_meta($product_id, $meta['key'], $meta['value']);
                }

                // 4.1. Asignar categorías desde el modelo
                if (!empty($woocommerce_product['categories'])) {
                    $category_ids = [];

                    foreach ($woocommerce_product['categories'] as $category) {
                        $category_id = $category['id'];

                        // Buscar información de la categoría en autopista
                        $categoria_info = null;
                        foreach ($categorias_por_id_autopista as $id => $cat) {
                            if ($id == $category_id) {
                                $categoria_info = $cat;
                                break;
                            }
                        }

                        if ($categoria_info) {
                            // Verificar si la categoría existe en WordPress
                            $term_exists = term_exists($categoria_info['name'], 'product_cat');

                            if (!$term_exists) {
                                // Crear la categoría si no existe
                                $new_term = wp_insert_term(
                                    $categoria_info['name'],
                                    'product_cat',
                                    array('slug' => $categoria_info['slug'])
                                );

                                if (!is_wp_error($new_term)) {
                                    $category_ids[] = $new_term['term_id'];
                                } else {
                                    error_log("Error creando categoría: " . $new_term->get_error_message());
                                }
                            } else {
                                $category_ids[] = $term_exists['term_id'];
                            }
                        }
                    }

                    // Asignar todas las categorías al producto
                    if (!empty($category_ids)) {
                        wp_set_object_terms($product_id, $category_ids, 'product_cat');
                    }
                }

                // 5. Manejar imagen destacada desde el modelo
                if (!empty($woocommerce_product['images'])) {
                    $image_info = $woocommerce_product['images'][0];
                    $image_url = $image_info['src'];

                    // Extraer SKU de la URL para construir path local
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
                            if ($attach_id && !is_wp_error($attach_id)) {
                                $attach_data = wp_generate_attachment_metadata($attach_id, $upload_file['file']);
                                wp_update_attachment_metadata($attach_id, $attach_data);
                                set_post_thumbnail($product_id, $attach_id);
                            }
                        } else {
                            error_log("Error subiendo imagen: {$upload_file['error']}");
                        }
                    }
                }
                
                // Mostrar progreso cada 100 productos
                if (($index + 1) % 100 === 0) {
                    echo "Procesados " . ($index + 1) . " de {$total_productos} productos...\n";
                }

            } else {
                $error_msg = is_wp_error($product_id) ? $product_id->get_error_message() : "Error desconocido";
                error_log("Error creando el producto: " . $error_msg);
            }
        }
        
        echo "Importación completada: {$productos_insertados} productos insertados de {$total_productos} totales.\n";
        
    } else {
        error_log("El archivo JSON no contiene un array de productos válido.");
    }
} else {
    error_log("No se encontró el archivo de productos en la ruta: {$json_file_path}");
}
// --- FIN DE LA IMPORTACIÓN ---

// Restaurar hooks antes de ejecutar acciones finales
$importing_products = false;
restore_hooks_after_import();

// Ejecutar hooks finales solo si se insertó al menos un producto
if ($ultimo_producto_id && $productos_insertados > 0) {
    echo "Ejecutando hooks finales en el último producto creado (ID: {$ultimo_producto_id})...\n";
    
    try {
        // Cargar el último producto creado
        $product_for_cleanup = wc_get_product($ultimo_producto_id);

        if ($product_for_cleanup && !is_wp_error($product_for_cleanup)) {
            // Ejecutar save() para disparar todos los hooks necesarios
            // Esto ejecutará validaciones, cálculos de precios, indexación, etc.
            $product_for_cleanup->save();
            echo "Hooks finales ejecutados correctamente.\n";
        } else {
            error_log("No se pudo cargar el producto para cleanup: " . ($product_for_cleanup ? $product_for_cleanup->get_error_message() : 'Producto no encontrado'));
        }
    } catch (Exception $e) {
        error_log("Error ejecutando hooks finales: " . $e->getMessage());
    }
} else {
    echo "No se ejecutaron hooks finales - no hay productos insertados.\n";
}

// Limpiar cache de WordPress
wp_cache_flush();

// Restaurar blog
restore_current_blog();

echo "Script completado. Productos procesados: {$productos_insertados}\n";

