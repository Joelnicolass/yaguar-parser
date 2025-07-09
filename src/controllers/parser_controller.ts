/**
 * parser_controller - Controlador para operaciones de parsing de archivos .asc
 *
 * Este controlador maneja:
 * - Parsing de archivos .asc legacy
 * - Conversión a formatos JSON y CSV
 * - Parsing de archivos de ejemplo
 * - Estadísticas de archivos parseados
 * - Limpieza de archivos temporales
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js, manejo de Request/Response
 */

import { Request, Response } from "express";
import { ParserService } from "../services/parser/parser_service";
import { ParserConfig } from "../types";
import logger from "../utils/logger";
import path from "path";
import { config } from "../config";

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
}
