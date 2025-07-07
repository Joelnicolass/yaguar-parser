/**
 * Sync Routes - Rutas para operaciones de sincronización
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import { SyncController } from "../controllers/sync_controller";

const router = Router();

// GET /api/sync/status - Obtener estado actual de sincronización
router.get("/status", SyncController.getStatus);

// POST /api/sync/trigger - Iniciar sincronización manual
router.post("/trigger", SyncController.triggerSync);

// GET /api/sync/logs - Obtener logs de sincronización
router.get("/logs", SyncController.getLogs);

export default router;
