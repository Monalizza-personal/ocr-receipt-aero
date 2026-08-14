import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { ExpenseReceipt } from "../types";
import { CATEGORY_COLORS } from "../data/seedData";
import { PieChart as PieIcon, TrendingUp } from "lucide-react";

interface AnalyticsChartsProps {
  receipts: ExpenseReceipt[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ receipts }) => {
  // Aggregate category data
  const categoryMap: Record<string, number> = {};
  receipts.forEach((r) => {
    const cat = r.category || "Other";
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(r.grandTotal) || 0);
  });

  const categoryData = Object.entries(categoryMap)
    .map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
      color: CATEGORY_COLORS[name] || "#94a3b8",
    }))
    .sort((a, b) => b.value - a.value);

  // Aggregate monthly temporal burn rate
  const monthlyMap: Record<string, { subtotal: number; vat: number; total: number; count: number }> = {};
  receipts.forEach((r) => {
    let monthLabel = "May 2025";
    if (r.date) {
      const parts = r.date.split("-");
      if (parts.length >= 2) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        monthLabel = `${months[monthNum - 1] || "M"} ${year}`;
      }
    }

    if (!monthlyMap[monthLabel]) {
      monthlyMap[monthLabel] = { subtotal: 0, vat: 0, total: 0, count: 0 };
    }
    monthlyMap[monthLabel].subtotal += Number(r.subtotal) || 0;
    monthlyMap[monthLabel].vat += Number(r.vatTotal) || 0;
    monthlyMap[monthLabel].total += Number(r.grandTotal) || 0;
    monthlyMap[monthLabel].count += 1;
  });

  const monthlyData = Object.entries(monthlyMap).map(([month, stats]) => ({
    month,
    Subtotal: Number(stats.subtotal.toFixed(2)),
    VAT: Number(stats.vat.toFixed(2)),
    Total: Number(stats.total.toFixed(2)),
    Count: stats.count,
  }));

  const totalSpend = receipts.reduce((s, r) => s + (Number(r.grandTotal) || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Category Allocation Donut Chart */}
      <div
        id="chart-category-allocation"
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-500/30 shadow-2xs">
                <PieIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Department / Category Allocation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Distribution of company and kitchen funds
                </p>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              SAR {totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="h-64 w-full mt-4 flex items-center justify-center">
            {categoryData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center">
                Upload receipts to generate category breakdown charts.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [
                      `SAR ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                      "Total Spent",
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid rgba(51, 65, 85, 0.8)",
                      color: "#fff",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Legend Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
          {categoryData.slice(0, 6).map((cat) => {
            const share = totalSpend > 0 ? Math.round((cat.value / totalSpend) * 100) : 0;
            return (
              <div
                key={cat.name}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 font-semibold shadow-2xs"
              >
                <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: cat.color }} />
                <span>{cat.name}:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {share}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Temporal Financial Burn Rate (Monthly) */}
      <div
        id="chart-temporal-burn-rate"
        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center ring-1 ring-sky-500/30 shadow-2xs">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Temporal Financial Burn Rate (Monthly)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Burn rate tracking of registered receipt expenses
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
              {monthlyData.length} Periods
            </span>
          </div>

          <div className="h-64 w-full mt-4 flex items-center justify-center">
            {monthlyData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center">
                Upload receipts to generate temporal trend metrics.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `SAR ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid rgba(51, 65, 85, 0.8)",
                      color: "#fff",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: "11px", paddingBottom: "10px", fontWeight: 600 }}
                  />
                  <Bar dataKey="Subtotal" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="VAT" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
          <span>VAT Rate: 15% (KSA Standard)</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">Ledger Currency: SAR</span>
        </div>
      </div>
    </div>
  );
};
