/**
 * Health Routes - Rutas para monitoreo y health check
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import { HealthController } from "../controllers/health_controller";

const router = Router();

// GET /api/health - Health check del servicio
router.get("/", HealthController.getHealth);

// GET /api/health/info - Información básica del servicio
router.get("/info", HealthController.getServiceInfo);

export default router;
