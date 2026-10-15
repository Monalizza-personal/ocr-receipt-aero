import React, { useState } from "react";
import {
  AlertTriangle,
  Lock,
  CloudCheck,
  RefreshCw,
  UploadCloud,
  ChevronRight,
  Database,
  ExternalLink,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ExpenseReceipt } from "../types";

interface SupabaseBannerProps {
  onOpenAuthModal: () => void;
  localReceiptsCount?: number;
  cloudReceiptsCount?: number;
  onSyncLocalToCloud?: () => Promise<void>;
  isSyncing?: boolean;
  onRefreshCloud?: () => Promise<void>;
}

export const SupabaseBanner: React.FC<SupabaseBannerProps> = ({
  onOpenAuthModal,
  localReceiptsCount = 0,
  cloudReceiptsCount = 0,
  onSyncLocalToCloud,
  isSyncing = false,
  onRefreshCloud,
}) => {
  const { user, isConfigured, keyType } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  // If user dismissed logged-in banner, keep it minimal or hidden
  if (isDismissed && user) {
    return null;
  }

  // 1. Missing Supabase Configuration State
  if (!isConfigured) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/90 dark:bg-amber-950/30 p-4 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                  Supabase Configuration Required for Cloud Storage
                </h3>
                <span className="text-[10px] bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-mono font-medium">
                  VITE_SUPABASE_ANON_KEY missing
                </span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-1 leading-relaxed">
                App is currently using local browser storage (offline mode). Set{" "}
                <code className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">
                  VITE_SUPABASE_ANON_KEY
                </code>{" "}
                or paste your Supabase publishable key to activate multi-user cloud persistence and private receipt storage.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Configure Key</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Configured but Not Logged In (Requires Auth before accessing private data)
  if (!user) {
    return (
      <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/90 dark:bg-sky-950/30 p-4 shadow-xs transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-bold text-sky-950 dark:text-sky-200">
                  Supabase Cloud Connected — Authentication Required for Private Data
                </h3>
                <span className="text-[10px] bg-sky-200/60 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-full font-medium">
                  {keyType === "publishable" ? "Publishable Key" : "Anon Key"} Active
                </span>
              </div>
              <p className="text-xs text-sky-800 dark:text-sky-300/90 mt-1 leading-relaxed">
                You are currently viewing offline demo records. Sign in with your account to access your personal receipts,
                upload scans to the private{" "}
                <code className="font-mono text-[11px] bg-sky-100 dark:bg-sky-900/60 px-1 py-0.5 rounded">
                  receipt-images
                </code>{" "}
                storage bucket, and sync data securely across devices.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <span>Sign In / Register</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated User (Cloud Persistence Active)
  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/20 p-3.5 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Supabase Cloud Storage Active
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-200/60 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-full font-medium">
                User: {user.email}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                • {cloudReceiptsCount} cloud receipts synced • RLS Enforced
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onSyncLocalToCloud && localReceiptsCount > 0 && (
            <button
              type="button"
              onClick={onSyncLocalToCloud}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Upload your local demo/offline receipts into your private Supabase account"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{isSyncing ? "Syncing..." : `Sync Local (${localReceiptsCount})`}</span>
            </button>
          )}

          {onRefreshCloud && (
            <button
              type="button"
              onClick={onRefreshCloud}
              disabled={isSyncing}
              className="p-1.5 text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition cursor-pointer border border-emerald-200 dark:border-emerald-800"
              title="Refresh receipts from Supabase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAuthModal}
            className="px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
          >
            Account
          </button>
        </div>
      </div>
    </div>
  );
};
