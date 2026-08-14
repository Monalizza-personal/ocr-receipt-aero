import React from "react";
import {
  Sparkles,
  Download,
  RotateCcw,
  Trash2,
  Receipt,
  FileSpreadsheet,
  Moon,
  Sun,
  PlusCircle,
} from "lucide-react";
import { ExpenseReceipt } from "../types";
import { exportReceiptsCSV, exportLineItemsCSV } from "../utils/csvExport";

interface HeaderProps {
  receipts: ExpenseReceipt[];
  onResetSeed: () => void;
  onClearLedger: () => void;
  onOpenManualModal: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  receipts,
  onResetSeed,
  onClearLedger,
  onOpenManualModal,
  isDarkMode,
  onToggleDarkMode,
}) => {
  return (
    <header className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-30 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Logo & Branding */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0 mt-0.5 ring-2 ring-emerald-500/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                InstaSheet Receipt OCR
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-500/30 shadow-2xs">
                <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                Gemini 3.5 AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Drag-and-drop receipt scans to instantly auto-populate your searchable expense tracking ledger.
            </p>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Manual Add Button */}
          <button
            id="btn-add-manual-receipt"
            onClick={onOpenManualModal}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            title="Create manual expense row without receipt image"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Manual Entry</span>
          </button>

          {/* Export Receipts CSV */}
          <button
            id="btn-export-receipts-csv"
            onClick={() => exportReceiptsCSV(receipts)}
            type="button"
            disabled={receipts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold border border-emerald-200/80 dark:border-emerald-800/50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            title="Export list of receipt summaries as CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Receipts (CSV)</span>
          </button>

          {/* Export Line Items CSV */}
          <button
            id="btn-export-items-csv"
            onClick={() => exportLineItemsCSV(receipts)}
            type="button"
            disabled={receipts.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100/80 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-800 dark:text-sky-300 rounded-xl text-xs font-bold border border-sky-200/80 dark:border-sky-800/50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
            title="Export detailed individual items ledger as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Export Line Items (CSV)</span>
          </button>

          {/* Reset Seed Button */}
          <button
            id="btn-reset-demo-seed"
            onClick={onResetSeed}
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
            title="Restore original Saudi Green Store pre-populated seed data"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>

          {/* Clear Ledger Button */}
          <button
            id="btn-clear-ledger"
            onClick={onClearLedger}
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 rounded-xl transition cursor-pointer border border-rose-200/60 dark:border-rose-900/40"
            title="Erase all records in current ledger"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {/* Theme Dark/Light Toggle */}
          <button
            id="btn-theme-toggle"
            onClick={onToggleDarkMode}
            type="button"
            className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60"
            title="Toggle theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400 fill-amber-400/20" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </div>
    </header>
  );
};
