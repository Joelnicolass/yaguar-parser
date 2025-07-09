/**
 * sync_controller - Controlador para operaciones de sincronización
 *
 * Este controlador maneja:
 * - Estado del proceso de sincronización
 * - Trigger manual de sincronización
 * - Consulta de logs de sincronización
 * - Métricas del sistema
 * - Integración completa SFTP + Parser
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js, manejo de Request/Response
 * - dayjs: Librería para manejo de fechas más ligera que moment.js
 */

import { Request, Response } from "express";
import dayjs from "dayjs";

import logger from "../utils/logger";
import { SftpService } from "../services/sftp/sftp_service";
import { ParserService } from "../services/parser/parser_service";

import { SyncStatus, SyncResult, SyncStatusEnum } from "../types";
import { config } from "../config";

export class SyncController {
  // Estado global del servicio de sincronización
  private static currentStatus: SyncStatus = {
    status: SyncStatusEnum.IDLE,
    lastSync: undefined,
    nextSync: undefined,
    message: "Servicio iniciado, esperando primera sincronización",
  };

  private static syncHistory: SyncResult[] = [];

  /**
   * Obtener estado actual de la sincronización
   * GET /api/sync/status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      // Calcular próxima sincronización basada en el cron schedule
      const nextSync = SyncController.calculateNextSync();

      const status = {
        ...SyncController.currentStatus,
        nextSync,
        uptime: process.uptime(),
        lastSyncHistory: SyncController.syncHistory.slice(-5), // Últimas 5 sincronizaciones
        totalSyncs: SyncController.syncHistory.length,
      };

      logger.info("Estado de sincronización consultado", {
        status: status.status,
      });

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener estado de sincronización:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener estado",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Trigger manual de sincronización COMPLETA (SFTP + Parser)
   * POST /api/sync/trigger
   */
  public static async triggerSync(req: Request, res: Response): Promise<void> {
    try {
      // Verificar si ya hay una sincronización en curso
      if (SyncController.currentStatus.status !== "IDLE") {
        res.status(409).json({
          success: false,
          error: "Sincronización en curso",
          message: `Estado actual: ${SyncController.currentStatus.status}`,
          currentStatus: SyncController.currentStatus,
        });
        return;
      }

      logger.info("Sincronización manual COMPLETA iniciada por usuario");

      // Respuesta inmediata al usuario
      res.json({
        success: true,
        message: "Sincronización completa iniciada (SFTP + Parser)",
        status: SyncController.currentStatus,
        timestamp: new Date().toISOString(),
      });

      // Ejecutar sincronización completa en background
      SyncController.executeFullSync();
    } catch (error) {
      logger.error("Error al iniciar sincronización manual:", error);
      res.status(500).json({
        success: false,
        error: "Error al iniciar sincronización",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Trigger manual solo SFTP (descarga sin parsing)
   * POST /api/sync/trigger-sftp-only
   */
  public static async triggerSftpOnly(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (SyncController.currentStatus.status !== "IDLE") {
        res.status(409).json({
          success: false,
          error: "Sincronización en curso",
          message: `Estado actual: ${SyncController.currentStatus.status}`,
          currentStatus: SyncController.currentStatus,
        });
        return;
      }

      logger.info("Sincronización SFTP-only iniciada por usuario");

      res.json({
        success: true,
        message: "Descarga SFTP iniciada (sin parsing)",
        status: SyncController.currentStatus,
        timestamp: new Date().toISOString(),
      });

      SyncController.executeSftpOnlySync();
    } catch (error) {
      logger.error("Error al iniciar sincronización SFTP:", error);
      res.status(500).json({
        success: false,
        error: "Error al iniciar sincronización SFTP",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Ejecutar sincronización completa (SFTP + Parser)
   * Método usado tanto por trigger manual como por scheduler automático
   */
  public static async executeFullSync(): Promise<SyncResult> {
    const startTime = Date.now();
    let downloadedFileName = "";

    try {
      logger.info("🚀 Iniciando sincronización completa (SFTP + Parser)");

      // FASE 1: Descargar archivo más reciente (incluye conexión automática)
      SyncController.updateStatus(
        SyncStatusEnum.CONNECTING,
        "Conectando al servidor SFTP..."
      );

      SyncController.updateStatus(
        SyncStatusEnum.DOWNLOADING,
        "Descargando archivo más reciente desde SFTP..."
      );

      const downloadResult = await SftpService.downloadLatestFileComplete();
      if (!downloadResult.success) {
        throw new Error(`Error en descarga: ${downloadResult.error}`);
      }

      downloadedFileName = downloadResult.fileName!;
      const fileSize = downloadResult.fileSize!;

      logger.info("📁 Archivo descargado exitosamente", {
        fileName: downloadedFileName,
        fileSize,
        downloadTime: downloadResult.downloadTime,
      });

      // FASE 2: Parsear archivo descargado
      SyncController.updateStatus(
        SyncStatusEnum.PARSING,
        `Parseando archivo: ${downloadedFileName}...`
      );

      const parserResult = await ParserService.parseFromTempFile(
        downloadedFileName
      );
      if (!parserResult.success) {
        throw new Error(`Error en parsing: ${parserResult.error}`);
      }

      logger.info("📊 Archivo parseado exitosamente", {
        productsCount: parserResult.productsCount,
        duration: parserResult.duration,
        outputPath: parserResult.outputPath,
      });

      // FASE 3: Generar XML (placeholder para futura implementación)
      SyncController.updateStatus(
        SyncStatusEnum.GENERATING,
        "Preparando datos para WooCommerce..."
      );

      // Simular procesamiento adicional
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // FASE 4: Completar sincronización
      const duration = Date.now() - startTime;

      SyncController.updateStatus(
        SyncStatusEnum.COMPLETED,
        `Sincronización completada: ${parserResult.productsCount} productos procesados`
      );

      const syncResult: SyncResult = {
        success: true,
        timestamp: new Date(),
        recordsProcessed: parserResult.productsCount,
        fileSize: Math.round(fileSize / 1024), // Convertir a KB
        duration,
      };

      // Agregar a historial
      SyncController.syncHistory.push(syncResult);

      // Mantener solo los últimos 100 registros
      if (SyncController.syncHistory.length > 100) {
        SyncController.syncHistory = SyncController.syncHistory.slice(-100);
      }

      logger.info("✅ Sincronización completa exitosa", {
        ...syncResult,
        fileName: downloadedFileName,
        outputPath: parserResult.outputPath,
      });

      // Volver a IDLE después de 5 segundos
      setTimeout(() => {
        SyncController.updateStatus(
          SyncStatusEnum.IDLE,
          "Esperando próxima sincronización"
        );
      }, 5000);

      return syncResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      SyncController.updateStatus(
        SyncStatusEnum.ERROR,
        `Error en sincronización: ${errorMessage}`
      );

      const syncResult: SyncResult = {
        success: false,
        timestamp: new Date(),
        recordsProcessed: 0,
        fileSize: 0,
        duration,
        error: errorMessage,
      };

      SyncController.syncHistory.push(syncResult);

      logger.error("❌ Error en sincronización completa:", {
        error: errorMessage,
        duration,
        fileName: downloadedFileName,
      });

      // Volver a IDLE después de 10 segundos en caso de error
      setTimeout(() => {
        SyncController.updateStatus(
          SyncStatusEnum.IDLE,
          "Esperando próxima sincronización (error recuperado)"
        );
      }, 10000);

      return syncResult;
    }
  }

  /**
   * Ejecutar solo descarga SFTP (sin parsing)
   */
  private static async executeSftpOnlySync(): Promise<void> {
    const startTime = Date.now();

    try {
      SyncController.updateStatus(
        SyncStatusEnum.CONNECTING,
        "Conectando al servidor SFTP..."
      );

      SyncController.updateStatus(
        SyncStatusEnum.DOWNLOADING,
        "Descargando archivo más reciente desde SFTP..."
      );

      const downloadResult = await SftpService.downloadLatestFileComplete();
      if (!downloadResult.success) {
        throw new Error(`Error en descarga: ${downloadResult.error}`);
      }

      const duration = Date.now() - startTime;

      SyncController.updateStatus(
        SyncStatusEnum.COMPLETED,
        `Descarga SFTP completada: ${downloadResult.fileName}`
      );

      logger.info("✅ Descarga SFTP exitosa", {
        fileName: downloadResult.fileName,
        fileSize: downloadResult.fileSize,
        duration,
      });

      setTimeout(() => {
        SyncController.updateStatus(
          SyncStatusEnum.IDLE,
          "Esperando próxima sincronización"
        );
      }, 3000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      SyncController.updateStatus(
        SyncStatusEnum.ERROR,
        `Error en descarga SFTP: ${errorMessage}`
      );

      logger.error("❌ Error en descarga SFTP:", error);

      setTimeout(() => {
        SyncController.updateStatus(
          SyncStatusEnum.IDLE,
          "Esperando próxima sincronización (error recuperado)"
        );
      }, 10000);
    }
  }

  /**
   * Obtener logs de sincronización
   * GET /api/sync/logs
   */
  public static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0 } = req.query;

      logger.info("Logs de sincronización consultados", {
        limit: Number(limit),
        offset: Number(offset),
      });

      // Obtener logs del historial con paginación
      const totalLogs = SyncController.syncHistory.length;
      const startIndex = Math.max(
        0,
        totalLogs - Number(offset) - Number(limit)
      );
      const endIndex = Math.max(0, totalLogs - Number(offset));

      const logs = SyncController.syncHistory
        .slice(startIndex, endIndex)
        .reverse(); // Mostrar más recientes primero

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total: totalLogs,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: startIndex > 0,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener logs de sincronización:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener logs",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Actualizar estado interno de sincronización
   */
  private static updateStatus(
    status: SyncStatus["status"],
    message?: string
  ): void {
    SyncController.currentStatus = {
      ...SyncController.currentStatus,
      status,
      message,
      lastSync:
        status === "COMPLETED"
          ? new Date()
          : SyncController.currentStatus.lastSync,
    };

    logger.info(`Estado de sincronización actualizado: ${status}`, { message });
  }

  /**
   * Calcular próxima ejecución basada en cron schedule
   */
  private static calculateNextSync(): Date {
    // Simulación: próxima sincronización a las 3:00 AM del siguiente día
    const tomorrow = dayjs()
      .add(1, "day")
      .hour(3)
      .minute(0)
      .second(0)
      .millisecond(0);
    return tomorrow.toDate();
  }

  /**
   * Simular proceso de sincronización para desarrollo
   */
  private static async simulateSync(): Promise<void> {
    const startTime = Date.now();

    try {
      // Simular diferentes fases del proceso
      SyncController.updateStatus(
        SyncStatusEnum.CONNECTING,
        "Conectando al servidor FTP..."
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      SyncController.updateStatus(
        SyncStatusEnum.DOWNLOADING,
        "Descargando archivo de respaldo..."
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      SyncController.updateStatus(
        SyncStatusEnum.PARSING,
        "Procesando datos..."
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      SyncController.updateStatus(
        SyncStatusEnum.GENERATING,
        "Generando XML para WooCommerce..."
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Completar sincronización
      const duration = Date.now() - startTime;
      const recordsProcessed = Math.floor(Math.random() * 500) + 100;

      SyncController.updateStatus(
        SyncStatusEnum.COMPLETED,
        `Sincronización completada: ${recordsProcessed} registros procesados`
      );

      // Agregar a historial
      const syncResult: SyncResult = {
        success: true,
        timestamp: new Date(),
        recordsProcessed,
        fileSize: Math.floor(Math.random() * 10000) + 5000, // KB
        duration,
      };

      SyncController.syncHistory.push(syncResult);

      // Mantener solo los últimos 100 registros
      if (SyncController.syncHistory.length > 100) {
        SyncController.syncHistory = SyncController.syncHistory.slice(-100);
      }

      logger.info("Sincronización simulada completada", syncResult);

      // Volver a estado IDLE después de 5 segundos
      setTimeout(() => {
        SyncController.updateStatus(
          SyncStatusEnum.IDLE,
          "Esperando próxima sincronización"
        );
      }, 5000);
    } catch (error) {
      SyncController.updateStatus(
        SyncStatusEnum.ERROR,
        "Error durante la sincronización"
      );
      logger.error("Error en simulación de sincronización:", error);
    }
  }

  /**
   * Obtener estado actual (método público para uso interno)
   */
  public static getCurrentStatus(): SyncStatus {
    return SyncController.currentStatus;
  }
}
