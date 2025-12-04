
export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
  image?: string;
  updatedAt: string;
  defaultBulkSize?: number; // Configurable default for units per box
}

export interface Debt {
  id: string;
  debtorName: string;
  amount: number;
  description: string;
  dueDate: string;
  isPaid: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'entrada' | 'venta' | 'ajuste' | 'devolucion' | 'consignacion';
  quantity: number;
  date: string;
  note?: string;
}

export interface SystemConfig {
  currencySymbol: string;
  taxRate: number;
  categories: string[];
  shopName: string;
  enableLowStockWarning: boolean;
  lowStockThreshold: number;
  googleDriveClientId?: string; // Client ID for Google Auth
  googleDriveBackupFileId?: string; // ID of the file in Drive
  googleDriveFolderId?: string; // ID of the specific folder in Drive
  lastSync?: string; // Timestamp of last successful sync
}

export interface CartItem {
  quantity: number;
  customPrice: number; // Allows overriding the default price
  isBulk: boolean;     // Toggle for selling by box/pack
  bulkSize: number;    // How many units are in the box/pack
}

export type ViewState = 'dashboard' | 'inventory' | 'debts' | 'settings';

export const DEFAULT_CONFIG: SystemConfig = {
  currencySymbol: '$',
  taxRate: 0.16,
  categories: ['General', 'Electrónica', 'Alimentos', 'Ropa', 'Hogar'],
  shopName: 'Mi Negocio',
  enableLowStockWarning: true,
  lowStockThreshold: 5
};
