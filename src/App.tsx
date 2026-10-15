/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { MetricCards } from "./components/MetricCards";
import { ReceiptDropzone } from "./components/ReceiptDropzone";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { LedgerTable } from "./components/LedgerTable";
import { ReceiptDetailModal } from "./components/ReceiptDetailModal";
import { ManualExpenseModal } from "./components/ManualExpenseModal";
import { ImportReceiptsModal } from "./components/ImportReceiptsModal";
import { SupabaseAuthModal } from "./components/SupabaseAuthModal";
import { SupabaseBanner } from "./components/SupabaseBanner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ExpenseReceipt } from "./types";
import { INITIAL_RECEIPTS } from "./data/seedData";
import {
  fetchUserReceipts,
  saveReceiptToSupabase,
  updateReceiptInSupabase,
  deleteReceiptFromSupabase,
  batchSaveReceiptsToSupabase,
} from "./lib/supabaseService";
import { syncChoicesFromSupabase } from "./utils/choices";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";

const STORAGE_KEY = "aistudio_receipts_ocr_expenses";

function MainDashboard() {
  const { user, isConfigured, isLoading: isAuthLoading } = useAuth();

  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [localReceiptsBackup, setLocalReceiptsBackup] = useState<ExpenseReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceipt | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  // Dark mode theme synchronization
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Load existing localStorage data on mount (Preserved for offline/unauthenticated use)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((r: ExpenseReceipt) => {
            if (r.uploadedAt) return r;
            const fallbackIso = r.createdAt
              ? new Date(r.createdAt).toISOString()
              : new Date().toISOString();
            return {
              ...r,
              uploadedAt: fallbackIso,
            };
          });
          setLocalReceiptsBackup(normalized);
          if (!user) {
            setReceipts(normalized);
          }
          return;
        }
      } catch (err) {
        console.error("Failed to parse saved receipts from localStorage:", err);
      }
    }

    // Default seed for unauthenticated first load
    setLocalReceiptsBackup(INITIAL_RECEIPTS);
    if (!user) {
      setReceipts(INITIAL_RECEIPTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RECEIPTS));
    }
  }, []);

  // Safe helper to write to localStorage without exceeding quota
  const safePersistLocalReceipts = (list: ExpenseReceipt[]) => {
    try {
      const sanitized = list.map((r) => ({
        ...r,
        imageUrl: r.imageUrl?.startsWith("http") ? r.imageUrl : undefined,
        thumbnailUrl: r.thumbnailUrl?.startsWith("http") ? r.thumbnailUrl : undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      setLocalReceiptsBackup(list);
    } catch (err) {
      console.warn("Storage quota exceeded or storage unavailable; continuing in-memory:", err);
    }
  };

  // Safe helper to backup user cloud receipts locally
  const safePersistUserBackup = (userId: string, list: ExpenseReceipt[]) => {
    try {
      const sanitized = list.map((r) => ({
        ...r,
        imageUrl: r.imageUrl?.startsWith("http") ? r.imageUrl : undefined,
        thumbnailUrl: r.thumbnailUrl?.startsWith("http") ? r.thumbnailUrl : undefined,
      }));
      localStorage.setItem(`${STORAGE_KEY}_user_${userId}`, JSON.stringify(sanitized));
    } catch {}
  };

  // Primary Data Synchronization: Load data from Supabase when user logs in
  const loadCloudData = useCallback(async (userId: string) => {
    setIsCloudLoading(true);
    setFeedbackMessage(null);
    try {
      const [cloudData] = await Promise.all([
        fetchUserReceipts(userId),
        syncChoicesFromSupabase(userId),
      ]);

      setReceipts(cloudData);
      safePersistUserBackup(userId, cloudData);

      if (cloudData.length > 0) {
        setFeedbackMessage({
          type: "success",
          text: `Loaded ${cloudData.length} receipt${cloudData.length === 1 ? "" : "s"} from your private Supabase cloud account.`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      }
    } catch (err: any) {
      console.error("Failed to load user receipts from Supabase:", err);
      setFeedbackMessage({
        type: "error",
        text: `Error loading receipts from Supabase: ${err?.message || "Unknown error"}. Check database connection and RLS policies.`,
      });
    } finally {
      setIsCloudLoading(false);
    }
  }, []);

  // React to User Authentication State changes
  useEffect(() => {
    if (user) {
      loadCloudData(user.id);
    } else {
      // User signed out: restore offline/demo localStorage data
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setReceipts(parsed);
            return;
          }
        } catch {}
      }
      setReceipts(INITIAL_RECEIPTS);
    }
  }, [user, loadCloudData]);

  // Handler: Receipt Processed from OCR Scanner or Camera
  const handleReceiptProcessed = async (
    newReceipt: ExpenseReceipt,
    fileOrBlob?: File | Blob
  ) => {
    if (user) {
      setIsSyncing(true);
      try {
        // Save to Supabase table + upload image to private 'receipt-images' bucket
        const savedRecord = await saveReceiptToSupabase(user.id, newReceipt, fileOrBlob);

        setReceipts((prev) => {
          const updated = [savedRecord, ...prev.filter((r) => r.id !== savedRecord.id)];
          safePersistUserBackup(user.id, updated);
          return updated;
        });
        setSelectedReceipt(savedRecord);
        setFeedbackMessage({
          type: "success",
          text: `Receipt from "${savedRecord.storeName}" saved directly to Supabase cloud database & private storage.`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } catch (err: any) {
        console.error("Failed to save receipt to Supabase:", err);
        // Fallback: save to memory & local storage with notification
        setReceipts((prev) => [newReceipt, ...prev]);
        setSelectedReceipt(newReceipt);
        setFeedbackMessage({
          type: "error",
          text: `Failed to save to Supabase: ${err.message}. Record kept in temporary session.`,
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Offline / LocalStorage Mode
      setReceipts((prev) => {
        const updated = [newReceipt, ...prev];
        safePersistLocalReceipts(updated);
        return updated;
      });
      setSelectedReceipt(newReceipt);
    }
  };

  // Handler: Multiple Receipts Processed (Batch OCR or File Import)
  const handleMultipleReceiptsProcessed = async (
    newReceipts: ExpenseReceipt[],
    files?: File[]
  ) => {
    if (newReceipts.length === 0) return;

    if (user) {
      setIsSyncing(true);
      try {
        const { savedCount, errors } = await batchSaveReceiptsToSupabase(user.id, newReceipts);
        // Reload fresh records from cloud
        const refreshed = await fetchUserReceipts(user.id);
        setReceipts(refreshed);
        safePersistUserBackup(user.id, refreshed);
        setSelectedReceipt(newReceipts[0]);

        if (errors.length > 0) {
          setFeedbackMessage({
            type: "info",
            text: `Saved ${savedCount} of ${newReceipts.length} receipts to Supabase. Issues: ${errors.join(", ")}`,
          });
        } else {
          setFeedbackMessage({
            type: "success",
            text: `Batch of ${savedCount} receipts successfully saved to your Supabase account!`,
          });
          setTimeout(() => setFeedbackMessage(null), 4000);
        }
      } catch (err: any) {
        console.error("Batch save error:", err);
        setFeedbackMessage({
          type: "error",
          text: `Batch save failed: ${err.message}`,
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Offline / LocalStorage Mode
      setReceipts((prev) => {
        const updated = [...newReceipts, ...prev];
        safePersistLocalReceipts(updated);
        return updated;
      });
      setSelectedReceipt(newReceipts[0]);
    }
  };

  // Handler: Update Receipt (Preserving original Upload Date & Time)
  const handleUpdateReceipt = async (id: string, updated: ExpenseReceipt) => {
    // Preserve existing upload timestamp
    const existing = receipts.find((r) => r.id === id);
    const preservedUploadAt = existing?.uploadedAt || updated.uploadedAt;
    const mergedRecord: ExpenseReceipt = {
      ...updated,
      ...(preservedUploadAt ? { uploadedAt: preservedUploadAt } : {}),
      ...(existing?.createdAt ? { createdAt: existing.createdAt } : {}),
    };

    // Optimistic UI update
    setReceipts((prev) => prev.map((r) => (r.id === id ? mergedRecord : r)));
    if (selectedReceipt?.id === id) {
      setSelectedReceipt(mergedRecord);
    }

    if (user) {
      setIsSyncing(true);
      try {
        await updateReceiptInSupabase(user.id, mergedRecord);
        safePersistUserBackup(user.id, receipts);
        setFeedbackMessage({
          type: "success",
          text: `Receipt updated in Supabase cloud (Upload timestamp preserved).`,
        });
        setTimeout(() => setFeedbackMessage(null), 3000);
      } catch (err: any) {
        console.error("Failed to update receipt in Supabase:", err);
        setFeedbackMessage({
          type: "error",
          text: `Failed to update in Supabase: ${err.message}`,
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      safePersistLocalReceipts(receipts.map((r) => (r.id === id ? mergedRecord : r)));
    }
  };

  // Handler: Delete Receipt
  const handleDeleteReceipt = async (id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    if (selectedReceipt?.id === id) {
      setSelectedReceipt(null);
    }

    if (user) {
      setIsSyncing(true);
      try {
        await deleteReceiptFromSupabase(user.id, id);
        safePersistUserBackup(
          user.id,
          receipts.filter((r) => r.id !== id)
        );
        setFeedbackMessage({
          type: "info",
          text: "Receipt deleted from your Supabase cloud database.",
        });
        setTimeout(() => setFeedbackMessage(null), 3000);
      } catch (err: any) {
        console.error("Failed to delete receipt from Supabase:", err);
        setFeedbackMessage({
          type: "error",
          text: `Failed to delete from Supabase: ${err.message}`,
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      safePersistLocalReceipts(receipts.filter((r) => r.id !== id));
    }
  };

  // Handler: Add Manual Expense
  const handleAddManualExpense = async (manualExpense: ExpenseReceipt) => {
    await handleReceiptProcessed(manualExpense);
  };

  // Handler: CSV / JSON Import
  const handleImportSuccess = async (importedList: ExpenseReceipt[], replaceAll: boolean) => {
    if (user) {
      setIsSyncing(true);
      try {
        const { savedCount, errors } = await batchSaveReceiptsToSupabase(user.id, importedList);
        const refreshed = await fetchUserReceipts(user.id);
        setReceipts(refreshed);
        safePersistUserBackup(user.id, refreshed);
        if (refreshed.length > 0) {
          setSelectedReceipt(refreshed[0]);
        }
        setFeedbackMessage({
          type: "success",
          text: `Imported and saved ${savedCount} receipts to your Supabase account.`,
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
      } catch (err: any) {
        setFeedbackMessage({
          type: "error",
          text: `Import failed: ${err.message}`,
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      setReceipts((prev) => {
        const updated = replaceAll ? importedList : [...importedList, ...prev];
        safePersistLocalReceipts(updated);
        return updated;
      });
      if (importedList.length > 0) {
        setSelectedReceipt(importedList[0]);
      }
    }
  };

  // Handler: One-Click Migration of Local Demo Receipts to User's Cloud Account
  const handleSyncLocalToCloud = async () => {
    if (!user) return;
    setIsSyncing(true);
    setFeedbackMessage(null);
    try {
      // Find local receipts that are not yet in user's cloud account
      const existingIds = new Set(receipts.map((r) => r.id));
      const candidatesToSync = localReceiptsBackup.filter((r) => !existingIds.has(r.id));

      const listToSync = candidatesToSync.length > 0 ? candidatesToSync : localReceiptsBackup;

      if (listToSync.length === 0) {
        setFeedbackMessage({
          type: "info",
          text: "All local receipts are already synchronized with your Supabase account.",
        });
        setIsSyncing(false);
        return;
      }

      const { savedCount, errors } = await batchSaveReceiptsToSupabase(user.id, listToSync);
      const refreshed = await fetchUserReceipts(user.id);
      setReceipts(refreshed);
      safePersistUserBackup(user.id, refreshed);

      setFeedbackMessage({
        type: "success",
        text: `Successfully uploaded ${savedCount} local receipts into your Supabase account!`,
      });
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: `Error synchronizing local data: ${err.message}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handler: Reset to Saudi Green Store Demo Seed
  const handleResetSeed = async () => {
    if (
      window.confirm(
        user
          ? "This will load the original Saudi Green Store demo receipts into your active Supabase ledger. Proceed?"
          : "This will reset all active rows to the pre-populated Saudi Green Store demo data. Proceed?"
      )
    ) {
      if (user) {
        setIsSyncing(true);
        try {
          await batchSaveReceiptsToSupabase(user.id, INITIAL_RECEIPTS);
          const refreshed = await fetchUserReceipts(user.id);
          setReceipts(refreshed);
          setSelectedReceipt(refreshed[0] || null);
          setFeedbackMessage({
            type: "success",
            text: "Demo seed receipts saved to your Supabase account.",
          });
          setTimeout(() => setFeedbackMessage(null), 3000);
        } finally {
          setIsSyncing(false);
        }
      } else {
        setReceipts(INITIAL_RECEIPTS);
        safePersistLocalReceipts(INITIAL_RECEIPTS);
        setSelectedReceipt(null);
      }
    }
  };

  // Handler: Clear Ledger
  const handleClearLedger = async () => {
    if (
      window.confirm(
        user
          ? "Are you sure you want to delete all cloud receipts from your Supabase account? This cannot be undone."
          : "Are you sure you want to completely erase the datasheet ledger? This action cannot be undone."
      )
    ) {
      if (user) {
        setIsSyncing(true);
        try {
          for (const r of receipts) {
            await deleteReceiptFromSupabase(user.id, r.id);
          }
          setReceipts([]);
          setSelectedReceipt(null);
          setFeedbackMessage({
            type: "info",
            text: "All receipts cleared from your Supabase account.",
          });
        } catch (err: any) {
          setFeedbackMessage({
            type: "error",
            text: `Error clearing receipts: ${err.message}`,
          });
        } finally {
          setIsSyncing(false);
        }
      } else {
        setReceipts([]);
        safePersistLocalReceipts([]);
        setSelectedReceipt(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header with Brand & Global Controls */}
      <Header
        receipts={receipts}
        onResetSeed={handleResetSeed}
        onClearLedger={handleClearLedger}
        onOpenManualModal={() => setIsManualModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Supabase Cloud Connection & Sync Status Banner */}
        <SupabaseBanner
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          localReceiptsCount={localReceiptsBackup.length}
          cloudReceiptsCount={receipts.length}
          onSyncLocalToCloud={user ? handleSyncLocalToCloud : undefined}
          isSyncing={isSyncing}
          onRefreshCloud={user ? () => loadCloudData(user.id) : undefined}
        />

        {/* Feedback Alert Toast */}
        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-xs transition animate-in fade-in duration-200 ${
              feedbackMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : feedbackMessage.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                : "bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="p-1 hover:opacity-70 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Global Loading Spinner when fetching cloud data */}
        {isCloudLoading && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-center gap-3 text-slate-600 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-semibold">
              Loading receipts from your Supabase cloud database...
            </span>
          </div>
        )}

        {/* 2. Metric Overview Cards */}
        <MetricCards receipts={receipts} />

        {/* 3. Drag & Drop Receipt OCR Scanner */}
        <ReceiptDropzone
          receipts={receipts}
          onReceiptProcessed={handleReceiptProcessed}
          onMultipleReceiptsProcessed={handleMultipleReceiptsProcessed}
          onOpenManualModal={() => setIsManualModalOpen(true)}
        />

        {/* 4. Analytics & Financial Trend Charts */}
        <AnalyticsCharts receipts={receipts} />

        {/* 5. Complete Searchable Ledger Tables (Receipts & Line Items) */}
        <LedgerTable
          receipts={receipts}
          onUpdateReceipt={handleUpdateReceipt}
          onDeleteReceipt={handleDeleteReceipt}
          onSelectForDetails={(r) => setSelectedReceipt(r)}
        />
      </main>

      {/* Receipt Details & Translation Modal */}
      <ReceiptDetailModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        onSave={(updated) => {
          handleUpdateReceipt(updated.id, updated);
          setSelectedReceipt(null);
        }}
        onDelete={(id) => {
          handleDeleteReceipt(id);
          setSelectedReceipt(null);
        }}
      />

      {/* Manual Expense Creation Modal */}
      <ManualExpenseModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAdd={handleAddManualExpense}
      />

      {/* Import Receipts Modal */}
      <ImportReceiptsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Supabase Authentication & Sync Modal */}
      <SupabaseAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        InstaSheet Kitchen Expenses & Receipt OCR Engine • Powered by Supabase PostgreSQL & Gemini Vision AI
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainDashboard />
    </AuthProvider>
  );
}
