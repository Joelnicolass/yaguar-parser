/**
 * parser_controller - Controlador para operaciones de parsing de archivos legacy y sucursales
 *
 * Este controlador maneja:
 * - Parsing de archivos .asc legacy
 * - Parsing de archivos JSON de sucursales
 * - Conversión a formatos JSON y CSV
 * - Integración directa con WooCommerce
 * - Estadísticas de archivos parseados
 * - Limpieza de archivos temporales
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js, manejo de Request/Response
 */

import { Request, Response } from "express";
import { ParserService } from "../services/parser/parser_service";
import { SucursalService } from "../services/sucursal/sucursal_service";
import { ParserConfig } from "../types";
import logger from "../utils/logger";
import path from "path";
import { config } from "../config";
import { jobController } from "./job_controller";

export class ParserController {
  /**
   * Parsear archivo de ejemplo
   * POST /api/parser/parse-example
   */
  public static async parseExample(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Parsing de archivo de ejemplo iniciado via API");

      const result = await ParserService.parseExampleFile();

      if (result.success) {
        res.json({
          success: true,
          message: "Archivo de ejemplo parseado exitosamente",
          data: {
            productsCount: result.productsCount,
            duration: result.duration,
            outputPath: result.outputPath,
            sampleProducts: result.products,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al parsear archivo de ejemplo",
          message: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error en parsing de archivo de ejemplo:", error);
      res.status(500).json({
        success: false,
        error: "Error al parsear archivo de ejemplo",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Parsear archivo personalizado
   * POST /api/parser/parse-file
   */
  public static async parseFile(req: Request, res: Response): Promise<void> {
    try {
      const {
        fileName,
        outputFormat = "json",
        cleanProductNames = true,
        validateData = true,
      } = req.body;

      if (!fileName) {
        res.status(400).json({
          success: false,
          error: "Nombre de archivo requerido",
          message: "Debe especificar el nombre del archivo a parsear",
        });
        return;
      }

      logger.info("Parsing de archivo personalizado iniciado via API", {
        fileName,
      });

      const inputPath = path.join(config.paths.tempDir, fileName);
      const outputDir = path.join(config.paths.tempDir, "parsed");

      const parserConfig: ParserConfig = {
        inputPath,
        outputFormat: outputFormat as "json" | "csv" | "both",
        outputDir,
        cleanProductNames,
        validateData,
      };

      const result = await ParserService.parseFile(parserConfig);

      if (result.success) {
        res.json({
          success: true,
          message: "Archivo parseado exitosamente",
          data: {
            fileName,
            productsCount: result.productsCount,
            duration: result.duration,
            outputPath: result.outputPath,
            sampleProducts: result.products,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al parsear archivo",
          message: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error en parsing de archivo personalizado:", error);
      res.status(500).json({
        success: false,
        error: "Error al parsear archivo",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Parsear archivo desde descarga SFTP
   * POST /api/parser/parse-from-sftp/:fileName
   */
  public static async parseFromSftp(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        res.status(400).json({
          success: false,
          error: "Nombre de archivo requerido",
          message: "Debe especificar el nombre del archivo a parsear",
        });
        return;
      }

      logger.info("Parsing de archivo SFTP iniciado via API", { fileName });

      const result = await ParserService.parseFromTempFile(fileName);

      if (result.success) {
        res.json({
          success: true,
          message: "Archivo SFTP parseado exitosamente",
          data: {
            fileName,
            productsCount: result.productsCount,
            duration: result.duration,
            outputPath: result.outputPath,
            sampleProducts: result.products,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al parsear archivo SFTP",
          message: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error en parsing de archivo SFTP:", error);
      res.status(500).json({
        success: false,
        error: "Error al parsear archivo SFTP",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Obtener estadísticas de archivo
   * GET /api/parser/stats/:fileName
   */
  public static async getFileStats(req: Request, res: Response): Promise<void> {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        res.status(400).json({
          success: false,
          error: "Nombre de archivo requerido",
          message: "Debe especificar el nombre del archivo",
        });
        return;
      }

      const filePath = path.join(config.paths.tempDir, fileName);
      const stats = ParserService.getParsingStats(filePath);

      res.json({
        success: true,
        data: {
          fileName,
          filePath,
          ...stats,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener estadísticas de archivo:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener estadísticas",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Limpiar archivos parseados
   * POST /api/parser/cleanup
   */
  public static async cleanup(req: Request, res: Response): Promise<void> {
    try {
      const { hours } = req.body;
      const olderThanHours = hours && typeof hours === "number" ? hours : 24;

      logger.info("Limpieza de archivos parseados iniciada via API", {
        olderThanHours,
      });

      await ParserService.cleanupParsedFiles(olderThanHours);

      res.json({
        success: true,
        message: `Limpieza completada - archivos parseados más antiguos que ${olderThanHours} horas eliminados`,
        data: {
          olderThanHours,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en limpieza de archivos parseados:", error);
      res.status(500).json({
        success: false,
        error: "Error en limpieza",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Obtener configuración del parser
   * GET /api/parser/config
   */
  public static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          supportedFormats: ["json", "csv", "both"],
          tempDir: config.paths.tempDir,
          defaultSettings: {
            outputFormat: "json",
            cleanProductNames: true,
            validateData: true,
          },
          features: [
            "Parsing de archivos .asc legacy",
            "Limpieza automática de nombres",
            "Validación de datos",
            "Export JSON y CSV",
            "Integración con SFTP",
            "Parsing de sucursales JSON",
            "Integración directa con WooCommerce",
          ],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener configuración del parser:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener configuración",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Parsear archivo JSON de sucursal y enviar a WooCommerce
   * POST /api/parser/parse-sucursal
   */
  public static async parseSucursal(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { filePath, uploadToWoocommerce = true } = req.body;

      logger.info("Parsing de archivo de sucursal iniciado via API", {
        filePath: filePath || "default",
        uploadToWoocommerce,
      });

      const result = await SucursalService.parseSucursalFile(
        filePath,
        uploadToWoocommerce
      );

      if (result.success) {
        res.json({
          success: true,
          message: uploadToWoocommerce
            ? "Sucursal parseada y productos enviados a WooCommerce exitosamente"
            : "Sucursal parseada exitosamente",
          data: {
            sucursal: result.sucursal,
            productsCount: result.productsCount,
            processedProducts: result.processedProducts,
            failedProducts: result.failedProducts,
            duration: result.duration,
            woocommerceResults: result.woocommerceResults,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al parsear archivo de sucursal",
          message: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error en parsing de sucursal:", error);
      res.status(500).json({
        success: false,
        error: "Error al parsear archivo de sucursal",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Parsear archivo JSON de sucursal de forma asíncrona (SIN TIMEOUTS)
   * POST /api/parser/parse-sucursal-async
   */
  public static async parseSucursalAsync(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { filePath, uploadToWoocommerce = true, sucursalId } = req.body;

      logger.info("Iniciando parsing asíncrono de sucursal", {
        filePath: filePath || "default",
        uploadToWoocommerce,
        sucursalId,
      });

      // Crear job asíncrono
      const jobId = jobController.createJob(
        async () => {
          const result = await SucursalService.parseSucursalFile(
            filePath,
            uploadToWoocommerce
          );
          return result;
        },
        {
          operation: 'parse-sucursal',
          filePath: filePath || "default",
          uploadToWoocommerce,
          sucursalId,
        }
      );

      // Responder inmediatamente con el job ID
      res.json({
        success: true,
        message: "Procesamiento iniciado. Use el jobId para consultar el estado.",
        jobId,
        statusUrl: `/api/jobs/status/${jobId}`,
        estimatedTime: "2-5 minutos dependiendo del número de productos",
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error("Error iniciando parsing asíncrono de sucursal:", error);
      res.status(500).json({
        success: false,
        error: "Error al iniciar procesamiento asíncrono",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Obtener información de una sucursal sin procesar
   * GET /api/parser/sucursal-info
   */
  public static async getSucursalInfo(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { filePath } = req.query;

      logger.info("Consultando información de sucursal via API", {
        filePath: filePath || "default",
      });

      const result = await SucursalService.getSucursalInfo(filePath as string);

      if (result.success) {
        res.json({
          success: true,
          message: "Información de sucursal obtenida exitosamente",
          data: result.sucursal,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Error al obtener información de sucursal",
          message: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error al obtener información de sucursal:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener información de sucursal",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Listar archivos de sucursales disponibles
   * GET /api/parser/sucursales-files
   */
  public static async listSucursalesFiles(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      logger.info("Listando archivos de sucursales disponibles via API");

      const files = SucursalService.getSucursalesFiles();

      res.json({
        success: true,
        message: "Archivos de sucursales obtenidos exitosamente",
        data: {
          totalFiles: files.length,
          files: files.map((file) => ({
            fullPath: file,
            fileName: path.basename(file),
            directory: path.dirname(file),
          })),
          defaultFile: config.sucursales.defaultFilePath,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al listar archivos de sucursales:", error);
      res.status(500).json({
        success: false,
        error: "Error al listar archivos de sucursales",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Parsear archivo de sucursal por defecto (acceso rápido)
   * POST /api/parser/parse-default-sucursal
   */
  public static async parseDefaultSucursal(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { uploadToWoocommerce = true } = req.body;

      logger.info(
        "Parsing de archivo de sucursal por defecto iniciado via API",
        {
          defaultFile: config.sucursales.defaultFilePath,
          uploadToWoocommerce,
        }
      );

      const result = await SucursalService.parseSucursalFile(
        config.sucursales.defaultFilePath,
        uploadToWoocommerce
      );

      if (result.success) {
        res.json({
          success: true,
          message: uploadToWoocommerce
            ? "Sucursal por defecto parseada y productos enviados a WooCommerce exitosamente"
            : "Sucursal por defecto parseada exitosamente",
          data: {
            sucursal: result.sucursal,
            productsCount: result.productsCount,
            processedProducts: result.processedProducts,
            failedProducts: result.failedProducts,
            duration: result.duration,
            woocommerceResults: result.woocommerceResults,
            sourceFile: config.sucursales.defaultFilePath,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al parsear archivo de sucursal por defecto",
          message: result.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error en parsing de sucursal por defecto:", error);
      res.status(500).json({
        success: false,
        error: "Error al parsear archivo de sucursal por defecto",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
}
