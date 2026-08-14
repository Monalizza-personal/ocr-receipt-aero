import { ExpenseReceipt } from "../types";

function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

function triggerDownload(csvContent: string, filename: string) {
  // UTF-8 BOM byte order mark
  const blob = new Blob([new Uint8Array([239, 187, 191]), csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportReceiptsCSV(receipts: ExpenseReceipt[]) {
  const headers = [
    "Receipt ID",
    "Merchant / Store Name",
    "Invoice / Receipt #",
    "Transaction Date",
    "Time",
    "Category",
    "Tax ID / VAT #",
    "Items Count",
    "Subtotal Before VAT",
    "VAT / Tax Total",
    "Grand Total",
    "Currency",
    "Payment Method",
    "Store Address",
    "Notes",
  ];

  const rows = receipts.map((r) => [
    escapeCSV(r.id),
    escapeCSV(r.storeName),
    escapeCSV(r.invoiceNo || ""),
    escapeCSV(r.date),
    escapeCSV(r.time || ""),
    escapeCSV(r.category),
    escapeCSV(r.taxId || ""),
    escapeCSV(r.items ? r.items.length : 0),
    escapeCSV(r.subtotal || 0),
    escapeCSV(r.vatTotal || 0),
    escapeCSV(r.grandTotal),
    escapeCSV(r.currency || "SAR"),
    escapeCSV(r.paymentMethod || "Card"),
    escapeCSV(r.storeAddress || ""),
    escapeCSV(r.notes || ""),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().split("T")[0];
  triggerDownload(csv, `kitchen_receipts_ledger_${dateStr}.csv`);
}

export function exportLineItemsCSV(receipts: ExpenseReceipt[]) {
  const headers = [
    "Merchant Store",
    "Date",
    "Invoice #",
    "Item Description",
    "Item Category",
    "Product Choice / Classification",
    "Quantity",
    "Unit Price",
    "VAT Amount",
    "Total Amount",
    "Currency",
    "Parent Receipt ID",
  ];

  const rows: string[][] = [];

  receipts.forEach((r) => {
    (r.items || []).forEach((item) => {
      rows.push([
        escapeCSV(r.storeName),
        escapeCSV(r.date),
        escapeCSV(r.invoiceNo || ""),
        escapeCSV(item.description),
        escapeCSV(item.category || r.category || "General"),
        escapeCSV(item.productChoice || "General"),
        escapeCSV(item.quantity || 1),
        escapeCSV(item.unitPrice || 0),
        escapeCSV(item.vatAmount || 0),
        escapeCSV(item.totalAmount || item.quantity * item.unitPrice),
        escapeCSV(r.currency || "SAR"),
        escapeCSV(r.id),
      ]);
    });
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const dateStr = new Date().toISOString().split("T")[0];
  triggerDownload(csv, `kitchen_line_items_breakdown_${dateStr}.csv`);
}
