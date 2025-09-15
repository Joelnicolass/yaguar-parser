/**
 * Router para operaciones de parsing de archivos legacy y sucursales
 */

import { Router } from "express";
import { ParserController } from "../controllers/parser_controller";

const router = Router();

// === RUTAS LEGACY (archivos .asc) ===

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

// === NUEVAS RUTAS PARA SUCURSALES ===

// Parsear archivo JSON de sucursal y enviar a WooCommerce (SÍNCRONO)
router.post("/parse-sucursal", ParserController.parseSucursal);

// Parsear archivo JSON de sucursal de forma asíncrona (NUEVO)
router.post("/parse-sucursal-async", ParserController.parseSucursalAsync);

// Parsear archivo de sucursal por defecto (acceso rápido)
router.post("/parse-default-sucursal", ParserController.parseDefaultSucursal);

// Obtener información de una sucursal sin procesar
router.get("/sucursal-info", ParserController.getSucursalInfo);

// Listar archivos de sucursales disponibles
router.get("/sucursales-files", ParserController.listSucursalesFiles);

export default router;
