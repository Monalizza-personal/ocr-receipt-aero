import { ExpenseReceipt } from "../types";

/**
 * Formats date as YYYYMMDD for clean, standard reference numbering
 */
export function getFormattedDateForRef(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Generates the next sequential Upload File Ref No based on existing receipts in the ledger.
 * Format: UPL-YYYYMMDD-001 (e.g. UPL-20261007-001)
 */
export function generateNextUploadRefNo(
  existingReceipts: ExpenseReceipt[] = [],
  prefix: string = "UPL"
): string {
  const dateStr = getFormattedDateForRef();
  const targetPrefix = `${prefix.trim().toUpperCase()}-${dateStr}-`;

  let maxSeq = 0;

  for (const receipt of existingReceipts) {
    if (!receipt.uploadRefNo) continue;
    const ref = receipt.uploadRefNo.trim().toUpperCase();
    if (ref.startsWith(targetPrefix)) {
      const seqStr = ref.substring(targetPrefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    } else if (ref.startsWith(`${prefix.trim().toUpperCase()}-`)) {
      // Also match non-date or older formats: UPL-001
      const parts = ref.split("-");
      const lastPart = parts[parts.length - 1];
      const seqNum = parseInt(lastPart, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = Math.max(maxSeq, seqNum);
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${prefix.trim().toUpperCase()}-${dateStr}-${nextSeq}`;
}

/**
 * Clean & sanitize user-entered or auto-assigned Upload Ref No
 */
export function sanitizeUploadRefNo(ref?: string): string {
  if (!ref) return "";
  return ref.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

/**
 * Returns distinct upload reference numbers with receipt count and totals
 */
export interface UploadBundleSummary {
  refNo: string;
  count: number;
  totalAmount: number;
  date?: string;
  merchants: string[];
}

export function getAllUploadBundles(receipts: ExpenseReceipt[] = []): UploadBundleSummary[] {
  const map = new Map<string, { count: number; totalAmount: number; date?: string; merchants: Set<string> }>();

  for (const r of receipts) {
    const ref = r.uploadRefNo?.trim();
    if (!ref) continue;

    const entry = map.get(ref) || {
      count: 0,
      totalAmount: 0,
      date: r.date,
      merchants: new Set<string>(),
    };

    entry.count += 1;
    entry.totalAmount += Number(r.grandTotal) || 0;
    if (r.storeName) entry.merchants.add(r.storeName);
    if (!entry.date && r.date) entry.date = r.date;

    map.set(ref, entry);
  }

  const results: UploadBundleSummary[] = [];
  map.forEach((val, key) => {
    results.push({
      refNo: key,
      count: val.count,
      totalAmount: val.totalAmount,
      date: val.date,
      merchants: Array.from(val.merchants).slice(0, 3),
    });
  });

  // Sort newest or highest sequence first
  return results.sort((a, b) => b.refNo.localeCompare(a.refNo));
}
