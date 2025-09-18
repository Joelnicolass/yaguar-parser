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
import {
  getCredencialesSucursal,
  hasSucursalCredenciales,
  SucursalCredenciales,
  getSucursalIdByFilename,
} from "../config/sucursales_credenciales";
import { SucursalService } from "../services/sucursal/sucursal_service";
import { CATEGORIAS_POR_ID } from "../config/categorias_referencia";

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

interface SucursalData {
  sucursal_id: number;
  nombre_sucursal: string;
  productos: Array<{
    sku: number;
    regular_price: number;
    description: string;
    short_description: string;
    meta_data: number;
    meta_data_2: string;
  }>;
}

export class WoocommerceController {
  private woocommerceInstances: Map<number, WooCommerceRestApi> = new Map();
  private defaultWoocommerce?: WooCommerceRestApi;
  public sucursalId: number | null = null;

  /**
   * Constructor - Inicializa la instancia por defecto (para compatibilidad hacia atrás)
   */
  constructor(woocommerceConfig?: WooCommerceConfig) {
    if (woocommerceConfig) {
      this.defaultWoocommerce = new WooCommerceRestApi({
        url: woocommerceConfig.url,
        consumerKey: woocommerceConfig.consumerKey,
        consumerSecret: woocommerceConfig.consumerSecret,
        version: woocommerceConfig.version || ("wc/v3" as any),
        axiosConfig: {
          timeout: 120000, // 2 minutos timeout para operaciones batch
        },
      });

      this.sucursalId = woocommerceConfig.sucursal_id;

      logger.info(
        "🛒 WooCommerce Controller inicializado (instancia por defecto)",
        {
          url: woocommerceConfig.url,
          version: woocommerceConfig.version,
        }
      );
    } else {
      logger.info(
        "🛒 WooCommerce Controller inicializado (modo multi-sucursal)"
      );
    }
  }
  /**
   * Crear un producto en la instancia WooCommerce de la sucursal indicada
   */
  public async createProduct(
    productData: any,
    sucursalId: number
  ): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
  }> {
    try {
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const response = await wooInstance.post("products", productData);

      if (response.status === 201) {
        return {
          success: true,
          productId: response.data.id,
        };
      } else {
        return {
          success: false,
          error: `Error de API: Status ${response.status}`,
        };
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  /**
   * Inicializar instancia de WooCommerce para una sucursal específica
   */
  private initializeSucursalInstance(
    sucursalId: number
  ): WooCommerceRestApi | null {
    if (this.woocommerceInstances.has(sucursalId)) {
      return this.woocommerceInstances.get(sucursalId)!;
    }

    const credenciales = getCredencialesSucursal(sucursalId);
    if (!credenciales) {
      logger.error(
        `❌ No se encontraron credenciales para sucursal ${sucursalId}`
      );
      return null;
    }

    const wooInstance = new WooCommerceRestApi({
      url: credenciales.credenciales.url,
      consumerKey: credenciales.credenciales.consumerKey,
      consumerSecret: credenciales.credenciales.consumerSecret,
      version: credenciales.credenciales.version || ("wc/v3" as any),
      axiosConfig: {
        timeout: 120000, // 2 minutos timeout para operaciones batch
      },
    });

    this.woocommerceInstances.set(sucursalId, wooInstance);

    logger.info(
      `🛒 Instancia WooCommerce inicializada para sucursal ${credenciales.nombre}`,
      {
        sucursal_id: sucursalId,
        url: credenciales.credenciales.url,
      }
    );

    this.sucursalId = sucursalId;

    return wooInstance;
  }

  /**
   * Obtener instancia de WooCommerce para una sucursal específica
   */
  private getWooCommerceInstance(
    sucursalId?: number
  ): WooCommerceRestApi | null {
    if (sucursalId) {
      return this.initializeSucursalInstance(sucursalId);
    }

    if (this.defaultWoocommerce) {
      return this.defaultWoocommerce;
    }

    logger.error("❌ No hay instancia de WooCommerce disponible");
    return null;
  }

  /**
   *  Cargar la lista de categorias que existe en categorias_referencia.ts
   *
   */
  public async crearCategorias(sucursalId: number) {
    const wooInstance = this.getWooCommerceInstance(sucursalId);
    if (!wooInstance) {
      logger.error(
        `❌ No se pudo obtener instancia de WooCommerce para sucursal ${sucursalId}`
      );
      return;
    }
    let newcategoriesIds: number[] = [];

    for (const key of Object.keys(CATEGORIAS_POR_ID)) {
      const cat = CATEGORIAS_POR_ID[Number(key)];
      if (!cat) {
        logger.warn(`⚠️ Categoría con ID ${key} no encontrada en referencia`);
        continue;
      }
      try {
        const res = await wooInstance.post("products/categories", {
          name: cat.name,
          slug: cat.slug,
          // podés definir parent si necesitás jerarquía:
          // parent: algun_id
        });
        console.log(
          `✅ Categoría creada: ${res.data.name} (ID WooCommerce: ${res.data.id})`
        );
        newcategoriesIds.push(res.data.id);
      } catch (error: any) {
        if (error.response?.status === 400) {
          console.warn(`⚠️ Ya existe la categoría: ${cat.name}`);
          logger.debug(
            error.response?.data || error.message || "Error desconocido"
          );
        } else {
          console.error(
            `❌ Error creando ${cat.name}:`,
            error.response?.data || error.message
          );
        }
      }
    }
  }

  /**
   * Carga completa de productos desde archivo JSON de sucursal específica
   * Lee el archivo JSON de una sucursal y sube todos los productos a su instancia de WooCommerce
   */
  public async uploadProductsFromSucursalJson(jsonFilePath: string): Promise<{
    success: boolean;
    uploadedCount: number;
    failedCount: number;
    errors: string[];
    duration: number;
    sucursal_info?: { id: number; nombre: string };
  }> {
    const startTime = Date.now();
    let uploadedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      logger.info("🚀 Iniciando carga de productos desde JSON de sucursal", {
        filePath: jsonFilePath,
      });

      // Verificar que el archivo existe
      if (!fs.existsSync(jsonFilePath)) {
        throw new Error(`Archivo JSON no encontrado: ${jsonFilePath}`);
      }

      // Leer y parsear el archivo JSON
      const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
      const sucursalData: SucursalData = JSON.parse(fileContent);

      const { sucursal_id, nombre_sucursal, productos } = sucursalData;

      logger.info(
        `📦 Procesando sucursal: ${nombre_sucursal} (ID: ${sucursal_id})`,
        {
          totalProductos: productos.length,
        }
      );

      // Obtener instancia de WooCommerce para esta sucursal
      const wooInstance = this.getWooCommerceInstance(sucursal_id);
      if (!wooInstance) {
        throw new Error(
          `No se pudo inicializar WooCommerce para sucursal ${sucursal_id}`
        );
      }
      // Crear categorías primero (si no existen)
      // await this.crearCategorias(sucursal_id);

      // Procesar productos en lotes para evitar sobrecarga de la API
      const batchSize = 100;

      const product = SucursalService.convertToWooCommerceFormat(productos, {
        id: sucursal_id,
        nombre: nombre_sucursal,
      }); // Limitar a 500 productos para pruebas

      const totalBatches = Math.ceil(product.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * batchSize;
        const end = start + batchSize;
        const batch = product.slice(start, end);

        try {
          const resp = await wooInstance.post("products/batch", {
            create: batch,
          });
          logger.debug(
            `😎 Batch ${batchIndex + 1}/${totalBatches} procesado: ${
              batch.length
            } productos creados`
          );
        } catch (error) {
          logger.error(`❌ Error en batch de productos:`, error);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        logger.info(
          `📊 Progreso ${nombre_sucursal}: ${Math.min(end, productos.length)}/${
            productos.length
          } productos procesados`
        );
      }

      const duration = Date.now() - startTime;

      logger.info(`✅ Carga completa finalizada para ${nombre_sucursal}`, {
        sucursal_id,
        totalProducts: productos.length,
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
        sucursal_info: { id: sucursal_id, nombre: nombre_sucursal },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en carga de productos de sucursal:", error);

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
   * Procesar múltiples archivos de sucursales
   */
  public async uploadProductsFromMultipleSucursales(
    sucursalFilePaths: string[]
  ): Promise<{
    success: boolean;
    totalUploaded: number;
    totalFailed: number;
    sucursalResults: Array<{
      sucursal_id: number;
      nombre: string;
      uploaded: number;
      failed: number;
      success: boolean;
      errors: string[];
    }>;
    duration: number;
  }> {
    const startTime = Date.now();
    let totalUploaded = 0;
    let totalFailed = 0;
    const sucursalResults: Array<{
      sucursal_id: number;
      nombre: string;
      uploaded: number;
      failed: number;
      success: boolean;
      errors: string[];
    }> = [];

    logger.info("🏢 Iniciando carga masiva de múltiples sucursales", {
      totalSucursales: sucursalFilePaths.length,
    });

    for (const filePath of sucursalFilePaths) {
      try {
        const result = await this.uploadProductsFromSucursalJson(filePath);

        totalUploaded += result.uploadedCount;
        totalFailed += result.failedCount;

        sucursalResults.push({
          sucursal_id: result.sucursal_info?.id || 0,
          nombre: result.sucursal_info?.nombre || "Desconocida",
          uploaded: result.uploadedCount,
          failed: result.failedCount,
          success: result.success,
          errors: result.errors,
        });

        // Pausa entre sucursales para no sobrecargar
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Error desconocido";
        logger.error(`❌ Error procesando archivo ${filePath}:`, error);

        sucursalResults.push({
          sucursal_id: 0,
          nombre: path.basename(filePath),
          uploaded: 0,
          failed: 1,
          success: false,
          errors: [errorMsg],
        });
        totalFailed++;
      }
    }

    const duration = Date.now() - startTime;

    logger.info("✅ Carga masiva de sucursales completada", {
      totalSucursales: sucursalFilePaths.length,
      totalUploaded,
      totalFailed,
      duration: `${duration}ms`,
    });

    return {
      success: totalFailed === 0,
      totalUploaded,
      totalFailed,
      sucursalResults,
      duration,
    };
  }

  /**
   * Convertir producto de formato sucursal a formato WooCommerce
   */
  private convertSucursalProductToWooProduct(producto: {
    sku: number;
    regular_price: number;
    description: string;
    short_description: string;
    meta_data: number;
    meta_data_2: string;
  }): WooCommerceProduct {
    return {
      sku: producto.sku.toString(),
      name: producto.short_description.trim(),
      regular_price: producto.regular_price.toString(),
      stock_quantity: 0, // Se puede ajustar según la lógica de negocio
      manage_stock: false,
      stock_status: "instock",
      categories: [{ name: "General" }], // Categoría por defecto
      type: "simple",
      status: "publish",
      meta_data: [
        { key: "_meta_data", value: producto.meta_data },
        { key: "_meta_data_2", value: producto.meta_data_2 },
      ],
    };
  }
  /**
   * Carga completa de productos desde archivo JSON (método original para compatibilidad)
   * Lee el archivo JSON generado y sube todos los productos a WooCommerce
   */
  public async uploadProductsFromJson(
    jsonFilePath?: string,
    sucursalId?: number
  ): Promise<{
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
      const filePath = jsonFilePath || "";

      logger.info("🚀 Iniciando carga completa de productos desde JSON", {
        filePath,
        sucursalId: sucursalId || "default",
      });

      // Verificar que el archivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Archivo JSON no encontrado: ${filePath}`);
      }

      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
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
            const response = await wooInstance.post("products", wooProduct);

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
  public async updateProductsFromComparison(sucursalId?: number): Promise<{
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
      logger.info("🔄 Iniciando actualización de productos por comparación", {
        sucursalId: sucursalId || "default",
      });

      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

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
          const searchResponse = await wooInstance.get("products", {
            sku: productJson.SKU,
          });

          if (searchResponse.status === 200 && searchResponse.data.length > 0) {
            const existingProduct = searchResponse.data[0];
            const updatedProduct = this.convertJsonToWooProduct(productJson);

            // Actualizar el producto existente
            const updateResponse = await wooInstance.put(
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
            const createResponse = await wooInstance.post(
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
  public async getAllProducts(sucursalId?: number): Promise<{
    success: boolean;
    products: WooCommerceProduct[];
    totalCount: number;
    error?: string;
  }> {
    try {
      logger.info("📋 Obteniendo lista completa de productos de WooCommerce", {
        sucursalId: sucursalId || "default",
      });

      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const allProducts: WooCommerceProduct[] = [];
      let page = 1;
      const perPage = 100; // Máximo permitido por la API

      while (true) {
        const response = await wooInstance.get("products", {
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
  public async testConnection(sucursalId?: number): Promise<{
    success: boolean;
    message: string;
    storeInfo?: any;
  }> {
    try {
      logger.info("🔗 Probando conexión con WooCommerce...", {
        sucursalId: sucursalId || "default",
      });

      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const response = await wooInstance.get("");

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
  public async createSingleProduct(
    productData: any,
    sucursalId?: number
  ): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
    action?: "created" | "updated" | "skipped";
  }> {
    try {
      logger.debug("🛍️ Creando producto individual en WooCommerce", {
        sku: productData.sku,
        name: productData.name,
        sucursalId: sucursalId || "default",
      });

      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const response = await wooInstance.post("products", productData);

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
          productData,
          sucursalId
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
          productDataWithoutImages,
          sucursalId
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
  private async createProductWithoutImages(
    productData: any,
    sucursalId?: number
  ): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
    action?: "created" | "updated" | "skipped";
  }> {
    try {
      logger.debug("🛍️ Creando producto sin imágenes en WooCommerce", {
        sku: productData.sku,
        name: productData.name,
        sucursalId: sucursalId || "default",
      });

      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const response = await wooInstance.post("products", productData);

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
          productData,
          sucursalId
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
    productData: any,
    sucursalId?: number
  ): Promise<{
    success: boolean;
    productId?: number;
    error?: string;
    action?: "created" | "updated" | "skipped";
  }> {
    try {
      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      // Buscar el producto por SKU
      const existingProducts = await wooInstance.get("products", {
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

        const response = await wooInstance.put(
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

        // Obtener instancia de WooCommerce
        const wooInstance = this.getWooCommerceInstance(sucursalId);
        if (!wooInstance) {
          throw new Error("No se pudo obtener instancia de WooCommerce");
        }

        // Buscar el producto nuevamente para actualizar sin imágenes
        const existingProducts = await wooInstance.get("products", {
          sku: sku,
          per_page: 1,
        });

        if (existingProducts.data && existingProducts.data.length > 0) {
          const existingProduct = existingProducts.data[0];

          // Remover tanto SKU como imágenes
          const updateDataWithoutImages = { ...productData };
          delete updateDataWithoutImages.sku;
          delete updateDataWithoutImages.images;

          const retryResponse = await wooInstance.put(
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
  public async processBatchProducts(
    products: any[],
    sucursalId?: number
  ): Promise<{
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
      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const batchSize = 50; // Reducir tamaño para evitar timeouts

      logger.info(
        `🚀 Iniciando procesamiento en lotes de ${batchSize} productos`,
        {
          totalProducts: products.length,
          batches: Math.ceil(products.length / batchSize),
          sucursalId: sucursalId || "default",
        }
      );

      // Procesar productos en lotes de 50
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
        const batchResult = await this.processSingleBatch(batch, wooInstance);

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
  private async processSingleBatch(
    products: any[],
    wooInstance: WooCommerceRestApi
  ): Promise<{
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
        const skus = products.map((p) => p.sku);

        // Buscar en lotes pequeños para evitar URLs muy largas
        for (let i = 0; i < skus.length; i += 20) {
          const skuBatch = skus.slice(i, i + 20);

          for (const sku of skuBatch) {
            try {
              const existingResponse = await wooInstance.get("products", {
                sku: sku,
                per_page: 1,
              });

              if (existingResponse.data && existingResponse.data.length > 0) {
                existingProductsMap.set(sku, existingResponse.data[0]);
              }
            } catch (searchError) {
              logger.debug(
                `No se pudo buscar producto con SKU ${sku}:`,
                searchError
              );
            }
          }

          // Pequeña pausa entre búsquedas
          if (i + 20 < skus.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
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
          const updateData = this.prepareProductForBatchUpdate(
            product,
            existingProduct.id
          );
          productsToUpdate.push(updateData);
          logger.debug(
            `📝 Producto ${product.sku} marcado para actualización (ID: ${existingProduct.id})`
          );
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
          logger.debug(
            `📤 Enviando lote de ${productsToCreate.length} productos para crear`
          );

          const batchData = {
            create: productsToCreate,
          };

          const response = await wooInstance.post("products/batch", batchData);

          if (response.status === 200) {
            const results = response.data;

            if (results.create) {
              for (let i = 0; i < results.create.length; i++) {
                const result = results.create[i];
                const originalProduct = productsToCreate[i];

                if (result.id) {
                  createdCount++;
                  logger.debug(
                    `✅ Producto creado: ${result.name} (SKU: ${result.sku}, ID: ${result.id})`
                  );
                } else if (result.error) {
                  failedCount++;
                  const errorMsg =
                    result.error.message ||
                    result.error.code ||
                    "Error desconocido";
                  errors.push(
                    `Error creando SKU ${originalProduct.sku}: ${errorMsg}`
                  );
                  logger.warn(
                    `❌ Error creando producto SKU ${originalProduct.sku}:`,
                    result.error
                  );
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
          logger.debug(
            `🔄 Enviando lote de ${productsToUpdate.length} productos para actualizar`
          );

          const updateBatchData = {
            update: productsToUpdate,
          };

          const updateResponse = await wooInstance.post(
            "products/batch",
            updateBatchData
          );

          if (updateResponse.status === 200) {
            const updateResults = updateResponse.data;

            if (updateResults.update) {
              for (const result of updateResults.update) {
                if (result.id) {
                  updatedCount++;
                  logger.debug(
                    `🔄 Producto actualizado: ${result.name} (SKU: ${result.sku}, ID: ${result.id})`
                  );
                } else if (result.error) {
                  failedCount++;
                  const errorMsg =
                    result.error.message ||
                    result.error.code ||
                    "Error desconocido";
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
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
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
   * Buscar producto por SKU
   */
  public async findProductBySku(
    sku: string,
    sucursalId?: number
  ): Promise<{
    success: boolean;
    product?: any;
    error?: string;
  }> {
    try {
      // Obtener instancia de WooCommerce
      const wooInstance = this.getWooCommerceInstance(sucursalId);
      if (!wooInstance) {
        throw new Error("No se pudo obtener instancia de WooCommerce");
      }

      const response = await wooInstance.get("products", { sku });

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
