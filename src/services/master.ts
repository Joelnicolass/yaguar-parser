import path from "path";
import fs from "fs";
import { SftpService } from "./sftp/sftp_service";
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";
import axiosRetry from "axios-retry";
import { getCredencialesSucursal } from "../config/sucursales_credenciales";
import {
  CATEGORIAS_POR_ID,
  CATEGORIAS_POR_ID_AUTOPISTA,
} from "../config/categorias_referencia";
import { SucursalData, SucursalProduct } from "../types";

// ✅ CONFIGURACIÓN CENTRALIZADA - Leer desde variables de entorno
const CONFIG = {
  // Configuración de concurrencia y paralelismo
  CONCURRENCY: {
    SUCURSALES_PARALELAS: parseInt(
      process.env.CONFIG_SUCURSALES_PARALELAS || "10"
    ),
    BATCHES_PARALELOS_POR_SUCURSAL: parseInt(
      process.env.CONFIG_BATCHES_PARALELOS_POR_SUCURSAL || "6"
    ),
    IMAGENES_PARALELAS: parseInt(
      process.env.CONFIG_IMAGENES_PARALELAS || "1000"
    ),
    BUSQUEDAS_PARALELAS_UPDATES: parseInt(
      process.env.CONFIG_BUSQUEDAS_PARALELAS_UPDATES || "5"
    ),
  },

  // Configuración de tamaños de batch
  BATCH_SIZES: {
    CREACION: parseInt(process.env.CONFIG_BATCH_SIZE_CREACION || "50"),
    ACTUALIZACION: parseInt(
      process.env.CONFIG_BATCH_SIZE_ACTUALIZACION || "25"
    ),
    ELIMINACION: parseInt(process.env.CONFIG_BATCH_SIZE_ELIMINACION || "100"),
    PAGINACION_SKUS: parseInt(
      process.env.CONFIG_BATCH_SIZE_PAGINACION_SKUS || "100"
    ),
    RETRY_BATCH: parseInt(process.env.CONFIG_BATCH_SIZE_RETRY || "20"),
  },

  // Configuración de timeouts y delays
  TIMEOUTS: {
    WOOCOMMERCE_TIMEOUT: parseInt(
      process.env.CONFIG_WOOCOMMERCE_TIMEOUT || "300000"
    ),
    IMAGE_VERIFICATION_TIMEOUT: parseInt(
      process.env.CONFIG_IMAGE_VERIFICATION_TIMEOUT || "5000"
    ),
    RETRY_BASE_DELAY: parseInt(process.env.CONFIG_RETRY_BASE_DELAY || "2000"),
    CHUNKS_DELAY_SUCURSALES: parseInt(
      process.env.CONFIG_CHUNKS_DELAY_SUCURSALES || "2000"
    ),
    SKU_FETCH_DELAY: parseInt(process.env.CONFIG_SKU_FETCH_DELAY || "100"),
    UPDATE_SEARCH_CHUNK_DELAY: parseInt(
      process.env.CONFIG_UPDATE_SEARCH_CHUNK_DELAY || "100"
    ),
    DELETE_BATCH_DELAY: parseInt(
      process.env.CONFIG_DELETE_BATCH_DELAY || "300"
    ),
    SERVER_OVERLOAD_DELAY: parseInt(
      process.env.CONFIG_SERVER_OVERLOAD_DELAY || "10000"
    ),
    RATE_LIMIT_DELAY: parseInt(process.env.CONFIG_RATE_LIMIT_DELAY || "5000"),
  },

  // Configuración de reintentos y límites
  RETRY: {
    MAX_RETRIES: parseInt(process.env.CONFIG_MAX_RETRIES || "3"),
    MAX_RESPONSE_TIMES_TRACKED: parseInt(
      process.env.CONFIG_MAX_RESPONSE_TIMES_TRACKED || "5"
    ),
    MAX_RETRIES_SERVER_ERROR: parseInt(
      process.env.CONFIG_MAX_RETRIES_SERVER_ERROR || "5"
    ),
    BACKOFF_MULTIPLIER: parseFloat(
      process.env.CONFIG_BACKOFF_MULTIPLIER || "1.5"
    ),
    // Configuración para axios-retry
    AXIOS_RETRY_ATTEMPTS: parseInt(
      process.env.CONFIG_AXIOS_RETRY_ATTEMPTS || "4"
    ),
    AXIOS_RETRY_DELAY: parseInt(process.env.CONFIG_AXIOS_RETRY_DELAY || "2000"),
  },

  // Configuración de delays adaptativos
  ADAPTIVE_DELAYS: {
    MIN_DELAY: parseInt(process.env.CONFIG_MIN_DELAY || "500"),
    MAX_DELAY: parseInt(process.env.CONFIG_MAX_DELAY || "3000"),
    RESPONSE_TIME_MULTIPLIER: parseFloat(
      process.env.CONFIG_RESPONSE_TIME_MULTIPLIER || "0.3"
    ),
    CHUNK_DELAY_MULTIPLIER: parseFloat(
      process.env.CONFIG_CHUNK_DELAY_MULTIPLIER || "0.2"
    ),
    CHUNK_MIN_DELAY: parseInt(process.env.CONFIG_CHUNK_MIN_DELAY || "300"),
    CHUNK_MAX_DELAY: parseInt(process.env.CONFIG_CHUNK_MAX_DELAY || "1500"),
    UPDATE_DELAY_DIVISOR: parseInt(
      process.env.CONFIG_UPDATE_DELAY_DIVISOR || "2"
    ),
    OVERLOAD_MULTIPLIER: parseInt(
      process.env.CONFIG_OVERLOAD_MULTIPLIER || "2"
    ),
  },

  // URLs y rutas
  URLS: {
    FALLBACK_IMAGE:
      process.env.CONFIG_FALLBACK_IMAGE || "https://vd.com.ar/images/0000.png",
    IMAGE_BASE_URL:
      process.env.CONFIG_IMAGE_BASE_URL || "https://vd.com.ar/images/",
  },

  // Configuración de archivos y extensiones
  FILES: {
    JSON_EXTENSION: process.env.CONFIG_JSON_EXTENSION || ".json",
  },

  // Configuración de optimizaciones
  OPTIMIZATION: {
    SKIP_SAME_PRICE_UPDATES:
      process.env.CONFIG_SKIP_SAME_PRICE_UPDATES === "true" || true,
    PRICE_COMPARISON_FIELDS:
      process.env.CONFIG_PRICE_COMPARISON_FIELDS || "id,sku,regular_price,name",
  },

  // Configuración de campos WooCommerce
  WOOCOMMERCE: {
    VERSION: process.env.CONFIG_WOOCOMMERCE_VERSION || "wc/v3",
    PRODUCT_TYPE: process.env.CONFIG_PRODUCT_TYPE || "simple",
    PRODUCT_STATUS: process.env.CONFIG_PRODUCT_STATUS || "publish",
    STOCK_STATUS: process.env.CONFIG_STOCK_STATUS || "instock",
    SKU_FIELD_ONLY: process.env.CONFIG_SKU_FIELD_ONLY || "sku",
    HTTP_METHOD_HEAD: process.env.CONFIG_HTTP_METHOD_HEAD || "HEAD",
    DELETE_PAGE: parseInt(process.env.CONFIG_DELETE_PAGE || "1"),
  },

  // Mensajes de error comunes
  ERROR_PATTERNS: {
    CONNECTION_ERRORS: (
      process.env.CONFIG_CONNECTION_ERRORS ||
      "socket hang up,ECONNRESET,timeout"
    ).split(","),
    SERVER_OVERLOAD_ERRORS: (
      process.env.CONFIG_SERVER_OVERLOAD_ERRORS || "503,502,504,500"
    ).split(","),
    RATE_LIMIT_ERRORS: (process.env.CONFIG_RATE_LIMIT_ERRORS || "429").split(
      ","
    ),
  },
};

console.log("⚙️ Configuración cargada:", JSON.stringify(CONFIG, null, 2));

// Cache global para verificación de imágenes
const imageCache = new Map<string, boolean>();

// Métricas para delays adaptativos
interface PerformanceMetrics {
  avgResponseTime: number;
  lastResponseTimes: number[];
  maxResponseTimes: number;
}

const performanceMetrics = new Map<number, PerformanceMetrics>();

// 🔄 SISTEMA DE TRACKING DE BATCHES FALLIDOS
interface FailedBatchInfo {
  products: WooCommerceProductFromSucursal[];
  reason: string;
  retryCount: number;
  sucursalId: number;
  batchType: "create" | "update";
}

// 🔄 SISTEMA DE TRACKING DE PRODUCTOS INDIVIDUALES FALLIDOS
interface FailedProductInfo {
  product: WooCommerceProductFromSucursal;
  reason: string;
  retryCount: number;
  sucursalId: number;
  sucursalName: string;
  originalBatchNumber: number;
  failureType: "validation" | "duplicate" | "category" | "data" | "unknown";
}

const failedBatches = new Map<string, FailedBatchInfo[]>();
const failedProducts = new Map<string, FailedProductInfo[]>();

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
      // Configurar axios-retry directamente en axiosConfig
      "axios-retry": {
        retries: CONFIG.RETRY.AXIOS_RETRY_ATTEMPTS,
        retryDelay: (retryCount: number) => {
          console.log(
            `🔄 Axios-retry: intento ${retryCount} en ${
              CONFIG.RETRY.AXIOS_RETRY_DELAY * retryCount
            }ms`
          );
          return CONFIG.RETRY.AXIOS_RETRY_DELAY * retryCount;
        },
        retryCondition: (error: any) => {
          // Reintentar en errores de red o códigos 5xx específicos
          const shouldRetry =
            error.code === "ECONNRESET" ||
            error.code === "ETIMEDOUT" ||
            error.code === "ENOTFOUND" ||
            (error.response?.status &&
              CONFIG.ERROR_PATTERNS.SERVER_OVERLOAD_ERRORS.includes(
                error.response.status.toString()
              ));

          if (shouldRetry) {
            console.log(
              `🔄 Axios-retry detectó error recuperable: ${
                error.response?.status || error.message
              }`
            );
          }

          return shouldRetry;
        },
        onRetry: (retryCount: number, error: any) => {
          console.log(
            `🔄 Axios-retry: Reintentando request ${retryCount}/${
              CONFIG.RETRY.AXIOS_RETRY_ATTEMPTS
            } - ${error.response?.status || error.message}`
          );
        },
      },
    },
  });

  console.log(
    `✅ Instancia WooCommerce inicializada para sucursal ${sucursalId} con configuración de axios-retry`
  );

  woocommerceInstances.set(sucursalId, wooInstance);
  return wooInstance;
}

export function getWooCommerceInstance(
  sucursalId: number
): WooCommerceRestApi | null {
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

// Nueva función optimizada para obtener productos existentes con precios para comparación
async function getAllExistingProductsWithPrices(
  wooInstance: WooCommerceRestApi
): Promise<
  Map<
    string,
    {
      id: number;
      regular_price: string;
      name: string;
      categories: Array<{ id: number }>;
    }
  >
> {
  const existingProducts = new Map<
    string,
    {
      id: number;
      regular_price: string;
      name: string;
      categories: Array<{ id: number }>;
    }
  >();
  let page = 1;
  const perPage = CONFIG.BATCH_SIZES.PAGINACION_SKUS;

  console.log(
    `🔍 Obteniendo productos existentes con precios y categorías para comparación...`
  );

  try {
    while (true) {
      const response = await wooInstance.get("products", {
        per_page: perPage,
        page,
        _fields: `${CONFIG.OPTIMIZATION.PRICE_COMPARISON_FIELDS},categories`, // ✅ Incluir categorías
      });

      const products = response.data;
      if (!products || products.length === 0) break;

      products.forEach((product: any) => {
        if (product.sku) {
          existingProducts.set(product.sku, {
            id: product.id,
            regular_price: product.regular_price || "0",
            name: product.name || "",
            categories: product.categories || [], // ✅ Preservar categorías existentes
          });
        }
      });

      console.log(
        `📄 Página ${page}: ${products.length} productos, ${existingProducts.size} productos con precios y categorías acumulados`
      );
      page++;

      // Delay pequeño para no saturar
      await new Promise((resolve) =>
        setTimeout(resolve, CONFIG.TIMEOUTS.SKU_FETCH_DELAY)
      );
    }
  } catch (error) {
    console.warn(
      `⚠️ Error obteniendo productos existentes con precios y categorías:`,
      error
    );
  }

  console.log(
    `✅ Total productos con precios y categorías encontrados: ${existingProducts.size}`
  );
  return existingProducts;
}

// Función para comparar si el precio ha cambiado
function shouldUpdateProduct(
  newProduct: WooCommerceProductFromSucursal,
  existingProduct: { id: number; regular_price: string; name: string }
): boolean {
  // Si la optimización de comparación de precios está deshabilitada, siempre actualizar
  if (!CONFIG.OPTIMIZATION.SKIP_SAME_PRICE_UPDATES) {
    return true;
  }

  // Normalizar precios para comparación (remover espacios, convertir a número)
  const newPrice = parseFloat(newProduct.regular_price.toString().trim()) || 0;
  const existingPrice =
    parseFloat(existingProduct.regular_price.toString().trim()) || 0;

  // Comparar precios con tolerancia mínima para errores de punto flotante
  const priceChanged = Math.abs(newPrice - existingPrice) > 0.01;

  if (!priceChanged) {
    console.log(
      `⏭️ SKU ${newProduct.sku}: Precio sin cambios ($${existingPrice}) - omitiendo actualización`
    );
    return false;
  }

  console.log(
    `💰 SKU ${newProduct.sku}: Precio cambió de $${existingPrice} a $${newPrice} - requiere actualización`
  );
  return true;
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

  // REINTENTOS para manejar errores de conexión y sobrecarga del servidor
  let retryCount = 0;
  const maxRetries = CONFIG.RETRY.MAX_RETRIES_SERVER_ERROR;
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
    } catch (error: any) {
      retryCount++;
      const errorMessage = error?.message || "Error desconocido";
      const errorStatus = error?.response?.status?.toString() || "";

      // 🔄 CLASIFICAR TIPO DE ERROR PARA APLICAR ESTRATEGIA APROPIADA
      let waitTime = CONFIG.TIMEOUTS.RETRY_BASE_DELAY;
      let shouldRetry = true;
      let errorType = "desconocido";

      if (
        CONFIG.ERROR_PATTERNS.CONNECTION_ERRORS.some((pattern) =>
          errorMessage.includes(pattern)
        )
      ) {
        errorType = "conexión";
        waitTime = retryCount * CONFIG.TIMEOUTS.RETRY_BASE_DELAY;
      } else if (
        CONFIG.ERROR_PATTERNS.SERVER_OVERLOAD_ERRORS.some(
          (pattern) => errorMessage.includes(pattern) || errorStatus === pattern
        )
      ) {
        errorType = "sobrecarga del servidor (503/502/504)";
        waitTime = Math.min(
          retryCount *
            CONFIG.TIMEOUTS.SERVER_OVERLOAD_DELAY *
            CONFIG.RETRY.BACKOFF_MULTIPLIER,
          30000 // Máximo 30 segundos
        );

        // 🚨 Para errores 503, aumentar dramáticamente el delay adaptativo
        if (errorStatus === "503") {
          const currentMetrics = performanceMetrics.get(sucursalId);
          if (currentMetrics) {
            currentMetrics.avgResponseTime *=
              CONFIG.ADAPTIVE_DELAYS.OVERLOAD_MULTIPLIER;
            console.log(
              `⚠️ Error 503 detectado: aumentando delays adaptativos x${CONFIG.ADAPTIVE_DELAYS.OVERLOAD_MULTIPLIER}`
            );
          }
        }
      } else if (
        CONFIG.ERROR_PATTERNS.RATE_LIMIT_ERRORS.some(
          (pattern) => errorMessage.includes(pattern) || errorStatus === pattern
        )
      ) {
        errorType = "límite de tasa (429)";
        waitTime = Math.min(
          retryCount *
            CONFIG.TIMEOUTS.RATE_LIMIT_DELAY *
            CONFIG.RETRY.BACKOFF_MULTIPLIER,
          15000 // Máximo 15 segundos
        );
      } else {
        errorType = "no recuperable";
        shouldRetry = false;
      }

      console.warn(
        `⚠️ Error de ${errorType} en batch ${batchNumber}, intento ${retryCount}/${maxRetries}: ${errorMessage} (Status: ${errorStatus})`
      );

      if (shouldRetry && retryCount < maxRetries) {
        console.log(
          `⏳ Esperando ${Math.round(
            waitTime
          )}ms antes de reintentar batch ${batchNumber}...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        if (shouldRetry) {
          console.error(
            `❌ Error persistente de ${errorType} en batch ${batchNumber} después de ${maxRetries} intentos`
          );
        } else {
          console.error(`❌ Error ${errorType} en batch ${batchNumber}`);
        }
        failedCount += batch.length;
        errors.push(
          `Error en batch ${batchNumber}: ${errorMessage} (${errorType})`
        );
        break;
      }
    }
  }

  // 📝 AGREGAR BATCH FALLIDO AL TRACKING SI NO TUVO ÉXITO
  if (!batchSuccess) {
    const sucursalKey = `sucursal_${sucursalId}`;
    addFailedBatch(sucursalKey, batch, errors.join(", "), sucursalId, "create");
  }

  return { uploadedCount, failedCount, errors };
}

// Nueva función para procesar batches de actualización en paralelo
async function processUpdateBatchesInParallel(
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
    `🚀 Procesando ${batches.length} batches de actualización en chunks de ${concurrencyLimit} en paralelo`
  );

  for (let chunkIndex = 0; chunkIndex < batchChunks.length; chunkIndex++) {
    const chunk = batchChunks[chunkIndex];

    if (!chunk || chunk.length === 0) continue;

    console.log(
      `📦 Procesando chunk de actualización ${chunkIndex + 1}/${
        batchChunks.length
      } con ${chunk.length} batches paralelos`
    );

    try {
      // Procesar batches del chunk en paralelo
      const chunkResults = await Promise.allSettled(
        chunk.map(async (batch, batchIndexInChunk) => {
          const globalBatchIndex =
            chunkIndex * concurrencyLimit + batchIndexInChunk;
          return await processSingleUpdateBatch(
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
            `✅ Batch actualización ${
              globalBatchIndex + 1
            }: ${uploadedCount} exitosos, ${failedCount} fallidos`
          );
        } else {
          console.error(
            `❌ Error en batch actualización ${globalBatchIndex + 1}:`,
            result.reason
          );
          const batch = chunk[batchIndexInChunk];
          if (batch) {
            totalFailed += batch.length;
          }
          allErrors.push(
            `Error en batch actualización ${globalBatchIndex + 1}: ${
              result.reason
            }`
          );
        }
      });

      // Delay adaptativo entre chunks
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
        console.log(`⏳ Delay entre chunks de actualización: ${chunkDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, chunkDelay));
      }
    } catch (error) {
      console.error(
        `❌ Error procesando chunk de actualización ${chunkIndex + 1}:`,
        error
      );
      // Contar todos los productos del chunk como fallidos
      const chunkSize = chunk.reduce((total, batch) => total + batch.length, 0);
      totalFailed += chunkSize;
      allErrors.push(
        `Error en chunk actualización ${chunkIndex + 1}: ${
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

// Función para procesar un solo batch de actualización
async function processSingleUpdateBatch(
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

  console.log(
    `🔄 Procesando batch actualización ${batchNumber}/${totalBatches} (${batch.length} productos)`
  );

  // REINTENTOS para manejar errores de conexión y sobrecarga del servidor
  let retryCount = 0;
  const maxRetries = CONFIG.RETRY.MAX_RETRIES_SERVER_ERROR;
  let batchSuccess = false;

  while (retryCount < maxRetries && !batchSuccess) {
    try {
      // Buscar productos existentes incluyendo sus categorías
      const searchPromises = batch.map(async (product) => {
        try {
          const searchResponse = await wooInstance.get("products", {
            sku: product.sku,
            per_page: 1,
            _fields: "id,categories", // ✅ Obtener ID y categorías existentes
          });

          if (searchResponse.data && searchResponse.data.length > 0) {
            const existingProduct = searchResponse.data[0];
            // ✅ PRESERVAR categorías existentes durante actualización
            const updatedProduct = {
              id: existingProduct.id,
              ...product,
              categories: existingProduct.categories || [], // ✅ Mantener categorías existentes
            };
            // Remover SKU del producto para actualización
            const { sku, ...productForUpdate } = updatedProduct;
            return productForUpdate;
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
        );
      }

      // Filtrar productos válidos para actualización
      const validUpdates = allResults.filter((p) => p !== null);

      if (validUpdates.length > 0) {
        // Actualizar usando batch API
        const updateResponse = await wooInstance.post("products/batch", {
          update: validUpdates,
        });

        const responseTime = Date.now() - batchStartTime;
        console.log(
          `✅ Batch actualización ${batchNumber}/${totalBatches}: Response en ${responseTime}ms, status: ${updateResponse.status}`
        );

        // Actualizar métricas para delays adaptativos
        calculateAdaptiveDelay(sucursalId, responseTime);
        batchSuccess = true;

        if (updateResponse.data) {
          const batchResult = updateResponse.data;

          // Procesar productos actualizados
          if (batchResult.update && batchResult.update.length > 0) {
            batchResult.update.forEach((product: any, index: number) => {
              if (
                product.id !== null &&
                product.id !== undefined &&
                product.id > 0
              ) {
                uploadedCount++;
                console.log(
                  `✅ Producto actualizado preservando categorías: SKU ${
                    batch[index]?.sku || "unknown"
                  }`
                );
              } else {
                failedCount++;
                const originalProduct = batch[index];
                if (originalProduct) {
                  errors.push(
                    `SKU ${originalProduct.sku}: Error en actualización`
                  );
                }
              }
            });
          }

          // Procesar errores
          if (batchResult.error && batchResult.error.length > 0) {
            batchResult.error.forEach((error: any, index: number) => {
              const originalProduct =
                batch[index + (batchResult.update?.length || 0)];
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

        // Contar productos que no se encontraron para actualizar
        const notFoundCount = batch.length - validUpdates.length;
        if (notFoundCount > 0) {
          failedCount += notFoundCount;
          errors.push(
            `${notFoundCount} productos no encontrados para actualizar`
          );
        }
      } else {
        // No se encontró ningún producto para actualizar
        failedCount += batch.length;
        errors.push(
          `Ningún producto encontrado para actualizar en batch ${batchNumber}`
        );
        batchSuccess = true; // No reintentar si no se encuentran productos
      }

      return { uploadedCount, failedCount, errors };
    } catch (error: any) {
      retryCount++;
      const errorMessage = error?.message || "Error desconocido";
      const errorStatus = error?.response?.status?.toString() || "";

      // 🔄 CLASIFICAR TIPO DE ERROR PARA APLICAR ESTRATEGIA APROPIADA
      let waitTime = CONFIG.TIMEOUTS.RETRY_BASE_DELAY;
      let shouldRetry = true;
      let errorType = "desconocido";

      if (
        CONFIG.ERROR_PATTERNS.CONNECTION_ERRORS.some((pattern) =>
          errorMessage.includes(pattern)
        )
      ) {
        errorType = "conexión";
        waitTime = retryCount * CONFIG.TIMEOUTS.RETRY_BASE_DELAY;
      } else if (
        CONFIG.ERROR_PATTERNS.SERVER_OVERLOAD_ERRORS.some(
          (pattern) => errorMessage.includes(pattern) || errorStatus === pattern
        )
      ) {
        errorType = "sobrecarga del servidor (503/502/504)";
        waitTime = Math.min(
          retryCount *
            CONFIG.TIMEOUTS.SERVER_OVERLOAD_DELAY *
            CONFIG.RETRY.BACKOFF_MULTIPLIER,
          30000 // Máximo 30 segundos
        );

        // 🚨 Para errores 503, aumentar dramáticamente el delay adaptativo
        if (errorStatus === "503") {
          const currentMetrics = performanceMetrics.get(sucursalId);
          if (currentMetrics) {
            currentMetrics.avgResponseTime *=
              CONFIG.ADAPTIVE_DELAYS.OVERLOAD_MULTIPLIER;
            console.log(
              `⚠️ Error 503 detectado en actualización: aumentando delays adaptativos x${CONFIG.ADAPTIVE_DELAYS.OVERLOAD_MULTIPLIER}`
            );
          }
        }
      } else if (
        CONFIG.ERROR_PATTERNS.RATE_LIMIT_ERRORS.some(
          (pattern) => errorMessage.includes(pattern) || errorStatus === pattern
        )
      ) {
        errorType = "límite de tasa (429)";
        waitTime = Math.min(
          retryCount *
            CONFIG.TIMEOUTS.RATE_LIMIT_DELAY *
            CONFIG.RETRY.BACKOFF_MULTIPLIER,
          15000 // Máximo 15 segundos
        );
      } else {
        errorType = "no recuperable";
        shouldRetry = false;
      }

      console.warn(
        `⚠️ Error de ${errorType} en batch actualización ${batchNumber}, intento ${retryCount}/${maxRetries}: ${errorMessage} (Status: ${errorStatus})`
      );

      if (shouldRetry && retryCount < maxRetries) {
        console.log(
          `⏳ Esperando ${Math.round(
            waitTime
          )}ms antes de reintentar batch actualización ${batchNumber}...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        if (shouldRetry) {
          console.error(
            `❌ Error persistente de ${errorType} en batch actualización ${batchNumber} después de ${maxRetries} intentos`
          );
        } else {
          console.error(
            `❌ Error ${errorType} en batch actualización ${batchNumber}`
          );
        }
        failedCount += batch.length;
        errors.push(
          `Error en batch actualización ${batchNumber}: ${errorMessage} (${errorType})`
        );
        break;
      }
    }
  }

  // 📝 AGREGAR BATCH FALLIDO AL TRACKING SI NO TUVO ÉXITO
  if (!batchSuccess) {
    const sucursalKey = `sucursal_${sucursalId}`;
    addFailedBatch(sucursalKey, batch, errors.join(", "), sucursalId, "update");
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
  recoveryResults?: {
    recoveredCount: number;
    permanentlyFailedCount: number;
    errors: string[];
  };
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

  // 🔄 PROCESAR BATCHES FALLIDOS AL FINAL
  console.log(`🔄 Iniciando fase de recovery de batches fallidos...`);
  const recoveryResults = await processFailedBatches();

  if (recoveryResults.recoveredCount > 0) {
    console.log(
      `✅ Recovery exitoso: ${recoveryResults.recoveredCount} productos recuperados`
    );
    totalUploaded += recoveryResults.recoveredCount;
  }

  if (recoveryResults.permanentlyFailedCount > 0) {
    console.log(
      `❌ ${recoveryResults.permanentlyFailedCount} productos fallaron permanentemente`
    );
    totalFailed += recoveryResults.permanentlyFailedCount;
  }

  const duration = Date.now() - startTime;

  return {
    success: totalFailed === 0,
    totalUploaded,
    totalFailed,
    sucursalResults,
    duration,
    recoveryResults, // Incluir resultados de recovery en la respuesta
  };
}

async function uploadProductsFromSucursalJson(jsonFilePath: string): Promise<{
  success: boolean;
  uploadedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
  sucursal_info?: { id: number; nombre: string };
  skippedCount?: number;
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

    // OPTIMIZACIÓN MEJORADA: Obtener productos existentes con precios para comparación inteligente
    let existingProductsWithPrices = new Map<
      string,
      { id: number; regular_price: string; name: string }
    >();
    let skippedCount = 0;

    if (CONFIG.OPTIMIZATION.SKIP_SAME_PRICE_UPDATES) {
      console.log(
        "💰 Optimización de precios habilitada - obteniendo productos existentes con precios..."
      );
      existingProductsWithPrices = await getAllExistingProductsWithPrices(
        wooInstance
      );
    } else {
      // Fallback al método anterior si la optimización está deshabilitada
      console.log("🔍 Usando método tradicional de obtención de SKUs...");
      const existingSkus = await getAllExistingSkus(wooInstance);
      // Convertir Set a Map para compatibilidad
      existingSkus.forEach((sku) => {
        existingProductsWithPrices.set(sku, {
          id: 0,
          regular_price: "0",
          name: "",
        });
      });
    }

    // Convertir productos usando la función legacy
    const productsBatch = convertToWooCommerceFormat(productos, {
      id: sucursal_id,
      nombre: nombre_sucursal,
    });

    console.log(`📦 Productos convertidos: ${productsBatch.length}`);

    // OPTIMIZACIÓN: Separar productos nuevos, para actualizar y para omitir
    const newProducts = productsBatch.filter(
      (product) => !existingProductsWithPrices.has(product.sku)
    );

    const existingProducts = productsBatch.filter((product) =>
      existingProductsWithPrices.has(product.sku)
    );

    // Aplicar lógica de comparación de precios para productos existentes
    const productsToUpdate: WooCommerceProductFromSucursal[] = [];
    const productsToSkip: WooCommerceProductFromSucursal[] = [];

    existingProducts.forEach((product) => {
      const existingProduct = existingProductsWithPrices.get(product.sku);
      if (existingProduct && shouldUpdateProduct(product, existingProduct)) {
        productsToUpdate.push(product);
      } else {
        productsToSkip.push(product);
        skippedCount++;
      }
    });

    console.log(
      `📊 Distribución optimizada: ${newProducts.length} nuevos, ${productsToUpdate.length} para actualizar, ${productsToSkip.length} omitidos (precio sin cambios)`
    );

    // Log de productos omitidos para transparencia
    if (productsToSkip.length > 0) {
      console.log(
        `⏭️ Productos omitidos por precio sin cambios: ${productsToSkip
          .map((p) => p.sku)
          .slice(0, 10)
          .join(", ")}${productsToSkip.length > 10 ? "..." : ""}`
      );
    }

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

    // FASE 2: Actualizar productos duplicados con batches paralelos
    if (productsToUpdate.length > 0) {
      console.log(
        `🔄 Iniciando actualización de ${productsToUpdate.length} productos existentes...`
      );

      // Pre-verificar imágenes para productos duplicados
      console.log(`🖼️ Verificando imágenes para productos duplicados...`);
      const duplicateImageUrls = productsToUpdate
        .map((p) => p.images[0]?.src)
        .filter((url): url is string => Boolean(url));
      const duplicateImageResults = await verifyImagesInBatch(
        duplicateImageUrls,
        CONFIG.CONCURRENCY.IMAGENES_PARALELAS
      );

      // Actualizar productos con imagen de fallback si es necesario
      productsToUpdate.forEach((product) => {
        const imageUrl = product.images[0]?.src;
        if (imageUrl && !duplicateImageResults.get(imageUrl)) {
          product.images = [{ src: CONFIG.URLS.FALLBACK_IMAGE }];
        }
      });

      // Dividir productos duplicados en batches
      const updateBatchSize = CONFIG.BATCH_SIZES.ACTUALIZACION;
      const updateBatches = [];
      for (let i = 0; i < productsToUpdate.length; i += updateBatchSize) {
        updateBatches.push(productsToUpdate.slice(i, i + updateBatchSize));
      }

      console.log(
        `📦 Iniciando actualización de ${productsToUpdate.length} productos en ${updateBatches.length} batches (${batchConcurrency} en paralelo)...`
      );

      const updateResult = await processUpdateBatchesInParallel(
        updateBatches,
        wooInstance,
        sucursal_id,
        batchConcurrency
      );

      uploadedCount += updateResult.uploadedCount;
      failedCount += updateResult.failedCount;
      errors.push(...updateResult.errors);

      console.log(
        `✅ Fase 2 completada: ${updateResult.uploadedCount} actualizados, ${updateResult.failedCount} fallidos`
      );
    }

    const duration = Date.now() - startTime;

    console.log(
      `✅ Proceso completado para ${nombre_sucursal}: ${uploadedCount} exitosos, ${failedCount} fallidos, ${skippedCount} omitidos (precio sin cambios) en ${duration}ms`
    );

    return {
      success: failedCount === 0,
      uploadedCount,
      failedCount,
      errors,
      duration,
      sucursal_info: { id: sucursal_id, nombre: nombre_sucursal },
      skippedCount, // Agregar conteo de productos omitidos
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

    // ir a buscar la categoria al categoryMappers/{sku}.json
    const categoriesMapperPath = path.join(
      process.cwd(),
      "categoryMappers",
      `${producto.sku}.json`
    );
    let categories: Array<{ id: number }> = [];

    if (fs.existsSync(categoriesMapperPath)) {
      try {
        const categoryFileContent = fs.readFileSync(
          categoriesMapperPath,
          "utf-8"
        );

        const categoryData = JSON.parse(categoryFileContent);

        if (categoryData && categoryData.categoryMap) {
          const mappedCategoryId = categoryData.categoryMap[producto.sku];
          if (mappedCategoryId) {
            categories.push({ id: mappedCategoryId });
          }
        }
      } catch (err) {
        console.error(
          `❌ Error leyendo mapeo de categorías para SKU ${producto.sku}:`,
          err
        );
      }
    }

    return {
      sku: `${producto.sku}`,
      name: productName,
      regular_price: `${producto.regular_price}`,
      description: cleanDescription,
      short_description: cleanShortDescription,
      categories: categories,
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

// Función para agregar batch fallido al tracking
function addFailedBatch(
  sucursalKey: string,
  products: WooCommerceProductFromSucursal[],
  reason: string,
  sucursalId: number,
  batchType: "create" | "update" = "create"
) {
  if (!failedBatches.has(sucursalKey)) {
    failedBatches.set(sucursalKey, []);
  }

  const failedBatchInfo: FailedBatchInfo = {
    products,
    reason,
    retryCount: 0,
    sucursalId,
    batchType,
  };

  failedBatches.get(sucursalKey)!.push(failedBatchInfo);
  console.log(
    `📝 Batch fallido agregado al tracking: ${products.length} productos (${reason})`
  );
}

// Función para procesar batches fallidos al final
async function processFailedBatches(): Promise<{
  recoveredCount: number;
  permanentlyFailedCount: number;
  errors: string[];
}> {
  let totalRecovered = 0;
  let totalPermanentlyFailed = 0;
  const allErrors: string[] = [];

  if (failedBatches.size === 0) {
    console.log(`✅ No hay batches fallidos para reprocesar`);
    return { recoveredCount: 0, permanentlyFailedCount: 0, errors: [] };
  }

  console.log(
    `🔄 Iniciando reprocesamiento de ${failedBatches.size} sucursales con batches fallidos...`
  );

  for (const [sucursalKey, batches] of failedBatches.entries()) {
    console.log(
      `🔄 Reprocesando ${batches.length} batches fallidos para ${sucursalKey}...`
    );

    for (const batch of batches) {
      if (batch.retryCount >= 2) {
        // Máximo 2 reintentos en la fase de recovery
        console.log(
          `❌ Batch excedió reintentos máximos, marcando como permanentemente fallido`
        );
        totalPermanentlyFailed += batch.products.length;
        allErrors.push(
          `Batch de ${batch.products.length} productos falló permanentemente: ${batch.reason}`
        );
        continue;
      }

      try {
        const wooInstance = getWooCommerceInstance(batch.sucursalId);
        if (!wooInstance) {
          throw new Error(
            `No se pudo obtener instancia de WooCommerce para sucursal ${batch.sucursalId}`
          );
        }

        // Dividir en batches más pequeños para recovery
        const smallBatches = [];
        for (
          let i = 0;
          i < batch.products.length;
          i += CONFIG.BATCH_SIZES.RETRY_BATCH
        ) {
          smallBatches.push(
            batch.products.slice(i, i + CONFIG.BATCH_SIZES.RETRY_BATCH)
          );
        }

        let batchRecovered = 0;
        for (const smallBatch of smallBatches) {
          try {
            console.log(
              `🔄 Reintentando batch pequeño de ${smallBatch.length} productos...`
            );

            const response = await wooInstance.post("products/batch", {
              [batch.batchType]:
                batch.batchType === "create"
                  ? smallBatch
                  : smallBatch.map((p) => {
                      const { sku, ...productWithoutSku } = p;
                      return productWithoutSku;
                    }),
            });

            if (response.data && response.data[batch.batchType]) {
              const successCount = response.data[batch.batchType].length;
              batchRecovered += successCount;
              console.log(
                `✅ Recovery exitoso: ${successCount}/${smallBatch.length} productos`
              );
            }

            // Delay entre small batches en recovery
            await new Promise((resolve) =>
              setTimeout(resolve, CONFIG.TIMEOUTS.SERVER_OVERLOAD_DELAY / 2)
            );
          } catch (smallBatchError) {
            console.warn(`⚠️ Small batch en recovery falló:`, smallBatchError);
            allErrors.push(
              `Small batch recovery falló: ${
                smallBatchError instanceof Error
                  ? smallBatchError.message
                  : "Error desconocido"
              }`
            );
          }
        }

        totalRecovered += batchRecovered;
        batch.retryCount++;

        console.log(
          `📊 Recovery completado para batch: ${batchRecovered}/${batch.products.length} productos recuperados`
        );
      } catch (error) {
        batch.retryCount++;
        const errorMsg =
          error instanceof Error ? error.message : "Error desconocido";
        console.error(`❌ Error en recovery de batch:`, errorMsg);
        allErrors.push(`Error en recovery: ${errorMsg}`);

        if (batch.retryCount >= 2) {
          totalPermanentlyFailed += batch.products.length;
        }
      }
    }

    // Delay entre sucursales en recovery
    await new Promise((resolve) =>
      setTimeout(resolve, CONFIG.TIMEOUTS.CHUNKS_DELAY_SUCURSALES)
    );
  }

  console.log(
    `📊 Recovery completado: ${totalRecovered} recuperados, ${totalPermanentlyFailed} fallidos permanentemente`
  );

  return {
    recoveredCount: totalRecovered,
    permanentlyFailedCount: totalPermanentlyFailed,
    errors: allErrors,
  };
}
