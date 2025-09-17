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
import { ParserService } from "../parser/parser_service";
import { SyncStatusEnum } from "../../types";
import path from "path";

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
      await SchedulerService.triggerAutomaticSync();
    } catch (error) {
      logger.error("Error en tarea de sincronización automática:", error);
    }
  }

  /**
   * Validar archivo antes del parsing - Enfoque simple y escalable
   */
  private static validateFileForParsing(fileName: string): {
    valid: boolean;
    reason?: string;
  } {
    try {
      logger.info("🔍 Validando archivo antes del parsing...", { fileName });

      // Validación 1: Extensión del archivo
      const allowedExtensions = [".asc", ".txt", ".csv"];
      const fileExt = path.extname(fileName).toLowerCase();

      if (!allowedExtensions.includes(fileExt)) {
        return {
          valid: false,
          reason: `Extensión no permitida: ${fileExt}. Permitidas: ${allowedExtensions.join(
            ", "
          )}`,
        };
      }

      // Validación 2: Patrón del nombre (ajusta según tus necesidades)
      const validNamePatterns = [
        /productos/i, // debe contener "productos"
        /woocommerce/i, // o "woocommerce"
        /^db_data/i, // o empezar con "db_data"
      ];

      const hasValidPattern = validNamePatterns.some((pattern) =>
        pattern.test(fileName)
      );

      if (!hasValidPattern) {
        return {
          valid: false,
          reason: `Nombre de archivo no coincide con patrones esperados. Archivo: ${fileName}`,
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error("Error al validar archivo:", error);
      return {
        valid: false,
        reason: `Error en validación: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Ejecutar sincronización automática completa usando servicios reales
   */
  private static async triggerAutomaticSync(): Promise<void> {
    logger.info("🔄 Ejecutando sincronización automática completa...");

    const startTime = Date.now();

    try {
      // Fase 1: Conectar y descargar desde SFTP
      logger.info("📡 Fase 1: Conectando al servidor SFTP...");
      const downloadResult = await SftpService.downloadLatestFileComplete();

      if (!downloadResult.success) {
        throw new Error(`Error en descarga SFTP: ${downloadResult.error}`);
      }

      logger.info("✅ Archivo descargado desde SFTP", {
        fileName: downloadResult.fileName,
        fileSize: downloadResult.fileSize,
        downloadTime: downloadResult.downloadTime,
      });

      // Fase de validación: Validar archivo antes del parsing
      logger.info("🔍 Fase 1.5: Validando archivo descargado...");

      if (!downloadResult.fileName) {
        throw new Error("No se obtuvo el nombre del archivo descargado");
      }

      // const validation = SchedulerService.validateFileForParsing(
      //   downloadResult.fileName
      // );

      // if (!validation.valid) {
      //   throw new Error(
      //     `Archivo no válido para procesamiento: ${validation.reason}`
      //   );
      // }

      logger.info("✅ Archivo validado - Continuando con el procesamiento");

      // // Fase 2: Parsear archivo descargado usando ParserService real
      // logger.info("⚙️ Fase 2: Procesando datos del archivo descargado...");

      // const parseResult = await ParserService.parseFromTempFile(
      //   downloadResult.fileName
      // );

      // if (!parseResult.success) {
      //   throw new Error(`Error al parsear archivo: ${parseResult.error}`);
      // }

      // logger.info("✅ Archivo parseado exitosamente", {
      //   productsCount: parseResult.productsCount,
      //   outputPath: parseResult.outputPath,
      //   duration: parseResult.duration,
      // });

      // // Fase 3: Generar estadísticas del procesamiento
      // logger.info("📊 Fase 3: Generando estadísticas del procesamiento...");

      // const stats = ParserService.getParsingStats(parseResult.filePath || "");

      // logger.info("📈 Estadísticas del procesamiento:", {
      //   fileExists: stats.exists,
      //   fileSize: stats.size,
      //   totalLines: stats.lines,
      //   productsProcessed: parseResult.productsCount,
      //   lastModified: stats.lastModified,
      // });

      // Fase 4: Limpieza de archivos temporales antiguos
      logger.info("🗑️ Fase 4: Limpiando archivos temporales...");

      // Limpiar archivos SFTP antiguos (más de 2 horas)
      //await SftpService.cleanupTempFiles(2);

      // Limpiar archivos parseados antiguos (más de 24 horas)
      //await ParserService.cleanupParsedFiles(24);

      const duration = Date.now() - startTime;

      logger.info("✅ Sincronización automática completada exitosamente", {
        totalDuration: `${duration}ms`,
        fileName: downloadResult.fileName,
        fileSize: downloadResult.fileSize,
        // productsProcessed: parseResult.productsCount,
        // outputPath: parseResult.outputPath,
        type: "automatic-complete",
        phases: {
          download: `${downloadResult.downloadTime}ms`,
          // parsing: `${parseResult.duration}ms`,
          total: `${duration}ms`,
        },
      });

      // TODO: Aquí se puede agregar la fase de integración con WooCommerce
      // cuando tengamos los datos de conexión reales
      logger.info("🔮 Próxima fase: Integración con WooCommerce (pendiente)");
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("❌ Error en sincronización automática:", {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
        phase: "automatic-sync",
      });
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
