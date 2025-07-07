/**
 * scheduler_controller - Controlador para operaciones del scheduler
 *
 * Este controlador maneja:
 * - Estado del scheduler
 * - Control de inicio/parada de tareas programadas
 * - Reprogramación de tareas
 * - Información de próximas ejecuciones
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js, manejo de Request/Response
 */

import { Request, Response } from "express";
import { SchedulerService } from "../services/scheduler/scheduler_service";
import logger from "../utils/logger";

export class SchedulerController {
  /**
   * Obtener estado del scheduler
   * GET /api/scheduler/status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = SchedulerService.getStatus();

      logger.info("Estado del scheduler consultado", {
        isRunning: status.isRunning,
      });

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al obtener estado del scheduler:", error);
      res.status(500).json({
        success: false,
        error: "Error al obtener estado del scheduler",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Iniciar el scheduler
   * POST /api/scheduler/start
   */
  public static async start(req: Request, res: Response): Promise<void> {
    try {
      SchedulerService.start();

      logger.info("Scheduler iniciado via API");

      res.json({
        success: true,
        message: "Scheduler iniciado exitosamente",
        data: SchedulerService.getStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al iniciar scheduler via API:", error);
      res.status(500).json({
        success: false,
        error: "Error al iniciar scheduler",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Detener el scheduler
   * POST /api/scheduler/stop
   */
  public static async stop(req: Request, res: Response): Promise<void> {
    try {
      SchedulerService.stop();

      logger.info("Scheduler detenido via API");

      res.json({
        success: true,
        message: "Scheduler detenido exitosamente",
        data: SchedulerService.getStatus(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al detener scheduler via API:", error);
      res.status(500).json({
        success: false,
        error: "Error al detener scheduler",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  /**
   * Reprogramar el scheduler con nueva expresión cron
   * POST /api/scheduler/reschedule
   */
  public static async reschedule(req: Request, res: Response): Promise<void> {
    try {
      const { schedule } = req.body;

      if (!schedule || typeof schedule !== "string") {
        res.status(400).json({
          success: false,
          error: "Expresión cron requerida",
          message:
            'Debe proporcionar una expresión cron válida en el campo "schedule"',
        });
        return;
      }

      SchedulerService.reschedule(schedule);

      logger.info("Scheduler reprogramado via API", { newSchedule: schedule });

      res.json({
        success: true,
        message: "Scheduler reprogramado exitosamente",
        data: {
          newSchedule: schedule,
          status: SchedulerService.getStatus(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Error al reprogramar scheduler via API:", error);
      res.status(400).json({
        success: false,
        error: "Error al reprogramar scheduler",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
}
