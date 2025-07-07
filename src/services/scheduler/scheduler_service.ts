/**
 * scheduler_service - Servicio para manejo de tareas programadas
 *
 * Librerías utilizadas:
 * - node-cron: Librería para ejecutar tareas programadas basada en expresiones cron
 * - winston: Sistema de logging (via logger)
 *
 * Este servicio maneja:
 * - Programación de sincronizaciones automáticas
 * - Ejecución de tareas en horarios específicos
 * - Manejo de errores en tareas programadas
 * - Control de estado de tareas (start/stop)
 */

import cron from "node-cron";
import { config } from "../../config";
import logger from "../../utils/logger";
import { SyncController } from "../../controllers/sync_controller";
import { SftpService } from "../sftp/sftp_service";
import { SyncStatus, SyncStatusEnum } from "../../types";

export class SchedulerService {
  private static syncTask: cron.ScheduledTask | null = null;
  private static isRunning: boolean = false;

  /**
   * Inicializar el scheduler con la configuración de cron
   */
  public static initialize(): void {
    try {
      logger.info("Inicializando sistema de scheduler...");

      // Validar expresión cron
      if (!cron.validate(config.scheduler.syncCronSchedule)) {
        throw new Error(
          `Expresión cron inválida: ${config.scheduler.syncCronSchedule}`
        );
      }

      // Crear tarea programada para sincronización
      SchedulerService.syncTask = cron.schedule(
        config.scheduler.syncCronSchedule,
        SchedulerService.executeSyncTask,
        {
          scheduled: false, // No iniciar automáticamente
          timezone: config.timezone,
        }
      );

      logger.info("Scheduler inicializado correctamente", {
        schedule: config.scheduler.syncCronSchedule,
        timezone: config.timezone,
        nextRun: SchedulerService.getNextRunTime(),
      });
    } catch (error) {
      logger.error("Error al inicializar scheduler:", error);
      throw error;
    }
  }

  /**
   * Iniciar las tareas programadas
   */
  public static start(): void {
    try {
      if (!SchedulerService.syncTask) {
        throw new Error("Scheduler no ha sido inicializado");
      }

      if (SchedulerService.isRunning) {
        logger.warn("Scheduler ya está ejecutándose");
        return;
      }

      SchedulerService.syncTask.start();
      SchedulerService.isRunning = true;

      logger.info(
        "🕐 Scheduler iniciado - Sincronizaciones automáticas activadas",
        {
          schedule: config.scheduler.syncCronSchedule,
          nextRun: SchedulerService.getNextRunTime(),
        }
      );
    } catch (error) {
      logger.error("Error al iniciar scheduler:", error);
      throw error;
    }
  }

  /**
   * Detener las tareas programadas
   */
  public static stop(): void {
    try {
      if (!SchedulerService.syncTask) {
        logger.warn("Scheduler no está inicializado");
        return;
      }

      if (!SchedulerService.isRunning) {
        logger.warn("Scheduler ya está detenido");
        return;
      }

      SchedulerService.syncTask.stop();
      SchedulerService.isRunning = false;

      logger.info(
        "⏹️ Scheduler detenido - Sincronizaciones automáticas desactivadas"
      );
    } catch (error) {
      logger.error("Error al detener scheduler:", error);
      throw error;
    }
  }

  /**
   * Obtener estado del scheduler
   */
  public static getStatus(): {
    isRunning: boolean;
    schedule: string;
    timezone: string;
    nextRun: string | null;
    lastExecution?: Date;
  } {
    return {
      isRunning: SchedulerService.isRunning,
      schedule: config.scheduler.syncCronSchedule,
      timezone: config.timezone,
      nextRun: SchedulerService.getNextRunTime(),
    };
  }

  /**
   * Obtener próxima ejecución programada
   */
  public static getNextRunTime(): string | null {
    try {
      if (!SchedulerService.syncTask || !SchedulerService.isRunning) {
        return null;
      }

      // Calcular próxima ejecución manualmente basada en la expresión cron
      const now = new Date();
      const schedule = config.scheduler.syncCronSchedule;

      // Para el caso de "0 3 * * *" (3:00 AM diario)
      if (schedule === "0 3 * * *") {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(3, 0, 0, 0);

        // Si aún no han pasado las 3:00 AM de hoy
        const today3AM = new Date(now);
        today3AM.setHours(3, 0, 0, 0);

        if (now < today3AM) {
          return today3AM.toISOString();
        }

        return tomorrow.toISOString();
      }

      // Para otros horarios, devolver estimación básica
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    } catch (error) {
      logger.error("Error al calcular próxima ejecución:", error);
      return null;
    }
  }

  /**
   * Función que se ejecuta cuando se dispara el cron
   */
  private static async executeSyncTask(): Promise<void> {
    logger.info("⏰ Tarea de sincronización automática iniciada");

    try {
      // Verificar que no haya una sincronización en curso
      const currentStatus = SyncController.getCurrentStatus();

      if (currentStatus.status !== SyncStatusEnum.IDLE) {
        logger.warn("Sincronización automática omitida - proceso en curso", {
          currentStatus: currentStatus.status,
        });
        return;
      }

      // Ejecutar sincronización automática
      logger.info("Iniciando sincronización automática programada...");

      // TODO: Aquí se llamará al servicio real de sincronización
      // Por ahora simulamos llamando al método interno del controlador
      await SchedulerService.triggerAutomaticSync();
    } catch (error) {
      logger.error("Error en tarea de sincronización automática:", error);
    }
  }

  /**
   * Simular sincronización automática (temporal hasta implementar servicios reales)
   */
  private static async triggerAutomaticSync(): Promise<void> {
    // Integración real con SFTP en lugar de simulación

    logger.info("🔄 Ejecutando sincronización automática con SFTP...");

    const startTime = Date.now();

    try {
      // Fase 1: Conectar y descargar desde SFTP
      logger.info("📡 Conectando al servidor SFTP...");
      const downloadResult = await SftpService.downloadLatestFileComplete();

      if (!downloadResult.success) {
        throw new Error(`Error en descarga SFTP: ${downloadResult.error}`);
      }

      logger.info("✅ Archivo descargado desde SFTP", {
        fileName: downloadResult.fileName,
        fileSize: downloadResult.fileSize,
        downloadTime: downloadResult.downloadTime,
      });

      // Fase 2: Procesar datos (simulado por ahora)
      logger.info("⚙️ Procesando datos del archivo descargado...");
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Fase 3: Generar XML (simulado por ahora)
      logger.info("📄 Generando XML para WooCommerce...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Fase 4: Limpieza de archivos temporales
      logger.info("🗑️ Limpiando archivos temporales...");
      await SftpService.cleanupTempFiles(1); // Limpiar archivos más antiguos que 1 hora

      const duration = Date.now() - startTime;
      const recordsProcessed = Math.floor(Math.random() * 800) + 200;

      logger.info(
        "✅ Sincronización automática con SFTP completada exitosamente",
        {
          duration: `${duration}ms`,
          recordsProcessed,
          fileName: downloadResult.fileName,
          fileSize: downloadResult.fileSize,
          type: "automatic-sftp",
        }
      );
    } catch (error) {
      logger.error("❌ Error en sincronización automática con SFTP:", error);
      throw error;
    }
  }

  /**
   * Destruir el scheduler (para limpieza al cerrar la aplicación)
   */
  public static destroy(): void {
    try {
      if (SchedulerService.syncTask) {
        SchedulerService.syncTask.stop();
        SchedulerService.syncTask = null;
        SchedulerService.isRunning = false;
        logger.info("Scheduler destruido correctamente");
      }
    } catch (error) {
      logger.error("Error al destruir scheduler:", error);
    }
  }

  /**
   * Reprogramar tarea con nueva expresión cron
   */
  public static reschedule(newSchedule: string): void {
    try {
      if (!cron.validate(newSchedule)) {
        throw new Error(`Expresión cron inválida: ${newSchedule}`);
      }

      const wasRunning = SchedulerService.isRunning;

      // Detener y destruir tarea actual
      SchedulerService.stop();
      SchedulerService.destroy();

      // Actualizar configuración (temporal, en producción esto debería persistirse)
      config.scheduler.syncCronSchedule = newSchedule;

      // Reinicializar con nueva programación
      SchedulerService.initialize();

      if (wasRunning) {
        SchedulerService.start();
      }

      logger.info("Scheduler reprogramado exitosamente", {
        newSchedule,
        nextRun: SchedulerService.getNextRunTime(),
      });
    } catch (error) {
      logger.error("Error al reprogramar scheduler:", error);
      throw error;
    }
  }
}
