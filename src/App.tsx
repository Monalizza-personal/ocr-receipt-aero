/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { Header } from "./components/Header";
import { MetricCards } from "./components/MetricCards";
import { ReceiptDropzone } from "./components/ReceiptDropzone";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { LedgerTable } from "./components/LedgerTable";
import { ReceiptDetailModal } from "./components/ReceiptDetailModal";
import { ManualExpenseModal } from "./components/ManualExpenseModal";
import { ExpenseReceipt } from "./types";
import { INITIAL_RECEIPTS } from "./data/seedData";

const STORAGE_KEY = "aistudio_receipts_ocr_expenses";

export default function App() {
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ExpenseReceipt | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
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

  // Update storage helper
  const saveReceiptsToStorage = (updated: ExpenseReceipt[]) => {
    setReceipts(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // Receipt Processed Handler (From OCR or Demo)
  const handleReceiptProcessed = (newReceipt: ExpenseReceipt) => {
    const updated = [newReceipt, ...receipts];
    saveReceiptsToStorage(updated);
    setSelectedReceipt(newReceipt);

    // Celebratory confetti on extraction
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#10b981", "#3b82f6", "#f59e0b"],
      });
    } catch {
      // Ignored if canvas-confetti is not loaded
    }
  };

  // Update single receipt
  const handleUpdateReceipt = (id: string, updated: ExpenseReceipt) => {
    const next = receipts.map((r) => (r.id === id ? updated : r));
    saveReceiptsToStorage(next);
    if (selectedReceipt?.id === id) {
      setSelectedReceipt(updated);
    }
  };

  // Delete single receipt
  const handleDeleteReceipt = (id: string) => {
    const next = receipts.filter((r) => r.id !== id);
    saveReceiptsToStorage(next);
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
    const updated = [manualExpense, ...receipts];
    saveReceiptsToStorage(updated);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header with Brand & Global Controls */}
      <Header
        receipts={receipts}
        onResetSeed={handleResetSeed}
        onClearLedger={handleClearLedger}
        onOpenManualModal={() => setIsManualModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Metric Overview Cards */}
        <MetricCards receipts={receipts} />

        {/* 2. Drag & Drop Receipt OCR Scanner */}
        <ReceiptDropzone onReceiptProcessed={handleReceiptProcessed} />

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
      />

      {/* Manual Expense Creation Modal */}
      <ManualExpenseModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onAdd={handleAddManualExpense}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        InstaSheet Kitchen Expenses & Receipt OCR Engine • Automated Gemini OCR & SAR VAT 15% Ledger
      </footer>
    </div>
  );
}
