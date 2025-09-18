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
import { WooCommerceConfig } from "../types";
import {
  getAllSucursales,
  getCredencialesSucursal,
  SUCURSALES_CREDENCIALES,
} from "../config/sucursales_credenciales";
import { log } from "console";

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

router.post("/upload-products/", async (req: Request, res: Response) => {
  try {
    const wooController = createWooController();
  } catch (error) {}
});
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
router.post(
  "/upload-products/:sucursalId",
  async (req: Request, res: Response) => {
    try {
      const { sucursalId } = req.params;
      const { jsonFilePath } = req.body;
      if (!sucursalId || !jsonFilePath) {
        res.status(400).json({
          success: false,
          error: "Se requieren sucursalId y jsonFilePath",
        });
        return;
      }
      const sucursalIdNum = parseInt(sucursalId);
      const wooController = createWooController();

      if (!wooController) {
        res.status(500).json({
          success: false,
          error: "No se pudo inicializar el controlador de WooCommerce",
        });
        return;
      }

      logger.info("Iniciando carga de productos a WooCommerce via API");

      const result = await wooController.uploadProductsFromJson(
        jsonFilePath,
        sucursalIdNum
      );

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
  }
);
// crear un endpoint para crear un unico producto en woocommerce por sucursal id
router.post(
  "/create-product/:sucursalId",
  async (req: Request, res: Response) => {
    try {
      const { sucursalId } = req.params;
      const { productData } = req.body;

      // if (!sucursalId || !productData) {
      //   res.status(400).json({
      //     success: false,
      //     error: "Se requieren sucursalId y productData",
      //   });
      //   return;
      // }

      const sucursalIdNum = 24;
      const wooController = createWooController();

      if (!wooController) {
        res.status(500).json({
          success: false,
          error: "No se pudo inicializar el controlador de WooCommerce",
        });
        return;
      }

      logger.info("Iniciando creación de producto en WooCommerce via API");

      const result = await wooController.createProduct(
        productData,
        sucursalIdNum
      );

      res.json({
        success: result.success,
        message: result.success
          ? "Producto creado exitosamente"
          : "Error en la creación de producto",
        data: {
          product: result.productId,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en creación de producto:", error);
      res.status(500).json({
        success: false,
        error: "Error al crear producto",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * Actualizar productos comparando archivos JSON
 * POST /api/woocommerce/update-products
 */
router.post("/update-products", async (req: Request, res: Response) => {
  try {
    const wooController = new WoocommerceController();

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
router.get("/products/:id", async (req: Request, res: Response) => {
  try {
    const wooController = new WoocommerceController();
    const { id } = req.params;
    logger.log("ID recibido:", id);
    if (!wooController) {
      res.status(500).json({
        success: false,
        error: "No se pudo inicializar el controlador de WooCommerce",
      });
      return;
    }

    logger.info("Obteniendo lista de productos de WooCommerce via API");

    const result = await wooController.getAllProducts(parseInt(id!));

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
 * RUTAS MULTI-SUCURSAL
 */

/**
 * Obtener lista de todas las sucursales configuradas
 * GET /api/woocommerce/sucursales
 */
router.get("/sucursales", async (req: Request, res: Response) => {
  try {
    const sucursales = getAllSucursales();

    // Omitir información sensible como secretos
    const sucursalesSafe = sucursales.map((sucursal) => ({
      sucursal_id: 1,
      nombre: sucursal.nombre,
      url: sucursal.credenciales.url,
      // No incluir consumerKey ni consumerSecret por seguridad
    }));

    res.json({
      success: true,
      message: "Sucursales obtenidas exitosamente",
      data: {
        totalSucursales: sucursales.length,
        sucursales: sucursalesSafe,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error al obtener sucursales:", error);
    res.status(500).json({
      success: false,
      error: "Error al obtener sucursales",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

/**
 * Probar conexión con una sucursal específica
 * GET /api/woocommerce/sucursales/:sucursalId/test-connection
 */
router.get(
  "/sucursales/:sucursalId/test-connection",
  async (req: Request, res: Response) => {
    try {
      const sucursalIdParam = req.params.sucursalId;

      if (!sucursalIdParam) {
        res.status(400).json({
          success: false,
          error: "ID de sucursal requerido",
        });
        return;
      }

      const sucursalId = parseInt(sucursalIdParam);

      if (isNaN(sucursalId)) {
        res.status(400).json({
          success: false,
          error: "ID de sucursal inválido",
        });
        return;
      }

      const wooController = new WoocommerceController(); // Modo multi-sucursal

      const result = await wooController.testConnection(sucursalId);

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          sucursalId: sucursalId,
          storeInfo: result.storeInfo,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.message,
          sucursalId: sucursalId,
        });
      }
    } catch (error) {
      logger.error("Error en test de conexión de sucursal:", error);
      res.status(500).json({
        success: false,
        error: "Error al probar conexión con sucursal",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * Cargar productos desde archivo JSON de sucursal específica
 * POST /api/woocommerce/sucursales/upload-products
 */
router.post(
  "/sucursales/upload-products",
  async (req: Request, res: Response) => {
    try {
      const { jsonFilePath } = req.body;

      if (!jsonFilePath) {
        res.status(400).json({
          success: false,
          error: "Se requiere la ruta del archivo JSON",
        });
        return;
      }

      const wooController = new WoocommerceController(); // Modo multi-sucursal

      logger.info("Iniciando carga de productos de sucursal via API", {
        filePath: jsonFilePath,
      });

      const result = await wooController.uploadProductsFromSucursalJson(
        jsonFilePath
      );

      res.json({
        success: result.success,
        message: result.success
          ? "Productos de sucursal cargados exitosamente"
          : "Error en la carga de productos de sucursal",
        data: {
          uploadedCount: result.uploadedCount,
          failedCount: result.failedCount,
          duration: result.duration,
          sucursal_info: result.sucursal_info,
          errors: result.errors.slice(0, 10), // Solo los primeros 10 errores
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en carga de productos de sucursal:", error);
      res.status(500).json({
        success: false,
        error: "Error al cargar productos de sucursal",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/**
 * Obtener productos de una sucursal específica
 * GET /api/woocommerce/sucursales/:sucursalId/products
 */
router.get(
  "/sucursales/:sucursalId/products",
  async (req: Request, res: Response) => {
    try {
      const sucursalIdParam = req.params.sucursalId;

      if (!sucursalIdParam) {
        res.status(400).json({
          success: false,
          error: "ID de sucursal requerido",
        });
        return;
      }

      const sucursalId = parseInt(sucursalIdParam);

      if (isNaN(sucursalId)) {
        res.status(400).json({
          success: false,
          error: "ID de sucursal inválido",
        });
        return;
      }

      const wooController = new WoocommerceController(); // Modo multi-sucursal

      logger.info("Obteniendo productos de sucursal via API", {
        sucursalId: sucursalId,
      });

      const result = await wooController.getAllProducts(sucursalId);

      if (result.success) {
        res.json({
          success: true,
          message: "Productos de sucursal obtenidos exitosamente",
          data: {
            sucursalId: sucursalId,
            totalCount: result.totalCount,
            products: result.products,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: "Error al obtener productos de la sucursal",
          sucursalId: sucursalId,
        });
      }
    } catch (error) {
      logger.error("Error al obtener productos de sucursal:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener productos de sucursal",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

export default router;
