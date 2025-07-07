/**
 * App.ts - Configuración principal de la aplicación Express
 *
 * Librerías externas utilizadas:
 * - express: Framework web minimalista y flexible para Node.js
 * - cors: Middleware para habilitar Cross-Origin Resource Sharing (CORS)
 * - helmet: Middleware de seguridad que configura varios headers HTTP
 * - dotenv: Carga variables de entorno desde archivo .env (via config)
 * - winston: Librería de logging avanzada con múltiples transportes (via logger)
 *
 * Este archivo configura:
 * - Middlewares de seguridad y parsing
 * - Sistema de logging para requests
 * - Rutas modulares de la aplicación
 * - Manejo global de errores
 * - Configuración del servidor
 */

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import logger from "./utils/logger";
import routes from "./routes";

import { config } from "./config";

const app = express();

// Middlewares de seguridad
app.use(helmet()); // Configura headers de seguridad
app.use(cors()); // Habilita CORS para todas las rutas
app.use(express.json()); // Parser para JSON en requests
app.use(express.urlencoded({ extended: true })); // Parser para form data

// Middleware de logging para requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Configurar todas las rutas de la aplicación
app.use("/", routes);

// Manejo de errores global
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Error no manejado:", error);

  res.status(500).json({
    error: "Error interno del servidor",
    message:
      config.server.nodeEnv === "development"
        ? error.message
        : "Algo salió mal",
  });
});

// Manejo de rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
    availableEndpoints: {
      health: "/health",
      serviceInfo: "/",
      syncStatus: "/api/sync/status",
      syncTrigger: "/api/sync/trigger",
      syncLogs: "/api/sync/logs",
    },
  });
});

// Iniciar servidor
const startServer = async () => {
  try {
    app.listen(config.server.port, () => {
      logger.info(`🚀 Servidor iniciado en puerto ${config.server.port}`);
      logger.info(`📍 Ambiente: ${config.server.nodeEnv}`);
      logger.info(`🕐 Zona horaria: ${config.timezone}`);
      logger.info(
        `📋 Health check: http://localhost:${config.server.port}/health`
      );
      logger.info(
        `🔄 Sync status: http://localhost:${config.server.port}/api/sync/status`
      );
    });
  } catch (error) {
    logger.error("Error al iniciar servidor:", error);
    process.exit(1);
  }
};

// Manejo de señales de terminación
process.on("SIGTERM", () => {
  logger.info("SIGTERM recibido, cerrando servidor...");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT recibido, cerrando servidor...");
  process.exit(0);
});

export { app };
export default startServer;
