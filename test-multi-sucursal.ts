/**
 * Script de prueba para validar el sistema multi-sucursal de WooCommerce
 *
 * Este script prueba:
 * 1. Inicialización del controlador sin configuración por defecto
 * 2. Conexión a múltiples sucursales con credenciales diferentes
 * 3. Carga de productos desde archivos JSON de sucursales específicas
 */

import { WoocommerceController } from "./src/controllers/woocommerce_controller";
import { getAllSucursales } from "./src/config/sucursales_credenciales";
import path from "path";
import fs from "fs";

async function testMultiSucursal() {
  console.log("🧪 Iniciando pruebas del sistema multi-sucursal...\n");

  try {
    // 1. Inicializar controlador sin configuración por defecto
    console.log(
      "📋 Paso 1: Inicializando WooCommerceController en modo multi-sucursal..."
    );
    const wooController = new WoocommerceController(); // Sin configuración por defecto
    console.log("✅ Controller inicializado correctamente\n");

    // 2. Obtener lista de sucursales configuradas
    console.log("📋 Paso 2: Obteniendo lista de sucursales configuradas...");
    const sucursales = getAllSucursales();
    console.log(
      `✅ Se encontraron ${sucursales.length} sucursales configuradas:`
    );
    sucursales.forEach((sucursal) => {
      console.log(
        `   - ${sucursal.nombre} (ID: ${sucursal.sucursal_id}) - URL: ${sucursal.credenciales.url}`
      );
    });
    console.log("");

    // 3. Probar conexión con las primeras 2 sucursales
    console.log(
      "📋 Paso 3: Probando conexión con las primeras 2 sucursales..."
    );
    const sucursalesAPrueba = sucursales.slice(0, 2);

    for (const sucursal of sucursalesAPrueba) {
      console.log(
        `🔗 Probando conexión con ${sucursal.nombre} (ID: ${sucursal.sucursal_id})...`
      );

      try {
        const connectionResult = await wooController.testConnection(
          sucursal.sucursal_id
        );

        if (connectionResult.success) {
          console.log(`✅ Conexión exitosa con ${sucursal.nombre}`);
          console.log(`   Mensaje: ${connectionResult.message}`);
          if (connectionResult.storeInfo) {
            console.log(
              `   Tienda: ${connectionResult.storeInfo.name || "N/A"}`
            );
            console.log(`   URL: ${connectionResult.storeInfo.url || "N/A"}`);
          }
        } else {
          console.log(
            `❌ Error conectando con ${sucursal.nombre}: ${connectionResult.message}`
          );
        }
      } catch (error: any) {
        console.log(
          `❌ Excepción al conectar con ${sucursal.nombre}: ${error.message}`
        );
      }
      console.log("");
    }

    // 4. Crear archivos JSON de prueba con estructura correcta
    console.log("📋 Paso 4: Creando archivos JSON de prueba...");

    const testDataAutopista = {
      sucursal_id: 10,
      nombre_sucursal: "Autopista",
      productos: [
        {
          sku: 999001,
          regular_price: 1500.5,
          description:
            "Producto de prueba Autopista - Detergente líquido concentrado",
          short_description: "Detergente Líquido Test Autopista",
          meta_data: 12,
          meta_data_2: "ML",
        },
        {
          sku: 999002,
          regular_price: 2300.75,
          description:
            "Producto de prueba Autopista - Shampoo anticaspa premium",
          short_description: "Shampoo Anticaspa Test Autopista",
          meta_data: 10,
          meta_data_2: "ML",
        },
      ],
    };

    const testDataBahiaBlanca = {
      sucursal_id: 11,
      nombre_sucursal: "Bahía Blanca",
      productos: [
        {
          sku: 999003,
          regular_price: 1200.25,
          description:
            "Producto de prueba Bahía Blanca - Aceite de girasol premium",
          short_description: "Aceite Girasol Test Bahía Blanca",
          meta_data: 10,
          meta_data_2: "ML",
        },
        {
          sku: 999004,
          regular_price: 800.0,
          description: "Producto de prueba Bahía Blanca - Leche descremada",
          short_description: "Leche Descremada Test Bahía Blanca",
          meta_data: 12,
          meta_data_2: "ML",
        },
      ],
    };

    // Crear archivos temporales de prueba
    const testFileAutopista = path.join(
      process.cwd(),
      "temp",
      "test_autopista.json"
    );
    const testFileBahiaBlanca = path.join(
      process.cwd(),
      "temp",
      "test_bahiablanca.json"
    );

    // Asegurar que existe el directorio temp
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(
      testFileAutopista,
      JSON.stringify(testDataAutopista, null, 2)
    );
    fs.writeFileSync(
      testFileBahiaBlanca,
      JSON.stringify(testDataBahiaBlanca, null, 2)
    );

    console.log("✅ Archivos de prueba creados:");
    console.log(`   - ${testFileAutopista}`);
    console.log(`   - ${testFileBahiaBlanca}`);
    console.log("");

    // 5. Probar carga de productos para cada sucursal
    console.log("📋 Paso 5: Probando carga de productos por sucursal...");

    // Probar Autopista (sucursal_id: 10)
    console.log("🏪 Probando carga en sucursal Autopista (ID: 10)...");
    try {
      const resultAutopista =
        await wooController.uploadProductsFromSucursalJson(testFileAutopista);

      console.log(`Resultado Autopista:`);
      console.log(`   - Éxito: ${resultAutopista.success}`);
      console.log(`   - Productos subidos: ${resultAutopista.uploadedCount}`);
      console.log(`   - Productos fallidos: ${resultAutopista.failedCount}`);
      console.log(`   - Duración: ${resultAutopista.duration}ms`);

      if (resultAutopista.errors.length > 0) {
        console.log(`   - Errores:`);
        resultAutopista.errors.forEach((error) => {
          console.log(`     * ${error}`);
        });
      }
    } catch (error: any) {
      console.log(`❌ Error cargando productos en Autopista: ${error.message}`);
    }
    console.log("");

    // Probar Bahía Blanca (sucursal_id: 11)
    console.log("🏪 Probando carga en sucursal Bahía Blanca (ID: 11)...");
    try {
      const resultBahiaBlanca =
        await wooController.uploadProductsFromSucursalJson(testFileBahiaBlanca);

      console.log(`Resultado Bahía Blanca:`);
      console.log(`   - Éxito: ${resultBahiaBlanca.success}`);
      console.log(`   - Productos subidos: ${resultBahiaBlanca.uploadedCount}`);
      console.log(`   - Productos fallidos: ${resultBahiaBlanca.failedCount}`);
      console.log(`   - Duración: ${resultBahiaBlanca.duration}ms`);

      if (resultBahiaBlanca.errors.length > 0) {
        console.log(`   - Errores:`);
        resultBahiaBlanca.errors.forEach((error) => {
          console.log(`     * ${error}`);
        });
      }
    } catch (error: any) {
      console.log(
        `❌ Error cargando productos en Bahía Blanca: ${error.message}`
      );
    }
    console.log("");

    // 6. Probar obtención de productos por sucursal
    console.log("📋 Paso 6: Probando obtención de productos por sucursal...");

    for (const sucursal of sucursalesAPrueba) {
      console.log(
        `📦 Obteniendo productos de ${sucursal.nombre} (ID: ${sucursal.sucursal_id})...`
      );

      try {
        const productResult = await wooController.getAllProducts(
          sucursal.sucursal_id
        );

        if (productResult.success) {
          console.log(
            `✅ Se obtuvieron ${productResult.totalCount} productos de ${sucursal.nombre}`
          );

          // Mostrar algunos productos de ejemplo
          if (productResult.products.length > 0) {
            console.log(`   Productos de ejemplo:`);
            productResult.products.slice(0, 3).forEach((product) => {
              console.log(
                `     - ${product.name} (SKU: ${product.sku}) - $${product.regular_price}`
              );
            });
          }
        } else {
          console.log(
            `❌ Error obteniendo productos de ${sucursal.nombre}: ${productResult.error}`
          );
        }
      } catch (error: any) {
        console.log(
          `❌ Excepción obteniendo productos de ${sucursal.nombre}: ${error.message}`
        );
      }
      console.log("");
    }

    // 7. Limpiar archivos de prueba
    console.log("📋 Paso 7: Limpiando archivos temporales...");
    try {
      if (fs.existsSync(testFileAutopista)) {
        fs.unlinkSync(testFileAutopista);
      }
      if (fs.existsSync(testFileBahiaBlanca)) {
        fs.unlinkSync(testFileBahiaBlanca);
      }
      console.log("✅ Archivos temporales eliminados");
    } catch (error: any) {
      console.log(
        `⚠️ Advertencia: No se pudieron eliminar archivos temporales: ${error.message}`
      );
    }

    console.log("\n🎉 Pruebas completadas!");
    console.log("\n📊 Resumen:");
    console.log("- ✅ Sistema multi-sucursal inicializado correctamente");
    console.log("- ✅ Credenciales de sucursales cargadas");
    console.log("- ✅ Conexiones a sucursales probadas");
    console.log("- ✅ Carga de productos por sucursal probada");
    console.log("- ✅ Obtención de productos por sucursal probada");
  } catch (error: any) {
    console.error("\n❌ Error durante las pruebas:", error);
    console.error("Stack:", error.stack);
  }
}

// Función para probar búsqueda individual de productos
async function testProductSearch() {
  console.log("\n🔍 Prueba adicional: Búsqueda de productos...");

  const wooController = new WoocommerceController();

  // Probar búsqueda en diferentes sucursales
  const testCases = [
    { sku: "999001", sucursalId: 10 }, // Autopista
    { sku: "999003", sucursalId: 11 }, // Bahía Blanca
  ];

  for (const testCase of testCases) {
    console.log(
      `🔎 Buscando producto SKU ${testCase.sku} en sucursal ${testCase.sucursalId}...`
    );

    try {
      const searchResult = await wooController.findProductBySku(
        testCase.sku,
        testCase.sucursalId
      );

      if (searchResult.success) {
        console.log(`✅ Producto encontrado: ${searchResult.product.name}`);
        console.log(`   SKU: ${searchResult.product.sku}`);
        console.log(`   Precio: $${searchResult.product.regular_price}`);
        console.log(`   Estado: ${searchResult.product.status}`);
      } else {
        console.log(`❌ Producto no encontrado: ${searchResult.error}`);
      }
    } catch (error: any) {
      console.log(`❌ Error buscando producto: ${error.message}`);
    }
    console.log("");
  }
}

// Ejecutar las pruebas
async function main() {
  await testMultiSucursal();
  await testProductSearch();
  console.log("\n🏁 Todas las pruebas finalizadas.");
}

main().catch(console.error);
