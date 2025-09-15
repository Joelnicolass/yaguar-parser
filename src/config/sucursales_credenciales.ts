/**
 * Configuración de credenciales WooCommerce por sucursal
 *
 * Este archivo contiene las credenciales específicas de cada sucursal
 * para conectarse a sus respectivas instancias de WooCommerce.
 *
 * Cada sucursal tiene:
 * - sucursal_id: ID único de la sucursal (del archivo JSON)
 * - nombre: Nombre de la sucursal
 * - credenciales: Configuración específica de WooCommerce
 */

import { WooCommerceConfig } from "../types";

export interface SucursalCredenciales {
  sucursal_id: number;
  nombre: string;
  credenciales: WooCommerceConfig;
}

/**
 * Mapeo de credenciales por sucursal_id
 *
 * IMPORTANTE: Configura aquí las credenciales reales de cada sucursal
 * antes de usar en producción.
 */
export const SUCURSALES_CREDENCIALES: Record<number, SucursalCredenciales> = {
  10: {
    sucursal_id: 10,
    nombre: "Autopista",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_AUTOPISTA_URL ||
        "https://autopista.example.com",
      consumerKey: process.env.WOOCOMMERCE_AUTOPISTA_KEY || "ck_autopista_key",
      consumerSecret:
        process.env.WOOCOMMERCE_AUTOPISTA_SECRET || "cs_autopista_secret",
      version: "wc/v3",
    },
  },
  11: {
    sucursal_id: 11,
    nombre: "Bahía Blanca",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_BAHIABLANCA_URL ||
        "https://bahiablanca.example.com",
      consumerKey:
        process.env.WOOCOMMERCE_BAHIABLANCA_KEY || "ck_bahiablanca_key",
      consumerSecret:
        process.env.WOOCOMMERCE_BAHIABLANCA_SECRET || "cs_bahiablanca_secret",
      version: "wc/v3",
    },
  },
  12: {
    sucursal_id: 12,
    nombre: "Campana",
    credenciales: {
      url: process.env.WOOCOMMERCE_CAMPANA_URL || "https://campana.example.com",
      consumerKey: process.env.WOOCOMMERCE_CAMPANA_KEY || "ck_campana_key",
      consumerSecret:
        process.env.WOOCOMMERCE_CAMPANA_SECRET || "cs_campana_secret",
      version: "wc/v3",
    },
  },
  13: {
    sucursal_id: 13,
    nombre: "Chacabuco",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_CHACABUCO_URL ||
        "https://chacabuco.example.com",
      consumerKey: process.env.WOOCOMMERCE_CHACABUCO_KEY || "ck_chacabuco_key",
      consumerSecret:
        process.env.WOOCOMMERCE_CHACABUCO_SECRET || "cs_chacabuco_secret",
      version: "wc/v3",
    },
  },
  14: {
    sucursal_id: 14,
    nombre: "Chaco",
    credenciales: {
      url: process.env.WOOCOMMERCE_CHACO_URL || "https://chaco.example.com",
      consumerKey: process.env.WOOCOMMERCE_CHACO_KEY || "ck_chaco_key",
      consumerSecret: process.env.WOOCOMMERCE_CHACO_SECRET || "cs_chaco_secret",
      version: "wc/v3",
    },
  },
  15: {
    sucursal_id: 15,
    nombre: "Córdoba",
    credenciales: {
      url: process.env.WOOCOMMERCE_CORDOBA_URL || "https://cordoba.example.com",
      consumerKey: process.env.WOOCOMMERCE_CORDOBA_KEY || "ck_cordoba_key",
      consumerSecret:
        process.env.WOOCOMMERCE_CORDOBA_SECRET || "cs_cordoba_secret",
      version: "wc/v3",
    },
  },
  16: {
    sucursal_id: 16,
    nombre: "General Roca",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_GRALROCA_URL || "https://gralroca.example.com",
      consumerKey: process.env.WOOCOMMERCE_GRALROCA_KEY || "ck_gralroca_key",
      consumerSecret:
        process.env.WOOCOMMERCE_GRALROCA_SECRET || "cs_gralroca_secret",
      version: "wc/v3",
    },
  },
  17: {
    sucursal_id: 17,
    nombre: "José C. Paz",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_JOSECPAZ_URL || "https://josecpaz.example.com",
      consumerKey: process.env.WOOCOMMERCE_JOSECPAZ_KEY || "ck_josecpaz_key",
      consumerSecret:
        process.env.WOOCOMMERCE_JOSECPAZ_SECRET || "cs_josecpaz_secret",
      version: "wc/v3",
    },
  },
  18: {
    sucursal_id: 18,
    nombre: "Jujuy",
    credenciales: {
      url: process.env.WOOCOMMERCE_JUJUY_URL || "https://jujuy.example.com",
      consumerKey: process.env.WOOCOMMERCE_JUJUY_KEY || "ck_jujuy_key",
      consumerSecret: process.env.WOOCOMMERCE_JUJUY_SECRET || "cs_jujuy_secret",
      version: "wc/v3",
    },
  },
  19: {
    sucursal_id: 19,
    nombre: "Mar del Plata",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_MARDELPLATA_URL ||
        "https://mardelplata.example.com",
      consumerKey:
        process.env.WOOCOMMERCE_MARDELPLATA_KEY || "ck_mardelplata_key",
      consumerSecret:
        process.env.WOOCOMMERCE_MARDELPLATA_SECRET || "cs_mardelplata_secret",
      version: "wc/v3",
    },
  },
  20: {
    sucursal_id: 20,
    nombre: "Maschwitz",
    credenciales: {
      url:
        process.env.WOOCOMMERCE_MASCHWITZ_URL ||
        "https://maschwitz.example.com",
      consumerKey: process.env.WOOCOMMERCE_MASCHWITZ_KEY || "ck_maschwitz_key",
      consumerSecret:
        process.env.WOOCOMMERCE_MASCHWITZ_SECRET || "cs_maschwitz_secret",
      version: "wc/v3",
    },
  },
  21: {
    sucursal_id: 21,
    nombre: "Mendoza",
    credenciales: {
      url: process.env.WOOCOMMERCE_MENDOZA_URL || "https://mendoza.example.com",
      consumerKey: process.env.WOOCOMMERCE_MENDOZA_KEY || "ck_mendoza_key",
      consumerSecret:
        process.env.WOOCOMMERCE_MENDOZA_SECRET || "cs_mendoza_secret",
      version: "wc/v3",
    },
  },
  22: {
    sucursal_id: 22,
    nombre: "Moreno",
    credenciales: {
      url: process.env.WOOCOMMERCE_MORENO_URL || "https://moreno.example.com",
      consumerKey: process.env.WOOCOMMERCE_MORENO_KEY || "ck_moreno_key",
      consumerSecret:
        process.env.WOOCOMMERCE_MORENO_SECRET || "cs_moreno_secret",
      version: "wc/v3",
    },
  },
  23: {
    sucursal_id: 23,
    nombre: "Neuquén",
    credenciales: {
      url: process.env.WOOCOMMERCE_NEUQUEN_URL || "https://neuquen.example.com",
      consumerKey: process.env.WOOCOMMERCE_NEUQUEN_KEY || "ck_neuquen_key",
      consumerSecret:
        process.env.WOOCOMMERCE_NEUQUEN_SECRET || "cs_neuquen_secret",
      version: "wc/v3",
    },
  },
  24: {
    sucursal_id: 24,
    nombre: "Posadas",
    credenciales: {
      url: process.env.WOOCOMMERCE_POSADAS_URL || "https://posadas.example.com",
      consumerKey: process.env.WOOCOMMERCE_POSADAS_KEY || "ck_posadas_key",
      consumerSecret:
        process.env.WOOCOMMERCE_POSADAS_SECRET || "cs_posadas_secret",
      version: "wc/v3",
    },
  },
  25: {
    sucursal_id: 25,
    nombre: "Salta",
    credenciales: {
      url: process.env.WOOCOMMERCE_SALTA_URL || "https://salta.example.com",
      consumerKey: process.env.WOOCOMMERCE_SALTA_KEY || "ck_salta_key",
      consumerSecret: process.env.WOOCOMMERCE_SALTA_SECRET || "cs_salta_secret",
      version: "wc/v3",
    },
  },
  26: {
    sucursal_id: 26,
    nombre: "San Juan",
    credenciales: {
      url: process.env.WOOCOMMERCE_SANJUAN_URL || "https://sanjuan.example.com",
      consumerKey: process.env.WOOCOMMERCE_SANJUAN_KEY || "ck_sanjuan_key",
      consumerSecret:
        process.env.WOOCOMMERCE_SANJUAN_SECRET || "cs_sanjuan_secret",
      version: "wc/v3",
    },
  },
  27: {
    sucursal_id: 27,
    nombre: "Santa Fe",
    credenciales: {
      url: process.env.WOOCOMMERCE_SANTAFE_URL || "https://santafe.example.com",
      consumerKey: process.env.WOOCOMMERCE_SANTAFE_KEY || "ck_santafe_key",
      consumerSecret:
        process.env.WOOCOMMERCE_SANTAFE_SECRET || "cs_santafe_secret",
      version: "wc/v3",
    },
  },
  28: {
    sucursal_id: 28,
    nombre: "Trelew",
    credenciales: {
      url: process.env.WOOCOMMERCE_TRELEW_URL || "https://trelew.example.com",
      consumerKey: process.env.WOOCOMMERCE_TRELEW_KEY || "ck_trelew_key",
      consumerSecret:
        process.env.WOOCOMMERCE_TRELEW_SECRET || "cs_trelew_secret",
      version: "wc/v3",
    },
  },
};

/**
 * Obtener credenciales de una sucursal específica
 */
export function getCredencialesSucursal(
  sucursalId: number
): SucursalCredenciales | null {
  return SUCURSALES_CREDENCIALES[sucursalId] || null;
}

/**
 * Validar si una sucursal tiene credenciales configuradas
 */
export function hasSucursalCredenciales(sucursalId: number): boolean {
  return sucursalId in SUCURSALES_CREDENCIALES;
}

/**
 * Obtener lista de todas las sucursales configuradas
 */
export function getAllSucursales(): SucursalCredenciales[] {
  return Object.values(SUCURSALES_CREDENCIALES);
}

/**
 * Mapeo de nombres de archivos a sucursal_id
 * Para facilitar la identificación por nombre de archivo
 */
export const ARCHIVO_A_SUCURSAL_ID: Record<string, number> = {
  "webprecautopista.json": 10,
  "webprecbahiablanca.json": 11,
  "webpreccampana.json": 12,
  "webprecchacabuco.json": 13,
  "webprecchaco.json": 14,
  "webpreccordoba.json": 15,
  "webprecgralroca.json": 16,
  "webprecjosecpaz.json": 17,
  "webprecjujuy.json": 18,
  "webprecmardelplata.json": 19,
  "webprecmaschwitz.json": 20,
  "webprecmendoza.json": 21,
  "webprecmoreno.json": 22,
  "webprecneuquen.json": 23,
  "webprecposadas.json": 24,
  "webprecsalta.json": 25,
  "webprecsanjuan.json": 26,
  "webprecsantafe.json": 27,
  "webprectrelew.json": 28,
};

/**
 * Obtener sucursal_id por nombre de archivo
 */
export function getSucursalIdByFilename(filename: string): number | null {
  return ARCHIVO_A_SUCURSAL_ID[filename] || null;
}
