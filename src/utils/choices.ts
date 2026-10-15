import { DEFAULT_PRODUCT_CHOICES, DEFAULT_CATEGORIES } from "../data/seedData";
import { getSupabaseClient } from "../lib/supabase";

const CUSTOM_CHOICES_STORAGE_KEY = "aistudio_custom_product_choices";
const CUSTOM_CATEGORIES_STORAGE_KEY = "aistudio_custom_categories";

// In-memory cache
let inMemoryCategories: string[] | null = null;
let inMemoryChoices: string[] | null = null;

export function getStoredProductChoices(): string[] {
  if (inMemoryChoices) return inMemoryChoices;
  try {
    const saved = localStorage.getItem(CUSTOM_CHOICES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        inMemoryChoices = Array.from(
          new Set([...DEFAULT_PRODUCT_CHOICES, ...parsed.map((s) => String(s).trim()).filter(Boolean)])
        );
        return inMemoryChoices;
      }
    }
  } catch {}
  inMemoryChoices = DEFAULT_PRODUCT_CHOICES;
  return inMemoryChoices;
}

export function saveCustomProductChoice(newChoice: string, userId?: string): string[] {
  const trimmed = newChoice.trim();
  if (!trimmed) return getStoredProductChoices();
  try {
    const saved = localStorage.getItem(CUSTOM_CHOICES_STORAGE_KEY);
    const existing: string[] = saved ? JSON.parse(saved) : [];
    if (!existing.includes(trimmed)) {
      existing.push(trimmed);
      localStorage.setItem(CUSTOM_CHOICES_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch {}

  inMemoryChoices = Array.from(new Set([...(inMemoryChoices || DEFAULT_PRODUCT_CHOICES), trimmed]));

  // Sync to Supabase if userId is provided or active
  if (userId) {
    const client = getSupabaseClient();
    if (client) {
      client
        .from("custom_product_choices")
        .upsert({ user_id: userId, name: trimmed }, { onConflict: "user_id, name" })
        .then(
          () => {},
          (err) => console.warn("Supabase choice save error:", err)
        );
    }
  }

  return inMemoryChoices;
}

export function getStoredCategories(): string[] {
  if (inMemoryCategories) return inMemoryCategories;
  try {
    const saved = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        inMemoryCategories = Array.from(
          new Set([...DEFAULT_CATEGORIES, ...parsed.map((s) => String(s).trim()).filter(Boolean)])
        );
        return inMemoryCategories;
      }
    }
  } catch {}
  inMemoryCategories = DEFAULT_CATEGORIES;
  return inMemoryCategories;
}

export function saveCustomCategory(newCategory: string, userId?: string): string[] {
  const trimmed = newCategory.trim();
  if (!trimmed) return getStoredCategories();
  try {
    const saved = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    const existing: string[] = saved ? JSON.parse(saved) : [];
    if (!existing.includes(trimmed)) {
      existing.push(trimmed);
      localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(existing));
    }
  } catch {}

  inMemoryCategories = Array.from(new Set([...(inMemoryCategories || DEFAULT_CATEGORIES), trimmed]));

  // Sync to Supabase if userId is provided
  if (userId) {
    const client = getSupabaseClient();
    if (client) {
      client
        .from("custom_categories")
        .upsert({ user_id: userId, name: trimmed }, { onConflict: "user_id, name" })
        .then(
          () => {},
          (err) => console.warn("Supabase category save error:", err)
        );
    }
  }

  return inMemoryCategories;
}

export function getCustomOnlyProductChoices(): string[] {
  try {
    const saved = localStorage.getItem(CUSTOM_CHOICES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    }
  } catch {}
  return [];
}

export function deleteCustomProductChoice(choiceToDelete: string, userId?: string): string[] {
  const trimmed = choiceToDelete.trim();
  try {
    const saved = localStorage.getItem(CUSTOM_CHOICES_STORAGE_KEY);
    const existing: string[] = saved ? JSON.parse(saved) : [];
    const updated = existing.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
    localStorage.setItem(CUSTOM_CHOICES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  if (inMemoryChoices) {
    inMemoryChoices = inMemoryChoices.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
  }

  if (userId) {
    const client = getSupabaseClient();
    if (client) {
      client
        .from("custom_product_choices")
        .delete()
        .eq("user_id", userId)
        .eq("name", trimmed)
        .then(
          () => {},
          (err) => console.warn("Supabase choice delete error:", err)
        );
    }
  }

  return getStoredProductChoices();
}

export function getCustomOnlyCategories(): string[] {
  try {
    const saved = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    }
  } catch {}
  return [];
}

export function deleteCustomCategory(categoryToDelete: string, userId?: string): string[] {
  const trimmed = categoryToDelete.trim();
  try {
    const saved = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    const existing: string[] = saved ? JSON.parse(saved) : [];
    const updated = existing.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}

  if (inMemoryCategories) {
    inMemoryCategories = inMemoryCategories.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
  }

  if (userId) {
    const client = getSupabaseClient();
    if (client) {
      client
        .from("custom_categories")
        .delete()
        .eq("user_id", userId)
        .eq("name", trimmed)
        .then(
          () => {},
          (err) => console.warn("Supabase category delete error:", err)
        );
    }
  }

  return getStoredCategories();
}

/**
 * Loads custom categories and product choices from Supabase for the authenticated user
 * and merges them with default options.
 */
export async function syncChoicesFromSupabase(userId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !userId) return;

  try {
    const [catRes, choiceRes] = await Promise.all([
      client.from("custom_categories").select("name").eq("user_id", userId),
      client.from("custom_product_choices").select("name").eq("user_id", userId),
    ]);

    if (catRes.data && catRes.data.length > 0) {
      const cloudCats = catRes.data.map((r: any) => r.name.trim()).filter(Boolean);
      inMemoryCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...cloudCats]));
      try {
        localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(cloudCats));
      } catch {}
    }

    if (choiceRes.data && choiceRes.data.length > 0) {
      const cloudChoices = choiceRes.data.map((r: any) => r.name.trim()).filter(Boolean);
      inMemoryChoices = Array.from(new Set([...DEFAULT_PRODUCT_CHOICES, ...cloudChoices]));
      try {
        localStorage.setItem(CUSTOM_CHOICES_STORAGE_KEY, JSON.stringify(cloudChoices));
      } catch {}
    }
  } catch (err) {
    console.warn("Error syncing choices from Supabase:", err);
  }
}
