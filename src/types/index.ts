export enum SyncStatusEnum {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  DOWNLOADING = "DOWNLOADING",
  PARSING = "PARSING",
  GENERATING = "GENERATING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

export interface SyncStatus {
  status: SyncStatusEnum;
  lastSync?: Date;
  nextSync?: Date;
  message?: string;
  recordsProcessed?: number;
  fileSize?: number;
  duration?: number;
}

export interface SyncResult {
  success: boolean;
  timestamp: Date;
  recordsProcessed: number;
  fileSize: number;
  duration: number;
  error?: string;
}

export interface DatabaseRecord {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  stock?: number;
  [key: string]: any;
}

export interface WooCommerceProduct {
  id?: string;
  name: string;
  type: "simple" | "variable" | "grouped" | "external";
  regular_price: string;
  description?: string;
  short_description?: string;
  categories?: Array<{ id: number; name: string }>;
  stock_quantity?: number;
  manage_stock: boolean;
  in_stock: boolean;
  [key: string]: any;
}

export interface FTPConfig {
  host: string;
  user: string;
  password: string;
  port: number;
  secure: boolean;
}

export interface SFTPConfig {
  host: string;
  user: string;
  password: string;
  port: number;
  remotePath: string;
  filePattern: string;
  timeout: number;
}

export interface SFTPConnectionResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface SFTPDownloadResult {
  success: boolean;
  fileName: string;
  localPath: string;
  fileSize: number;
  downloadTime: number;
  error?: string;
}

export interface LogConfig {
  level: string;
  maxSize: string;
  maxFiles: number;
  dir: string;
}

/**
 * Types para el servicio de parser
 */

export interface ParsedProduct {
  sku: string;
  name: string;
  price: string;
  stock: string;
  category: string;
}

export interface ParserResult {
  success: boolean;
  productsCount: number;
  filePath?: string;
  outputPath?: string;
  duration: number;
  error?: string;
  products?: ParsedProduct[];
}

export interface ParserConfig {
  inputPath: string;
  outputFormat: "json" | "csv" | "both";
  outputDir: string;
  cleanProductNames: boolean;
  validateData: boolean;
}
