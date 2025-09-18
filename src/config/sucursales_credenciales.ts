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
  /* 3: {
    sucursal_id: 3,
    nombre: "Campana",
    credenciales: {
      url: process.env.WOOCOMMERCE_CAMPANA_URL || "https://campana.example.com",
      consumerKey: process.env.WOOCOMMERCE_CAMPANA_KEY || "ck_campana_key",
      consumerSecret:
        process.env.WOOCOMMERCE_CAMPANA_SECRET || "cs_campana_secret",
      version: "wc/v3",
    },
  },
  4: {
    sucursal_id: 4,
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
  5: {
    sucursal_id: 5,
    nombre: "Santa Fe",
    credenciales: {
      url: process.env.WOOCOMMERCE_SANTAFE_URL || "https://santafe.example.com",
      consumerKey: process.env.WOOCOMMERCE_SANTAFE_KEY || "ck_santafe_key",
      consumerSecret:
        process.env.WOOCOMMERCE_SANTAFE_SECRET || "cs_santafe_secret",
      version: "wc/v3",
    },
  },
  6: {
    sucursal_id: 6,
    nombre: "Córdoba",
    credenciales: {
      url: process.env.WOOCOMMERCE_CORDOBA_URL || "https://cordoba.example.com",
      consumerKey: process.env.WOOCOMMERCE_CORDOBA_KEY || "ck_cordoba_key",
      consumerSecret:
        process.env.WOOCOMMERCE_CORDOBA_SECRET || "cs_cordoba_secret",
      version: "wc/v3",
    },
  },
  8: {
    sucursal_id: 8,
    nombre: "Neuquén",
    credenciales: {
      url: process.env.WOOCOMMERCE_NEUQUEN_URL || "https://neuquen.example.com",
      consumerKey: process.env.WOOCOMMERCE_NEUQUEN_KEY || "ck_neuquen_key",
      consumerSecret:
        process.env.WOOCOMMERCE_NEUQUEN_SECRET || "cs_neuquen_secret",
      version: "wc/v3",
    },
  },
  9: {
    sucursal_id: 9,
    nombre: "Salta",
    credenciales: {
      url: process.env.WOOCOMMERCE_SALTA_URL || "https://salta.example.com",
      consumerKey: process.env.WOOCOMMERCE_SALTA_KEY || "ck_salta_key",
      consumerSecret: process.env.WOOCOMMERCE_SALTA_SECRET || "cs_salta_secret",
      version: "wc/v3",
    },
  }, */
  10: {
    nombre: "Autopista",
    credenciales: {
      sucursal_id: 10,
      url: "https://vd.com.ar/autopista/",
      consumerKey: "ck_b8b7f2a38e22994892730e89183dffa93e2b5ce8",
      consumerSecret: "cs_4d33915c9a51648c93ef33a25f6e7cc8a205537b",
      version: "wc/v3",
    },
  },
  /* 12: {
    sucursal_id: 12,
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
  13: {
    sucursal_id: 13,
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
  14: {
    sucursal_id: 14,
    nombre: "Mendoza",
    credenciales: {
      url: process.env.WOOCOMMERCE_MENDOZA_URL || "https://mendoza.example.com",
      consumerKey: process.env.WOOCOMMERCE_MENDOZA_KEY || "ck_mendoza_key",
      consumerSecret:
        process.env.WOOCOMMERCE_MENDOZA_SECRET || "cs_mendoza_secret",
      version: "wc/v3",
    },
  },
  15: {
    sucursal_id: 15,
    nombre: "Chaco",
    credenciales: {
      url: process.env.WOOCOMMERCE_CHACO_URL || "https://chaco.example.com",
      consumerKey: process.env.WOOCOMMERCE_CHACO_KEY || "ck_chaco_key",
      consumerSecret: process.env.WOOCOMMERCE_CHACO_SECRET || "cs_chaco_secret",
      version: "wc/v3",
    },
  },
  16: {
    sucursal_id: 16,
    nombre: "San Juan",
    credenciales: {
      url: process.env.WOOCOMMERCE_SANJUAN_URL || "https://sanjuan.example.com",
      consumerKey: process.env.WOOCOMMERCE_SANJUAN_KEY || "ck_sanjuan_key",
      consumerSecret:
        process.env.WOOCOMMERCE_SANJUAN_SECRET || "cs_sanjuan_secret",
      version: "wc/v3",
    },
  },
  18: {
    sucursal_id: 18,
    nombre: "Moreno",
    credenciales: {
      url: process.env.WOOCOMMERCE_MORENO_URL || "https://moreno.example.com",
      consumerKey: process.env.WOOCOMMERCE_MORENO_KEY || "ck_moreno_key",
      consumerSecret:
        process.env.WOOCOMMERCE_MORENO_SECRET || "cs_moreno_secret",
      version: "wc/v3",
    },
  },
  19: {
    sucursal_id: 19,
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
  20: {
    sucursal_id: 20,
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
  21: {
    sucursal_id: 21,
    nombre: "Posadas",
    credenciales: {
      url: process.env.WOOCOMMERCE_POSADAS_URL || "https://posadas.example.com",
      consumerKey: process.env.WOOCOMMERCE_POSADAS_KEY || "ck_posadas_key",
      consumerSecret:
        process.env.WOOCOMMERCE_POSADAS_SECRET || "cs_posadas_secret",
      version: "wc/v3",
    },
  },
  22: {
    sucursal_id: 22,
    nombre: "Trelew",
    credenciales: {
      url: process.env.WOOCOMMERCE_TRELEW_URL || "https://trelew.example.com",
      consumerKey: process.env.WOOCOMMERCE_TRELEW_KEY || "ck_trelew_key",
      consumerSecret:
        process.env.WOOCOMMERCE_TRELEW_SECRET || "cs_trelew_secret",
      version: "wc/v3",
    },
  },
  23: {
    sucursal_id: 23,
    nombre: "Jujuy",
    credenciales: {
      url: process.env.WOOCOMMERCE_JUJUY_URL || "https://jujuy.example.com",
      consumerKey: process.env.WOOCOMMERCE_JUJUY_KEY || "ck_jujuy_key",
      consumerSecret: process.env.WOOCOMMERCE_JUJUY_SECRET || "cs_jujuy_secret",
      version: "wc/v3",
    },
  }, */
  24: {
    nombre: "Chacabuco",
    credenciales: {
      sucursal_id: 24,
      url: "https://vd.com.ar/",
      consumerKey: "ck_2ebb13760100741f2da793984ae114e2cf588114",
      consumerSecret: "cs_b808157442282d9aa1b023f2052e7c48285f516f",
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
  "productos_sucursal_autopista.json": 10,
  "productos_sucursal_bahiablanca.json": 13,
  "productos_sucursal_campana.json": 3,
  "productos_sucursal_chacabuco.json": 24,
  "productos_sucursal_chaco.json": 15,
  "productos_sucursal_cordoba.json": 6,
  "productos_sucursal_gralroca.json": 20,
  "productos_sucursal_josecpaz.json": 4,
  "productos_sucursal_jujuy.json": 23,
  "productos_sucursal_mardelplata.json": 12,
  "productos_sucursal_maschwitz.json": 19,
  "productos_sucursal_mendoza.json": 14,
  "productos_sucursal_moreno.json": 18,
  "productos_sucursal_neuquen.json": 8,
  "productos_sucursal_posadas.json": 21,
  "productos_sucursal_salta.json": 9,
  "productos_sucursal_sanjuan.json": 16,
  "productos_sucursal_santafe.json": 5,
  "productos_sucursal_trelew.json": 22,
};

export const SUCURSAL_ID_A_ARCHIVO: Record<number, string> = Object.entries(
  ARCHIVO_A_SUCURSAL_ID
).reduce((acc, [filename, sucursalId]) => {
  acc[sucursalId] = filename;
  return acc;
}, {} as Record<number, string>);

/**
 * Obtener sucursal_id por nombre de archivo
 */
export function getSucursalIdByFilename(filename: string): number | null {
  return ARCHIVO_A_SUCURSAL_ID[filename] || null;
}
