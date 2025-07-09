/**
 * parser_service - Servicio para parsear archivos .asc de la base de datos legacy
 *
 * Librerías utilizadas:
 * - fs: Módulo nativo de Node.js para operaciones del sistema de archivos
 * - path: Módulo nativo de Node.js para manejo de rutas
 * - csv-writer: Librería para generar archivos CSV
 *
 * Este servicio maneja:
 * - Lectura de archivos .asc con formato legacy
 * - Parsing de líneas con regex para extraer datos
 * - Limpieza y validación de nombres de productos
 * - Exportación a JSON y CSV
 * - Manejo de errores y logging detallado
 */

import fs from "fs";
import path from "path";
import { config } from "../../config";
import logger from "../../utils/logger";
import { ParsedProduct, ParserResult, ParserConfig } from "../../types";

// Instalar csv-writer si no está instalado
let createCsvWriter: any;
try {
  createCsvWriter = require("csv-writer").createObjectCsvWriter;
} catch (error) {
  logger.warn("csv-writer no instalado. Solo estará disponible output JSON");
}

export class ParserService {
  /**
   * Parsear archivo .asc con configuración personalizable
   */
  public static async parseFile(config: ParserConfig): Promise<ParserResult> {
    const startTime = Date.now();

    try {
      logger.info("🔍 Iniciando parsing de archivo .asc...", {
        inputPath: config.inputPath,
        outputFormat: config.outputFormat,
      });

      // Verificar que el archivo existe
      if (!fs.existsSync(config.inputPath)) {
        throw new Error(`Archivo no encontrado: ${config.inputPath}`);
      }

      // Leer archivo
      const fileContent = fs.readFileSync(config.inputPath, "utf-8");
      const lines = fileContent.split(/\r?\n/);
      const products: ParsedProduct[] = [];

      logger.info(`📄 Archivo leído: ${lines.length} líneas encontradas`);

      // Procesar cada línea
      let processedLines = 0;
      let skippedLines = 0;

      for (const line of lines) {
        try {
          const product = ParserService.parseLine(
            line,
            config.cleanProductNames
          );

          if (product) {
            if (
              config.validateData &&
              !ParserService.validateProduct(product)
            ) {
              skippedLines++;
              continue;
            }

            products.push(product);
            processedLines++;
          } else {
            skippedLines++;
          }
        } catch (error) {
          logger.warn("Error al procesar línea:", { line, error });
          skippedLines++;
        }
      }

      logger.info("📊 Parsing completado", {
        totalLines: lines.length,
        processedLines,
        skippedLines,
        productsFound: products.length,
      });

      // Crear directorio de salida si no existe
      if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
      }

      let outputPath = "";

      // Generar archivos de salida según configuración
      if (config.outputFormat === "json" || config.outputFormat === "both") {
        outputPath = await ParserService.generateJsonOutput(
          products,
          config.outputDir
        );
        logger.info("📁 Archivo JSON generado:", { path: outputPath });
      }

      if (config.outputFormat === "csv" || config.outputFormat === "both") {
        if (createCsvWriter) {
          const csvPath = await ParserService.generateCsvOutput(
            products,
            config.outputDir
          );
          logger.info("📁 Archivo CSV generado:", { path: csvPath });
          if (!outputPath) outputPath = csvPath;
        } else {
          logger.warn("No se puede generar CSV: csv-writer no instalado");
        }
      }

      const duration = Date.now() - startTime;

      logger.info("✅ Parsing completado exitosamente", {
        productsCount: products.length,
        duration: `${duration}ms`,
        outputPath,
      });

      return {
        success: true,
        productsCount: products.length,
        filePath: config.inputPath,
        outputPath,
        duration,
        products: products.slice(0, 10), // Solo devolver los primeros 10 para no sobrecargar la respuesta
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      logger.error("❌ Error en parsing de archivo:", {
        error: errorMessage,
        inputPath: config.inputPath,
        duration: `${duration}ms`,
      });

      return {
        success: false,
        productsCount: 0,
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Parsear línea individual del archivo .asc
   * Basado en el código original con mejoras
   */
  private static parseLine(
    line: string,
    cleanNames: boolean = true
  ): ParsedProduct | null {
    try {
      // Regex mejorada para capturar el patrón: ID + NOMBRE + números
      const match = line.match(/^(\d+)\s+(.*?)(?:\s{2,}|\t+|\d)/);
      const nums = line.match(/\d+/g);

      if (!match || !nums || nums.length < 2) {
        return null;
      }

      const sku = nums[0];
      let name = match[2];

      // Validar que el nombre existe
      if (!name) {
        return null;
      }

      // Limpiar nombre del producto
      if (cleanNames) {
        name = name
          .replace(/\*+$/, "") // Remover asteriscos al final
          .replace(/\*{3,}/g, " ") // Reemplazar secuencias de asteriscos por espacio
          .trim()
          .replace(/\s+/g, " "); // Normalizar espacios
      }

      // Extraer stock, precio y categoría
      const stock = nums[1] || "0";
      const price = nums[2] || "0";
      const category = nums[nums.length - 1] || "0";

      // Validar que el nombre no esté vacío después de limpieza
      if (!name || name.length < 2) {
        return null;
      }

      return {
        sku,
        name,
        price,
        stock,
        category,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validar datos del producto
   */
  private static validateProduct(product: ParsedProduct): boolean {
    // Validaciones básicas
    if (!product.sku || !product.name) {
      return false;
    }

    // SKU debe ser numérico
    if (!/^\d+$/.test(product.sku)) {
      return false;
    }

    // Precio y stock deben ser números válidos
    if (isNaN(Number(product.price)) || isNaN(Number(product.stock))) {
      return false;
    }

    // Nombre debe tener longitud mínima
    if (product.name.length < 2) {
      return false;
    }

    return true;
  }

  /**
   * Generar archivo JSON de salida
   */
  private static async generateJsonOutput(
    products: ParsedProduct[],
    outputDir: string
  ): Promise<string> {
    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `woocommerce_productos_${timestamp}.json`;
    const outputPath = path.join(outputDir, fileName);

    // Formatear productos para WooCommerce
    const woocommerceProducts = products.map((product) => ({
      SKU: product.sku,
      Name: product.name,
      "Regular price": product.price,
      Stock: product.stock,
      Categories: product.category,
      Type: "simple",
      Published: "1",
      "Meta: _manage_stock": "yes",
      "Meta: _stock_status":
        Number(product.stock) > 0 ? "instock" : "outofstock",
    }));

    // Escribir archivo JSON
    fs.writeFileSync(outputPath, JSON.stringify(woocommerceProducts, null, 2));

    return outputPath;
  }

  /**
   * Generar archivo CSV de salida (requiere csv-writer)
   */
  private static async generateCsvOutput(
    products: ParsedProduct[],
    outputDir: string
  ): Promise<string> {
    if (!createCsvWriter) {
      throw new Error("csv-writer no está instalado");
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const fileName = `woocommerce_productos_${timestamp}.csv`;
    const outputPath = path.join(outputDir, fileName);

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        { id: "sku", title: "SKU" },
        { id: "name", title: "Name" },
        { id: "price", title: "Regular price" },
        { id: "stock", title: "Stock" },
        { id: "category", title: "Categories" },
        { id: "type", title: "Type" },
        { id: "published", title: "Published" },
      ],
    });

    // Formatear productos para CSV
    const csvProducts = products.map((product) => ({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      type: "simple",
      published: "1",
    }));

    await csvWriter.writeRecords(csvProducts);
    return outputPath;
  }

  /**
   * Parsear archivo desde ruta temporal (integración con SFTP)
   */
  public static async parseFromTempFile(
    fileName: string
  ): Promise<ParserResult> {
    const inputPath = path.join(config.paths.tempDir, fileName);
    const outputDir = path.join(config.paths.tempDir, "parsed");

    const parserConfig: ParserConfig = {
      inputPath,
      outputFormat: "json", // Por defecto JSON para integración
      outputDir,
      cleanProductNames: true,
      validateData: true,
    };

    return await ParserService.parseFile(parserConfig);
  }

  /**
   * Parsear archivo de ejemplo para testing
   */
  public static async parseExampleFile(): Promise<ParserResult> {
    const inputPath = path.join(
      process.cwd(),
      "examples",
      "db_data_example.asc"
    );
    const outputDir = path.join(config.paths.tempDir, "examples");

    const parserConfig: ParserConfig = {
      inputPath,
      outputFormat: "both",
      outputDir,
      cleanProductNames: true,
      validateData: true,
    };

    return await ParserService.parseFile(parserConfig);
  }

  /**
   * Obtener estadísticas del último archivo parseado
   */
  public static getParsingStats(filePath: string): {
    exists: boolean;
    size?: number;
    lines?: number;
    lastModified?: Date;
  } {
    try {
      if (!fs.existsSync(filePath)) {
        return { exists: false };
      }

      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split(/\r?\n/).length;

      return {
        exists: true,
        size: stats.size,
        lines,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Limpiar archivos temporales de parsing
   */
  public static async cleanupParsedFiles(
    olderThanHours: number = 24
  ): Promise<void> {
    try {
      const parsedDir = path.join(config.paths.tempDir, "parsed");

      if (!fs.existsSync(parsedDir)) {
        return;
      }

      const files = fs.readdirSync(parsedDir);
      const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(parsedDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Archivo parseado eliminado: ${file}`);
        }
      }

      if (deletedCount > 0) {
        logger.info(
          `✅ Limpieza de archivos parseados completada: ${deletedCount} archivos eliminados`
        );
      }
    } catch (error) {
      logger.error("Error durante limpieza de archivos parseados:", error);
    }
  }
}
