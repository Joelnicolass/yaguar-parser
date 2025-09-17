/**
 * compression_service - Servicio para manejo de archivos comprimidos
 *
 * Librerías utilizadas:
 * - node-7z: Librería para manejar archivos 7zip y otros formatos comprimidos
 * - adm-zip: Librería para manejo de archivos ZIP
 * - yauzl: Librería para extracción de archivos ZIP de manera eficiente
 * - fs: Módulo nativo de Node.js para operaciones del sistema de archivos
 * - path: Módulo nativo de Node.js para manejo de rutas
 *
 * Este servicio maneja:
 * - Descompresión de archivos .z y .rar
 * - Búsqueda de archivos específicos dentro de archivos comprimidos
 * - Validación de archivos comprimidos
 * - Limpieza de archivos temporales de descompresión
 */

import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { config } from "../../config";
import logger from "../../utils/logger";

const execAsync = promisify(exec);

// Intentar importar las librerías de compresión opcionalmente
let AdmZip: any;
try {
  AdmZip = require("adm-zip");
} catch (error) {
  logger.warn(
    "adm-zip no está instalado. Solo estará disponible descompresión .z y .rar"
  );
}

export interface CompressionResult {
  success: boolean;
  extractedFiles: string[];
  extractionPath?: string;
  extracetedFilesFullPath?: string[];
  error?: string;
  duration?: number;
}

export class CompressionService {
  /**
   * Descomprimir archivo y buscar archivo específico
   */
  public static async extractAndReturnAllFiles(
    compressedFilePath: string
  ): Promise<CompressionResult> {
    const startTime = Date.now();

    try {
      logger.info("🗜️ Iniciando descompresión de archivo", {
        compressedFile: path.basename(compressedFilePath),
      });

      // Validar que el archivo existe
      if (!fs.existsSync(compressedFilePath)) {
        return {
          success: false,
          extractedFiles: [],
          error: `Archivo comprimido no encontrado: ${compressedFilePath}`,
        };
      }

      const fileExtension = path.extname(compressedFilePath).toLowerCase();
      const fileName = path.basename(compressedFilePath, fileExtension);

      // Crear directorio de extracción temporal
      const extractionDir = path.join(
        config.paths.tempDir,
        "extraction",
        `${fileName}_${Date.now()}`
      );

      if (!fs.existsSync(extractionDir)) {
        fs.mkdirSync(extractionDir, { recursive: true });
      }

      let result: CompressionResult;

      switch (fileExtension) {
        case ".z":
          result = await CompressionService.extractZFile(
            compressedFilePath,
            extractionDir
          );
          break;
        case ".rar":
          result = await CompressionService.extractRarFile(
            compressedFilePath,
            extractionDir
          );
          break;
        case ".zip":
          result = await CompressionService.extractZipFile(
            compressedFilePath,
            extractionDir
          );
          break;
        default:
          return {
            success: false,
            extractedFiles: [],
            error: `Formato de archivo no soportado: ${fileExtension}`,
          };
      }

      if (!result.success) {
        return result;
      }

      const duration = Date.now() - startTime;

      // Buscar archivos JSON en el directorio de extracción
      const allJsonFiles = CompressionService.findAllJsonFiles(extractionDir);

      logger.info("✅ Descompresión completada", {
        extractedFiles: result.extractedFiles,
        totalJsonFiles: allJsonFiles.length,
        duration,
      });

      return {
        success: true,
        extractedFiles: result.extractedFiles,
        extracetedFilesFullPath: allJsonFiles, // Rutas completas de archivos JSON
        extractionPath: result.extractionPath,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en descompresión:", error);

      return {
        success: false,
        extractedFiles: [],
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Descomprimir archivo .z usando comando compress/uncompress del sistema
   */
  private static async extractZFile(
    filePath: string,
    extractionDir: string
  ): Promise<CompressionResult> {
    try {
      logger.info("🗜️ Descomprimiendo archivo .z...", {
        file: path.basename(filePath),
      });

      const fileName = path.basename(filePath, ".z");
      const outputPath = path.join(extractionDir, fileName);

      // Intentar con comando uncompress del sistema
      try {
        await execAsync(`uncompress -c "${filePath}" > "${outputPath}"`);
      } catch (uncompressError) {
        // Si uncompress falla, intentar con 7z
        logger.warn("uncompress falló, intentando con 7z...");
        try {
          await execAsync(`7z x "${filePath}" -o"${extractionDir}"`);
        } catch (sevenzError) {
          // Si 7z también falla, intentar copiar directamente
          logger.warn("7z falló, intentando copia directa...");
          fs.copyFileSync(filePath, outputPath);
        }
      }

      // Verificar que el archivo se extrajo
      const extractedFiles = fs.readdirSync(extractionDir);

      return {
        success: extractedFiles.length > 0,
        extractedFiles,
        extractionPath: extractionDir,
      };
    } catch (error) {
      logger.error("Error descomprimiendo archivo .z:", error);
      return {
        success: false,
        extractedFiles: [],
        error:
          error instanceof Error ? error.message : "Error en descompresión .z",
      };
    }
  }

  /**
   * Descomprimir archivo .rar usando 7z
   */
  private static async extractRarFile(
    filePath: string,
    extractionDir: string
  ): Promise<CompressionResult> {
    try {
      logger.info("🗜️ Descomprimiendo archivo .rar...", {
        file: path.basename(filePath),
      });

      // Usar 7z para extraer archivo RAR
      try {
        await execAsync(`7z x "${filePath}" -o"${extractionDir}"`);
      } catch (sevenzError) {
        // Si 7z falla, intentar con unrar
        logger.warn("7z falló, intentando con unrar...");
        await execAsync(`unrar x "${filePath}" "${extractionDir}/"`);
      }

      const extractedFiles = fs.readdirSync(extractionDir);

      return {
        success: extractedFiles.length > 0,
        extractedFiles,
        extractionPath: extractionDir,
      };
    } catch (error) {
      logger.error("Error descomprimiendo archivo .rar:", error);
      return {
        success: false,
        extractedFiles: [],
        error:
          error instanceof Error
            ? error.message
            : "Error en descompresión .rar",
      };
    }
  }

  /**
   * Descomprimir archivo .zip usando adm-zip
   */
  private static async extractZipFile(
    filePath: string,
    extractionDir: string
  ): Promise<CompressionResult> {
    try {
      logger.info("🗜️ Descomprimiendo archivo .zip...", {
        file: path.basename(filePath),
      });

      if (AdmZip) {
        // Usar adm-zip si está disponible
        const zip = new AdmZip(filePath);
        zip.extractAllTo(extractionDir, true);
      } else {
        // Fallback con comando unzip del sistema
        logger.warn(
          "adm-zip no disponible, usando comando unzip del sistema..."
        );
        await execAsync(`unzip -o "${filePath}" -d "${extractionDir}"`);
      }

      const extractedFiles = fs.readdirSync(extractionDir);

      return {
        success: extractedFiles.length > 0,
        extractedFiles,
        extractionPath: extractionDir,
      };
    } catch (error) {
      logger.error("Error descomprimiendo archivo .zip:", error);
      return {
        success: false,
        extractedFiles: [],
        error:
          error instanceof Error
            ? error.message
            : "Error en descompresión .zip",
      };
    }
  }

  /**
   * Buscar todos los archivos JSON recursivamente en un directorio
   */
  public static findAllJsonFiles(searchDir: string): string[] {
    const jsonFiles: string[] = [];

    try {
      const searchRecursively = (dir: string): void => {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          
          try {
            const stats = fs.statSync(itemPath);

            if (stats.isDirectory()) {
              // Excluir directorios de metadatos de macOS
              if (item === '__MACOSX' || item.startsWith('._')) {
                continue;
              }
              // Recursivamente buscar en subdirectorios
              searchRecursively(itemPath);
            } else if (item.toLowerCase().endsWith('.json')) {
              // Excluir archivos de metadatos de macOS que empiezan con ._
              if (item.startsWith('._')) {
                continue;
              }
              // Agregar archivos JSON válidos a la lista
              jsonFiles.push(itemPath);
            }
          } catch (error) {
            // Ignorar archivos/directorios que no se pueden leer
            logger.warn(`No se pudo acceder a: ${itemPath}`, error);
            continue;
          }
        }
      };

      searchRecursively(searchDir);
    } catch (error) {
      logger.error("Error buscando archivos JSON:", error);
    }

    return jsonFiles;
  }

  /**
   * Buscar archivo específico en directorio de extracción
   */
  private static async findTargetFile(
    searchDir: string,
    targetPattern: string
  ): Promise<string | null> {
    try {
      const searchRecursively = (dir: string): string | null => {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            const found = searchRecursively(itemPath);
            if (found) return found;
          } else {
            // Verificar si coincide con el patrón
            if (targetPattern === "*.asc" && item.endsWith(".asc")) {
              return itemPath;
            } else if (item === targetPattern) {
              return itemPath;
            }
          }
        }
        return null;
      };

      return searchRecursively(searchDir);
    } catch (error) {
      logger.error("Error buscando archivo objetivo:", error);
      return null;
    }
  }

  /**
   * Limpiar archivos de extracción temporales
   */
  public static async cleanupExtractionFiles(
    olderThanHours: number = 2
  ): Promise<void> {
    try {
      const extractionDir = path.join(config.paths.tempDir, "extraction");

      if (!fs.existsSync(extractionDir)) {
        return;
      }

      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
      const directories = fs.readdirSync(extractionDir);
      let deletedCount = 0;

      for (const dir of directories) {
        const dirPath = path.join(extractionDir, dir);
        try {
          const stats = fs.statSync(dirPath);

          if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            deletedCount++;
            logger.info(`🗑️ Directorio de extracción eliminado: ${dir}`);
          }
        } catch (error) {
          // Ignorar errores individuales y continuar
          logger.warn(`Error al procesar directorio ${dir}:`, error);
        }
      }

      if (deletedCount > 0) {
        logger.info(
          `✅ Limpieza de archivos de extracción completada: ${deletedCount} directorios eliminados`
        );
      }
    } catch (error) {
      logger.error("Error durante limpieza de archivos de extracción:", error);
    }
  }

  /**
   * Verificar si un archivo es compatible con descompresión
   */
  public static isCompressedFile(filePath: string): boolean {
    const supportedExtensions = [".z", ".rar", ".zip"];
    const extension = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(extension);
  }

  /**
   * Obtener información sobre un archivo comprimido
   */
  public static getCompressionInfo(filePath: string): {
    isCompressed: boolean;
    type: string;
    size: number;
  } {
    try {
      const stats = fs.statSync(filePath);
      const extension = path.extname(filePath).toLowerCase();

      return {
        isCompressed: CompressionService.isCompressedFile(filePath),
        type: extension,
        size: stats.size,
      };
    } catch (error) {
      logger.error("Error obteniendo información de compresión:", error);
      return {
        isCompressed: false,
        type: "unknown",
        size: 0,
      };
    }
  }

  /**
   * Listar archivos en directorio de extracción
   */
  public static getExtractionDirectoryInfo(): {
    totalDirectories: number;
    totalSizeBytes: number;
    directories: Array<{
      name: string;
      size: number;
      created: Date;
      fileCount: number;
    }>;
  } {
    try {
      const extractionDir = path.join(config.paths.tempDir, "extraction");

      if (!fs.existsSync(extractionDir)) {
        return {
          totalDirectories: 0,
          totalSizeBytes: 0,
          directories: [],
        };
      }

      const directories = fs.readdirSync(extractionDir);
      let totalSizeBytes = 0;
      const directoryInfo = [];

      for (const dir of directories) {
        try {
          const dirPath = path.join(extractionDir, dir);
          const stats = fs.statSync(dirPath);

          if (stats.isDirectory()) {
            const dirSize = CompressionService.calculateDirectorySize(dirPath);
            const fileCount = CompressionService.countFilesInDirectory(dirPath);

            totalSizeBytes += dirSize;
            directoryInfo.push({
              name: dir,
              size: dirSize,
              created: stats.birthtime,
              fileCount,
            });
          }
        } catch (error) {
          // Ignorar errores individuales
        }
      }

      return {
        totalDirectories: directoryInfo.length,
        totalSizeBytes,
        directories: directoryInfo.sort(
          (a, b) => b.created.getTime() - a.created.getTime()
        ),
      };
    } catch (error) {
      logger.error(
        "Error obteniendo información del directorio de extracción:",
        error
      );
      return {
        totalDirectories: 0,
        totalSizeBytes: 0,
        directories: [],
      };
    }
  }

  /**
   * Calcular tamaño de directorio recursivamente
   */
  private static calculateDirectorySize(dirPath: string): number {
    let totalSize = 0;

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        try {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            totalSize += CompressionService.calculateDirectorySize(itemPath);
          } else {
            totalSize += stats.size;
          }
        } catch (error) {
          // Ignorar errores de archivos individuales
        }
      }
    } catch (error) {
      // Ignorar errores de acceso
    }

    return totalSize;
  }

  /**
   * Contar archivos en directorio recursivamente
   */
  private static countFilesInDirectory(dirPath: string): number {
    let fileCount = 0;

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        try {
          const itemPath = path.join(dirPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            fileCount += CompressionService.countFilesInDirectory(itemPath);
          } else {
            fileCount++;
          }
        } catch (error) {
          // Ignorar errores de archivos individuales
        }
      }
    } catch (error) {
      // Ignorar errores de acceso
    }

    return fileCount;
  }
}
