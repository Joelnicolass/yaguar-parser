/**
 * Routes Index - Configuración centralizada de todas las rutas
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import healthRoutes from "./health";
import syncRoutes from "./sync";

const router = Router();

// Rutas de health check y información del servicio
router.use("/", healthRoutes);

// Rutas de API para sincronización
router.use("/api/sync", syncRoutes);

export default router;
