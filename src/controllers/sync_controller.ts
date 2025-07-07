/**
 * sync_controller - Controlador para operaciones de sincronización
 *
 * Este controlador maneja:
 * - Estado del proceso de sincronización
 * - Trigger manual de sincronización
 * - Consulta de logs de sincronización
 * - Métricas del sistema
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js, manejo de Request/Response
 * - dayjs: Librería para manejo de fechas más ligera que moment.js
 */

import { Request, Response } from "express";
import dayjs from "dayjs";

import logger from "../utils/logger";

import { SyncStatus, SyncResult } from "../types";
import { config } from "../config";

export class SyncController {
  // Estado global del servicio de sincronización
  private static currentStatus: SyncStatus = {
    status: "IDLE",
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
   * Trigger manual de sincronización
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
        return; // Mover el return después del response para corregir el error de tipos
      }

      logger.info("Sincronización manual iniciada por usuario");

      // Simular inicio de sincronización
      SyncController.updateStatus(
        "CONNECTING",
        "Iniciando sincronización manual..."
      );

      // TODO: Aquí se implementará la lógica real de sincronización
      // Por ahora simulamos el proceso
      setTimeout(() => {
        SyncController.simulateSync();
      }, 1000);

      res.json({
        success: true,
        message: "Sincronización iniciada",
        status: SyncController.currentStatus,
        timestamp: new Date().toISOString(),
      });
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
   * Obtener logs recientes de sincronización
   * GET /api/sync/logs
   */
  public static async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const level = (req.query.level as string) || "info";

      // TODO: Implementar lectura real de logs desde archivos
      // Por ahora devolvemos logs simulados
      const mockLogs = [
        {
          timestamp: dayjs().subtract(1, "hour").toISOString(),
          level: "info",
          message: "Sincronización completada exitosamente",
          records: 150,
        },
        {
          timestamp: dayjs().subtract(2, "hours").toISOString(),
          level: "info",
          message: "Conectando al servidor FTP",
        },
        {
          timestamp: dayjs().subtract(3, "hours").toISOString(),
          level: "error",
          message: "Error de conexión FTP - reintentando",
        },
      ];

      res.json({
        success: true,
        data: {
          logs: mockLogs.slice(0, limit),
          total: mockLogs.length,
          filter: { level, limit },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener logs:", error);
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
        "CONNECTING",
        "Conectando al servidor FTP..."
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      SyncController.updateStatus(
        "DOWNLOADING",
        "Descargando archivo de respaldo..."
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));

      SyncController.updateStatus("PARSING", "Procesando datos...");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      SyncController.updateStatus(
        "GENERATING",
        "Generando XML para WooCommerce..."
      );
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Completar sincronización
      const duration = Date.now() - startTime;
      const recordsProcessed = Math.floor(Math.random() * 500) + 100;

      SyncController.updateStatus(
        "COMPLETED",
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
        SyncController.updateStatus("IDLE", "Esperando próxima sincronización");
      }, 5000);
    } catch (error) {
      SyncController.updateStatus("ERROR", "Error durante la sincronización");
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
