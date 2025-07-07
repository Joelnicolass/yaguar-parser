/**
 * Health Routes - Rutas para monitoreo y health check
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import { HealthController } from "../controllers/health_controller";

const router = Router();

// GET /health - Health check del servicio
router.get("/health", HealthController.getHealth);

// GET / - Información básica del servicio
router.get("/", HealthController.getServiceInfo);

export default router;
