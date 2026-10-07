/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { MetricCards } from "./components/MetricCards";
import { ReceiptDropzone } from "./components/ReceiptDropzone";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { LedgerTable } from "./components/LedgerTable";
import { ReceiptDetailModal } from "./components/ReceiptDetailModal";
import { ManualExpenseModal } from "./components/ManualExpenseModal";
import { ImportReceiptsModal } from "./components/ImportReceiptsModal";
import { ExpenseReceipt } from "./types";
import { INITIAL_RECEIPTS } from "./data/seedData";

const STORAGE_KEY = "aistudio_receipts_ocr_expenses";

export default function App() {
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceipt | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  // Theme synchronization
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Load receipts from persistent localStorage or seed
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setReceipts(parsed);
          return;
        }
      } catch (err) {
        console.error("Failed to parse saved receipts:", err);
      }
    }
    // Initialize default seed
    setReceipts(INITIAL_RECEIPTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RECEIPTS));
  }, []);

  // Helper to persist receipts to localStorage safely without exceeding quota or freezing renderer
  const safePersistReceipts = (list: ExpenseReceipt[]) => {
    try {
      // Strip out huge blob URLs or massive base64 strings so localStorage stays lightweight (<100KB)
      const sanitized = list.map((r) => ({
        ...r,
        imageUrl: r.imageUrl?.startsWith("http") ? r.imageUrl : undefined,
        thumbnailUrl: r.thumbnailUrl?.startsWith("http") ? r.thumbnailUrl : undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (err) {
      console.warn("Storage quota exceeded or storage unavailable; continuing in-memory:", err);
    }
  };

  // Update storage helper
  const saveReceiptsToStorage = (updated: ExpenseReceipt[]) => {
    setReceipts(updated);
    safePersistReceipts(updated);
  };

  // Receipt Processed Handler (From OCR or Demo)
  const handleReceiptProcessed = (newReceipt: ExpenseReceipt) => {
    setReceipts((prev) => {
      const updated = [newReceipt, ...prev];
      safePersistReceipts(updated);
      return updated;
    });
    setSelectedReceipt(newReceipt);
  };

  // Batch Receipt Processed Handler (From CSV/JSON or multi-file uploads)
  const handleMultipleReceiptsProcessed = (newReceipts: ExpenseReceipt[]) => {
    if (newReceipts.length === 0) return;
    setReceipts((prev) => {
      const updated = [...newReceipts, ...prev];
      safePersistReceipts(updated);
      return updated;
    });
    setSelectedReceipt(newReceipts[0]);
  };

  // Update single receipt
  const handleUpdateReceipt = (id: string, updated: ExpenseReceipt) => {
    setReceipts((prev) => {
      const next = prev.map((r) => (r.id === id ? updated : r));
      safePersistReceipts(next);
      return next;
    });
    if (selectedReceipt?.id === id) {
      setSelectedReceipt(updated);
    }
  };

  // Delete single receipt
  const handleDeleteReceipt = (id: string) => {
    setReceipts((prev) => {
      const next = prev.filter((r) => r.id !== id);
      safePersistReceipts(next);
      return next;
    });
    if (selectedReceipt?.id === id) {
      setSelectedReceipt(null);
    }
  };

  // Reset to original Saudi Green Store Seed
  const handleResetSeed = () => {
    if (
      window.confirm(
        "This will overwrite all active rows with the original pre-populated seed data representing the Green Store receipt. Proceed?"
      )
    ) {
      saveReceiptsToStorage(INITIAL_RECEIPTS);
      setSelectedReceipt(null);
    }
  };

  // Clear entire ledger
  const handleClearLedger = () => {
    if (
      window.confirm(
        "Are you sure you want to completely erase the datasheet ledger? This action cannot be undone."
      )
    ) {
      saveReceiptsToStorage([]);
      setSelectedReceipt(null);
    }
  };

  // Manual expense added
  const handleAddManualExpense = (manualExpense: ExpenseReceipt) => {
    setReceipts((prev) => {
      const updated = [manualExpense, ...prev];
      safePersistReceipts(updated);
      return updated;
    });
    setSelectedReceipt(manualExpense);
  };

  // Import receipts from CSV or JSON
  const handleImportSuccess = (importedList: ExpenseReceipt[], replaceAll: boolean) => {
    setReceipts((prev) => {
      const updated = replaceAll ? importedList : [...importedList, ...prev];
      safePersistReceipts(updated);
      return updated;
    });
    if (importedList.length > 0) {
      setSelectedReceipt(importedList[0]);
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
      />

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Metric Overview Cards */}
        <MetricCards receipts={receipts} />

        {/* 2. Drag & Drop Receipt OCR Scanner */}
        <ReceiptDropzone
          onReceiptProcessed={handleReceiptProcessed}
          onMultipleReceiptsProcessed={handleMultipleReceiptsProcessed}
          onOpenManualModal={() => setIsManualModalOpen(true)}
        />

        {/* 3. Analytics & Financial Trend Charts */}
        <AnalyticsCharts receipts={receipts} />

        {/* 4. Complete Searchable Ledger Tables (Receipts & Line Items) */}
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

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        InstaSheet Kitchen Expenses & Receipt OCR Engine • Automated Gemini OCR & SAR VAT 15% Ledger
      </footer>
    </div>
  );
}
