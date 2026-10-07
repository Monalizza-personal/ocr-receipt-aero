import { ExpenseItem, ExpenseReceipt } from "../types";

export const STANDARD_VAT_RATE = 0.15; // 15% Saudi Standard VAT

/**
 * Checks whether an item currently has VAT applied.
 */
export function isItemVatApplicable(item: ExpenseItem): boolean {
  if (typeof item.hasVat === "boolean") {
    return item.hasVat;
  }
  // Fallback: check if vatAmount exists and is positive
  return (Number(item.vatAmount) || 0) > 0.001;
}

/**
 * Amends an item's VAT classification without changing its total billed amount.
 * - When switched to "No VAT": vatAmount becomes 0, unitPrice absorbs the total, totalAmount is strictly preserved.
 * - When switched to "Got VAT": pre-tax base is derived from totalAmount (total / 1.15), vatAmount is 15%, totalAmount is strictly preserved.
 */
export function toggleItemVat(item: ExpenseItem, newHasVat: boolean): ExpenseItem {
  const qty = Math.max(1, Number(item.quantity) || 1);
  const currentTotal =
    Number(item.totalAmount) ||
    Number(((Number(item.unitPrice) || 0) * qty + (Number(item.vatAmount) || 0)).toFixed(2));

  if (!newHasVat) {
    // 0% VAT / Exempt
    return {
      ...item,
      hasVat: false,
      vatAmount: 0,
      unitPrice: Number((currentTotal / qty).toFixed(2)),
      totalAmount: Number(currentTotal.toFixed(2)),
    };
  }

  // 15% Standard VAT
  const preTaxTotal = Number((currentTotal / (1 + STANDARD_VAT_RATE)).toFixed(2));
  const vatAmount = Number((currentTotal - preTaxTotal).toFixed(2));
  const unitPrice = Number((preTaxTotal / qty).toFixed(2));

  return {
    ...item,
    hasVat: true,
    vatAmount,
    unitPrice,
    totalAmount: Number(currentTotal.toFixed(2)),
  };
}

/**
 * Recalculates receipt totals based on its item lines.
 * The grand total preserves the sum of all item total amounts.
 */
export function recalculateReceiptTotals(items: ExpenseItem[] = []): {
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
} {
  const safeItems = Array.isArray(items) ? items : [];

  const vatTotal = safeItems.reduce((acc, it) => acc + (Number(it.vatAmount) || 0), 0);

  const grandTotal = safeItems.reduce((acc, it) => {
    const itTotal =
      Number(it.totalAmount) ||
      (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1) + (Number(it.vatAmount) || 0);
    return acc + itTotal;
  }, 0);

  const roundedGrand = Number(grandTotal.toFixed(2));
  const roundedVat = Number(vatTotal.toFixed(2));
  const roundedSubtotal = Number((roundedGrand - roundedVat).toFixed(2));

  return {
    subtotal: roundedSubtotal,
    vatTotal: roundedVat,
    grandTotal: roundedGrand,
  };
}
