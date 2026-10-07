import { DEFAULT_PRODUCT_CHOICES, DEFAULT_CATEGORIES } from "../data/seedData";

const CUSTOM_CHOICES_STORAGE_KEY = "aistudio_custom_product_choices";
const CUSTOM_CATEGORIES_STORAGE_KEY = "aistudio_custom_categories";

export function getStoredProductChoices(): string[] {
  try {
    const saved = localStorage.getItem(CUSTOM_CHOICES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set([...DEFAULT_PRODUCT_CHOICES, ...parsed.map((s) => String(s).trim()).filter(Boolean)])
        );
      }
    }
  } catch {}
  return DEFAULT_PRODUCT_CHOICES;
}

export function saveCustomProductChoice(newChoice: string): string[] {
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
  return getStoredProductChoices();
}

export function getStoredCategories(): string[] {
  try {
    const saved = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return Array.from(
          new Set([...DEFAULT_CATEGORIES, ...parsed.map((s) => String(s).trim()).filter(Boolean)])
        );
      }
    }
  } catch {}
  return DEFAULT_CATEGORIES;
}

export function saveCustomCategory(newCategory: string): string[] {
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
  return getStoredCategories();
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

export function deleteCustomProductChoice(choiceToDelete: string): string[] {
  const trimmed = choiceToDelete.trim();
  try {
    const saved = localStorage.getItem(CUSTOM_CHOICES_STORAGE_KEY);
    const existing: string[] = saved ? JSON.parse(saved) : [];
    const updated = existing.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
    localStorage.setItem(CUSTOM_CHOICES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
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

export function deleteCustomCategory(categoryToDelete: string): string[] {
  const trimmed = categoryToDelete.trim();
  try {
    const saved = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    const existing: string[] = saved ? JSON.parse(saved) : [];
    const updated = existing.filter((c) => c.toLowerCase() !== trimmed.toLowerCase());
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
  return getStoredCategories();
}
