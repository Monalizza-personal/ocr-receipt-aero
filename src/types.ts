export interface ExpenseItem {
  id?: string;
  description: string;
  originalDescription?: string;
  quantity: number;
  unitPrice: number;
  vatAmount?: number;
  totalAmount?: number;
  category?: string;
  productChoice?: string;
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
  createdAt?: number;
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
