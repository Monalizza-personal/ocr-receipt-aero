import { ExpenseReceipt } from "../types";

/**
 * Standard Malaysia Timezone identifier
 * UTC+8 (MYT)
 */
export const MALAYSIA_TIMEZONE = "Asia/Kuala_Lumpur";

/**
 * Resolves the upload ISO 8601 UTC timestamp for any receipt.
 * Preserves existing uploadedAt or falls back to legacy createdAt without modifying them.
 */
export function getReceiptUploadIso(
  receipt?: Partial<ExpenseReceipt> | null
): string {
  if (!receipt) return new Date().toISOString();

  // 1. If uploadedAt is already set as an ISO string, use it
  if (receipt.uploadedAt && typeof receipt.uploadedAt === "string") {
    const parsed = new Date(receipt.uploadedAt);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  // 2. Backward compatibility: Fallback to existing createdAt timestamp (number or string)
  if (receipt.createdAt !== undefined && receipt.createdAt !== null) {
    const parsed = new Date(receipt.createdAt);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  // 3. Fallback to receipt date if valid
  if (receipt.date) {
    const parsed = new Date(receipt.date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

/**
 * Returns epoch timestamp (ms) for sorting receipts by upload date & time
 */
export function getReceiptUploadTimestamp(
  receipt?: Partial<ExpenseReceipt> | null
): number {
  if (!receipt) return 0;
  if (receipt.uploadedAt) {
    const time = new Date(receipt.uploadedAt).getTime();
    if (!isNaN(time)) return time;
  }
  if (receipt.createdAt) {
    const time = new Date(receipt.createdAt).getTime();
    if (!isNaN(time)) return time;
  }
  if (receipt.date) {
    const time = new Date(receipt.date).getTime();
    if (!isNaN(time)) return time;
  }
  return 0;
}

/**
 * Formats a timestamp into Malaysia local Date (Asia/Kuala_Lumpur)
 * Example output: "15 Oct 2026" or "18 May 2025"
 */
export function formatMalaysiaDate(
  isoOrTimestamp?: string | number | Date | null
): string {
  if (!isoOrTimestamp) return "—";
  try {
    const dateObj =
      typeof isoOrTimestamp === "string" || typeof isoOrTimestamp === "number"
        ? new Date(isoOrTimestamp)
        : isoOrTimestamp;

    if (isNaN(dateObj.getTime())) return "—";

    return new Intl.DateTimeFormat("en-MY", {
      timeZone: MALAYSIA_TIMEZONE,
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(dateObj);
  } catch (err) {
    console.error("Error formatting Malaysia date:", err);
    return "—";
  }
}

/**
 * Formats a timestamp into Malaysia local Time (Asia/Kuala_Lumpur)
 * Example output: "12:15 PM" or "12:15:30 PM"
 */
export function formatMalaysiaTime(
  isoOrTimestamp?: string | number | Date | null,
  includeSeconds: boolean = false
): string {
  if (!isoOrTimestamp) return "—";
  try {
    const dateObj =
      typeof isoOrTimestamp === "string" || typeof isoOrTimestamp === "number"
        ? new Date(isoOrTimestamp)
        : isoOrTimestamp;

    if (isNaN(dateObj.getTime())) return "—";

    return new Intl.DateTimeFormat("en-MY", {
      timeZone: MALAYSIA_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      ...(includeSeconds ? { second: "2-digit" } : {}),
      hour12: true,
    }).format(dateObj);
  } catch (err) {
    console.error("Error formatting Malaysia time:", err);
    return "—";
  }
}

/**
 * Formats date and time together with Malaysia timezone annotation
 * Example: { date: "15 Oct 2026", time: "12:15:30 PM", full: "15 Oct 2026, 12:15:30 PM (MYT)" }
 */
export function formatMalaysiaDateTime(
  isoOrTimestamp?: string | number | Date | null
): { date: string; time: string; full: string } {
  const date = formatMalaysiaDate(isoOrTimestamp);
  const time = formatMalaysiaTime(isoOrTimestamp, true);
  if (date === "—" && time === "—") {
    return { date: "—", time: "—", full: "—" };
  }
  return {
    date,
    time,
    full: `${date}, ${time} (MYT)`,
  };
}

/**
 * Returns date in YYYY-MM-DD format based on Malaysia timezone (Asia/Kuala_Lumpur).
 * Matches HTML `<input type="date" />` values for exact range filtering.
 */
export function getMalaysiaDateYMD(
  isoOrTimestamp?: string | number | Date | null
): string {
  if (!isoOrTimestamp) return "";
  try {
    const dateObj =
      typeof isoOrTimestamp === "string" || typeof isoOrTimestamp === "number"
        ? new Date(isoOrTimestamp)
        : isoOrTimestamp;

    if (isNaN(dateObj.getTime())) return "";

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: MALAYSIA_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
  } catch {
    return "";
  }
}
