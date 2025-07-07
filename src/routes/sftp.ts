/**
 * SFTP Routes - Rutas para operaciones SFTP
 *
 * Librerías utilizadas:
 * - express.Router: Sistema de enrutamiento modular de Express
 */

import { Router } from "express";
import { SftpController } from "../controllers/sftp_controller";

const router = Router();

// POST /api/sftp/test-connection - Probar conexión SFTP
router.post("/test-connection", SftpController.testConnection);

// GET /api/sftp/list-files - Listar archivos remotos
router.get("/list-files", SftpController.listFiles);

// POST /api/sftp/download-latest - Descargar archivo más reciente
router.post("/download-latest", SftpController.downloadLatest);

// POST /api/sftp/download/:fileName - Descargar archivo específico
router.post("/download/:fileName", SftpController.downloadFile);

// GET /api/sftp/status - Estado de la conexión SFTP
router.get("/status", SftpController.getStatus);

// POST /api/sftp/cleanup - Limpiar archivos temporales
router.post("/cleanup", SftpController.cleanup);

export default router;
