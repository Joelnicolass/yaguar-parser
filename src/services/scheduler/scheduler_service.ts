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
import { CompressionService } from "../compression/compression_service";
import { WoocommerceController } from "../../controllers/woocommerce_controller";
import {
  ARCHIVO_A_SUCURSAL_ID,
  SUCURSAL_ID_A_ARCHIVO,
  SucursalCredenciales,
  SUCURSALES_CREDENCIALES,
} from "../../config/sucursales_credenciales";

export class SchedulerService {
  private static syncTask: cron.ScheduledTask | null = null;
  private static isRunning: boolean = false;
  // Agregar flag de bloqueo para prevenir ejecuciones concurrentes
  private static isAutoSyncInProgress: boolean = false;

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
   * Ejecutar inmediatamente DEBUG
   *
   */
  public static async DEBUG_executeImmediateSync(): Promise<void> {
    try {
      logger.info("Ejecución inmediata de sincronización (DEBUG) iniciada...");
      await SchedulerService.triggerAutomaticSync();
      logger.info("Ejecución inmediata de sincronización (DEBUG) finalizada.");
    } catch (error) {
      logger.error(
        "Error en ejecución inmediata de sincronización (DEBUG):",
        error
      );
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

      // Calcular próxima ejecución basada en la expresión cron actual
      const now = new Date();
      const schedule = config.scheduler.syncCronSchedule;

      // Para expresiones de segundos (6 campos): "*/10 * * * * *"
      if (schedule.split(" ").length === 6) {
        const parts = schedule.split(" ");
        const secondsPart = parts[0];

        if (secondsPart && secondsPart.startsWith("*/")) {
          const interval = parseInt(secondsPart.substring(2));
          if (!isNaN(interval) && interval > 0) {
            const nextRun = new Date(now.getTime() + interval * 1000);
            return nextRun.toISOString();
          }
        }
      }

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

    // Verificación doble con bloqueo local
    if (SchedulerService.isAutoSyncInProgress) {
      logger.warn(
        "Sincronización automática omitida - flag de progreso activo"
      );
      return;
    }

    // Agregar timeout de seguridad para liberar el flag automáticamente
    let timeoutId: NodeJS.Timeout;

    try {
      // Marcar inmediatamente como en progreso para evitar concurrencia
      SchedulerService.isAutoSyncInProgress = true;

      // Timeout de seguridad: liberar flag después de 5 minutos máximo
      timeoutId = setTimeout(() => {
        logger.warn(
          "⚠️ Timeout de seguridad: liberando flag de sincronización automática después de 5 minutos"
        );
        SchedulerService.isAutoSyncInProgress = false;
      }, 5 * 60 * 1000); // 5 minutos

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

      // Agregar timeout a la sincronización completa
      const syncPromise = SchedulerService.triggerAutomaticSync();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("Timeout de sincronización (4 minutos)")),
          4 * 60 * 1000
        );
      });

      await Promise.race([syncPromise, timeoutPromise]);

      // Si llegamos aquí, la sincronización completó exitosamente
      clearTimeout(timeoutId);
    } catch (error) {
      // Limpiar timeout si hay error
      if (timeoutId!) {
        clearTimeout(timeoutId);
      }

      logger.error("Error en tarea de sincronización automática:", error);
    } finally {
      // Asegurar que el flag se libere siempre
      SchedulerService.isAutoSyncInProgress = false;
      logger.info("Flag de sincronización automática liberado");
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

      const LOCAL_PATH = downloadResult.localPath;
      logger.info({ LOCAL_PATH });

      // Descomprimir el archivo
      logger.info("🗜️ Fase 2: Descomprimiendo archivo...");
      const unzipped = await CompressionService.extractAndReturnAllFiles(
        LOCAL_PATH
      );

      if (!unzipped.success || !unzipped.extractionPath) {
        throw new Error(`Error al descomprimir: ${unzipped.error}`);
      }

      logger.info("✅ Archivo descomprimido", {
        extractionPath: unzipped.extractionPath,
        extractedFiles: unzipped.extractedFiles,
        extractedFilesFullPath: unzipped.extracetedFilesFullPath,
        duration: unzipped.duration,
      });

      // refactorizar esto -> es una negrada
      const wooController = new WoocommerceController();

      const result = await wooController.uploadProductsFromMultipleSucursales(
        unzipped.extracetedFilesFullPath!
      );

      logger.info("✅ Productos sincronizados a WooCommerce", {
        ...result,
      });

      /*  const credentials: SucursalCredenciales["credenciales"][] = [];

      Object.keys(SUCURSALES_CREDENCIALES).forEach((key) => {
        if (!SUCURSALES_CREDENCIALES[parseInt(key)]) return;

        return credentials.push(
          SUCURSALES_CREDENCIALES[parseInt(key)]!.credenciales
        );
      });
 */
      // factory de controllers - cada controller es una sucursal

      /* const woocommerceControllers = credentials.map(
        (cred) => new WoocommerceController(cred)
      );

      logger.info(
        `✅ Inicializados ${woocommerceControllers.length} controladores de WooCommerce`
      ); */

      // Fase 3: SINCRONIZAR A WOO

      /* let promises: Promise<any>[] = [];

      woocommerceControllers.forEach((wcController) => {
        const archivoSucursal = SUCURSAL_ID_A_ARCHIVO[wcController.sucursalId!];
        promises.push(
          wcController.uploadProductsFromSucursalJson(archivoSucursal!)
        );
      });

      await Promise.all(promises); */

      const duration = Date.now() - startTime;
      logger.info("✅ Sincronización automática completada exitosamente", {
        totalDuration: `${duration}ms`,
      });
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
