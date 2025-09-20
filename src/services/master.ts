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
    version: credenciales.credenciales.version || ("wc/v3" as any),
    axiosConfig: {
      timeout: 240000,
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

    const jsonFiles = res.files.filter((file) => file.name.endsWith(".json"));
    const downloadedJsonFiles = [];

    for (const file of jsonFiles) {
      if (file.name.endsWith(".json")) {
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

  for (const filePath of sucursalFilePaths) {
    try {
      const result = await uploadProductsFromSucursalJson(filePath);

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

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
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

    // OPTIMIZACIÓN: Reducir tamaño de batch para evitar timeouts
    const batchSize = 50; // Reducido de 100 a 50

    // Convertir productos usando la función legacy
    const productsBatch = convertToWooCommerceFormat(productos, {
      id: sucursal_id,
      nombre: nombre_sucursal,
    });

    console.log(`📦 Productos convertidos: ${productsBatch.length}`);

    // Arrays para almacenar productos duplicados para actualización posterior
    const duplicateProducts: WooCommerceProductFromSucursal[] = [];

    // FASE 1: Intentar crear todos los productos
    const totalBatches = Math.ceil(productsBatch.length / batchSize);
    console.log(
      `📦 Iniciando creación de productos en ${totalBatches} batches (${batchSize} productos por batch)...`
    );

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = start + batchSize;
      const batch = productsBatch.slice(start, end);

      console.log(
        `📤 Procesando batch ${batchIndex + 1}/${totalBatches} (${
          batch.length
        } productos)`
      );

      // REINTENTOS para manejar errores de conexión
      let retryCount = 0;
      const maxRetries = 3;
      let batchSuccess = false;

      while (retryCount < maxRetries && !batchSuccess) {
        try {
          // Verificar imágenes y ajustar productos como en el sistema legacy
          const finalBatch = await Promise.all(
            batch.map(async (prod) => {
              const imageFound = await fetch(prod.images[0]?.src || "")
                .then((res) => res.ok)
                .catch(() => false);

              if (!imageFound) {
                return {
                  ...prod,
                  images: [{ src: "https://vd.com.ar/images/0000.png" }],
                };
              }
              return prod;
            })
          );

          // Crear productos usando la API batch como en el sistema legacy
          const response = await wooInstance.post("products/batch", {
            create: finalBatch,
          });

          console.log(`✅ Response recibido, status: ${response.status}`);
          batchSuccess = true;

          if (response.data) {
            const batchResult = response.data;

            // Procesar productos en el array 'create' - separar exitosos de duplicados
            if (batchResult.create && batchResult.create.length > 0) {
              let batchCreated = 0;
              let batchDuplicates = 0;

              batchResult.create.forEach((product: any, index: number) => {
                const originalProduct = finalBatch[index];
                if (!originalProduct) return;

                // CORRECCIÓN: Un ID válido debe ser > 0, no solo !== null
                if (
                  product.id !== null &&
                  product.id !== undefined &&
                  product.id > 0
                ) {
                  // Producto creado exitosamente con ID válido
                  uploadedCount++;
                  batchCreated++;
                } else {
                  // Producto duplicado o con error (id: null, id: 0, etc.)
                  duplicateProducts.push(originalProduct);
                  batchDuplicates++;
                }
              });

              console.log(
                `✅ Batch ${
                  batchIndex + 1
                }: ${batchCreated} creados, ${batchDuplicates} duplicados`
              );
            }

            // Procesar errores adicionales del array 'error' (otros tipos de errores)
            if (batchResult.error && batchResult.error.length > 0) {
              console.log(
                `❌ ${batchResult.error.length} errores adicionales en batch ${
                  batchIndex + 1
                }`
              );

              batchResult.error.forEach((error: any, index: number) => {
                const originalProduct =
                  finalBatch[index + (batchResult.create?.length || 0)];
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
        } catch (error) {
          retryCount++;
          const errorMessage =
            error instanceof Error ? error.message : "Error desconocido";

          if (
            errorMessage.includes("socket hang up") ||
            errorMessage.includes("ECONNRESET") ||
            errorMessage.includes("timeout")
          ) {
            console.warn(
              `⚠️ Error de conexión en batch ${
                batchIndex + 1
              }, intento ${retryCount}/${maxRetries}: ${errorMessage}`
            );

            if (retryCount < maxRetries) {
              const waitTime = retryCount * 2000; // 2s, 4s, 6s
              console.log(`⏳ Esperando ${waitTime}ms antes de reintentar...`);
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            } else {
              console.error(
                `❌ Error persistente en batch ${
                  batchIndex + 1
                } después de ${maxRetries} intentos`
              );
              failedCount += batch.length;
              errors.push(`Error en batch ${batchIndex + 1}: ${errorMessage}`);
            }
          } else {
            console.error(
              `❌ Error no recuperable en batch ${batchIndex + 1}:`,
              error
            );
            failedCount += batch.length;
            errors.push(`Error en batch ${batchIndex + 1}: ${errorMessage}`);
            break;
          }
        }
      }

      // Delay más largo entre batches
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Aumentado de 300ms a 1000ms
    }

    console.log(
      `📊 Fase 1 completada: ${uploadedCount} creados, ${duplicateProducts.length} duplicados detectados, ${failedCount} errores`
    );

    // FASE 2: Actualizar productos duplicados
    if (duplicateProducts.length > 0) {
      console.log(
        `🔄 Iniciando actualización de ${duplicateProducts.length} productos duplicados...`
      );

      const updateBatchSize = 50; // Menor tamaño para actualizaciones
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
          // Buscar IDs de productos existentes por SKU
          const productsWithIds = await Promise.all(
            updateBatch.map(async (product) => {
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
            })
          );

          // Filtrar productos válidos para actualización
          const validUpdates = productsWithIds.filter((p) => p !== null);

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

        // Delay entre batches de actualización
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      console.log(`📊 Fase 2 completada: duplicados procesados y actualizados`);
    }

    const duration = Date.now() - startTime;

    console.log(
      `✅ Proceso completado para ${nombre_sucursal}: ${uploadedCount} exitosos (creados + actualizados), ${failedCount} fallidos en ${duration}ms`
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
    const imageUrl = `https://vd.com.ar/images/${producto.sku}.png`;
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
      type: "simple",
      status: "publish",
      stock_status: "instock",
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
