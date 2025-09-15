/**
 * woocommerce_controller - Controlador para interactuar con la API de WooCommerce
 *
 * Este controlador maneja:
 * - Carga completa de productos desde archivos JSON
 * - Actualización de productos existentes comparando archivos
 * - Listado de todos los productos de WooCommerce
 * - Integración con la API REST de WooCommerce
 *
 * Librerías utilizadas:
 * - @woocommerce/woocommerce-rest-api: Cliente oficial para la API de WooCommerce
 * - fs: Módulo nativo de Node.js para operaciones del sistema de archivos
 * - path: Módulo nativo de Node.js para manejo de rutas
 */

import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import fs from "fs";
import path from "path";
import logger from "../utils/logger";
import { config } from "../config";
import { WooCommerceConfig } from "../types";

// Interfaces para tipado
interface WooCommerceProduct {
  id?: number;
  sku: string;
  name: string;
  regular_price: string;
  stock_quantity: number;
  manage_stock: boolean;
  stock_status: string;
  categories: Array<{ id?: number; name: string }>;
  type: string;
  status: string;
  meta_data?: Array<{ key: string; value: any }>;
}

interface ProductFromJson {
  SKU: string;
  Name: string;
  "Regular price": string;
  Stock: string;
  Categories: string;
  Type: string;
  Published: string;
  "Meta: _manage_stock": string;
  "Meta: _stock_status": string;
}

export class WoocommerceController {
  private woocommerce: WooCommerceRestApi;

  /**
   * Constructor - Inicializa la instancia de WooCommerce API
   */
  constructor(woocommerceConfig: WooCommerceConfig) {
    this.woocommerce = new WooCommerceRestApi({
      url: config.woocommerce.url,
      consumerKey: config.woocommerce.consumerKey,
      consumerSecret: config.woocommerce.consumerSecret,
      version: config.woocommerce.version || ("wc/v3" as any),
      axiosConfig: {
        timeout: 120000, // 2 minutos timeout para operaciones batch
      },
    });

    logger.info("🛒 WooCommerce Controller inicializado", {
      url: config.woocommerce.url,
      version: config.woocommerce.version,
    });
  }

  /**
   * Carga completa de productos desde archivo JSON
   * Lee el archivo JSON generado y sube todos los productos a WooCommerce
   */
  public async uploadProductsFromJson(jsonFilePath?: string): Promise<{
    success: boolean;
    uploadedCount: number;
    failedCount: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    let uploadedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      // Usar la ruta proporcionada o construir la ruta por defecto
      const filePath = jsonFilePath || this.getLatestJsonFilePath();

      logger.info("🚀 Iniciando carga completa de productos desde JSON", {
        filePath,
      });

      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo JSON no encontrado: ${filePath}`);
      }

      // Leer y parsear el archivo JSON
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const productsFromJson: ProductFromJson[] = JSON.parse(fileContent);

      logger.info(
        `📦 ${productsFromJson.length} productos encontrados en JSON`
      );

      // Procesar productos en lotes para evitar sobrecarga de la API
      const batchSize = 10;
      for (let i = 0; i < productsFromJson.length; i += batchSize) {
        const batch = productsFromJson.slice(i, i + batchSize);

        // Procesar cada producto del lote
        const batchPromises = batch.map(async (productJson) => {
          try {
            const wooProduct = this.convertJsonToWooProduct(productJson);

            // Crear producto en WooCommerce
            const response = await this.woocommerce.post(
              "products",
              wooProduct
            );

            if (response.status === 201) {
              uploadedCount++;
              logger.debug(
                `✅ Producto creado: ${wooProduct.name} (SKU: ${wooProduct.sku})`
              );
            } else {
              failedCount++;
              errors.push(
                `Error al crear producto ${wooProduct.sku}: Status ${response.status}`
              );
            }
          } catch (error) {
            failedCount++;
            const errorMsg =
              error instanceof Error ? error.message : "Error desconocido";
            errors.push(
              `Error al procesar producto ${productJson.SKU}: ${errorMsg}`
            );
            logger.error(
              `❌ Error al crear producto ${productJson.SKU}:`,
              error
            );
          }
        });

        // Esperar a que termine el lote antes de procesar el siguiente
        await Promise.all(batchPromises);

        // Pausa breve entre lotes para no sobrecargar la API
        await new Promise((resolve) => setTimeout(resolve, 500));

        logger.info(
          `📊 Progreso: ${Math.min(i + batchSize, productsFromJson.length)}/${
            productsFromJson.length
          } productos procesados`
        );
      }

      const duration = Date.now() - startTime;

      logger.info("✅ Carga completa de productos finalizada", {
        totalProducts: productsFromJson.length,
        uploadedCount,
        failedCount,
        duration: `${duration}ms`,
      });

      return {
        success: failedCount === 0,
        uploadedCount,
        failedCount,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en carga completa de productos:", error);

      return {
        success: false,
        uploadedCount,
        failedCount: failedCount + 1,
        errors: [...errors, errorMessage],
        duration,
      };
    }
  }

  /**
   * Actualizar productos comparando con el archivo JSON anterior
   * Compara el último JSON con el anterior y actualiza productos con cambios
   */
  public async updateProductsFromComparison(): Promise<{
    success: boolean;
    updatedCount: number;
    failedCount: number;
    skippedCount: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
      logger.info("🔄 Iniciando actualización de productos por comparación");

      // Obtener los dos archivos JSON más recientes
      const jsonFiles = this.getJsonFilesList();

      if (jsonFiles.length < 2) {
        throw new Error("Se necesitan al menos 2 archivos JSON para comparar");
      }

      const latestFile = jsonFiles[0]!; // El más reciente
      const previousFile = jsonFiles[1]!; // El anterior

      logger.info("📋 Comparando archivos:", {
        latest: latestFile,
        previous: previousFile,
      });

      // Leer ambos archivos
      const latestProducts: ProductFromJson[] = JSON.parse(
        fs.readFileSync(latestFile, "utf-8")
      );
      const previousProducts: ProductFromJson[] = JSON.parse(
        fs.readFileSync(previousFile, "utf-8")
      );

      // Crear mapas para búsqueda rápida por SKU
      const latestMap = new Map(latestProducts.map((p) => [p.SKU, p]));
      const previousMap = new Map(previousProducts.map((p) => [p.SKU, p]));

      // Encontrar productos que han cambiado
      const changedProducts: ProductFromJson[] = [];

      for (const [sku, latestProduct] of latestMap) {
        const previousProduct = previousMap.get(sku);

        if (!previousProduct) {
          // Producto nuevo, agregar a la lista de cambios
          changedProducts.push(latestProduct);
        } else if (this.hasProductChanged(latestProduct, previousProduct)) {
          // Producto existente con cambios
          changedProducts.push(latestProduct);
        } else {
          skippedCount++;
        }
      }

      logger.info(
        `🔍 Encontrados ${changedProducts.length} productos con cambios`
      );

      // Procesar productos cambiados
      for (const productJson of changedProducts) {
        try {
          // Buscar el producto en WooCommerce por SKU
          const searchResponse = await this.woocommerce.get("products", {
            sku: productJson.SKU,
          });

          if (searchResponse.status === 200 && searchResponse.data.length > 0) {
            const existingProduct = searchResponse.data[0];
            const updatedProduct = this.convertJsonToWooProduct(productJson);

            // Actualizar el producto existente
            const updateResponse = await this.woocommerce.put(
              `products/${existingProduct.id}`,
              updatedProduct
            );

            if (updateResponse.status === 200) {
              updatedCount++;
              logger.debug(
                `✅ Producto actualizado: ${updatedProduct.name} (SKU: ${updatedProduct.sku})`
              );
            } else {
              failedCount++;
              errors.push(
                `Error al actualizar producto ${productJson.SKU}: Status ${updateResponse.status}`
              );
            }
          } else {
            // Producto no encontrado en WooCommerce, crear nuevo
            const wooProduct = this.convertJsonToWooProduct(productJson);
            const createResponse = await this.woocommerce.post(
              "products",
              wooProduct
            );

            if (createResponse.status === 201) {
              updatedCount++;
              logger.debug(
                `✅ Producto nuevo creado: ${wooProduct.name} (SKU: ${wooProduct.sku})`
              );
            } else {
              failedCount++;
              errors.push(
                `Error al crear producto nuevo ${productJson.SKU}: Status ${createResponse.status}`
              );
            }
          }
        } catch (error) {
          failedCount++;
          const errorMsg =
            error instanceof Error ? error.message : "Error desconocido";
          errors.push(
            `Error al procesar producto ${productJson.SKU}: ${errorMsg}`
          );
          logger.error(
            `❌ Error al actualizar producto ${productJson.SKU}:`,
            error
          );
        }

        // Pausa breve entre requests
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const duration = Date.now() - startTime;

      logger.info("✅ Actualización de productos finalizada", {
        totalChanged: changedProducts.length,
        updatedCount,
        failedCount,
        skippedCount,
        duration: `${duration}ms`,
      });

      return {
        success: failedCount === 0,
        updatedCount,
        failedCount,
        skippedCount,
        errors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en actualización de productos:", error);

      return {
        success: false,
        updatedCount,
        failedCount: failedCount + 1,
        skippedCount,
        errors: [...errors, errorMessage],
        duration,
      };
    }
  }

  /**
   * Listar todos los productos de WooCommerce
   * Devuelve todos los productos cargados en la tienda
   */
  public async getAllProducts(): Promise<{
    success: boolean;
    products: WooCommerceProduct[];
    totalCount: number;
    error?: string;
  }> {
    try {
      logger.info("📋 Obteniendo lista completa de productos de WooCommerce");

      const allProducts: WooCommerceProduct[] = [];
      let page = 1;
      const perPage = 100; // Máximo permitido por la API

      while (true) {
        const response = await this.woocommerce.get("products", {
          page: page,
          per_page: perPage,
          status: "any", // Incluir todos los estados
        });

        if (response.status !== 200) {
          throw new Error(`Error de API: Status ${response.status}`);
        }

        const products = response.data;
        allProducts.push(...products);

        logger.debug(
          `📦 Página ${page}: ${products.length} productos obtenidos`
        );

        // Si la página devuelve menos productos que el límite, hemos llegado al final
        if (products.length < perPage) {
          break;
        }

        page++;
      }

      logger.info("✅ Lista completa de productos obtenida", {
        totalProducts: allProducts.length,
        pages: page,
      });

      return {
        success: true,
        products: allProducts,
        totalCount: allProducts.length,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error al obtener productos de WooCommerce:", error);

      return {
        success: false,
        products: [],
        totalCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Convertir objeto JSON a formato WooCommerce
   */
  private convertJsonToWooProduct(
    productJson: ProductFromJson
  ): WooCommerceProduct {
    return {
      sku: productJson.SKU,
      name: productJson.Name,
      regular_price: productJson["Regular price"],
      stock_quantity: parseInt(productJson.Stock) || 0,

      manage_stock: productJson["Meta: _manage_stock"] === "yes",
      stock_status: productJson["Meta: _stock_status"] || "instock",
      categories: [{ name: productJson.Categories || "Sin categoría" }],
      type: productJson.Type || "simple",
      status: productJson.Published === "1" ? "publish" : "draft",
    };
  }

  /**
   * Comparar si un producto ha cambiado entre dos versiones
   */
  private hasProductChanged(
    latest: ProductFromJson,
    previous: ProductFromJson
  ): boolean {
    const fieldsToCompare = [
      "Name",
      "Regular price",
      "Stock",
      "Categories",
      "Meta: _stock_status",
    ];

    return fieldsToCompare.some((field) => {
      const latestValue = (latest as any)[field];
      const previousValue = (previous as any)[field];
      return latestValue !== previousValue;
    });
  }

  /**
   * Obtener la ruta del archivo JSON más reciente
   */
  private getLatestJsonFilePath(): string {
    const today = new Date().toISOString().split("T")[0];
    const fileName = `woocommerce_productos_${today}.json`;
    return path.join(config.paths.tempDir, "examples", fileName);
  }

  /**
   * Obtener lista de archivos JSON ordenados por fecha (más reciente primero)
   */
  private getJsonFilesList(): string[] {
    const examplesDir = path.join(config.paths.tempDir, "examples");

    if (!fs.existsSync(examplesDir)) {
      return [];
    }

    const files = fs
      .readdirSync(examplesDir)
      .filter(
        (file) =>
          file.startsWith("woocommerce_productos_") && file.endsWith(".json")
      )
      .map((file) => ({
        name: file,
        path: path.join(examplesDir, file),
        stats: fs.statSync(path.join(examplesDir, file)),
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()) // Más reciente primero
      .map((file) => file.path);

    return files;
  }

  /**
   * Método utilitario para probar la conexión con WooCommerce
   */
  public async testConnection(): Promise<{
    success: boolean;
    message: string;
    storeInfo?: any;
  }> {
    try {
      logger.info("🔗 Probando conexión con WooCommerce...");

      const response = await this.woocommerce.get("");

      if (response.status === 200) {
        logger.info("✅ Conexión con WooCommerce exitosa");

        return {
          success: true,
          message: "Conexión exitosa con WooCommerce",
          storeInfo: response.data,
        };
      } else {
        throw new Error(`Error de conexión: Status ${response.status}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error al conectar con WooCommerce:", error);

      return {
        success: false,
        message: `Error de conexión: ${errorMessage}`,
      };
    }
  }

  /**
   * Crear un producto individual en WooCommerce
   * Método público para uso desde otros servicios
   */
  public async createSingleProduct(productData: any): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
    action?: "created" | "updated" | "skipped";
  }> {
    try {
      logger.debug("🛍️ Creando producto individual en WooCommerce", {
        sku: productData.sku,
        name: productData.name,
      });

      const response = await this.woocommerce.post("products", productData);

      if (response.status === 201) {
        logger.debug(
          `✅ Producto creado exitosamente: ${productData.name} (ID: ${response.data.id})`
        );

        return {
          success: true,
          productId: response.data.id,
          action: "created",
        };
      } else {
        return {
          success: false,
          error: `Error de API: Status ${response.status}`,
        };
      }
    } catch (error: any) {
      // Verificar si es un error de SKU duplicado
      if (error.response?.data?.code === "product_invalid_sku") {
        logger.warn(
          `⚠️ SKU ${productData.sku} ya existe, intentando actualizar...`
        );

        // Intentar actualizar el producto existente
        const updateResult = await this.updateProductBySku(
          productData.sku,
          productData
        );
        return updateResult;
      }

      // Verificar si es un error de imagen inválida
      if (
        error.response?.data?.code === "woocommerce_product_invalid_image_id"
      ) {
        logger.warn(
          `⚠️ ID de imagen inválido para producto ${productData.sku}, reintentando sin imágenes...`
        );

        // Intentar crear el producto sin imágenes
        const productDataWithoutImages = { ...productData };
        delete productDataWithoutImages.images;

        const retryResult = await this.createProductWithoutImages(
          productDataWithoutImages
        );
        return retryResult;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error(`❌ Error al crear producto ${productData.sku}:`, error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Crear un producto sin imágenes (fallback para errores de imagen)
   */
  private async createProductWithoutImages(productData: any): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
    action?: "created" | "updated" | "skipped";
  }> {
    try {
      logger.debug("🛍️ Creando producto sin imágenes en WooCommerce", {
        sku: productData.sku,
        name: productData.name,
      });

      const response = await this.woocommerce.post("products", productData);

      if (response.status === 201) {
        logger.info(
          `✅ Producto creado exitosamente (sin imágenes): ${productData.name} (ID: ${response.data.id})`
        );

        return {
          success: true,
          productId: response.data.id,
          action: "created",
        };
      } else {
        return {
          success: false,
          error: `Error de API: Status ${response.status}`,
        };
      }
    } catch (error: any) {
      // Si aún hay error de SKU duplicado, intentar actualizar
      if (error.response?.data?.code === "product_invalid_sku") {
        logger.warn(
          `⚠️ SKU ${productData.sku} ya existe durante reintento, actualizando...`
        );

        const updateResult = await this.updateProductBySku(
          productData.sku,
          productData
        );
        return updateResult;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      logger.error(
        `❌ Error al crear producto sin imágenes ${productData.sku}:`,
        error
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Actualizar un producto existente por SKU
   */
  private async updateProductBySku(
    sku: string,
    productData: any
  ): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
    action?: "created" | "updated" | "skipped";
  }> {
    try {
      // Buscar el producto por SKU
      const existingProducts = await this.woocommerce.get("products", {
        sku: sku,
        per_page: 1,
      });

      if (existingProducts.data && existingProducts.data.length > 0) {
        const existingProduct = existingProducts.data[0];

        logger.info(
          `🔄 Actualizando producto existente: ${productData.name} (ID: ${existingProduct.id})`
        );

        // Remover campos que no se deben actualizar
        const updateData = { ...productData };
        delete updateData.sku; // No actualizar el SKU

        const response = await this.woocommerce.put(
          `products/${existingProduct.id}`,
          updateData
        );

        if (response.status === 200) {
          logger.info(
            `✅ Producto actualizado exitosamente: ${productData.name} (ID: ${existingProduct.id})`
          );

          return {
            success: true,
            productId: existingProduct.id,
            action: "updated",
          };
        } else {
          return {
            success: false,
            error: `Error al actualizar: Status ${response.status}`,
          };
        }
      } else {
        return {
          success: false,
          error: `No se encontró producto con SKU: ${sku}`,
        };
      }
    } catch (error: any) {
      // Verificar si es un error de imagen inválida durante actualización
      if (
        error.response?.data?.code === "woocommerce_product_invalid_image_id"
      ) {
        logger.warn(
          `⚠️ Error de imagen durante actualización de SKU ${sku}, reintentando sin imágenes...`
        );

        // Buscar el producto nuevamente para actualizar sin imágenes
        const existingProducts = await this.woocommerce.get("products", {
          sku: sku,
          per_page: 1,
        });

        if (existingProducts.data && existingProducts.data.length > 0) {
          const existingProduct = existingProducts.data[0];

          // Remover tanto SKU como imágenes
          const updateDataWithoutImages = { ...productData };
          delete updateDataWithoutImages.sku;
          delete updateDataWithoutImages.images;

          const retryResponse = await this.woocommerce.put(
            `products/${existingProduct.id}`,
            updateDataWithoutImages
          );

          if (retryResponse.status === 200) {
            logger.info(
              `✅ Producto actualizado exitosamente (sin imágenes): ${productData.name} (ID: ${existingProduct.id})`
            );

            return {
              success: true,
              productId: existingProduct.id,
              action: "updated",
            };
          }
        }
      }

      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      logger.error(`❌ Error al actualizar producto con SKU ${sku}:`, error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Procesar productos en lotes usando el endpoint batch de WooCommerce
   * Mucho más eficiente para operaciones masivas
   */
  public async processBatchProducts(products: any[]): Promise<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    failedCount: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    const allErrors: string[] = [];

    try {
      const batchSize = 50; // Reducir tamaño para evitar timeouts

      logger.info(
        `🚀 Iniciando procesamiento en lotes de ${batchSize} productos`,
        {
          totalProducts: products.length,
          batches: Math.ceil(products.length / batchSize),
        }
      );

      // Procesar productos en lotes de 100
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        logger.info(
          `📦 Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            products.length / batchSize
          )}`,
          {
            productosEnLote: batch.length,
            rango: `${i + 1}-${Math.min(i + batchSize, products.length)}`,
          }
        );

        // Procesar el lote actual
        const batchResult = await this.processSingleBatch(batch);

        totalCreated += batchResult.createdCount;
        totalUpdated += batchResult.updatedCount;
        totalFailed += batchResult.failedCount;
        allErrors.push(...batchResult.errors);

        // Pausa entre lotes para no sobrecargar la API
        if (i + batchSize < products.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 segundos entre lotes
        }
      }

      const duration = Date.now() - startTime;

      logger.info("✅ Procesamiento en lotes completado", {
        totalProducts: products.length,
        createdCount: totalCreated,
        updatedCount: totalUpdated,
        failedCount: totalFailed,
        duration: `${duration}ms`,
      });

      return {
        success: totalFailed < products.length, // Éxito si no todos fallaron
        createdCount: totalCreated,
        updatedCount: totalUpdated,
        failedCount: totalFailed,
        errors: allErrors,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en procesamiento de lotes:", error);

      return {
        success: false,
        createdCount: totalCreated,
        updatedCount: totalUpdated,
        failedCount: products.length - totalCreated - totalUpdated,
        errors: [...allErrors, errorMessage],
        duration,
      };
    }
  }

  /**
   * Procesar un lote individual de productos usando batch API
   */
  private async processSingleBatch(products: any[]): Promise<{
    createdCount: number;
    updatedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    try {
      // Preparar datos para batch
      const productsToCreate: any[] = [];
      const productsToUpdate: any[] = [];
      const errors: string[] = [];

      // Primera pasada: Intentar identificar productos que necesitan actualización
      const skuToProductMap = new Map();
      for (const product of products) {
        skuToProductMap.set(product.sku, product);
      }

      // Buscar productos existentes de una vez
      const existingProductsMap = new Map();
      try {
        // Obtener todos los SKUs para buscar productos existentes
        const skus = products.map(p => p.sku);
        
        // Buscar en lotes pequeños para evitar URLs muy largas
        for (let i = 0; i < skus.length; i += 20) {
          const skuBatch = skus.slice(i, i + 20);
          
          for (const sku of skuBatch) {
            try {
              const existingResponse = await this.woocommerce.get("products", {
                sku: sku,
                per_page: 1,
              });
              
              if (existingResponse.data && existingResponse.data.length > 0) {
                existingProductsMap.set(sku, existingResponse.data[0]);
              }
            } catch (searchError) {
              logger.debug(`No se pudo buscar producto con SKU ${sku}:`, searchError);
            }
          }
          
          // Pequeña pausa entre búsquedas
          if (i + 20 < skus.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } catch (searchError) {
        logger.warn("Error buscando productos existentes:", searchError);
      }

      // Separar productos en crear vs actualizar basado en productos existentes
      for (const product of products) {
        const existingProduct = existingProductsMap.get(product.sku);
        
        if (existingProduct) {
          // Producto existe, preparar para actualización
          const updateData = this.prepareProductForBatchUpdate(product, existingProduct.id);
          productsToUpdate.push(updateData);
          logger.debug(`📝 Producto ${product.sku} marcado para actualización (ID: ${existingProduct.id})`);
        } else {
          // Producto no existe, preparar para creación
          const createData = this.prepareProductForBatch(product);
          productsToCreate.push(createData);
          logger.debug(`✨ Producto ${product.sku} marcado para creación`);
        }
      }

      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      // Procesar creaciones
      if (productsToCreate.length > 0) {
        try {
          logger.debug(`📤 Enviando lote de ${productsToCreate.length} productos para crear`);

          const batchData = {
            create: productsToCreate,
          };

          const response = await this.woocommerce.post("products/batch", batchData);

          if (response.status === 200) {
            const results = response.data;

            if (results.create) {
              for (let i = 0; i < results.create.length; i++) {
                const result = results.create[i];
                const originalProduct = productsToCreate[i];

                if (result.id) {
                  createdCount++;
                  logger.debug(`✅ Producto creado: ${result.name} (SKU: ${result.sku}, ID: ${result.id})`);
                } else if (result.error) {
                  failedCount++;
                  const errorMsg = result.error.message || result.error.code || 'Error desconocido';
                  errors.push(`Error creando SKU ${originalProduct.sku}: ${errorMsg}`);
                  logger.warn(`❌ Error creando producto SKU ${originalProduct.sku}:`, result.error);
                }
              }
            }
          }
        } catch (error: any) {
          logger.error("❌ Error en batch create:", error);
          failedCount += productsToCreate.length;
          errors.push(`Error en creación batch: ${error.message}`);
        }
      }

      // Procesar actualizaciones
      if (productsToUpdate.length > 0) {
        try {
          logger.debug(`🔄 Enviando lote de ${productsToUpdate.length} productos para actualizar`);

          const updateBatchData = {
            update: productsToUpdate,
          };

          const updateResponse = await this.woocommerce.post("products/batch", updateBatchData);

          if (updateResponse.status === 200) {
            const updateResults = updateResponse.data;

            if (updateResults.update) {
              for (const result of updateResults.update) {
                if (result.id) {
                  updatedCount++;
                  logger.debug(`🔄 Producto actualizado: ${result.name} (SKU: ${result.sku}, ID: ${result.id})`);
                } else if (result.error) {
                  failedCount++;
                  const errorMsg = result.error.message || result.error.code || 'Error desconocido';
                  errors.push(`Error actualizando producto: ${errorMsg}`);
                  logger.warn(`❌ Error actualizando producto:`, result.error);
                }
              }
            }
          }
        } catch (error: any) {
          logger.error("❌ Error en batch update:", error);
          failedCount += productsToUpdate.length;
          errors.push(`Error en actualización batch: ${error.message}`);
        }
      }

      return {
        createdCount,
        updatedCount,
        failedCount,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido";
      logger.error("❌ Error procesando lote individual:", error);

      return {
        createdCount: 0,
        updatedCount: 0,
        failedCount: products.length,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Preparar producto para operación batch de creación
   */
  private prepareProductForBatch(product: any): any {
    // Remover campos que pueden causar problemas en batch
    const batchProduct = { ...product };

    // Asegurar que las imágenes estén en formato correcto para batch
    if (batchProduct.images && Array.isArray(batchProduct.images)) {
      batchProduct.images = batchProduct.images.map((img: any) => ({
        src: img.src,
        name: img.name || batchProduct.name,
        alt: img.alt || batchProduct.name,
      }));
    }

    return batchProduct;
  }

  /**
   * Preparar producto para operación batch de actualización
   * Recibe el ID del producto existente directamente
   */
  private prepareProductForBatchUpdate(product: any, productId: number): any {
    // Preparar datos de actualización para batch API
    const updateData = { ...product };
    
    // Campos requeridos para actualización en batch
    updateData.id = productId;
    
    // Remover SKU ya que no se debe actualizar
    delete updateData.sku;

    // Asegurar que las imágenes estén en formato correcto
    if (updateData.images && Array.isArray(updateData.images)) {
      updateData.images = updateData.images.map((img: any) => ({
        src: img.src,
        name: img.name || updateData.name,
        alt: img.alt || updateData.name,
      }));
    }

    // Remover campos que no deben actualizarse o pueden causar conflictos
    delete updateData.date_created;
    delete updateData.date_modified;
    delete updateData.permalink;

    return updateData;
  }

  /**
   * Preparar producto para operación batch de actualización
   * Busca el producto existente por SKU y prepara datos para actualización
   */
  private async prepareProductForUpdate(product: any): Promise<any | null> {
    try {
      // Buscar producto existente por SKU
      const existingProducts = await this.woocommerce.get("products", {
        sku: product.sku,
        per_page: 1,
      });

      if (existingProducts.data && existingProducts.data.length > 0) {
        const existingProduct = existingProducts.data[0];

        // Preparar datos de actualización
        const updateData = { ...product };
        updateData.id = existingProduct.id; // Requerido para updates en batch
        delete updateData.sku; // No actualizar SKU

        return updateData;
      } else {
        logger.warn(
          `⚠️ No se encontró producto existente con SKU: ${product.sku}`
        );
        return null;
      }
    } catch (error) {
      logger.error(
        `❌ Error buscando producto existente con SKU ${product.sku}:`,
        error
      );
      return null;
    }
  }

  /**
   * Buscar producto por SKU
   */
  public async findProductBySku(sku: string): Promise<{
    success: boolean;
    product?: any;
    error?: string;
  }> {
    try {
      const response = await this.woocommerce.get("products", { sku });

      if (response.status === 200 && response.data.length > 0) {
        return {
          success: true,
          product: response.data[0],
        };
      } else {
        return {
          success: false,
          error: "Producto no encontrado",
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
