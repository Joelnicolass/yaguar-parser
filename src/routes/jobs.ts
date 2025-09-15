/**
 * Router para operaciones de jobs asíncronos
 */

import { Router, Request, Response } from "express";
import { jobController } from "../controllers/job_controller";
import logger from "../utils/logger";

const router = Router();

/**
 * Obtener estado de un job específico
 */
router.get("/status/:jobId", (req: Request, res: Response): void => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        success: false,
        error: "Job ID requerido",
      });
      return;
    }

    const jobStatus = jobController.getJobStatus(jobId);

    if (!jobStatus) {
      res.status(404).json({
        success: false,
        error: "Job no encontrado",
      });
      return;
    }

    res.json({
      success: true,
      job: jobStatus,
    });
  } catch (error) {
    logger.error("Error obteniendo estado de job:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * Listar todos los jobs
 */
router.get("/list", (req: Request, res: Response): void => {
  try {
    const jobs = jobController.getAllJobs();

    res.json({
      success: true,
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    logger.error("Error listando jobs:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

/**
 * Limpiar jobs antiguos
 */
router.post("/cleanup", (req: Request, res: Response): void => {
  try {
    const cleanedCount = jobController.cleanupOldJobs();

    res.json({
      success: true,
      message: `${cleanedCount} jobs antiguos eliminados`,
      cleanedCount,
    });
  } catch (error) {
    logger.error("Error limpiando jobs:", error);
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
    });
  }
});

export default router;
