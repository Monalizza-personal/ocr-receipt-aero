import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session, AuthError } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getSupabaseKeyType,
  isSecretKey,
  isValidPublishableKey,
  SupabaseKeyType,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  keyType: SupabaseKeyType;
  projectUrl: string;
  hasKey: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  savePublishableKey: (key: string) => { success: boolean; error?: string };
  removePublishableKey: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(isSupabaseConfigured());
  const [keyType, setKeyType] = useState<SupabaseKeyType>(getSupabaseKeyType());

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setIsLoading(false);
      return;
    }

    // 1. Initial session load
    client.auth.getSession().then(({ data: { session }, error }) => {
      if (!error && session) {
        setSession(session);
        setUser(session.user);
      }
      setIsLoading(false);
    });

    // 2. Auth state subscription
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        error: {
          name: "ConfigurationError",
          message: "Supabase publishable key is not configured yet.",
          status: 400,
        } as AuthError,
      };
    }
    const res = await client.auth.signInWithPassword({ email: email.trim(), password });
    return { error: res.error };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        error: {
          name: "ConfigurationError",
          message: "Supabase publishable key is not configured yet.",
          status: 400,
        } as AuthError,
      };
    }
    const res = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName || email.split("@")[0],
        },
      },
    });
    return { error: res.error };
  };

  const resetPassword = async (email: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        error: {
          name: "ConfigurationError",
          message: "Supabase publishable key is not configured.",
          status: 400,
        } as AuthError,
      };
    }
    const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    const res = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });
    return { error: res.error };
  };

  const resendConfirmationEmail = async (email: string) => {
    const client = getSupabaseClient();
    if (!client) {
      return {
        error: {
          name: "ConfigurationError",
          message: "Supabase publishable key is not configured.",
          status: 400,
        } as AuthError,
      };
    }
    const res = await client.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    return { error: res.error };
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  const savePublishableKey = (key: string): { success: boolean; error?: string } => {
    const trimmed = (key || "").trim();

    if (isSecretKey(trimmed)) {
      return {
        success: false,
        error:
          "Forbidden: Secret service_role API key detected. Never use secret keys in browser code. Please use the publishable key (sb_publishable_...) or anon key instead.",
      };
    }

    if (!isValidPublishableKey(trimmed)) {
      return {
        success: false,
        error:
          "Invalid key format. Please enter a valid Supabase publishable key (sb_publishable_...) or anon eyJ... token.",
      };
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("supabase_publishable_key", trimmed);
      setIsConfigured(true);
      setKeyType(getSupabaseKeyType(trimmed));
      window.location.reload();
    }

    return { success: true };
  };

  const removePublishableKey = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("supabase_publishable_key");
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured,
        keyType,
        projectUrl: SUPABASE_URL,
        hasKey: Boolean(SUPABASE_ANON_KEY),
        signIn,
        signUp,
        resetPassword,
        resendConfirmationEmail,
        signOut,
        savePublishableKey,
        removePublishableKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
