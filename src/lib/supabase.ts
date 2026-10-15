import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase configuration credentials
 * Project URL provided by user: https://jxuiggmifepmlpiculms.supabase.co
 */
export const DEFAULT_SUPABASE_URL = "https://jxuiggmifepmlpiculms.supabase.co";

/**
 * Helper to safely read environment variables across Vite, Node, and test runtimes
 */
const getEnvVar = (key: string): string => {
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env && import.meta.env[key]) {
      return String(import.meta.env[key]).trim();
    }
  } catch {}
  try {
    if (typeof process !== "undefined" && process?.env && process.env[key]) {
      return String(process.env[key]).trim();
    }
  } catch {}
  return "";
};

/**
 * Detects whether an API key is a private/secret/service_role key.
 * Secret keys MUST NEVER be used in client-side browser code.
 */
export function isSecretKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();

  // Modern Supabase secret keys start with sb_secret_
  if (trimmed.startsWith("sb_secret_")) return true;
  if (trimmed.startsWith("service_role_")) return true;
  if (trimmed.toLowerCase().includes("service_role")) return true;

  // Inspect JWT payload if in eyJ... format
  if (trimmed.startsWith("eyJ") && trimmed.includes(".")) {
    try {
      const parts = trimmed.split(".");
      if (parts.length >= 2) {
        const decoded = JSON.parse(atob(parts[1]));
        if (decoded.role === "service_role" || decoded.role === "secret") {
          return true;
        }
      }
    } catch {}
  }

  return false;
}

/**
 * Validates that an API key is a valid client-side key (publishable or anon).
 * Rejects secret keys and malformed strings.
 */
export function isValidPublishableKey(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();

  // Reject secret keys immediately
  if (isSecretKey(trimmed)) return false;

  // Modern Supabase publishable key (sb_publishable_... or sb_anon_...)
  if (trimmed.startsWith("sb_publishable_") || trimmed.startsWith("sb_anon_")) {
    return trimmed.length >= 20;
  }

  // Standard legacy Supabase anon JWT key format (eyJ...)
  if (trimmed.startsWith("eyJ")) {
    return trimmed.length >= 40;
  }

  return trimmed.length >= 20;
}

// Purge any rogue secret key from localStorage on initialization
if (typeof window !== "undefined") {
  try {
    const storedKey = localStorage.getItem("supabase_publishable_key");
    if (storedKey && isSecretKey(storedKey)) {
      console.warn("[Security] Purged forbidden secret API key from localStorage.");
      localStorage.removeItem("supabase_publishable_key");
    }
  } catch {}
}

const envUrl = getEnvVar("VITE_SUPABASE_URL");
const envKey = getEnvVar("VITE_SUPABASE_ANON_KEY") || getEnvVar("VITE_SUPABASE_PUBLISHABLE_KEY");

// Environment variable takes strict precedence over localStorage.
// LocalStorage is only checked as a fallback when no valid env var is provided,
// and it must be a valid publishable key.
let resolvedKey = "";
if (isValidPublishableKey(envKey)) {
  resolvedKey = envKey;
} else if (typeof window !== "undefined") {
  const localKey = (localStorage.getItem("supabase_publishable_key") || "").trim();
  if (isValidPublishableKey(localKey)) {
    resolvedKey = localKey;
  }
}

export const SUPABASE_URL = envUrl || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = resolvedKey;

export type SupabaseKeyType = "jwt" | "publishable" | "custom" | "missing" | "forbidden_secret";

export function getSupabaseKeyType(key: string = SUPABASE_ANON_KEY): SupabaseKeyType {
  if (!key) return "missing";
  if (isSecretKey(key)) return "forbidden_secret";
  if (key.startsWith("sb_publishable_") || key.startsWith("sb_anon_")) return "publishable";
  if (key.startsWith("eyJ")) return "jwt";
  return "custom";
}

/**
 * Checks whether Supabase is actively configured with a valid publishable key.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && isValidPublishableKey(SUPABASE_ANON_KEY));
}

// Singleton client instance
let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "instasheet_supabase_auth_token",
      },
    });
  }

  return clientInstance;
}

export const supabase = getSupabaseClient();

/**
 * Verifies connectivity to the Supabase project
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  statusText: string;
  keyType: SupabaseKeyType;
}> {
  if (isSecretKey(SUPABASE_ANON_KEY)) {
    return {
      connected: false,
      statusText: "Forbidden: Secret API key detected. Never use secret or service_role keys in browser code.",
      keyType: "forbidden_secret",
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      connected: false,
      statusText: "Supabase client not initialized: Missing VITE_SUPABASE_ANON_KEY or sb_publishable_ key.",
      keyType: getSupabaseKeyType(),
    };
  }

  try {
    const { error } = await client.auth.getSession();
    if (error) {
      return {
        connected: false,
        statusText: `Supabase auth error: ${error.message}`,
        keyType: getSupabaseKeyType(),
      };
    }

    return {
      connected: true,
      statusText: "Connected to Supabase project successfully.",
      keyType: getSupabaseKeyType(),
    };
  } catch (err: any) {
    return {
      connected: false,
      statusText: `Connection failed: ${err?.message || "Network error"}`,
      keyType: getSupabaseKeyType(),
    };
  }
}
