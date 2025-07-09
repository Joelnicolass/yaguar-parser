/**
 * sftp_service - Servicio para descargar archivos desde servidor SFTP
 *
 * Librerías utilizadas:
 * - ssh2-sftp-client: Cliente SFTP robusto para Node.js basado en ssh2
 * - path: Módulo nativo de Node.js para manejo de rutas
 * - fs: Módulo nativo de Node.js para operaciones del sistema de archivos
 *
 * Este servicio maneja:
 * - Conexión segura al servidor SFTP
 * - Listado de archivos remotos
 * - Descarga de archivos con validación
 * - Limpieza de archivos temporales
 * - Manejo de errores de conexión y descarga
 */

import SftpClient from "ssh2-sftp-client";
import { config } from "../../config";
import logger from "../../utils/logger";
import { SFTPConnectionResult, SFTPDownloadResult } from "../../types";
import path from "path";
import fs from "fs";

export class SftpService {
  private static client: SftpClient | null = null;
  private static isConnected: boolean = false;

  /**
   * Conectar al servidor SFTP
   */
  public static async connect(): Promise<SFTPConnectionResult> {
    try {
      logger.info("🔗 Conectando al servidor SFTP...", {
        host: config.sftp.host,
        port: config.sftp.port,
        user: config.sftp.user,
      });

      SftpService.client = new SftpClient();

      await SftpService.client.connect({
        host: config.sftp.host,
        port: config.sftp.port,
        username: config.sftp.user,
        password: config.sftp.password,
        readyTimeout: config.sftp.timeout,
      });

      SftpService.isConnected = true;

      logger.info("✅ Conexión SFTP establecida exitosamente", {
        host: config.sftp.host,
        port: config.sftp.port,
      });

      return {
        success: true,
        message: "Conexión SFTP establecida exitosamente",
      };
    } catch (error) {
      SftpService.isConnected = false;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error al conectar al servidor SFTP:", {
        error: errorMessage,
        host: config.sftp.host,
        port: config.sftp.port,
      });

      return {
        success: false,
        message: "Error al conectar al servidor SFTP",
        error: errorMessage,
      };
    }
  }

  /**
   * Desconectar del servidor SFTP
   */
  public static async disconnect(): Promise<void> {
    try {
      if (SftpService.client && SftpService.isConnected) {
        await SftpService.client.end();
        SftpService.client = null;
        SftpService.isConnected = false;
        logger.info("🔌 Conexión SFTP cerrada");
      }
    } catch (error) {
      logger.error("Error al cerrar conexión SFTP:", error);
    }
  }

  /**
   * Listar archivos en el directorio remoto
   */
  public static async listFiles(): Promise<{
    success: boolean;
    files?: any[];
    error?: string;
  }> {
    try {
      if (!SftpService.client || !SftpService.isConnected) {
        logger.error("❌ No hay conexión SFTP activa");
        throw new Error("No hay conexión SFTP activa");
      }

      logger.info("📂 Listando archivos en directorio remoto...", {
        remotePath: config.sftp.remotePath,
        pattern: config.sftp.filePattern,
      });

      const fileList = await SftpService.client.list(config.sftp.remotePath);

      logger.info(`📋 Encontrados ${fileList.length} archivos`, {
        path: config.sftp.remotePath,
        totalFiles: fileList.length,
        fileNames: fileList.map((file) => file.name),
        filePattern: config.sftp.filePattern,
      });

      return {
        success: true,
        files: fileList,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";
      logger.error("❌ Error al listar archivos:", errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Descargar archivo específico
   */
  public static async downloadFile(
    remoteFileName: string
  ): Promise<SFTPDownloadResult> {
    const startTime = Date.now();

    try {
      if (!SftpService.client || !SftpService.isConnected) {
        throw new Error("No hay conexión SFTP activa");
      }

      // Crear directorio temporal si no existe
      if (!fs.existsSync(config.paths.tempDir)) {
        fs.mkdirSync(config.paths.tempDir, { recursive: true });
      }

      const remotePath = path.posix.join(
        config.sftp.remotePath,
        remoteFileName
      );
      const localPath = path.join(config.paths.tempDir, remoteFileName);

      logger.info("📥 Descargando archivo...", {
        remoteFile: remotePath,
        localFile: localPath,
      });

      await SftpService.client.fastGet(remotePath, localPath);

      // Obtener información del archivo descargado
      const fileStats = fs.statSync(localPath);
      const downloadTime = Date.now() - startTime;

      logger.info("✅ Archivo descargado exitosamente", {
        fileName: remoteFileName,
        fileSize: fileStats.size,
        downloadTime: `${downloadTime}ms`,
        localPath,
      });

      return {
        success: true,
        fileName: remoteFileName,
        localPath,
        fileSize: fileStats.size,
        downloadTime,
      };
    } catch (error) {
      const downloadTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error al descargar archivo:", {
        fileName: remoteFileName,
        error: errorMessage,
        downloadTime: `${downloadTime}ms`,
      });

      return {
        success: false,
        fileName: remoteFileName,
        localPath: "",
        fileSize: 0,
        downloadTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Descargar el archivo más reciente que coincida con el patrón
   */
  public static async downloadLatestFile(): Promise<SFTPDownloadResult> {
    try {
      const listResult = await SftpService.listFiles();

      if (
        !listResult.success ||
        !listResult.files ||
        listResult.files.length === 0
      ) {
        throw new Error("No se encontraron archivos en el servidor");
      }

      // Encontrar el archivo más reciente
      const latestFile = listResult.files
        .filter((file) => file.type === "-") // Solo archivos, no directorios
        .sort((a, b) => b.modifyTime - a.modifyTime)[0];

      if (!latestFile) {
        throw new Error("No se encontraron archivos válidos");
      }

      logger.info("📅 Archivo más reciente encontrado:", {
        fileName: latestFile.name,
        size: latestFile.size,
        modifyTime: new Date(latestFile.modifyTime).toISOString(),
      });

      return await SftpService.downloadFile(latestFile.name);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      return {
        success: false,
        fileName: "",
        localPath: "",
        fileSize: 0,
        downloadTime: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Operación completa: conectar, descargar y desconectar
   */
  public static async downloadLatestFileComplete(): Promise<SFTPDownloadResult> {
    try {
      // Conectar
      const connectionResult = await SftpService.connect();
      if (!connectionResult.success) {
        throw new Error(connectionResult.error || "Error de conexión");
      }

      // Descargar archivo más reciente
      const downloadResult = await SftpService.downloadLatestFile();

      // Desconectar
      await SftpService.disconnect();

      return downloadResult;
    } catch (error) {
      // Asegurar desconexión en caso de error
      await SftpService.disconnect();

      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      return {
        success: false,
        fileName: "",
        localPath: "",
        fileSize: 0,
        downloadTime: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Limpiar archivos temporales antiguos
   */
  public static async cleanupTempFiles(
    olderThanHours: number = 24
  ): Promise<void> {
    try {
      if (!fs.existsSync(config.paths.tempDir)) {
        return;
      }

      const files = fs.readdirSync(config.paths.tempDir);
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(config.paths.tempDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Archivo temporal eliminado: ${file}`);
        }
      }

      if (deletedCount > 0) {
        logger.info(
          `✅ Limpieza completada: ${deletedCount} archivos eliminados`
        );
      }
    } catch (error) {
      logger.error("Error durante limpieza de archivos temporales:", error);
    }
  }

  /**
   * Obtener estado de la conexión
   */
  public static getConnectionStatus(): {
    isConnected: boolean;
    host: string;
    port: number;
    user: string;
  } {
    return {
      isConnected: SftpService.isConnected,
      host: config.sftp.host,
      port: config.sftp.port,
      user: config.sftp.user,
    };
  }
}
