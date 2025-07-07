/**
 * sftp_controller - Controlador para operaciones SFTP
 *
 * Este controlador maneja:
 * - Prueba de conexión SFTP
 * - Listado de archivos remotos
 * - Descarga manual de archivos
 * - Estado de la conexión SFTP
 * - Limpieza de archivos temporales
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js, manejo de Request/Response
 */

import { Request, Response } from "express";
import { SftpService } from "../services/sftp/sftp_service";
import logger from "../utils/logger";

export class SftpController {
  /**
   * Probar conexión SFTP
   * POST /api/sftp/test-connection
   */
  public static async testConnection(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      logger.info("Prueba de conexión SFTP iniciada via API");

      const connectionResult = await SftpService.connect();

      if (connectionResult.success) {
        await SftpService.disconnect();
      }

      res.json({
        success: connectionResult.success,
        message: connectionResult.message,
        error: connectionResult.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en prueba de conexión SFTP:", error);
      res.status(500).json({
        success: false,
        error: "Error en prueba de conexión",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Listar archivos remotos
   * GET /api/sftp/list-files
   */
  public static async listFiles(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Listado de archivos SFTP iniciado via API");

      const connectionResult = await SftpService.connect();
      if (!connectionResult.success) {
        res.status(500).json({
          success: false,
          error: "Error de conexión",
          message: connectionResult.error,
        });
        return;
      }

      const listResult = await SftpService.listFiles();
      await SftpService.disconnect();

      res.json({
        success: listResult.success,
        data: {
          files: listResult.files || [],
          totalFiles: listResult.files?.length || 0,
        },
        error: listResult.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      await SftpService.disconnect();
      logger.error("Error al listar archivos SFTP:", error);
      res.status(500).json({
        success: false,
        error: "Error al listar archivos",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Descargar archivo más reciente
   * POST /api/sftp/download-latest
   */
  public static async downloadLatest(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      logger.info("Descarga de archivo más reciente iniciada via API");

      const downloadResult = await SftpService.downloadLatestFileComplete();

      if (downloadResult.success) {
        res.json({
          success: true,
          message: "Archivo descargado exitosamente",
          data: {
            fileName: downloadResult.fileName,
            localPath: downloadResult.localPath,
            fileSize: downloadResult.fileSize,
            downloadTime: downloadResult.downloadTime,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al descargar archivo",
          message: downloadResult.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("Error en descarga de archivo via API:", error);
      res.status(500).json({
        success: false,
        error: "Error al descargar archivo",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Descargar archivo específico
   * POST /api/sftp/download/:fileName
   */
  public static async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        res.status(400).json({
          success: false,
          error: "Nombre de archivo requerido",
          message: "Debe especificar el nombre del archivo a descargar",
        });
        return;
      }

      logger.info("Descarga de archivo específico iniciada via API", {
        fileName,
      });

      const connectionResult = await SftpService.connect();
      if (!connectionResult.success) {
        res.status(500).json({
          success: false,
          error: "Error de conexión",
          message: connectionResult.error,
        });
        return;
      }

      const downloadResult = await SftpService.downloadFile(fileName);
      await SftpService.disconnect();

      if (downloadResult.success) {
        res.json({
          success: true,
          message: "Archivo descargado exitosamente",
          data: {
            fileName: downloadResult.fileName,
            localPath: downloadResult.localPath,
            fileSize: downloadResult.fileSize,
            downloadTime: downloadResult.downloadTime,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Error al descargar archivo",
          message: downloadResult.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      await SftpService.disconnect();
      logger.error("Error en descarga de archivo específico:", error);
      res.status(500).json({
        success: false,
        error: "Error al descargar archivo",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Obtener estado de la conexión SFTP
   * GET /api/sftp/status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = SftpService.getConnectionStatus();

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener estado SFTP:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener estado",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Limpiar archivos temporales
   * POST /api/sftp/cleanup
   */
  public static async cleanup(req: Request, res: Response): Promise<void> {
    try {
      const { hours } = req.body;
      const olderThanHours = hours && typeof hours === "number" ? hours : 24;

      logger.info("Limpieza de archivos temporales iniciada via API", {
        olderThanHours,
      });

      await SftpService.cleanupTempFiles(olderThanHours);

      res.json({
        success: true,
        message: `Limpieza completada - archivos más antiguos que ${olderThanHours} horas eliminados`,
        data: {
          olderThanHours,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error en limpieza de archivos temporales:", error);
      res.status(500).json({
        success: false,
        error: "Error en limpieza",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
}
