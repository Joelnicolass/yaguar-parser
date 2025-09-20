import path from "path";
import fs from "fs";
import { SftpService } from "./sftp/sftp_service";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import { getCredencialesSucursal } from "../config/sucursales_credenciales";
import {
  CATEGORIAS_POR_ID,
  CATEGORIAS_POR_ID_AUTOPISTA,
} from "../config/categorias_referencia";
import { SucursalData, SucursalProduct } from "../types";

// ✅ CONFIGURACIÓN CENTRALIZADA - Modificar aquí para cambiar comportamiento
const CONFIG = {
  // Configuración de concurrencia y paralelismo
  CONCURRENCY: {
    SUCURSALES_PARALELAS: 1, // Máximo sucursales procesadas en paralelo
    BATCHES_PARALELOS_POR_SUCURSAL: 3, // Máximo batches paralelos por sucursal
    IMAGENES_PARALELAS: 500, // Máximo verificaciones de imágenes en paralelo
    BUSQUEDAS_PARALELAS_UPDATES: 5, // Máximo búsquedas paralelas para updates
  },

  // Configuración de tamaños de batch
  BATCH_SIZES: {
    CREACION: 50, // Productos por batch para creación
    ACTUALIZACION: 50, // Productos por batch para actualización
    ELIMINACION: 100, // Productos por batch para eliminación
    PAGINACION_SKUS: 100, // Productos por página al obtener SKUs existentes
  },

  // Configuración de timeouts y delays
  TIMEOUTS: {
    WOOCOMMERCE_TIMEOUT: 300000, // 5 minutos para operaciones WooCommerce
    IMAGE_VERIFICATION_TIMEOUT: 5000, // 5 segundos para verificar imágenes
    RETRY_BASE_DELAY: 2000, // Delay base para reintentos (ms)
    CHUNKS_DELAY_SUCURSALES: 2000, // Delay entre chunks de sucursales
    SKU_FETCH_DELAY: 100, // Delay entre páginas al obtener SKUs
    UPDATE_SEARCH_CHUNK_DELAY: 100, // Delay entre chunks de búsqueda
    DELETE_BATCH_DELAY: 300, // Delay entre batches de eliminación
  },

  // Configuración de reintentos y límites
  RETRY: {
    MAX_RETRIES: 3, // Máximo reintentos por batch
    MAX_RESPONSE_TIMES_TRACKED: 5, // Cantidad de tiempos de respuesta a trackear
  },

  // Configuración de delays adaptativos
  ADAPTIVE_DELAYS: {
    MIN_DELAY: 500, // Delay mínimo adaptativo (ms)
    MAX_DELAY: 3000, // Delay máximo adaptativo (ms)
    RESPONSE_TIME_MULTIPLIER: 0.3, // Multiplicador del tiempo de respuesta
    CHUNK_DELAY_MULTIPLIER: 0.2, // Multiplicador para delay entre chunks
    CHUNK_MIN_DELAY: 300, // Delay mínimo entre chunks (ms)
    CHUNK_MAX_DELAY: 1500, // Delay máximo entre chunks (ms)
    UPDATE_DELAY_DIVISOR: 2, // Divisor para delays de actualización
  },

  // URLs y rutas
  URLS: {
    FALLBACK_IMAGE: "https://vd.com.ar/images/0000.png", // Imagen por defecto
    IMAGE_BASE_URL: "https://vd.com.ar/images/", // Base URL para imágenes
  },

  // Configuración de archivos y extensiones
  FILES: {
    JSON_EXTENSION: ".json", // Extensión de archivos a procesar
  },

  // Configuración de campos WooCommerce
  WOOCOMMERCE: {
    VERSION: "wc/v3", // Versión de la API de WooCommerce
    PRODUCT_TYPE: "simple", // Tipo de producto por defecto
    PRODUCT_STATUS: "publish", // Estado de producto por defecto
    STOCK_STATUS: "instock", // Estado de stock por defecto
    SKU_FIELD_ONLY: "sku", // Campo para obtener solo SKUs
    HTTP_METHOD_HEAD: "HEAD", // Método HTTP para verificar imágenes
    DELETE_PAGE: 1, // Página fija para eliminación (se actualiza dinámicamente)
  },

  // Mensajes de error comunes
  ERROR_PATTERNS: {
    CONNECTION_ERRORS: ["socket hang up", "ECONNRESET", "timeout"],
  },
};

// Cache global para verificación de imágenes
const imageCache = new Map<string, boolean>();

// Métricas para delays adaptativos
interface PerformanceMetrics {
  avgResponseTime: number;
  lastResponseTimes: number[];
  maxResponseTimes: number;
}

const performanceMetrics = new Map<number, PerformanceMetrics>();

interface WooCommerceProductFromSucursal {
  sku: string;
  name: string;
  regular_price: string;
  description: string;
  short_description: string;
  categories: Array<{ id: number }>;
  type: string;
  status: string;
  manage_stock?: boolean;
  stock_status: string;
  images: Array<{
    src: string;
  }>;
  meta_data: Array<{ key: string; value: any }>;
}

interface BatchResult {
  created?: any[];
  updated?: any[];
  errors?: any[];
}

interface ProductProcessingResult {
  successCount: number;
  failedProducts: WooCommerceProductFromSucursal[];
  duplicateProducts: WooCommerceProductFromSucursal[];
  otherErrors: any[];
}

const woocommerceInstances: Map<number, WooCommerceRestApi> = new Map();

function initializeSucursalInstance(
  sucursalId: number
): WooCommerceRestApi | null {
  if (woocommerceInstances.has(sucursalId))
    return woocommerceInstances.get(sucursalId)!;

  const credenciales = getCredencialesSucursal(sucursalId);
  if (!credenciales) return null;

  const wooInstance = new WooCommerceRestApi({
    url: credenciales.credenciales.url,
    consumerKey: credenciales.credenciales.consumerKey,
    consumerSecret: credenciales.credenciales.consumerSecret,
    version:
      credenciales.credenciales.version || (CONFIG.WOOCOMMERCE.VERSION as any),
    axiosConfig: {
      timeout: CONFIG.TIMEOUTS.WOOCOMMERCE_TIMEOUT,
      // Aumentado a 5 minutos para operaciones largas
    },
  });

  // Los reintentos se manejan a nivel de función, no necesitamos configurar axios-retry aquí
  console.log(
    `✅ Instancia WooCommerce inicializada para sucursal ${sucursalId} con manejo de reintentos`
  );

  woocommerceInstances.set(sucursalId, wooInstance);
  return wooInstance;
}

function getWooCommerceInstance(sucursalId: number): WooCommerceRestApi | null {
  return initializeSucursalInstance(sucursalId);
}

export async function executeUpload(): Promise<void> {
  const startTime = Date.now();
  try {
    await SftpService.connect();
    const res = await SftpService.listFiles();

    if (!res.success)
      throw new Error(`Error al listar archivos en SFTP: ${res.error}`);

    if (!res.files || res.files.length === 0)
      throw new Error("No se encontraron archivos en el servidor SFTP");

    const jsonFiles = res.files.filter((file) =>
      file.name.endsWith(CONFIG.FILES.JSON_EXTENSION)
    );
    const downloadedJsonFiles = [];

    for (const file of jsonFiles) {
      if (file.name.endsWith(CONFIG.FILES.JSON_EXTENSION)) {
        const downloadRes = await SftpService.downloadFile(file.name);
        if (downloadRes.success) {
          downloadedJsonFiles.push(downloadRes.localPath);
        }
      }
    }

    const result = await uploadProductsFromMultipleSucursales(
      downloadedJsonFiles
    );

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    throw error;
  } finally {
    await SftpService.disconnect();
    const duration = Date.now() - startTime;
    console.log(`Proceso de subida finalizado en ${duration} ms`);
  }
}

export async function executeDelete(sucursalId: number): Promise<void> {
  const startTime = Date.now();
  try {
    const result = await deleteAllProductsFromSucursal(sucursalId);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    console.log(`Proceso de borrado finalizado en ${duration} ms`);
  }
}

// Función para verificar imágenes con cache
async function verifyImageExists(imageUrl: string): Promise<boolean> {
  if (imageCache.has(imageUrl)) {
    return imageCache.get(imageUrl)!;
  }

  try {
    // Crear AbortController para timeout manual
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CONFIG.TIMEOUTS.IMAGE_VERIFICATION_TIMEOUT
    );

    const response = await fetch(imageUrl, {
      method: CONFIG.WOOCOMMERCE.HTTP_METHOD_HEAD,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const exists = response.ok;
    imageCache.set(imageUrl, exists);
    return exists;
  } catch (error) {
    imageCache.set(imageUrl, false);
    return false;
  }
}

// Función para verificar múltiples imágenes en paralelo con límite
async function verifyImagesInBatch(
  imageUrls: string[],
  concurrencyLimit: number = CONFIG.CONCURRENCY.IMAGENES_PARALELAS
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Filtrar URLs que ya están en cache
  const urlsToCheck = imageUrls.filter((url) => !imageCache.has(url));
  const cachedResults = imageUrls
    .filter((url) => imageCache.has(url))
    .map((url) => [url, imageCache.get(url)!] as [string, boolean]);

  // Agregar resultados del cache
  cachedResults.forEach(([url, exists]) => results.set(url, exists));

  if (urlsToCheck.length === 0) {
    return results;
  }

  // Procesar en chunks para limitar concurrencia
  const chunks = [];
  for (let i = 0; i < urlsToCheck.length; i += concurrencyLimit) {
    chunks.push(urlsToCheck.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkPromises = chunk.map(async (url) => {
      const exists = await verifyImageExists(url);
      results.set(url, exists);
      return { url, exists };
    });

    await Promise.all(chunkPromises);
  }

  return results;
}

// Función para obtener todos los SKUs existentes de una sucursal
async function getAllExistingSkus(
  wooInstance: WooCommerceRestApi
): Promise<Set<string>> {
  const existingSkus = new Set<string>();
  let page = 1;
  const perPage = CONFIG.BATCH_SIZES.PAGINACION_SKUS;

  console.log(`🔍 Obteniendo SKUs existentes...`);

  try {
    while (true) {
      const response = await wooInstance.get("products", {
        per_page: perPage,
        page,
        _fields: CONFIG.WOOCOMMERCE.SKU_FIELD_ONLY, // Solo obtener el campo SKU para mayor eficiencia
      });

      const products = response.data;
      if (!products || products.length === 0) break;

      products.forEach((product: any) => {
        if (product.sku) {
          existingSkus.add(product.sku);
        }
      });

      console.log(
        `📄 Página ${page}: ${products.length} productos, ${existingSkus.size} SKUs únicos acumulados`
      );
      page++;

      // Delay pequeño para no saturar
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.TIMEOUTS.SKU_FETCH_DELAY)
      );
    }
  } catch (error) {
    console.warn(`⚠️ Error obteniendo SKUs existentes:`, error);
  }

  console.log(`✅ Total SKUs existentes encontrados: ${existingSkus.size}`);
  return existingSkus;
}

// Función para calcular delay adaptativo
function calculateAdaptiveDelay(
  sucursalId: number,
  responseTime: number
): number {
  let metrics = performanceMetrics.get(sucursalId);

  if (!metrics) {
    metrics = {
      avgResponseTime: responseTime,
      lastResponseTimes: [responseTime],
      maxResponseTimes: CONFIG.RETRY.MAX_RESPONSE_TIMES_TRACKED,
    };
    performanceMetrics.set(sucursalId, metrics);
  } else {
    // Mantener solo los últimos N tiempos de respuesta
    metrics.lastResponseTimes.push(responseTime);
    if (metrics.lastResponseTimes.length > metrics.maxResponseTimes) {
      metrics.lastResponseTimes.shift();
    }

    // Calcular promedio
    metrics.avgResponseTime =
      metrics.lastResponseTimes.reduce((sum, time) => sum + time, 0) /
      metrics.lastResponseTimes.length;
  }

  // Delay adaptativo: más tiempo si el servidor está lento
  // Mínimo 500ms, máximo 3000ms
  const adaptiveDelay = Math.min(
    Math.max(
      metrics.avgResponseTime * CONFIG.ADAPTIVE_DELAYS.RESPONSE_TIME_MULTIPLIER,
      CONFIG.ADAPTIVE_DELAYS.MIN_DELAY
    ),
    CONFIG.ADAPTIVE_DELAYS.MAX_DELAY
  );

  console.log(
    `📊 Sucursal ${sucursalId} - Promedio: ${Math.round(
      metrics.avgResponseTime
    )}ms, Delay: ${Math.round(adaptiveDelay)}ms`
  );

  return adaptiveDelay;
}

// Nueva función para procesar batches en paralelo con límite de concurrencia
async function processBatchesInParallel(
  batches: WooCommerceProductFromSucursal[][],
  wooInstance: WooCommerceRestApi,
  sucursalId: number,
  concurrencyLimit: number = CONFIG.CONCURRENCY.BATCHES_PARALELOS_POR_SUCURSAL
): Promise<{
  uploadedCount: number;
  failedCount: number;
  errors: string[];
}> {
  let totalUploaded = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  // Procesar batches en chunks para limitar concurrencia
  const batchChunks = [];
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    batchChunks.push(batches.slice(i, i + concurrencyLimit));
  }

  console.log(
    `🚀 Procesando ${batches.length} batches en chunks de ${concurrencyLimit} en paralelo`
  );

  for (let chunkIndex = 0; chunkIndex < batchChunks.length; chunkIndex++) {
    const chunk = batchChunks[chunkIndex];

    if (!chunk || chunk.length === 0) continue;

    console.log(
      `📦 Procesando chunk ${chunkIndex + 1}/${batchChunks.length} con ${
        chunk.length
      } batches paralelos`
    );

    try {
      // Procesar batches del chunk en paralelo
      const chunkResults = await Promise.allSettled(
        chunk.map(async (batch, batchIndexInChunk) => {
          const globalBatchIndex =
            chunkIndex * concurrencyLimit + batchIndexInChunk;
          return await processSingleBatch(
            batch,
            wooInstance,
            sucursalId,
            globalBatchIndex + 1,
            batches.length
          );
        })
      );

      // Procesar resultados del chunk
      chunkResults.forEach((result, batchIndexInChunk) => {
        const globalBatchIndex =
          chunkIndex * concurrencyLimit + batchIndexInChunk;

        if (result.status === "fulfilled") {
          const { uploadedCount, failedCount, errors } = result.value;
          totalUploaded += uploadedCount;
          totalFailed += failedCount;
          allErrors.push(...errors);

          console.log(
            `✅ Batch ${
              globalBatchIndex + 1
            }: ${uploadedCount} exitosos, ${failedCount} fallidos`
          );
        } else {
          console.error(
            `❌ Error en batch ${globalBatchIndex + 1}:`,
            result.reason
          );
          const batch = chunk[batchIndexInChunk];
          if (batch) {
            totalFailed += batch.length;
          }
          allErrors.push(
            `Error en batch ${globalBatchIndex + 1}: ${result.reason}`
          );
        }
      });

      // Delay adaptativo entre chunks (no entre batches individuales)
      if (chunkIndex < batchChunks.length - 1) {
        const avgResponseTime =
          performanceMetrics.get(sucursalId)?.avgResponseTime || 1000;
        const chunkDelay = Math.min(
          Math.max(
            avgResponseTime * CONFIG.ADAPTIVE_DELAYS.CHUNK_DELAY_MULTIPLIER,
            CONFIG.ADAPTIVE_DELAYS.CHUNK_MIN_DELAY
          ),
          CONFIG.ADAPTIVE_DELAYS.CHUNK_MAX_DELAY
        );
        console.log(`⏳ Delay entre chunks: ${chunkDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, chunkDelay));
      }
    } catch (error) {
      console.error(`❌ Error procesando chunk ${chunkIndex + 1}:`, error);
      // Contar todos los productos del chunk como fallidos
      const chunkSize = chunk.reduce((total, batch) => total + batch.length, 0);
      totalFailed += chunkSize;
      allErrors.push(
        `Error en chunk ${chunkIndex + 1}: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`
      );
    }
  }

  return {
    uploadedCount: totalUploaded,
    failedCount: totalFailed,
    errors: allErrors,
  };
}

// Función para procesar un solo batch
async function processSingleBatch(
  batch: WooCommerceProductFromSucursal[],
  wooInstance: WooCommerceRestApi,
  sucursalId: number,
  batchNumber: number,
  totalBatches: number
): Promise<{
  uploadedCount: number;
  failedCount: number;
  errors: string[];
}> {
  let uploadedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  const batchStartTime = Date.now();

  // REINTENTOS para manejar errores de conexión
  let retryCount = 0;
  const maxRetries = CONFIG.RETRY.MAX_RETRIES;
  let batchSuccess = false;

  while (retryCount < maxRetries && !batchSuccess) {
    try {
      // Crear productos usando la API batch
      const response = await wooInstance.post("products/batch", {
        create: batch,
      });

      const responseTime = Date.now() - batchStartTime;
      console.log(
        `✅ Batch ${batchNumber}/${totalBatches}: Response en ${responseTime}ms, status: ${response.status}`
      );

      // Actualizar métricas para delays adaptativos
      calculateAdaptiveDelay(sucursalId, responseTime);
      batchSuccess = true;

      if (response.data) {
        const batchResult = response.data;

        // Procesar productos creados
        if (batchResult.create && batchResult.create.length > 0) {
          batchResult.create.forEach((product: any, index: number) => {
            if (
              product.id !== null &&
              product.id !== undefined &&
              product.id > 0
            ) {
              uploadedCount++;
            } else {
              failedCount++;
              const originalProduct = batch[index];
              if (originalProduct) {
                errors.push(`SKU ${originalProduct.sku}: Error en creación`);
              }
            }
          });
        }

        // Procesar errores
        if (batchResult.error && batchResult.error.length > 0) {
          batchResult.error.forEach((error: any, index: number) => {
            const originalProduct =
              batch[index + (batchResult.create?.length || 0)];
            if (originalProduct) {
              failedCount++;
              errors.push(
                `SKU ${originalProduct.sku}: ${
                  error.message || error.code || "Error desconocido"
                }`
              );
            }
          });
        }
      }

      return { uploadedCount, failedCount, errors };
    } catch (error) {
      retryCount++;
      const errorMessage =
        error instanceof Error ? error.message : "Error desconocido";

      if (
        CONFIG.ERROR_PATTERNS.CONNECTION_ERRORS.some((pattern) =>
          errorMessage.includes(pattern)
        )
      ) {
        console.warn(
          `⚠️ Error de conexión en batch ${batchNumber}, intento ${retryCount}/${maxRetries}: ${errorMessage}`
        );

        if (retryCount < maxRetries) {
          const waitTime = retryCount * CONFIG.TIMEOUTS.RETRY_BASE_DELAY;
          console.log(
            `⏳ Esperando ${waitTime}ms antes de reintentar batch ${batchNumber}...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          console.error(
            `❌ Error persistente en batch ${batchNumber} después de ${maxRetries} intentos`
          );
          failedCount += batch.length;
          errors.push(`Error en batch ${batchNumber}: ${errorMessage}`);
        }
      } else {
        console.error(
          `❌ Error no recuperable en batch ${batchNumber}:`,
          error
        );
        failedCount += batch.length;
        errors.push(`Error en batch ${batchNumber}: ${errorMessage}`);
        break;
      }
    }
  }

  return { uploadedCount, failedCount, errors };
}

async function uploadProductsFromMultipleSucursales(
  sucursalFilePaths: string[]
): Promise<{
  success: boolean;
  totalUploaded: number;
  totalFailed: number;
  sucursalResults: Array<{
    sucursal_id: number;
    nombre: string;
    uploaded: number;
    failed: number;
    success: boolean;
    errors: string[];
  }>;
  duration: number;
}> {
  const startTime = Date.now();
  let totalUploaded = 0;
  let totalFailed = 0;
  const sucursalResults: Array<{
    sucursal_id: number;
    nombre: string;
    uploaded: number;
    failed: number;
    success: boolean;
    errors: string[];
  }> = [];

  // OPTIMIZACIÓN: Procesamiento paralelo con límite de concurrencia
  const concurrencyLimit = CONFIG.CONCURRENCY.SUCURSALES_PARALELAS; // Máximo 3 sucursales en paralelo
  const chunks = [];

  for (let i = 0; i < sucursalFilePaths.length; i += concurrencyLimit) {
    chunks.push(sucursalFilePaths.slice(i, i + concurrencyLimit));
  }

  console.log(
    `🚀 Procesando ${sucursalFilePaths.length} sucursales en chunks de ${concurrencyLimit}`
  );

  for (const chunk of chunks) {
    try {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (filePath) => {
          try {
            const result = await uploadProductsFromSucursalJson(filePath);
            return {
              filePath,
              result,
              success: true,
            };
          } catch (error) {
            return {
              filePath,
              error,
              success: false,
            };
          }
        })
      );

      // Procesar resultados del chunk
      chunkResults.forEach((chunkResult) => {
        if (chunkResult.status === "fulfilled") {
          const { filePath, result, success, error } = chunkResult.value;

          if (success && result) {
            totalUploaded += result.uploadedCount;
            totalFailed += result.failedCount;

            sucursalResults.push({
              sucursal_id: result.sucursal_info?.id || 0,
              nombre: result.sucursal_info?.nombre || "Desconocida",
              uploaded: result.uploadedCount,
              failed: result.failedCount,
              success: result.success,
              errors: result.errors,
            });
          } else {
            const errorMsg =
              error instanceof Error ? error.message : "Error desconocido";
            sucursalResults.push({
              sucursal_id: 0,
              nombre: path.basename(filePath),
              uploaded: 0,
              failed: 1,
              success: false,
              errors: [errorMsg],
            });
            totalFailed++;
          }
        } else {
          // Error en Promise.allSettled
          sucursalResults.push({
            sucursal_id: 0,
            nombre: "Desconocida",
            uploaded: 0,
            failed: 1,
            success: false,
            errors: ["Error en procesamiento paralelo"],
          });
          totalFailed++;
        }
      });

      // Delay entre chunks para no saturar el servidor
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        console.log(`⏳ Delay entre chunks de sucursales...`);
        await new Promise((resolve) =>
          setTimeout(resolve, CONFIG.TIMEOUTS.CHUNKS_DELAY_SUCURSALES)
        );
      }
    } catch (error) {
      console.error(`❌ Error procesando chunk de sucursales:`, error);
      totalFailed += chunk.length;
    }
  }

  const duration = Date.now() - startTime;

  return {
    success: totalFailed === 0,
    totalUploaded,
    totalFailed,
    sucursalResults,
    duration,
  };
}

async function uploadProductsFromSucursalJson(jsonFilePath: string): Promise<{
  success: boolean;
  uploadedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
  sucursal_info?: { id: number; nombre: string };
}> {
  const startTime = Date.now();
  let uploadedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  try {
    if (!fs.existsSync(jsonFilePath))
      throw new Error(`Archivo JSON no encontrado: ${jsonFilePath}`);

    const fileContent = fs.readFileSync(jsonFilePath, "utf-8");
    const sucursalData: SucursalData = JSON.parse(fileContent);

    const { sucursal_id, nombre_sucursal, productos } = sucursalData;

    const wooInstance = getWooCommerceInstance(sucursal_id);
    if (!wooInstance) {
      throw new Error(
        `No se pudo inicializar WooCommerce para sucursal ${sucursal_id}`
      );
    }

    console.log(
      `🚀 Procesando ${productos.length} productos para sucursal ${nombre_sucursal}`
    );

    // OPTIMIZACIÓN: Obtener SKUs existentes al inicio
    const existingSkus = await getAllExistingSkus(wooInstance);

    // Convertir productos usando la función legacy
    const productsBatch = convertToWooCommerceFormat(productos, {
      id: sucursal_id,
      nombre: nombre_sucursal,
    });

    console.log(`📦 Productos convertidos: ${productsBatch.length}`);

    // OPTIMIZACIÓN: Separar productos nuevos y existentes desde el inicio
    const newProducts = productsBatch.filter(
      (product) => !existingSkus.has(product.sku)
    );
    const duplicateProducts = productsBatch.filter((product) =>
      existingSkus.has(product.sku)
    );

    console.log(
      `📊 Distribución: ${newProducts.length} nuevos, ${duplicateProducts.length} para actualizar`
    );

    // OPTIMIZACIÓN: Verificar imágenes en lotes para productos nuevos
    if (newProducts.length > 0) {
      console.log(
        `🖼️ Verificando ${newProducts.length} imágenes en paralelo...`
      );
      const imageUrls = newProducts
        .map((p) => p.images[0]?.src)
        .filter((url): url is string => Boolean(url));
      const imageResults = await verifyImagesInBatch(
        imageUrls,
        CONFIG.CONCURRENCY.IMAGENES_PARALELAS
      );

      // Actualizar productos con imagen de fallback si es necesario
      newProducts.forEach((product) => {
        const imageUrl = product.images[0]?.src;
        if (imageUrl && !imageResults.get(imageUrl)) {
          product.images = [{ src: CONFIG.URLS.FALLBACK_IMAGE }];
        }
      });
      console.log(`✅ Verificación de imágenes completada`);
    }

    const batchSize = CONFIG.BATCH_SIZES.CREACION; // Tamaño de batch
    const batchConcurrency = CONFIG.CONCURRENCY.BATCHES_PARALELOS_POR_SUCURSAL; // Máximo 2 batches en paralelo por sucursal

    // FASE 1: Crear productos nuevos con batches paralelos
    if (newProducts.length > 0) {
      // Dividir productos en batches
      const batches = [];
      for (let i = 0; i < newProducts.length; i += batchSize) {
        batches.push(newProducts.slice(i, i + batchSize));
      }

      console.log(
        `📦 Iniciando creación de ${newProducts.length} productos nuevos en ${batches.length} batches (${batchConcurrency} en paralelo)...`
      );

      const createResult = await processBatchesInParallel(
        batches,
        wooInstance,
        sucursal_id,
        batchConcurrency
      );

      uploadedCount += createResult.uploadedCount;
      failedCount += createResult.failedCount;
      errors.push(...createResult.errors);

      console.log(
        `✅ Fase 1 completada: ${createResult.uploadedCount} creados, ${createResult.failedCount} fallidos`
      );
    }

    // FASE 2: Actualizar productos duplicados (mantener secuencial por simplicidad)
    if (duplicateProducts.length > 0) {
      console.log(
        `🔄 Iniciando actualización de ${duplicateProducts.length} productos existentes...`
      );

      // Pre-verificar imágenes para productos duplicados
      console.log(`🖼️ Verificando imágenes para productos duplicados...`);
      const duplicateImageUrls = duplicateProducts
        .map((p) => p.images[0]?.src)
        .filter((url): url is string => Boolean(url));
      const duplicateImageResults = await verifyImagesInBatch(
        duplicateImageUrls,
        CONFIG.CONCURRENCY.IMAGENES_PARALELAS
      );

      // Actualizar productos con imagen de fallback si es necesario
      duplicateProducts.forEach((product) => {
        const imageUrl = product.images[0]?.src;
        if (imageUrl && !duplicateImageResults.get(imageUrl)) {
          product.images = [{ src: CONFIG.URLS.FALLBACK_IMAGE }];
        }
      });

      const updateBatchSize = CONFIG.BATCH_SIZES.ACTUALIZACION; // Menor tamaño para actualizaciones
      const updateBatches = Math.ceil(
        duplicateProducts.length / updateBatchSize
      );

      for (
        let updateBatchIndex = 0;
        updateBatchIndex < updateBatches;
        updateBatchIndex++
      ) {
        const start = updateBatchIndex * updateBatchSize;
        const end = start + updateBatchSize;
        const updateBatch = duplicateProducts.slice(start, end);

        console.log(
          `🔄 Procesando batch de actualización ${
            updateBatchIndex + 1
          }/${updateBatches} (${updateBatch.length} productos)`
        );

        try {
          // Buscar IDs en paralelo con límite
          const searchPromises = updateBatch.map(async (product) => {
            try {
              const searchResponse = await wooInstance.get("products", {
                sku: product.sku,
                per_page: 1,
              });

              if (searchResponse.data && searchResponse.data.length > 0) {
                const existingProduct = searchResponse.data[0];
                return {
                  id: existingProduct.id,
                  ...product,
                };
              }
              return null;
            } catch (searchError) {
              console.error(
                `❌ Error buscando producto ${product.sku}:`,
                searchError
              );
              return null;
            }
          });

          // Ejecutar búsquedas en chunks para no saturar
          const searchChunks = [];
          for (
            let i = 0;
            i < searchPromises.length;
            i += CONFIG.CONCURRENCY.BUSQUEDAS_PARALELAS_UPDATES
          ) {
            searchChunks.push(
              searchPromises.slice(
                i,
                i + CONFIG.CONCURRENCY.BUSQUEDAS_PARALELAS_UPDATES
              )
            );
          }

          const allResults = [];
          for (const chunk of searchChunks) {
            const chunkResults = await Promise.all(chunk);
            allResults.push(...chunkResults);
            await new Promise((resolve) =>
              setTimeout(resolve, CONFIG.TIMEOUTS.UPDATE_SEARCH_CHUNK_DELAY)
            ); // Pequeño delay entre chunks de búsqueda
          }

          // Filtrar productos válidos para actualización
          const validUpdates = allResults.filter((p) => p !== null);

          if (validUpdates.length > 0) {
            // Preparar productos para actualización (remover SKU)
            const updateData = validUpdates.map((product) => {
              const { sku, ...productWithoutSku } = product!;
              return productWithoutSku;
            });

            // Actualizar usando batch API
            const updateResponse = await wooInstance.post("products/batch", {
              update: updateData,
            });

            if (updateResponse.data && updateResponse.data.update) {
              const updated = updateResponse.data.update.length;
              uploadedCount += updated;
              console.log(
                `✅ ${updated} productos actualizados exitosamente en batch ${
                  updateBatchIndex + 1
                }`
              );
            }

            if (updateResponse.data && updateResponse.data.error) {
              const updateErrors = updateResponse.data.error.length;
              failedCount += updateErrors;
              console.log(
                `❌ ${updateErrors} productos fallaron en actualización`
              );

              updateResponse.data.error.forEach((error: any, index: number) => {
                const originalProduct = validUpdates[index];
                if (originalProduct) {
                  errors.push(
                    `Update SKU ${originalProduct.sku}: ${
                      error.message || "Error en actualización"
                    }`
                  );
                }
              });
            }
          }
        } catch (updateError) {
          console.error(
            `❌ Error en batch de actualización ${updateBatchIndex + 1}:`,
            updateError
          );
          failedCount += updateBatch.length;
          errors.push(
            `Error en actualización batch ${updateBatchIndex + 1}: ${
              updateError instanceof Error
                ? updateError.message
                : "Error desconocido"
            }`
          );
        }

        // Delay adaptativo entre batches de actualización
        const delay =
          calculateAdaptiveDelay(sucursal_id, 1000) /
          CONFIG.ADAPTIVE_DELAYS.UPDATE_DELAY_DIVISOR; // Delay menor para actualizaciones
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      console.log(`📊 Fase 2 completada: duplicados procesados y actualizados`);
    }

    const duration = Date.now() - startTime;

    console.log(
      `✅ Proceso completado para ${nombre_sucursal}: ${uploadedCount} exitosos, ${failedCount} fallidos en ${duration}ms`
    );

    return {
      success: failedCount === 0,
      uploadedCount,
      failedCount,
      errors,
      duration,
      sucursal_info: { id: sucursal_id, nombre: nombre_sucursal },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido";

    console.error(`❌ Error general en sucursal: ${errorMessage}`);

    return {
      success: false,
      uploadedCount,
      failedCount: failedCount + 1,
      errors: [...errors, errorMessage],
      duration,
    };
  }
}

function convertToWooCommerceFormat(
  productos: SucursalProduct[],
  sucursalInfo: { id: number; nombre: string }
): WooCommerceProductFromSucursal[] {
  return productos.map((producto) => {
    const cleanDescription = producto.description.trim();
    const cleanShortDescription = producto.short_description.trim();
    const productName = cleanDescription || cleanShortDescription || "";
    const imageUrl = `${CONFIG.URLS.IMAGE_BASE_URL}${producto.sku}.png`;
    const categoriaDefault = CATEGORIAS_POR_ID[producto.meta_data];
    const categoriaWoocommerce = Object.values(
      CATEGORIAS_POR_ID_AUTOPISTA
    ).find(
      (cat) =>
        cat.name.toLowerCase() === categoriaDefault?.name.trim().toLowerCase()
    );
    const categories: Array<{ id: number }> = categoriaWoocommerce
      ? [{ id: categoriaWoocommerce.id }]
      : [];

    return {
      sku: `${producto.sku}`,
      name: productName,
      regular_price: `${producto.regular_price}`,
      description: cleanDescription,
      short_description: cleanShortDescription,
      categories,
      type: CONFIG.WOOCOMMERCE.PRODUCT_TYPE,
      status: CONFIG.WOOCOMMERCE.PRODUCT_STATUS,
      stock_status: CONFIG.WOOCOMMERCE.STOCK_STATUS,
      images: [
        {
          src: imageUrl,
        },
      ],
      meta_data: [
        { key: "_sucursal_id", value: `${sucursalInfo.id}` },
        { key: "_sucursal_nombre", value: `${sucursalInfo.nombre}` },
        { key: "_meta_data_original", value: `${producto.meta_data}` },
        { key: "_meta_data_2_original", value: `${producto.meta_data_2}` },
        { key: "_unidad_medida", value: `${producto.meta_data_2.trim()}` },
        { key: "_image_url", value: imageUrl },
      ],
    };
  });
}

async function deleteAllProductsFromSucursal(
  sucursalId: number
): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  const wooInstance = getWooCommerceInstance(sucursalId);
  if (!wooInstance) {
    throw new Error(
      `No se pudo inicializar WooCommerce para sucursal ${sucursalId}`
    );
  }

  let totalDeleted = 0;
  const errors: string[] = [];
  const perPage = CONFIG.BATCH_SIZES.ELIMINACION;

  console.log(`🗑️ Iniciando borrado de productos para sucursal ${sucursalId}`);

  while (true) {
    try {
      // SIEMPRE arrancamos en page=1 porque la lista cambia al borrar
      const response = await wooInstance.get("products", {
        per_page: perPage,
        page: CONFIG.WOOCOMMERCE.DELETE_PAGE,
      });

      const products = response.data;
      if (!products || products.length === 0) break;

      const ids = products.map((p: any) => p.id);

      const deleteRes = await wooInstance.post("products/batch", {
        delete: ids,
      });

      if (deleteRes.data && deleteRes.data.delete) {
        totalDeleted += deleteRes.data.delete.length;
        console.log(`✅ ${deleteRes.data.delete.length} productos borrados`);
      }

      if (deleteRes.data && deleteRes.data.error) {
        deleteRes.data.error.forEach((err: any, index: number) => {
          const id = ids[index];
          errors.push(`ID ${id}: ${err.message || "Error al borrar"}`);
        });
      }

      // Pequeño delay para no saturar
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.TIMEOUTS.DELETE_BATCH_DELAY)
      );
    } catch (err) {
      console.error(`❌ Error en borrado:`, err);
      errors.push(
        err instanceof Error ? err.message : "Error desconocido en borrado"
      );
      break;
    }
  }

  console.log(
    `🧹 Borrado completado en sucursal ${sucursalId}: ${totalDeleted} eliminados`
  );

  return {
    success: errors.length === 0,
    deleted: totalDeleted,
    errors,
  };
}
