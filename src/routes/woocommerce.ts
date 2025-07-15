/**
 * Routes WooCommerce - Rutas para operaciones con WooCommerce API
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router, Request, Response } from "express";
import { WoocommerceController } from "../controllers/woocommerce_controller";
import logger from "../utils/logger";
import config from "../config";

const router = Router();

// Configuración por defecto para WooCommerce (debe configurarse via variables de entorno)

// Crear instancia del controlador (se podría mover a un singleton)
const createWooController = () => {
  try {
    return new WoocommerceController(config.woocommerce);
  } catch (error) {
    logger.error("Error al crear WooCommerce Controller:", error);
    return null;
  }
};

/**
 * Probar conexión con WooCommerce
 * GET /api/woocommerce/test-connection
 */
router.get("/test-connection", async (req: Request, res: Response) => {
  try {
    const wooController = createWooController();

    if (!wooController) {
      res.status(500).json({
        success: false,
        error: "No se pudo inicializar el controlador de WooCommerce",
      });
      return;
    }

    const result = await wooController.testConnection();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        storeInfo: result.storeInfo,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
      });
    }
  } catch (error) {
    logger.error("Error en test de conexión WooCommerce:", error);
    res.status(500).json({
      success: false,
      error: "Error al probar conexión con WooCommerce",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Carga completa de productos desde JSON
 * POST /api/woocommerce/upload-products
 */
router.post("/upload-products", async (req: Request, res: Response) => {
  try {
    const { jsonFilePath } = req.body;

    const wooController = createWooController();

    if (!wooController) {
      res.status(500).json({
        success: false,
        error: "No se pudo inicializar el controlador de WooCommerce",
      });
      return;
    }

    logger.info("Iniciando carga de productos a WooCommerce via API");

    const result = await wooController.uploadProductsFromJson(jsonFilePath);

    res.json({
      success: result.success,
      message: result.success
        ? "Productos cargados exitosamente"
        : "Error en la carga de productos",
      data: {
        uploadedCount: result.uploadedCount,
        failedCount: result.failedCount,
        duration: result.duration,
        errors: result.errors.slice(0, 10), // Solo los primeros 10 errores
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error en carga de productos:", error);
    res.status(500).json({
      success: false,
      error: "Error al cargar productos",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Actualizar productos comparando archivos JSON
 * POST /api/woocommerce/update-products
 */
router.post("/update-products", async (req: Request, res: Response) => {
  try {
    const wooController = createWooController();

    if (!wooController) {
      res.status(500).json({
        success: false,
        error: "No se pudo inicializar el controlador de WooCommerce",
      });
      return;
    }

    logger.info("Iniciando actualización de productos por comparación via API");

    const result = await wooController.updateProductsFromComparison();

    res.json({
      success: result.success,
      message: result.success
        ? "Productos actualizados exitosamente"
        : "Error en la actualización de productos",
      data: {
        updatedCount: result.updatedCount,
        failedCount: result.failedCount,
        skippedCount: result.skippedCount,
        duration: result.duration,
        errors: result.errors.slice(0, 10), // Solo los primeros 10 errores
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error en actualización de productos:", error);
    res.status(500).json({
      success: false,
      error: "Error al actualizar productos",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Listar todos los productos de WooCommerce
 * GET /api/woocommerce/products
 */
router.get("/products", async (req: Request, res: Response) => {
  try {
    const wooController = createWooController();

    if (!wooController) {
      res.status(500).json({
        success: false,
        error: "No se pudo inicializar el controlador de WooCommerce",
      });
      return;
    }

    logger.info("Obteniendo lista de productos de WooCommerce via API");

    const result = await wooController.getAllProducts();

    if (result.success) {
      res.json({
        success: true,
        message: "Productos obtenidos exitosamente",
        data: {
          totalCount: result.totalCount,
          products: result.products,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: "Error al obtener productos de WooCommerce",
      });
    }
  } catch (error) {
    logger.error("Error al obtener productos:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener productos",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Obtener estadísticas de WooCommerce
 * GET /api/woocommerce/stats
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const wooController = createWooController();

    if (!wooController) {
      res.status(500).json({
        success: false,
        error: "No se pudo inicializar el controlador de WooCommerce",
      });
      return;
    }

    const result = await wooController.getAllProducts();

    if (result.success) {
      // Calcular estadísticas básicas
      const products = result.products;
      const stats = {
        totalProducts: products.length,
        publishedProducts: products.filter((p) => p.status === "publish")
          .length,
        draftProducts: products.filter((p) => p.status === "draft").length,
        inStockProducts: products.filter((p) => p.stock_status === "instock")
          .length,
        outOfStockProducts: products.filter(
          (p) => p.stock_status === "outofstock"
        ).length,
        averagePrice:
          products.length > 0
            ? products.reduce(
                (sum, p) => sum + (parseFloat(p.regular_price) || 0),
                0
              ) / products.length
            : 0,
      };

      res.json({
        success: true,
        message: "Estadísticas obtenidas exitosamente",
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: "Error al obtener estadísticas de WooCommerce",
      });
    }
  } catch (error) {
    logger.error("Error al obtener estadísticas:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener estadísticas",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

export default router;
