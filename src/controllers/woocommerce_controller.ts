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
        timeout: 30000, // 30 segundos timeout
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
}
