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

// POST /api/sync/trigger - Iniciar sincronización completa (SFTP + Parser)
router.post("/trigger", SyncController.triggerSync);

// POST /api/sync/trigger-sftp-only - Iniciar solo descarga SFTP (sin parsing)
router.post("/trigger-sftp-only", SyncController.triggerSftpOnly);

// GET /api/sync/logs - Obtener logs de sincronización
router.get("/logs", SyncController.getLogs);

export default router;
