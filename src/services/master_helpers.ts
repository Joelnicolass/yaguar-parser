import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { getCredencialesSucursal } from "../config/sucursales_credenciales";
import fs from "fs";
import path from "path";

interface ProductWithCategories {
  id: number;
  sku: string;
  name: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  sucursal_id?: string;
  sucursal_nombre?: string;
}

interface CategoryMappingJson {
  sucursalID: number;
  categoryMap: Record<string, number>;
}

// Cache de instancias de WooCommerce
const woocommerceInstances: Map<number, WooCommerceRestApi> = new Map();

// Función local para inicializar instancia de WooCommerce
function initializeSucursalInstance(
  sucursalId: number
): WooCommerceRestApi | null {
  if (woocommerceInstances.has(sucursalId)) {
    return woocommerceInstances.get(sucursalId)!;
  }

  const credenciales = getCredencialesSucursal(sucursalId);
  if (!credenciales) {
    console.error(
      `❌ No se encontraron credenciales para sucursal ${sucursalId}`
    );
    return null;
  }

  const wooInstance = new WooCommerceRestApi({
    url: credenciales.credenciales.url,
    consumerKey: credenciales.credenciales.consumerKey,
    consumerSecret: credenciales.credenciales.consumerSecret,
    version: (credenciales.credenciales.version || "wc/v3") as any,
    axiosConfig: {
      timeout: 300000, // 5 minutos
    },
  });

  console.log(
    `✅ Instancia WooCommerce inicializada para sucursal ${sucursalId}`
  );
  woocommerceInstances.set(sucursalId, wooInstance);
  return wooInstance;
}

export const getCategoriesAndSubcategories = async () => {
  // Esta función puede ser implementada más tarde si es necesaria
};

export const getAllProductsWithCategories = async (
  sucursalId: number
): Promise<ProductWithCategories[]> => {
  console.log(
    `🔍 Obteniendo todos los productos con categorías para sucursal ${sucursalId}...`
  );

  const wooInstance = initializeSucursalInstance(sucursalId);
  if (!wooInstance) {
    throw new Error(
      `No se pudo inicializar WooCommerce para sucursal ${sucursalId}`
    );
  }

  const allProducts: ProductWithCategories[] = [];
  let page = 1;
  const perPage = 100; // Obtener 100 productos por página
  let hasMoreProducts = true;

  const testMode = true;
  const maxPages = testMode ? 2 : Infinity; // Limitar a 2 páginas en modo test

  try {
    while (hasMoreProducts && page <= maxPages) {
      console.log(`📄 Obteniendo página ${page}...`);

      const response = await wooInstance.get("products", {
        per_page: perPage,
        page,
        _fields: "id,sku,name,categories,meta_data", // Solo campos necesarios para optimizar
      });

      const products = response.data;

      if (!products || products.length === 0) {
        hasMoreProducts = false;
        break;
      }

      // Procesar productos de esta página
      for (const product of products) {
        const productWithCategories: ProductWithCategories = {
          id: product.id,
          sku: product.sku || "Sin SKU",
          name: product.name || "Sin nombre",
          categories: product.categories || [],
        };

        // Extraer información de sucursal desde meta_data si existe
        if (product.meta_data && Array.isArray(product.meta_data)) {
          const sucursalIdMeta = product.meta_data.find(
            (meta: any) => meta.key === "_sucursal_id"
          );
          const sucursalNombreMeta = product.meta_data.find(
            (meta: any) => meta.key === "_sucursal_nombre"
          );

          if (sucursalIdMeta) {
            productWithCategories.sucursal_id = sucursalIdMeta.value;
          }
          if (sucursalNombreMeta) {
            productWithCategories.sucursal_nombre = sucursalNombreMeta.value;
          }
        }

        allProducts.push(productWithCategories);
      }

      console.log(`✅ Página ${page}: ${products.length} productos procesados`);
      page++;

      // Pequeño delay para no saturar la API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `\n📊 RESUMEN TOTAL: ${allProducts.length} productos encontrados\n`
    );

    // Generar y guardar el mapeo JSON
    await generateCategoryMapping(allProducts, sucursalId);

    return allProducts;
  } catch (error) {
    console.error(`❌ Error obteniendo productos:`, error);
    throw error;
  }
};

async function generateCategoryMapping(
  products: ProductWithCategories[],
  sucursalId: number
): Promise<void> {
  console.log(
    `\n📋 Generando mapeo JSON de categorías para sucursal ${sucursalId}...`
  );

  const categoryMap: Record<string, number> = {};
  let mappedProductsCount = 0;
  let productsWithoutCategory = 0;

  products.forEach((product) => {
    if (product.sku && product.sku !== "Sin SKU") {
      if (product.categories && product.categories.length > 0) {
        // Tomar la primera categoría si hay múltiples
        if (!product.categories[0] || !product.categories[0].id) {
          console.warn(
            `⚠️ Producto con SKU ${product.sku} tiene categoría inválida`
          );
          productsWithoutCategory++;
          return;
        }
        const firstCategory = product.categories[0];
        categoryMap[product.sku] = firstCategory.id;
        mappedProductsCount++;
      } else {
        productsWithoutCategory++;
      }
    }
  });

  const mappingJson: CategoryMappingJson = {
    sucursalID: sucursalId,
    categoryMap: categoryMap,
  };

  // Crear directorio temp si no existe
  const tempDir = path.resolve(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.resolve(
    tempDir,
    `sucursal_${sucursalId}_category_mapping.json`
  );

  try {
    await fs.promises.writeFile(filePath, JSON.stringify(mappingJson, null, 2));

    console.log(`✅ Mapeo de categorías generado exitosamente:`);
    console.log(`   📁 Archivo: ${filePath}`);
    console.log(`   📊 Productos mapeados: ${mappedProductsCount}`);
    console.log(`   ❌ Productos sin categoría: ${productsWithoutCategory}`);
    console.log(
      `   📈 Total categorías únicas: ${Object.keys(categoryMap).length}`
    );

    // Mostrar una muestra del mapeo generado
    const sampleEntries = Object.entries(categoryMap).slice(0, 5);
    if (sampleEntries.length > 0) {
      console.log(`\n📋 Muestra del mapeo generado:`);
      sampleEntries.forEach(([sku, categoryId]) => {
        console.log(`   SKU ${sku} → Categoría ID ${categoryId}`);
      });
      if (Object.keys(categoryMap).length > 5) {
        console.log(`   ... y ${Object.keys(categoryMap).length - 5} más`);
      }
    }
  } catch (error) {
    console.error(`❌ Error al guardar el mapeo de categorías:`, error);
    throw error;
  }
}

export const createSingleProductForTesting = async (
  sucursalId: number,
  productData: {
    sku: string;
    name: string;
    regular_price: string;
    description?: string;
    short_description?: string;
    categoryId?: number; // ID de categoría específica para testing
  }
): Promise<{
  success: boolean;
  productId?: number;
  productUrl?: string;
  error?: string;
  categoryInfo?: {
    id: number;
    name: string;
    slug: string;
  };
}> => {
  console.log(`🧪 Creando producto de testing para sucursal ${sucursalId}...`);
  console.log(`📋 Datos del producto:`, JSON.stringify(productData, null, 2));

  try {
    const wooInstance = initializeSucursalInstance(sucursalId);
    if (!wooInstance) {
      throw new Error(
        `No se pudo inicializar WooCommerce para sucursal ${sucursalId}`
      );
    }

    // Verificar si el SKU ya existe
    console.log(`🔍 Verificando si SKU ${productData.sku} ya existe...`);
    const existingProductResponse = await wooInstance.get("products", {
      sku: productData.sku,
      per_page: 1,
    });

    if (
      existingProductResponse.data &&
      existingProductResponse.data.length > 0
    ) {
      const existingProduct = existingProductResponse.data[0];
      console.log(
        `⚠️ Producto con SKU ${productData.sku} ya existe (ID: ${existingProduct.id})`
      );

      // Obtener información de categoría del producto existente
      let categoryInfo = undefined;
      if (existingProduct.categories && existingProduct.categories.length > 0) {
        const firstCategory = existingProduct.categories[0];
        categoryInfo = {
          id: firstCategory.id,
          name: firstCategory.name,
          slug: firstCategory.slug,
        };
      }

      return {
        success: false,
        error: `Producto con SKU ${productData.sku} ya existe`,
        productId: existingProduct.id,
        productUrl: existingProduct.permalink,
        categoryInfo,
      };
    }

    // Obtener información de la categoría si se especificó
    let categoryInfo = undefined;
    if (productData.categoryId) {
      try {
        console.log(
          `🏷️ Obteniendo información de categoría ${productData.categoryId}...`
        );
        const categoryResponse = await wooInstance.get(
          `products/categories/${productData.categoryId}`
        );
        if (categoryResponse.data) {
          categoryInfo = {
            id: categoryResponse.data.id,
            name: categoryResponse.data.name,
            slug: categoryResponse.data.slug,
          };
          console.log(
            `✅ Categoría encontrada: ${categoryInfo.name} (${categoryInfo.slug})`
          );
        }
      } catch (categoryError) {
        console.warn(
          `⚠️ Error obteniendo información de categoría ${productData.categoryId}:`,
          categoryError
        );
      }
    }

    // Preparar el producto para WooCommerce
    const wooCommerceProduct = {
      sku: productData.sku,
      name: productData.name,
      regular_price: productData.regular_price,
      description: productData.description || productData.name,
      short_description: productData.short_description || productData.name,
      type: "simple",
      status: "publish",
      stock_status: "instock",
      categories: productData.categoryId
        ? [{ id: productData.categoryId }]
        : [],
    };

    console.log(`🚀 Creando producto en WooCommerce...`);
    const createResponse = await wooInstance.post(
      "products",
      wooCommerceProduct
    );

    if (createResponse.data && createResponse.data.id) {
      const createdProduct = createResponse.data;

      console.log(`✅ Producto creado exitosamente:`);
      console.log(`   🆔 ID: ${createdProduct.id}`);
      console.log(`   📦 SKU: ${createdProduct.sku}`);
      console.log(`   🏷️ Nombre: ${createdProduct.name}`);
      console.log(`   💰 Precio: $${createdProduct.regular_price}`);
      console.log(`   🌐 URL: ${createdProduct.permalink}`);

      if (createdProduct.categories && createdProduct.categories.length > 0) {
        console.log(`   🏷️ Categorías asignadas:`);
        createdProduct.categories.forEach((cat: any) => {
          console.log(`      • ${cat.name} (ID: ${cat.id}, Slug: ${cat.slug})`);
        });
      } else {
        console.log(`   🏷️ Sin categorías asignadas`);
      }

      // Actualizar categoryInfo con la información real del producto creado
      if (createdProduct.categories && createdProduct.categories.length > 0) {
        const firstCategory = createdProduct.categories[0];
        categoryInfo = {
          id: firstCategory.id,
          name: firstCategory.name,
          slug: firstCategory.slug,
        };
      }

      return {
        success: true,
        productId: createdProduct.id,
        productUrl: createdProduct.permalink,
        categoryInfo,
      };
    } else {
      throw new Error(
        "No se recibió un ID válido en la respuesta de WooCommerce"
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";
    console.error(`❌ Error creando producto de testing:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
};
