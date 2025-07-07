/**
 * Logger - Sistema de logging avanzado con rotación de archivos
 *
 * Librerías externas utilizadas:
 * - winston: Librería de logging robusta con múltiples transportes y formatos
 * - winston-daily-rotate-file: Plugin para winston que rota archivos diariamente
 * - path: Módulo nativo de Node.js para manejo de rutas de archivos
 * - fs: Módulo nativo de Node.js para operaciones del sistema de archivos
 *
 * Este sistema proporciona:
 * - Logging con diferentes niveles (error, warn, info, debug)
 * - Rotación automática de archivos por día
 * - Archivos separados para errores
 * - Formato JSON estructurado para logs
 * - Output colorizado en consola para desarrollo
 */

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

import { config } from "../config";

// Crear directorio de logs si no existe
if (!fs.existsSync(config.paths.logsDir)) {
  fs.mkdirSync(config.paths.logsDir, { recursive: true });
}

// Configuración de formato personalizado
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Configuración para archivo de logs rotativos
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(config.paths.logsDir, "yaguar-sync-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: logFormat,
});

// Configuración para errores
const errorFileTransport = new DailyRotateFile({
  filename: path.join(config.paths.logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  format: logFormat,
});

// Configuración del logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [fileRotateTransport, errorFileTransport],
});

// En desarrollo, también mostrar logs en consola
if (config.server.nodeEnv === "development") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

export default logger;
