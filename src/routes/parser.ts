/**
 * Router para operaciones de parsing de archivos .asc
 */

import { Router } from "express";
import { ParserController } from "../controllers/parser_controller";

const router = Router();

// Parsear archivo de ejemplo
router.post("/parse-example", ParserController.parseExample);

// Parsear archivo personalizado
router.post("/parse-file", ParserController.parseFile);

// Parsear archivo desde SFTP
router.post("/parse-from-sftp/:fileName", ParserController.parseFromSftp);

// Obtener estadísticas de archivo
router.get("/stats/:fileName", ParserController.getFileStats);

// Limpiar archivos parseados
router.post("/cleanup", ParserController.cleanup);

// Obtener configuración del parser
router.get("/config", ParserController.getConfig);

export default router;
