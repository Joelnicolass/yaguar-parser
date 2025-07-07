export interface SyncStatus {
  status:
    | "IDLE"
    | "CONNECTING"
    | "DOWNLOADING"
    | "PARSING"
    | "GENERATING"
    | "COMPLETED"
    | "ERROR";
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

export interface LogConfig {
  level: string;
  maxSize: string;
  maxFiles: number;
  dir: string;
}
