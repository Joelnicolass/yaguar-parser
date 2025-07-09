/**
 * Routes Index - Configuración centralizada de todas las rutas
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import healthRoutes from "./health";
import syncRoutes from "./sync";
import schedulerRoutes from "./scheduler";
import sftpRoutes from "./sftp";
import parserRoutes from "./parser";

const router = Router();

// Rutas de health check y información del servicio
router.use("/api/health", healthRoutes);

// Rutas de API para sincronización
router.use("/api/sync", syncRoutes);

// Rutas de API para scheduler
router.use("/api/scheduler", schedulerRoutes);

// Rutas de API para SFTP
router.use("/api/sftp", sftpRoutes);

// Rutas de API para el parser
router.use("/api/parser", parserRoutes);

export default router;
