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

const router = Router();

// Rutas de health check y información del servicio
router.use("/", healthRoutes);

// Rutas de API para sincronización
router.use("/api/sync", syncRoutes);

// Rutas de API para scheduler
router.use("/api/scheduler", schedulerRoutes);

export default router;
