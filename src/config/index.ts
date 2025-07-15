/**
 * Config - Configuración centralizada de la aplicación
 *
 * Librerías externas utilizadas:
 * - dotenv: Carga variables de entorno desde archivo .env al proceso Node.js
 *
 * Este archivo centraliza:
 * - Configuración del servidor Express
 * - Configuración del cliente SFTP
 * - Configuración del scheduler (cron jobs)
 * - Configuración del sistema de logging
 * - Paths y zona horaria
 */

import dotenv from "dotenv";
import { SFTPConfig, LogConfig } from "../types";

// Cargar variables de entorno
dotenv.config();

export const config = {
  // Configuración del servidor
  server: {
    port: parseInt(process.env.PORT || "3000"),
    nodeEnv: process.env.NODE_ENV || "development",
  },

  // Configuración del SFTP
  sftp: {
    host: process.env.SFTP_HOST || "test.rebex.net",
    user: process.env.SFTP_USER || "demo",
    password: process.env.SFTP_PASSWORD || "password",
    port: parseInt(process.env.SFTP_PORT || "22"),
    remotePath: process.env.SFTP_REMOTE_PATH || "/",
    filePattern: process.env.SFTP_FILE_PATTERN || "*.*",
    timeout: parseInt(process.env.SFTP_TIMEOUT || "30000"),
  } as SFTPConfig,

  // Configuración del cron
  scheduler: {
    syncCronSchedule: process.env.SYNC_CRON_SCHEDULE || "0 3 * * *", // 3:00 AM diario

    // syncCronSchedule: process.env.SYNC_CRON_SCHEDULE || "*/1 * * * *", // Cada 1 minuto para testing
  },

  // Configuración de logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    maxSize: process.env.LOG_MAX_SIZE || "10m",
    maxFiles: parseInt(process.env.LOG_MAX_FILES || "5"),
    dir: process.env.LOGS_DIR || "./logs",
  } as LogConfig,

  // Configuración de paths
  paths: {
    tempDir: process.env.TEMP_DIR || "./temp",
    logsDir: process.env.LOGS_DIR || "./logs",
  },
  woocommerce: {
    url: process.env.WOOCOMMERCE_URL || ,
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || "",
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || "",
    version: process.env.WOOCOMMERCE_VERSION || "wc/v3",
  },

  // Timezone
  timezone: process.env.TZ || "America/Argentina/Buenos_Aires",
};

console.log("Config loaded:", config);

export default config;
