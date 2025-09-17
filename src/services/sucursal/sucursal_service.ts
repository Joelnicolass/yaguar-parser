/**
 * sucursal_service - Servicio para parsear archivos JSON de sucursales
 *
 * Librerías utilizadas:
 * - fs: Módulo nativo de Node.js para operaciones del sistema de archivos
 * - path: Módulo nativo de Node.js para manejo de rutas
 *
 * Este servicio maneja:
 * - Lectura de archivos JSON con estructura de sucursales
 * - Parsing y validación de datos de productos por sucursal
 * - Conversión a formato compatible con WooCommerce
 * - Integración directa con WooCommerce API
 * - Manejo de errores y logging detallado
 */

import fs from "fs";
import path from "path";
import { config } from "../../config";
import logger from "../../utils/logger";
import { WoocommerceController } from "../../controllers/woocommerce_controller";
import {
  SucursalData,
  SucursalProduct,
  SucursalParserResult,
  WooCommerceConfig,
} from "../../types";
import { CATEGORIAS_POR_ID } from "../../config/categorias_referencia";

interface WooCommerceProductFromSucursal {
  sku: string;
  name: string;
  regular_price: string;
  description: string;
  short_description: string;
  categories: Array<{ id: number }>;
  type: string;
  status: string;
  manage_stock?: boolean;
  stock_status: string;
  images: Array<{
    src: string;
  }>;
  meta_data: Array<{ key: string; value: any }>;
}

export class SucursalService {
  /**
   * Parsear archivo JSON de sucursal y enviar a WooCommerce
   */
  public static async parseSucursalFile(
    filePath?: string,
    uploadToWoocommerce: boolean = true
  ): Promise<SucursalParserResult> {
    const startTime = Date.now();
    let processedProducts = 0;
    let failedProducts = 0;

    try {
      // Usar la ruta proporcionada o la configurada por defecto
      const inputPath = filePath || config.sucursales.defaultFilePath;

      logger.info("🏪 Iniciando parsing de archivo de sucursal", {
        filePath: inputPath,
        uploadToWoocommerce,
      });

      // Verificar que el archivo existe
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Archivo de sucursal no encontrado: ${inputPath}`);
      }

      // Leer y parsear el archivo JSON
      const fileContent = fs.readFileSync(inputPath, "utf-8");
      const sucursalData: SucursalData = JSON.parse(fileContent);

      // Validar estructura de datos
      if (
        !sucursalData.sucursal_id ||
        !sucursalData.nombre_sucursal ||
        !sucursalData.productos
      ) {
        throw new Error(
          "Estructura de archivo JSON inválida. Debe contener: sucursal_id, nombre_sucursal, productos"
        );
      }

      logger.info("📊 Datos de sucursal cargados", {
        sucursalId: sucursalData.sucursal_id,
        nombreSucursal: sucursalData.nombre_sucursal,
        totalProductos: sucursalData.productos.length,
      });

      let woocommerceResults;

      if (uploadToWoocommerce) {
        // Convertir productos a formato WooCommerce y enviar
        woocommerceResults = await SucursalService.uploadToWooCommerce(
          sucursalData
        );
        processedProducts = woocommerceResults.uploadedCount;
        failedProducts = woocommerceResults.failedCount;
      } else {
        // Solo procesar y validar datos sin enviar
        const validatedProducts = SucursalService.validateProducts(
          sucursalData.productos
        );
        processedProducts = validatedProducts.length;
        failedProducts =
          sucursalData.productos.length - validatedProducts.length;
      }

      const duration = Date.now() - startTime;

      logger.info("✅ Parsing de sucursal completado", {
        sucursalId: sucursalData.sucursal_id,
        nombreSucursal: sucursalData.nombre_sucursal,
        totalProductos: sucursalData.productos.length,
        processedProducts,
        failedProducts,
        duration: `${duration}ms`,
        uploadedToWoocommerce: uploadToWoocommerce,
      });

      return {
        success: true,
        sucursal: {
          id: sucursalData.sucursal_id,
          nombre: sucursalData.nombre_sucursal,
        },
        productsCount: sucursalData.productos.length,
        processedProducts,
        failedProducts,
        duration,
        woocommerceResults,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en parsing de sucursal:", {
        error: errorMessage,
        filePath: filePath || config.sucursales.defaultFilePath,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        sucursal: { id: 0, nombre: "Desconocida" },
        productsCount: 0,
        processedProducts: 0,
        failedProducts: 0,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Validar productos de sucursal
   */
  private static validateProducts(
    productos: SucursalProduct[]
  ): SucursalProduct[] {
    return productos.filter((producto) => {
      // Validaciones básicas
      if (!producto.sku || producto.sku <= 0) {
        logger.warn("Producto inválido: SKU faltante o inválido", { producto });
        return false;
      }

      if (!producto.regular_price || producto.regular_price <= 0) {
        logger.warn("Producto inválido: Precio faltante o inválido", {
          producto,
        });
        return false;
      }

      if (!producto.description || producto.description.trim().length < 3) {
        logger.warn("Producto inválido: Descripción faltante o muy corta", {
          sku: producto.sku,
        });
        return false;
      }

      return true;
    });
  }

  /**
   * Convertir productos de sucursal a formato WooCommerce
   */
  public static convertToWooCommerceFormat(
    productos: SucursalProduct[],
    sucursalInfo: { id: number; nombre: string }
  ): WooCommerceProductFromSucursal[] {
    return productos.map((producto) => {
      // Limpiar y formatear descripciones
      const cleanDescription = producto.description.trim();
      const cleanShortDescription = producto.short_description.trim();
      const productName = cleanDescription || cleanShortDescription || "";

      // Generar URL de imagen basada en SKU
      const imageUrl = `https://shop.yaguar.com.ar/common/img/Productos/${producto.sku}/250x250.jpg`;

      return {
        sku: producto.sku.toString(),
        name: productName,
        regular_price: producto.regular_price.toString(),
        description: cleanDescription,
        short_description: cleanShortDescription,
        categories: [CATEGORIAS_POR_ID[producto.meta_data]],
        type: "simple",
        status: "publish",
        stock_status: "instock",
        images: [
          {
            src: imageUrl,
            // name: productName,
            // alt: productName,
          },
        ],
        meta_data: [
          { key: "_sucursal_id", value: sucursalInfo.id },
          { key: "_sucursal_nombre", value: sucursalInfo.nombre },
          { key: "_meta_data_original", value: producto.meta_data },
          { key: "_meta_data_2_original", value: producto.meta_data_2 },
          { key: "_unidad_medida", value: producto.meta_data_2.trim() },
          { key: "_image_url", value: imageUrl }, // Guardar URL de imagen en metadatos también
        ],
      };
    });
  }

  /**
   * Subir productos a WooCommerce usando batch API para mayor eficiencia
   */
  private static async uploadToWooCommerce(
    sucursalData: SucursalData
  ): Promise<{
    uploadedCount: number;
    failedCount: number;
    errors: string[];
    createdCount?: number;
    updatedCount?: number;
  }> {
    try {
      // Validar productos primero
      const validProducts = SucursalService.validateProducts(
        sucursalData.productos
      );

      if (validProducts.length === 0) {
        throw new Error("No hay productos válidos para cargar");
      }

      // Convertir a formato WooCommerce
      const wooProducts = SucursalService.convertToWooCommerceFormat(
        validProducts,
        { id: sucursalData.sucursal_id, nombre: sucursalData.nombre_sucursal }
      );

      // Crear instancia de WooCommerce Controller
      const wooConfig = {
        url: config.woocommerce.url || "https://tu-tienda.com",
        consumerKey: config.woocommerce.consumerKey,
        consumerSecret: config.woocommerce.consumerSecret,
        version: config.woocommerce.version,
        sucursal_id: sucursalData.sucursal_id,
      };

      const wooController = new WoocommerceController(wooConfig);

      logger.info(
        `� Iniciando carga optimizada de ${wooProducts.length} productos usando Batch API`
      );

      // Usar el nuevo método de batch para procesar todos los productos
      const batchResult = await wooController.processBatchProducts(wooProducts);

      const uploadedCount = batchResult.createdCount + batchResult.updatedCount;

      // Si hay muchos fallos, intentar fallback con procesamiento individual
      const failureRate = batchResult.failedCount / wooProducts.length;
      if (failureRate > 0.5 && batchResult.failedCount > 10) {
        logger.warn(
          `⚠️ Alto porcentaje de fallos (${(failureRate * 100).toFixed(
            1
          )}%), intentando fallback con procesamiento individual`
        );

        // Usar método original como fallback
        const fallbackResult =
          await SucursalService.uploadToWooCommerceFallback(
            sucursalData,
            wooController
          );

        logger.info(
          `🔄 Fallback completado: ${fallbackResult.createdCount} creados, ${fallbackResult.updatedCount} actualizados adicionales`
        );

        return {
          uploadedCount: uploadedCount + fallbackResult.uploadedCount,
          failedCount: Math.max(
            0,
            batchResult.failedCount - fallbackResult.uploadedCount
          ),
          errors: [...batchResult.errors, ...fallbackResult.errors],
          createdCount:
            batchResult.createdCount + (fallbackResult.createdCount || 0),
          updatedCount:
            batchResult.updatedCount + (fallbackResult.updatedCount || 0),
        };
      }

      logger.info(
        `🎯 Resumen de carga optimizada: ${batchResult.createdCount} creados, ${batchResult.updatedCount} actualizados, ${batchResult.failedCount} fallaron`
      );

      return {
        uploadedCount,
        failedCount: batchResult.failedCount,
        errors: batchResult.errors,
        createdCount: batchResult.createdCount,
        updatedCount: batchResult.updatedCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      logger.error("❌ Error en carga masiva optimizada a WooCommerce:", error);

      return {
        uploadedCount: 0,
        failedCount: sucursalData.productos.length,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Método fallback: procesamiento individual cuando batch falla mucho
   */
  private static async uploadToWooCommerceFallback(
    sucursalData: SucursalData,
    wooController: WoocommerceController
  ): Promise<{
    uploadedCount: number;
    failedCount: number;
    errors: string[];
    createdCount?: number;
    updatedCount?: number;
  }> {
    try {
      const validProducts = SucursalService.validateProducts(
        sucursalData.productos
      );

      const wooProducts = SucursalService.convertToWooCommerceFormat(
        validProducts,
        { id: sucursalData.sucursal_id, nombre: sucursalData.nombre_sucursal }
      );

      const batchSize = config.sucursales.batchSize || 10;
      let uploadedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];
      let createdCount = 0;
      let updatedCount = 0;

      logger.info(
        `🔄 Fallback: Procesando ${wooProducts.length} productos individualmente en lotes de ${batchSize}`
      );

      for (let i = 0; i < wooProducts.length; i += batchSize) {
        const batch = wooProducts.slice(i, i + batchSize);

        for (const product of batch) {
          try {
            const result = await SucursalService.createProductInWooCommerce(
              wooController,
              product
            );

            if (result.success) {
              uploadedCount++;

              if (result.action === "created") {
                createdCount++;
              } else if (result.action === "updated") {
                updatedCount++;
              }
            } else {
              failedCount++;
              errors.push(
                `Error fallback producto ${product.sku}: ${result.error}`
              );
            }
          } catch (error) {
            failedCount++;
            const errorMsg =
              error instanceof Error ? error.message : "Error desconocido";
            errors.push(
              `Error fallback procesando ${product.sku}: ${errorMsg}`
            );
          }
        }

        // Pausa entre lotes
        if (i + batchSize < wooProducts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return {
        uploadedCount,
        failedCount,
        errors,
        createdCount,
        updatedCount,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      return {
        uploadedCount: 0,
        failedCount: sucursalData.productos.length,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Crear un producto individual en WooCommerce
   */
  private static async createProductInWooCommerce(
    wooController: WoocommerceController,
    product: WooCommerceProductFromSucursal
  ): Promise<{ success: boolean; error?: string; action?: string }> {
    try {
      const result = await wooController.createSingleProduct(product);

      return {
        success: result.success,
        error: result.error,
        action: result.action,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Obtener información de una sucursal sin procesar productos
   */
  public static async getSucursalInfo(filePath?: string): Promise<{
    success: boolean;
    sucursal?: { id: number; nombre: string; totalProductos: number };
    error?: string;
  }> {
    try {
      const inputPath = filePath || config.sucursales.defaultFilePath;

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Archivo de sucursal no encontrado: ${inputPath}`);
      }

      const fileContent = fs.readFileSync(inputPath, "utf-8");
      const sucursalData: SucursalData = JSON.parse(fileContent);

      return {
        success: true,
        sucursal: {
          id: sucursalData.sucursal_id,
          nombre: sucursalData.nombre_sucursal,
          totalProductos: sucursalData.productos.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Listar archivos de sucursales disponibles
   */
  public static getSucursalesFiles(): string[] {
    try {
      const sucursalesDir = config.paths.sucursalesDir;

      if (!fs.existsSync(sucursalesDir)) {
        logger.warn("Directorio de sucursales no encontrado:", sucursalesDir);
        return [];
      }

      const files = fs
        .readdirSync(sucursalesDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => path.join(sucursalesDir, file));

      return files;
    } catch (error) {
      logger.error("Error al listar archivos de sucursales:", error);
      return [];
    }
  }
}
