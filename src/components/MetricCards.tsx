import React from "react";
import { DollarSign, FileCheck, Percent, PieChart } from "lucide-react";
import { ExpenseReceipt } from "../types";

interface MetricCardsProps {
  receipts: ExpenseReceipt[];
}

export const MetricCards: React.FC<MetricCardsProps> = ({ receipts }) => {
  // Aggregate calculations
  const totalValue = receipts.reduce((acc, r) => acc + (Number(r.grandTotal) || 0), 0);
  const totalVAT = receipts.reduce((acc, r) => acc + (Number(r.vatTotal) || 0), 0);
  const totalCount = receipts.length;

  // Category breakdown to find top sector
  const categoryTotals: Record<string, number> = {};
  receipts.forEach((r) => {
    const cat = r.category || "Other";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(r.grandTotal) || 0);
  });

  let topCategory = "N/A";
  let topCategoryAmount = 0;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (amt > topCategoryAmount) {
      topCategoryAmount = amt;
      topCategory = cat;
    }
  });

  const topCategoryShare = totalValue > 0 ? Math.round((topCategoryAmount / totalValue) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Aggregate Value - Vibrant Emerald */}
      <div
        id="kpi-aggregate-value"
        className="bg-gradient-to-br from-white via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-emerald-800 dark:text-emerald-300/90 uppercase tracking-wider">
            Aggregate Value (SAR)
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/30 group-hover:scale-110 transition duration-200">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
            {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Total ledger financial volume
          </span>
        </div>
      </div>

      {/* 2. Processed Claim Files - Vibrant Sky */}
      <div
        id="kpi-claim-files"
        className="bg-gradient-to-br from-white via-white to-sky-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-sky-950/20 border border-sky-500/20 hover:border-sky-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-sky-800 dark:text-sky-300/90 uppercase tracking-wider">
            OCR Processed Claim files
          </span>
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center ring-1 ring-sky-500/30 group-hover:scale-110 transition duration-200">
            <FileCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
            {totalCount}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Active local persistent ledger cache rows
          </span>
        </div>
      </div>

      {/* 3. Recoverable VAT - Vibrant Amber */}
      <div
        id="kpi-recoverable-vat"
        className="bg-gradient-to-br from-white via-white to-amber-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/20 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300/90 uppercase tracking-wider">
            Recoverable VAT (SAR)
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center ring-1 ring-amber-500/30 group-hover:scale-110 transition duration-200">
            <Percent className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight tabular-nums">
            {totalVAT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Estimated 15% standard tax write-off
          </span>
        </div>
      </div>

      {/* 4. Core Sector Allocation - Vibrant Indigo */}
      <div
        id="kpi-core-sector"
        className="bg-gradient-to-br from-white via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 border border-indigo-500/20 hover:border-indigo-500/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-indigo-800 dark:text-indigo-300/90 uppercase tracking-wider">
            Core Sector Allocation
          </span>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center ring-1 ring-indigo-500/30 group-hover:scale-110 transition duration-200">
            <PieChart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate max-w-[150px]">
              {topCategory}
            </p>
            {topCategoryShare > 0 && (
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                {topCategoryShare}%
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Sector utilizing highest financial share
          </span>
        </div>
      </div>
    </div>
  );
};
