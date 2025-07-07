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
        },
        features: [
          "Sincronización automática diaria",
          "Descarga desde FTP",
          "Conversión DB → JSON → XML",
          "Compatible con WooCommerce",
          "Sistema de logging avanzado",
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
