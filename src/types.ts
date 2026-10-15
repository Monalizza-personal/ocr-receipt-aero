export interface ExpenseItem {
  id?: string;
  description: string;
  originalDescription?: string;
  quantity: number;
  unitPrice: number;
  vatAmount?: number;
  totalAmount?: number;
  hasVat?: boolean;
  category?: string;
  productChoice?: string;
  uploadRefNo?: string;
}

export interface ExpenseReceipt {
  id: string;
  storeName: string;
  originalStoreName?: string;
  storeAddress?: string;
  originalStoreAddress?: string;
  storePhone?: string;
  taxId?: string;
  invoiceNo?: string;
  uploadRefNo?: string; // Upload File Reference Number (e.g. UPL-20261007-001)
  date: string;
  time?: string;
  currency: string;
  items: ExpenseItem[];
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  category: string;
  paymentMethod: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  isPdf?: boolean;
  isTranslated?: boolean;
  notes?: string;
  createdAt?: number; // Legacy epoch ms timestamp
  uploadedAt?: string; // ISO 8601 UTC upload timestamp (e.g. 2026-10-15T04:15:30.000Z)
}

export interface CategorySummary {
  category: string;
  totalAmount: number;
  count: number;
  color: string;
}

export interface MonthlyBurnSummary {
  month: string;
  subtotal: number;
  vat: number;
  grandTotal: number;
  receiptsCount: number;
}

export type ViewTab = "receipts" | "items";
