import { ExpenseReceipt, ExpenseItem } from "../types";

/**
 * Robust CSV parser supporting commas, semicolons, tabs, multiline quoted strings, and escaped quotes
 */
export function parseCSV(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, ""); // Remove BOM if present

  // Auto-detect delimiter from the first non-empty line
  const firstLine = cleanText.split(/\r\n|\r|\n/).find((l) => l.trim().length > 0) || "";
  let delimiter = ",";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ";";
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = "\t";
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = "";
      } else if (char === "\r" || char === "\n") {
        currentRow.push(currentVal.trim());
        currentVal = "";
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        if (char === "\r" && nextChar === "\n") {
          i++; // Skip LF after CR
        }
      } else {
        currentVal += char;
      }
    }
  }

  // Final flush
  currentRow.push(currentVal.trim());
  if (currentRow.some((field) => field.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Standardize numeric amounts with currency symbols and commas
 */
function cleanNumber(val: any): number {
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Standardize dates into YYYY-MM-DD
 */
function normalizeDate(val?: string): string {
  if (!val) return new Date().toISOString().split("T")[0];
  const str = val.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  // Check DD/MM/YYYY or MM/DD/YYYY
  const slashParts = str.split(/[/.-]/);
  if (slashParts.length === 3) {
    if (slashParts[0].length === 4) {
      // YYYY/MM/DD
      return `${slashParts[0]}-${slashParts[1].padStart(2, "0")}-${slashParts[2].padStart(2, "0")}`;
    }
    if (slashParts[2].length === 4) {
      // DD/MM/YYYY
      return `${slashParts[2]}-${slashParts[1].padStart(2, "0")}-${slashParts[0].padStart(2, "0")}`;
    }
  }
  const timestamp = Date.parse(str);
  if (!isNaN(timestamp)) {
    return new Date(timestamp).toISOString().split("T")[0];
  }
  return new Date().toISOString().split("T")[0];
}

/**
 * Parse imported JSON or CSV file into ExpenseReceipt array
 */
export function parseImportedReceiptsFile(fileContent: string, filename = ""): ExpenseReceipt[] {
  const trimmed = fileContent.trim();
  if (!trimmed) throw new Error("The imported file is empty.");

  // 1. Try parsing as JSON
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.receipts)) list = parsed.receipts;
        else if (Array.isArray(parsed.data)) list = parsed.data;
        else if (Array.isArray(parsed.expenses)) list = parsed.expenses;
        else if (Array.isArray(parsed.items) && parsed.items[0]?.storeName) list = parsed.items;
        else list = [parsed];
      }

      const validReceipts: ExpenseReceipt[] = [];

      for (const item of list) {
        if (item && typeof item === "object") {
          const grandTotal = cleanNumber(item.grandTotal ?? item.totalAmount ?? item.amount ?? item.total ?? 0);
          const vatTotal = cleanNumber(item.vatTotal ?? item.tax ?? (grandTotal > 0 ? grandTotal - grandTotal / 1.15 : 0));
          const subtotal = cleanNumber(item.subtotal ?? (grandTotal - vatTotal));

          validReceipts.push({
            id: item.id || `imp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            storeName: item.storeName || item.merchantName || item.storeNameEn || item.vendor || item.store || "Imported Receipt",
            originalStoreName: item.originalStoreName || item.storeName || item.merchantName || item.storeNameEn || "Imported Receipt",
            storeAddress: item.storeAddress || item.address || "",
            originalStoreAddress: item.originalStoreAddress || item.storeAddress || "",
            storePhone: item.storePhone || item.phone || "",
            taxId: item.taxId || item.vatNo || "",
            invoiceNo: item.invoiceNo || item.invoice || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
            date: normalizeDate(item.date),
            time: item.time || "12:00",
            currency: item.currency || "SAR",
            category: item.category || "Food & Dining",
            paymentMethod: item.paymentMethod || "Card",
            subtotal,
            vatTotal,
            grandTotal,
            notes: item.notes || `Imported from ${filename || "file"}`,
            isTranslated: Boolean(item.isTranslated),
            items: Array.isArray(item.items) && item.items.length > 0
              ? item.items.map((it: any, idx: number) => ({
                  id: it.id || `item_${idx}_${Date.now()}`,
                  description: it.description || it.descriptionEn || it.name || "Item",
                  originalDescription: it.originalDescription || it.description,
                  quantity: cleanNumber(it.quantity) || 1,
                  unitPrice: cleanNumber(it.unitPrice) || 0,
                  vatAmount: cleanNumber(it.vatAmount) || 0,
                  totalAmount: cleanNumber(it.totalAmount) || (cleanNumber(it.quantity) || 1) * (cleanNumber(it.unitPrice) || 0),
                  category: it.category || item.category || "General",
                  productChoice: it.productChoice || "Supply",
                }))
              : [
                  {
                    id: `item_0_${Date.now()}`,
                    description: item.storeName || item.merchantName || "Expense Total",
                    quantity: 1,
                    unitPrice: grandTotal,
                    vatAmount: vatTotal,
                    totalAmount: grandTotal,
                    category: item.category || "Food & Dining",
                    productChoice: "General Supply",
                  },
                ],
            imageUrl: item.imageUrl,
            thumbnailUrl: item.thumbnailUrl,
            isPdf: Boolean(item.isPdf),
            createdAt: item.createdAt || Date.now(),
          });
        }
      }

      if (validReceipts.length > 0) return validReceipts;
    } catch {
      // Fall through to CSV parsing
    }
  }

  // 2. Parse as CSV
  const table = parseCSV(trimmed);
  if (table.length < 2) {
    throw new Error("CSV file must contain a header row and at least one data row.");
  }

  const rawHeaders = table[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const dataRows = table.slice(1);

  // Check if it's Line Items CSV: "merchantstore", "itemdescription", etc.
  const isLineItemsCSV = rawHeaders.includes("itemdescription") && (rawHeaders.includes("parentreceiptid") || rawHeaders.includes("unitprice"));

  if (isLineItemsCSV) {
    const storeIdx = rawHeaders.findIndex((h) => h.includes("merchant") || h.includes("store"));
    const dateIdx = rawHeaders.findIndex((h) => h.includes("date"));
    const invIdx = rawHeaders.findIndex((h) => h.includes("invoice"));
    const descIdx = rawHeaders.findIndex((h) => h.includes("itemdescription") || h.includes("description"));
    const catIdx = rawHeaders.findIndex((h) => h.includes("category"));
    const prodIdx = rawHeaders.findIndex((h) => h.includes("product"));
    const qtyIdx = rawHeaders.findIndex((h) => h.includes("qty") || h.includes("quantity"));
    const unitPriceIdx = rawHeaders.findIndex((h) => h.includes("unitprice") || h.includes("price"));
    const vatIdx = rawHeaders.findIndex((h) => h.includes("vat"));
    const totalIdx = rawHeaders.findIndex((h) => h.includes("totalamount") || h.includes("total"));
    const currIdx = rawHeaders.findIndex((h) => h.includes("currency"));
    const parentIdIdx = rawHeaders.findIndex((h) => h.includes("parentreceiptid"));

    const grouped = new Map<string, { store: string; date: string; invoiceNo: string; currency: string; items: ExpenseItem[] }>();

    for (const row of dataRows) {
      const store = (storeIdx >= 0 ? row[storeIdx] : "") || "Imported Merchant";
      const date = (dateIdx >= 0 ? row[dateIdx] : "") || new Date().toISOString().split("T")[0];
      const invoiceNo = (invIdx >= 0 ? row[invIdx] : "") || "";
      const groupKey = parentIdIdx >= 0 && row[parentIdIdx] ? row[parentIdIdx] : `${store}_${date}_${invoiceNo}`;
      const currency = (currIdx >= 0 ? row[currIdx] : "") || "SAR";

      const qty = qtyIdx >= 0 ? cleanNumber(row[qtyIdx]) || 1 : 1;
      const unitPrice = unitPriceIdx >= 0 ? cleanNumber(row[unitPriceIdx]) || 0 : 0;
      const totalAmount = totalIdx >= 0 ? cleanNumber(row[totalIdx]) || qty * unitPrice : qty * unitPrice;
      const vatAmount = vatIdx >= 0 ? cleanNumber(row[vatIdx]) || 0 : 0;

      const item: ExpenseItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        description: (descIdx >= 0 ? row[descIdx] : "") || "Item",
        category: (catIdx >= 0 ? row[catIdx] : "") || "Food & Dining",
        productChoice: (prodIdx >= 0 ? row[prodIdx] : "") || "General Supply",
        quantity: qty,
        unitPrice,
        vatAmount,
        totalAmount,
      };

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { store, date, invoiceNo, currency, items: [item] });
      } else {
        grouped.get(groupKey)!.items.push(item);
      }
    }

    const result: ExpenseReceipt[] = [];
    grouped.forEach((val, key) => {
      const grandTotal = val.items.reduce((acc, it) => acc + (it.totalAmount || 0), 0);
      const vatTotal = val.items.reduce((acc, it) => acc + (it.vatAmount || 0), 0);
      const subtotal = Math.max(0, grandTotal - vatTotal);

      result.push({
        id: key.startsWith("rec_") ? key : `rec_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        storeName: val.store,
        originalStoreName: val.store,
        invoiceNo: val.invoiceNo || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
        date: normalizeDate(val.date),
        time: "12:00",
        currency: val.currency || "SAR",
        category: val.items[0]?.category || "Food & Dining",
        paymentMethod: "Card",
        subtotal,
        vatTotal,
        grandTotal,
        notes: `Imported line items (${val.items.length} items)`,
        items: val.items,
        createdAt: Date.now(),
      });
    });

    if (result.length > 0) return result;
  }

  // Standard Receipts CSV
  const storeIdx = rawHeaders.findIndex((h) => h.includes("merchant") || h.includes("store") || h.includes("vendor") || h.includes("name") || h.includes("supplier"));
  const dateIdx = rawHeaders.findIndex((h) => h.includes("date") || h.includes("time"));
  const grandTotalIdx = rawHeaders.findIndex((h) => h.includes("grandtotal") || h.includes("total") || h.includes("amount") || h.includes("cost") || h.includes("paid"));
  const subtotalIdx = rawHeaders.findIndex((h) => h.includes("subtotal") || h.includes("beforevat"));
  const vatIdx = rawHeaders.findIndex((h) => h.includes("vat") || h.includes("tax"));
  const categoryIdx = rawHeaders.findIndex((h) => h.includes("category"));
  const invoiceIdx = rawHeaders.findIndex((h) => h.includes("invoice") || h.includes("receipt") || h.includes("bill") || h.includes("ref"));
  const currencyIdx = rawHeaders.findIndex((h) => h.includes("currency"));
  const paymentIdx = rawHeaders.findIndex((h) => h.includes("payment") || h.includes("method"));
  const taxIdIdx = rawHeaders.findIndex((h) => h.includes("taxid") || h.includes("vatno") || h.includes("vat#"));
  const addressIdx = rawHeaders.findIndex((h) => h.includes("address") || h.includes("location"));
  const notesIdx = rawHeaders.findIndex((h) => h.includes("notes") || h.includes("description") || h.includes("memo"));

  const parsedReceipts: ExpenseReceipt[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    const storeName = (storeIdx >= 0 ? row[storeIdx] : "") || `Receipt #${idx + 1}`;
    const rawDate = dateIdx >= 0 ? row[dateIdx] : "";
    const dateVal = normalizeDate(rawDate);
    const grandTotal = grandTotalIdx >= 0 ? cleanNumber(row[grandTotalIdx]) : 0;
    const vatTotal = vatIdx >= 0 ? cleanNumber(row[vatIdx]) : grandTotal * 0.15;
    const subtotal = subtotalIdx >= 0 ? cleanNumber(row[subtotalIdx]) : Math.max(0, grandTotal - vatTotal);

    parsedReceipts.push({
      id: `rec_imp_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      storeName,
      originalStoreName: storeName,
      invoiceNo: (invoiceIdx >= 0 ? row[invoiceIdx] : "") || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      date: dateVal,
      time: "12:00",
      category: (categoryIdx >= 0 ? row[categoryIdx] : "") || "Food & Dining",
      taxId: taxIdIdx >= 0 ? row[taxIdIdx] : "",
      currency: (currencyIdx >= 0 ? row[currencyIdx] : "") || "SAR",
      paymentMethod: (paymentIdx >= 0 ? row[paymentIdx] : "") || "Card",
      storeAddress: addressIdx >= 0 ? row[addressIdx] : "",
      subtotal,
      vatTotal,
      grandTotal,
      notes: (notesIdx >= 0 ? row[notesIdx] : "") || `Imported from CSV (${filename || "data"})`,
      items: [
        {
          id: `item_${Date.now()}_${idx}`,
          description: storeName,
          quantity: 1,
          unitPrice: grandTotal,
          vatAmount: vatTotal,
          totalAmount: grandTotal,
          category: (categoryIdx >= 0 ? row[categoryIdx] : "") || "Food & Dining",
          productChoice: "Imported Expense",
        },
      ],
      createdAt: Date.now(),
    });
  }

  if (parsedReceipts.length === 0) {
    throw new Error("No readable receipt data could be parsed from this file.");
  }

  return parsedReceipts;
}
