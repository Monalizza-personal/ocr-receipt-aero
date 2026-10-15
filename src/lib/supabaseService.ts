import { getSupabaseClient } from "./supabase";
import { ExpenseReceipt, ExpenseItem } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCT_CHOICES } from "../data/seedData";

export const STORAGE_BUCKET = "receipt-images";

// In-memory cache for signed URLs to prevent excessive RPC calls
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Resolves a signed URL for a private storage image in the receipt-images bucket.
 * If the path is already an external URL or data URL, it returns it directly.
 */
export async function getSignedReceiptImageUrl(
  storagePathOrUrl?: string | null
): Promise<string | undefined> {
  if (!storagePathOrUrl) return undefined;

  // If it's already an http/https URL that is not an expired signed url, or a data: url
  if (
    storagePathOrUrl.startsWith("data:") ||
    storagePathOrUrl.startsWith("blob:")
  ) {
    return storagePathOrUrl;
  }

  // If it's a full URL containing a Supabase public or signed URL, check if valid
  if (storagePathOrUrl.startsWith("http://") || storagePathOrUrl.startsWith("https://")) {
    return storagePathOrUrl;
  }

  // It's a relative storage path (e.g. "USER_ID/filename.jpg")
  const cached = signedUrlCache.get(storagePathOrUrl);
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  const client = getSupabaseClient();
  if (!client) return storagePathOrUrl;

  try {
    // Create a 2-hour authenticated signed URL for private bucket access
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePathOrUrl, 7200);

    if (error || !data?.signedUrl) {
      console.warn("Could not generate signed URL for storage path:", storagePathOrUrl, error);
      return storagePathOrUrl;
    }

    signedUrlCache.set(storagePathOrUrl, {
      url: data.signedUrl,
      expiresAt: now + 7000 * 1000,
    });
    return data.signedUrl;
  } catch (err) {
    console.warn("Exception generating signed URL:", err);
    return storagePathOrUrl;
  }
}

/**
 * Uploads a file (or base64/blob) to the private receipt-images Supabase Storage bucket.
 * Returns the relative storage path (stored in database) and an authenticated signed URL.
 */
export async function uploadReceiptFileToStorage(
  userId: string,
  receiptId: string,
  fileOrBlobOrDataUrl: File | Blob | string,
  filename?: string
): Promise<{ storagePath: string; signedUrl: string } | null> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase client is not initialized.");
  }

  let uploadBlob: Blob;
  let contentType = "image/jpeg";
  let extension = "jpg";

  if (typeof fileOrBlobOrDataUrl === "string") {
    // If it's a data URL
    if (fileOrBlobOrDataUrl.startsWith("data:")) {
      const parts = fileOrBlobOrDataUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
      extension = contentType.includes("pdf")
        ? "pdf"
        : contentType.includes("png")
        ? "png"
        : "jpg";

      const binaryStr = atob(parts[1]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      uploadBlob = new Blob([bytes], { type: contentType });
    } else {
      // It's already a path or URL
      return null;
    }
  } else if (fileOrBlobOrDataUrl instanceof File) {
    uploadBlob = fileOrBlobOrDataUrl;
    contentType = fileOrBlobOrDataUrl.type || "image/jpeg";
    const nameParts = fileOrBlobOrDataUrl.name.split(".");
    extension = nameParts.length > 1 ? nameParts.pop()!.toLowerCase() : "jpg";
  } else {
    uploadBlob = fileOrBlobOrDataUrl;
    contentType = fileOrBlobOrDataUrl.type || "image/jpeg";
    extension = contentType.includes("pdf") ? "pdf" : "jpg";
  }

  const cleanFilename = (filename || `${receiptId}_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .substring(0, 50);

  // Requirement 5: Store files under USER_ID/unique-filename
  const storagePath = `${userId}/${cleanFilename}.${extension}`;

  const { error: uploadError } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, uploadBlob, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error("Supabase Storage upload error:", uploadError);
    throw new Error(`Failed to upload receipt file to storage: ${uploadError.message}`);
  }

  // Generate initial signed URL
  const { data: signedData, error: signError } = await client.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 7200);

  const signedUrl = signedData?.signedUrl || "";

  if (signedUrl) {
    signedUrlCache.set(storagePath, {
      url: signedUrl,
      expiresAt: Date.now() + 7000 * 1000,
    });
  }

  return { storagePath, signedUrl };
}

/**
 * Fetches all receipts and nested expense items belonging to the authenticated user.
 */
export async function fetchUserReceipts(userId: string): Promise<ExpenseReceipt[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase is not configured.");
  }

  // Fetch receipts and nested expense items
  const { data: rows, error } = await client
    .from("receipts")
    .select(`
      *,
      expense_items (*)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching receipts from Supabase:", error);
    throw error;
  }

  if (!rows || rows.length === 0) {
    return [];
  }

  // Map database rows to ExpenseReceipt and resolve signed URLs in parallel
  const mappedList: ExpenseReceipt[] = await Promise.all(
    rows.map(async (row: any) => {
      // Resolve signed URL for image_url if stored as a private storage path
      let resolvedImageUrl = row.image_url;
      if (
        row.image_url &&
        !row.image_url.startsWith("http") &&
        !row.image_url.startsWith("data:")
      ) {
        resolvedImageUrl = await getSignedReceiptImageUrl(row.image_url);
      }

      // Map nested expense items
      const rawItems = Array.isArray(row.expense_items) ? row.expense_items : [];
      const items: ExpenseItem[] = rawItems.map((it: any) => ({
        id: it.id,
        description: it.description,
        originalDescription: it.original_description || undefined,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unit_price) || 0,
        vatAmount: Number(it.vat_amount) || 0,
        totalAmount: Number(it.total_amount) || 0,
        hasVat: it.has_vat !== false,
        category: it.category || row.category || "Miscellaneous",
        productChoice: it.product_choice || "General Supply",
        uploadRefNo: it.upload_ref_no || row.upload_ref_no || undefined,
      }));

      // Preserve timestamps: created_at represents Upload Date & Time
      const uploadIso = row.uploaded_at || row.created_at || new Date().toISOString();
      const legacyCreatedAt = new Date(uploadIso).getTime();

      const receipt: ExpenseReceipt = {
        id: row.id,
        storeName: row.store_name,
        originalStoreName: row.original_store_name || undefined,
        storeAddress: row.store_address || undefined,
        originalStoreAddress: row.original_store_address || undefined,
        storePhone: row.store_phone || undefined,
        taxId: row.tax_id || undefined,
        invoiceNo: row.invoice_no || undefined,
        uploadRefNo: row.upload_ref_no || undefined,
        date: row.date || new Date().toISOString().split("T")[0],
        time: row.time || undefined,
        currency: row.currency || "SAR",
        items,
        subtotal: Number(row.subtotal) || 0,
        vatTotal: Number(row.vat_total) || 0,
        grandTotal: Number(row.grand_total) || 0,
        category: row.category || "Miscellaneous",
        paymentMethod: row.payment_method || "Cash",
        imageUrl: resolvedImageUrl || undefined,
        thumbnailUrl: resolvedImageUrl || row.thumbnail_url || undefined,
        isPdf: Boolean(row.is_pdf),
        isTranslated: Boolean(row.is_translated),
        notes: row.notes || undefined,
        createdAt: legacyCreatedAt,
        uploadedAt: uploadIso,
      };

      return receipt;
    })
  );

  return mappedList;
}

/**
 * Saves a new receipt and its line items into Supabase.
 * Uploads receipt image to private storage if provided.
 */
export async function saveReceiptToSupabase(
  userId: string,
  receipt: ExpenseReceipt,
  fileOrBlob?: File | Blob
): Promise<ExpenseReceipt> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase client is not initialized.");
  }

  let finalStoragePath: string | undefined = undefined;
  let finalDisplayUrl: string | undefined = receipt.imageUrl;

  // 1. Handle image upload to private Supabase Storage bucket
  if (fileOrBlob) {
    try {
      const uploadRes = await uploadReceiptFileToStorage(
        userId,
        receipt.id,
        fileOrBlob,
        `receipt_${receipt.id}`
      );
      if (uploadRes) {
        finalStoragePath = uploadRes.storagePath;
        finalDisplayUrl = uploadRes.signedUrl;
      }
    } catch (storageErr) {
      console.warn("Storage upload failed, proceeding with database save:", storageErr);
    }
  } else if (receipt.imageUrl && receipt.imageUrl.startsWith("data:")) {
    try {
      const uploadRes = await uploadReceiptFileToStorage(
        userId,
        receipt.id,
        receipt.imageUrl,
        `receipt_${receipt.id}`
      );
      if (uploadRes) {
        finalStoragePath = uploadRes.storagePath;
        finalDisplayUrl = uploadRes.signedUrl;
      }
    } catch (storageErr) {
      console.warn("Base64 storage upload failed, proceeding with database save:", storageErr);
    }
  } else if (receipt.imageUrl && !receipt.imageUrl.startsWith("http")) {
    finalStoragePath = receipt.imageUrl;
  }

  const uploadIso = receipt.uploadedAt || new Date().toISOString();

  // 2. Prepare receipt database payload matching public.receipts table
  const receiptPayload = {
    id: receipt.id,
    user_id: userId,
    store_name: receipt.storeName || "Unknown Merchant",
    original_store_name: receipt.originalStoreName || null,
    store_address: receipt.storeAddress || null,
    original_store_address: receipt.originalStoreAddress || null,
    store_phone: receipt.storePhone || null,
    tax_id: receipt.taxId || null,
    invoice_no: receipt.invoiceNo || null,
    upload_ref_no: receipt.uploadRefNo || null,
    date: receipt.date || new Date().toISOString().split("T")[0],
    time: receipt.time || null,
    currency: receipt.currency || "SAR",
    subtotal: Number(receipt.subtotal) || 0,
    vat_total: Number(receipt.vatTotal) || 0,
    grand_total: Number(receipt.grandTotal) || 0,
    category: receipt.category || "Miscellaneous",
    payment_method: receipt.paymentMethod || "Cash",
    image_url: finalStoragePath || finalDisplayUrl || null,
    thumbnail_url: finalStoragePath || finalDisplayUrl || null,
    is_pdf: Boolean(receipt.isPdf),
    is_translated: Boolean(receipt.isTranslated),
    notes: receipt.notes || null,
    uploaded_at: uploadIso,
    created_at: uploadIso,
    updated_at: new Date().toISOString(),
  };

  // Upsert receipt to prevent duplicates
  const { error: receiptError } = await client
    .from("receipts")
    .upsert(receiptPayload, { onConflict: "id" });

  if (receiptError) {
    console.error("Error inserting receipt in Supabase:", receiptError);
    throw new Error(`Failed to save receipt: ${receiptError.message}`);
  }

  // 3. Insert or replace line items in public.expense_items
  if (Array.isArray(receipt.items) && receipt.items.length > 0) {
    // Delete any existing items for this receipt
    await client.from("expense_items").delete().eq("receipt_id", receipt.id);

    const itemsPayload = receipt.items.map((item, idx) => ({
      id: item.id || `item_${receipt.id}_${idx}_${Date.now()}`,
      receipt_id: receipt.id,
      user_id: userId,
      description: item.description || "Expense item",
      original_description: item.originalDescription || null,
      quantity: Number(item.quantity) || 1,
      unit_price: Number(item.unitPrice) || 0,
      vat_amount: Number(item.vatAmount) || 0,
      total_amount:
        Number(item.totalAmount) || (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
      has_vat: item.hasVat !== false,
      category: item.category || receipt.category || "Miscellaneous",
      product_choice: item.productChoice || "General Supply",
      upload_ref_no: item.uploadRefNo || receipt.uploadRefNo || null,
      created_at: uploadIso,
    }));

    const { error: itemsError } = await client.from("expense_items").insert(itemsPayload);

    if (itemsError) {
      console.error("Error inserting expense items in Supabase:", itemsError);
      // Non-fatal, receipt is already saved
    }
  }

  return {
    ...receipt,
    imageUrl: finalDisplayUrl,
    thumbnailUrl: finalDisplayUrl,
    uploadedAt: uploadIso,
  };
}

/**
 * Updates an existing receipt in Supabase, preserving its original upload timestamp.
 */
export async function updateReceiptInSupabase(
  userId: string,
  receipt: ExpenseReceipt
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase client is not initialized.");
  }

  // Preserve existing upload timestamp
  const uploadIso = receipt.uploadedAt || new Date().toISOString();

  const receiptUpdatePayload: any = {
    store_name: receipt.storeName,
    original_store_name: receipt.originalStoreName || null,
    store_address: receipt.storeAddress || null,
    original_store_address: receipt.originalStoreAddress || null,
    store_phone: receipt.storePhone || null,
    tax_id: receipt.taxId || null,
    invoice_no: receipt.invoiceNo || null,
    upload_ref_no: receipt.uploadRefNo || null,
    date: receipt.date,
    time: receipt.time || null,
    currency: receipt.currency || "SAR",
    subtotal: Number(receipt.subtotal) || 0,
    vat_total: Number(receipt.vatTotal) || 0,
    grand_total: Number(receipt.grandTotal) || 0,
    category: receipt.category || "Miscellaneous",
    payment_method: receipt.paymentMethod || "Cash",
    notes: receipt.notes || null,
    is_translated: Boolean(receipt.isTranslated),
    updated_at: new Date().toISOString(),
  };

  // Only update image_url if provided and not a local blob
  if (receipt.imageUrl && !receipt.imageUrl.startsWith("blob:")) {
    receiptUpdatePayload.image_url = receipt.imageUrl;
  }

  const { error: updateError } = await client
    .from("receipts")
    .update(receiptUpdatePayload)
    .eq("id", receipt.id)
    .eq("user_id", userId);

  if (updateError) {
    console.error("Error updating receipt in Supabase:", updateError);
    throw new Error(`Failed to update receipt: ${updateError.message}`);
  }

  // Synchronize line items: delete old items and re-insert updated ones
  if (Array.isArray(receipt.items)) {
    await client.from("expense_items").delete().eq("receipt_id", receipt.id);

    if (receipt.items.length > 0) {
      const itemsPayload = receipt.items.map((item, idx) => ({
        id: item.id || `item_${receipt.id}_${idx}_${Date.now()}`,
        receipt_id: receipt.id,
        user_id: userId,
        description: item.description,
        original_description: item.originalDescription || null,
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unitPrice) || 0,
        vat_amount: Number(item.vatAmount) || 0,
        total_amount:
          Number(item.totalAmount) || (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
        has_vat: item.hasVat !== false,
        category: item.category || receipt.category || "Miscellaneous",
        product_choice: item.productChoice || "General Supply",
        upload_ref_no: item.uploadRefNo || receipt.uploadRefNo || null,
        created_at: uploadIso,
      }));

      await client.from("expense_items").insert(itemsPayload);
    }
  }
}

/**
 * Deletes a receipt and its associated line items (via cascade) from Supabase.
 */
export async function deleteReceiptFromSupabase(
  userId: string,
  receiptId: string
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase client is not initialized.");
  }

  const { error } = await client
    .from("receipts")
    .delete()
    .eq("id", receiptId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting receipt from Supabase:", error);
    throw new Error(`Failed to delete receipt: ${error.message}`);
  }
}

/**
 * Batch saves multiple receipts into Supabase (e.g. from CSV/JSON import or batch sync).
 */
export async function batchSaveReceiptsToSupabase(
  userId: string,
  receipts: ExpenseReceipt[]
): Promise<{ savedCount: number; errors: string[] }> {
  let savedCount = 0;
  const errors: string[] = [];

  for (const receipt of receipts) {
    try {
      await saveReceiptToSupabase(userId, receipt);
      savedCount++;
    } catch (err: any) {
      errors.push(`Receipt "${receipt.storeName}" (${receipt.id}): ${err?.message || "Error"}`);
    }
  }

  return { savedCount, errors };
}

/**
 * Custom Categories Cloud Synchronization
 */
export async function fetchCustomCategoriesFromSupabase(userId: string): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) return DEFAULT_CATEGORIES;

  try {
    const { data, error } = await client
      .from("custom_categories")
      .select("name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return DEFAULT_CATEGORIES;
    }

    const customNames = data.map((d: any) => d.name.trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...customNames]));
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export async function addCustomCategoryToSupabase(
  userId: string,
  categoryName: string
): Promise<void> {
  const client = getSupabaseClient();
  const trimmed = categoryName.trim();
  if (!client || !trimmed) return;

  try {
    await client
      .from("custom_categories")
      .upsert({ user_id: userId, name: trimmed }, { onConflict: "user_id, name" });
  } catch (err) {
    console.warn("Could not save custom category to Supabase:", err);
  }
}

export async function removeCustomCategoryFromSupabase(
  userId: string,
  categoryName: string
): Promise<void> {
  const client = getSupabaseClient();
  const trimmed = categoryName.trim();
  if (!client || !trimmed) return;

  try {
    await client
      .from("custom_categories")
      .delete()
      .eq("user_id", userId)
      .eq("name", trimmed);
  } catch (err) {
    console.warn("Could not remove custom category from Supabase:", err);
  }
}

/**
 * Custom Product Choices Cloud Synchronization
 */
export async function fetchCustomProductChoicesFromSupabase(userId: string): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) return DEFAULT_PRODUCT_CHOICES;

  try {
    const { data, error } = await client
      .from("custom_product_choices")
      .select("name")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error || !data) {
      return DEFAULT_PRODUCT_CHOICES;
    }

    const customChoices = data.map((d: any) => d.name.trim()).filter(Boolean);
    return Array.from(new Set([...DEFAULT_PRODUCT_CHOICES, ...customChoices]));
  } catch {
    return DEFAULT_PRODUCT_CHOICES;
  }
}

export async function addCustomProductChoiceToSupabase(
  userId: string,
  choiceName: string
): Promise<void> {
  const client = getSupabaseClient();
  const trimmed = choiceName.trim();
  if (!client || !trimmed) return;

  try {
    await client
      .from("custom_product_choices")
      .upsert({ user_id: userId, name: trimmed }, { onConflict: "user_id, name" });
  } catch (err) {
    console.warn("Could not save custom product choice to Supabase:", err);
  }
}

export async function removeCustomProductChoiceFromSupabase(
  userId: string,
  choiceName: string
): Promise<void> {
  const client = getSupabaseClient();
  const trimmed = choiceName.trim();
  if (!client || !trimmed) return;

  try {
    await client
      .from("custom_product_choices")
      .delete()
      .eq("user_id", userId)
      .eq("name", trimmed);
  } catch (err) {
    console.warn("Could not remove custom product choice from Supabase:", err);
  }
}
