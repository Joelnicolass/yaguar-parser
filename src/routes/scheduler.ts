/**
 * Scheduler Routes - Rutas para operaciones del scheduler
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import { SchedulerController } from "../controllers/scheduler_controller";

const router = Router();

// GET /api/scheduler/status - Obtener estado del scheduler
router.get("/status", SchedulerController.getStatus);

// POST /api/scheduler/start - Iniciar scheduler
router.post("/start", SchedulerController.start);

// POST /api/scheduler/stop - Detener scheduler
router.post("/stop", SchedulerController.stop);

// POST /api/scheduler/reschedule - Reprogramar scheduler
router.post("/reschedule", SchedulerController.reschedule);

export default router;
