/**
 * health_controller - Controlador para endpoints de monitoreo y health check
 *
 * Este controlador maneja:
 * - Health check del servicio
 * - Información básica del servicio
 * - Endpoints de diagnóstico
 */

import { Request, Response } from "express";
import { config } from "../config";

export class HealthController {
  /**
   * Health check endpoint
   * GET /health
   */
  public static async getHealth(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        service: "Yaguar Sync Service",
        version: "0.1.0",
        environment: config.server.nodeEnv,
        timezone: config.timezone,
      });
    } catch (error) {
      res.status(500).json({
        status: "ERROR",
        message: "Error en health check",
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Información básica del servicio
   * GET /
   */
  public static async getServiceInfo(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      res.json({
        message: "Yaguar Sync Service",
        description:
          "Servicio de sincronización de datos WordPress/WooCommerce",
        version: "0.1.0",
        endpoints: {
          health: "/health",
          sync: {
            status: "/api/sync/status",
            trigger: "/api/sync/trigger",
            logs: "/api/sync/logs",
          },
          scheduler: {
            status: "/api/scheduler/status",
            start: "/api/scheduler/start",
            stop: "/api/scheduler/stop",
            reschedule: "/api/scheduler/reschedule",
          },
          sftp: {
            status: "/api/sftp/status",
            testConnection: "/api/sftp/test-connection",
            listFiles: "/api/sftp/list-files",
            downloadLatest: "/api/sftp/download-latest",
            downloadFile: "/api/sftp/download/:fileName",
            cleanup: "/api/sftp/cleanup",
          },
        },
        features: [
          "Sincronización automática diaria",
          "Descarga desde SFTP",
          "Conversión DB → JSON → XML",
          "Compatible con WooCommerce",
          "Sistema de logging avanzado",
          "Cron jobs programables",
          "Cliente SFTP integrado",
        ],
      });
    } catch (error) {
      res.status(500).json({
        error: "Error al obtener información del servicio",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
}
