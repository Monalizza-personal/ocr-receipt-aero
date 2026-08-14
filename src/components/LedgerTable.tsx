import React, { useState } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  Eye,
  Trash2,
  Edit2,
  ExternalLink,
  ChevronDown,
  Sparkles,
  FileSpreadsheet,
  Receipt as ReceiptIcon,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { ExpenseReceipt, ViewTab, ExpenseItem } from "../types";
import { CATEGORY_COLORS, DEFAULT_CATEGORIES, DEFAULT_PRODUCT_CHOICES } from "../data/seedData";

interface LedgerTableProps {
  receipts: ExpenseReceipt[];
  onUpdateReceipt: (id: string, updated: ExpenseReceipt) => void;
  onDeleteReceipt: (id: string) => void;
  onSelectForDetails: (receipt: ExpenseReceipt) => void;
}

export const LedgerTable: React.FC<LedgerTableProps> = ({
  receipts,
  onUpdateReceipt,
  onDeleteReceipt,
  onSelectForDetails,
}) => {
  const [activeTab, setActiveTab] = useState<ViewTab>("receipts");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Categories");
  const [selectedChoice, setSelectedChoice] = useState<string>("All Choices");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Flattened line items array with parent metadata
  const allLineItems = receipts.flatMap((r) =>
    (r.items || []).map((it) => ({
      ...it,
      parentReceiptId: r.id,
      storeName: r.storeName,
      date: r.date,
      invoiceNo: r.invoiceNo,
      currency: r.currency,
      imageUrl: r.imageUrl,
    }))
  );

  // Filter receipts
  const filteredReceipts = receipts
    .filter((r) => {
      const matchSearch =
        searchTerm === "" ||
        r.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.invoiceNo && r.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.notes && r.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (r.items && r.items.some((it) => it.description.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchCat = selectedCategory === "All Categories" || r.category === selectedCategory;

      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "amount-desc") return (b.grandTotal || 0) - (a.grandTotal || 0);
      if (sortBy === "amount-asc") return (a.grandTotal || 0) - (b.grandTotal || 0);
      return 0;
    });

  // Filter line items
  const filteredLineItems = allLineItems
    .filter((it) => {
      const matchSearch =
        searchTerm === "" ||
        it.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (it.invoiceNo && it.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCat =
        selectedCategory === "All Categories" || (it.category || "General") === selectedCategory;

      const matchChoice =
        selectedChoice === "All Choices" || (it.productChoice || "General") === selectedChoice;

      return matchSearch && matchCat && matchChoice;
    })
    .sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === "date-asc") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === "amount-desc") return (b.totalAmount || 0) - (a.totalAmount || 0);
      if (sortBy === "amount-asc") return (a.totalAmount || 0) - (b.totalAmount || 0);
      return 0;
    });

  // Inline cell edit triggers
  const startEditing = (id: string, field: string, initialVal: any) => {
    setEditingCell({ id, field });
    setEditValue(initialVal !== undefined ? String(initialVal) : "");
  };

  const commitInlineEdit = (receipt: ExpenseReceipt) => {
    if (!editingCell) return;
    const { field } = editingCell;
    const updated = { ...receipt };

    if (field === "storeName") updated.storeName = editValue.trim() || updated.storeName;
    if (field === "invoiceNo") updated.invoiceNo = editValue.trim();
    if (field === "date") updated.date = editValue;
    if (field === "category") updated.category = editValue;
    if (field === "grandTotal") {
      const num = parseFloat(editValue) || 0;
      updated.grandTotal = num;
      // Auto-adjust subtotal and VAT proportionally
      updated.vatTotal = Number((num * (15 / 115)).toFixed(2));
      updated.subtotal = Number((num - updated.vatTotal).toFixed(2));
    }

    onUpdateReceipt(receipt.id, updated);
    setEditingCell(null);
  };

  return (
    <div
      id="ledger-table-container"
      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden flex flex-col transition"
    >
      {/* Top Ledger Header with Tabs */}
      <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Tab 1: Receipts Ledger */}
          <button
            id="tab-receipts-ledger"
            type="button"
            onClick={() => setActiveTab("receipts")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "receipts"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/50 dark:border-slate-700/50"
            }`}
          >
            <ReceiptIcon className="w-3.5 h-3.5" />
            <span>Receipts Ledger ({receipts.length})</span>
          </button>

          {/* Tab 2: Line Items Ledger */}
          <button
            id="tab-items-ledger"
            type="button"
            onClick={() => setActiveTab("items")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "items"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/50 dark:border-slate-700/50"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Line Items Ledger ({allLineItems.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:block">
          Double-click any cell to edit inline instantly • Click 'Inspect' for visual preview
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search stores, items, invoice #, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9.5 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400"
          />
        </div>

        {/* Dropdowns Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
            >
              <option value="All Categories">All Categories</option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Product Choice Filter (Visible in Line Items Tab) */}
          {activeTab === "items" && (
            <div className="relative">
              <select
                value={selectedChoice}
                onChange={(e) => setSelectedChoice(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
              >
                <option value="All Choices">All Choices</option>
                {DEFAULT_PRODUCT_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table Content Area */}
      <div className="overflow-x-auto">
        {activeTab === "receipts" ? (
          /* TAB 1: RECEIPTS SUMMARY TABLE */
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-14 text-center">Proof</th>
                <th className="py-3 px-3">Merchant / Store Name</th>
                <th className="py-3 px-3">Invoice #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Tax ID</th>
                <th className="py-3 px-2 text-center">Items</th>
                <th className="py-3 px-3 text-right">Subtotal</th>
                <th className="py-3 px-3 text-right">VAT (15%)</th>
                <th className="py-3 px-3 text-right">Grand Total</th>
                <th className="py-3 px-3 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No expense records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => {
                  const isEditingStore = editingCell?.id === r.id && editingCell?.field === "storeName";
                  const isEditingInvoice = editingCell?.id === r.id && editingCell?.field === "invoiceNo";
                  const isEditingDate = editingCell?.id === r.id && editingCell?.field === "date";
                  const isEditingTotal = editingCell?.id === r.id && editingCell?.field === "grandTotal";

                  const catColor = CATEGORY_COLORS[r.category] || "#64748b";

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group"
                    >
                      {/* Proof Thumbnail */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectForDetails(r)}
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-emerald-500 transition cursor-pointer mx-auto"
                          title="View receipt proof image"
                        >
                          {r.thumbnailUrl || r.imageUrl ? (
                            <img
                              src={r.thumbnailUrl || r.imageUrl}
                              alt="thumbnail"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Store Name */}
                      <td
                        className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white cursor-pointer"
                        onDoubleClick={() => startEditing(r.id, "storeName", r.storeName)}
                      >
                        {isEditingStore ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => commitInlineEdit(r)}
                              onKeyDown={(e) => e.key === "Enter" && commitInlineEdit(r)}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-emerald-500 rounded text-xs w-full"
                            />
                            <button
                              type="button"
                              onClick={() => commitInlineEdit(r)}
                              className="p-1 text-emerald-600"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{r.storeName}</span>
                              <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition" />
                            </div>
                            {r.originalStoreName && r.originalStoreName !== r.storeName && (
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {r.originalStoreName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Invoice # */}
                      <td
                        className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 cursor-pointer"
                        onDoubleClick={() => startEditing(r.id, "invoiceNo", r.invoiceNo)}
                      >
                        {isEditingInvoice ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitInlineEdit(r)}
                            onKeyDown={(e) => e.key === "Enter" && commitInlineEdit(r)}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-emerald-500 rounded text-xs w-28"
                          />
                        ) : (
                          <span>{r.invoiceNo || "INV-001"}</span>
                        )}
                      </td>

                      {/* Date */}
                      <td
                        className="py-2.5 px-3 text-slate-600 dark:text-slate-300 tabular-nums cursor-pointer"
                        onDoubleClick={() => startEditing(r.id, "date", r.date)}
                      >
                        {isEditingDate ? (
                          <input
                            type="date"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitInlineEdit(r)}
                            onKeyDown={(e) => e.key === "Enter" && commitInlineEdit(r)}
                            className="px-1 py-1 bg-white dark:bg-slate-800 border border-emerald-500 rounded text-xs"
                          />
                        ) : (
                          <span>{r.date}</span>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: catColor }}
                        >
                          {r.category}
                        </span>
                      </td>

                      {/* Tax ID */}
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {r.taxId || "—"}
                      </td>

                      {/* Items Count */}
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                          {r.items ? r.items.length : 0}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="py-2.5 px-3 text-right font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                        {(Number(r.subtotal) || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* VAT Total */}
                      <td className="py-2.5 px-3 text-right font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                        {(Number(r.vatTotal) || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Grand Total */}
                      <td
                        className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white tabular-nums cursor-pointer"
                        onDoubleClick={() => startEditing(r.id, "grandTotal", r.grandTotal)}
                      >
                        {isEditingTotal ? (
                          <input
                            type="number"
                            step="0.01"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitInlineEdit(r)}
                            onKeyDown={(e) => e.key === "Enter" && commitInlineEdit(r)}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-emerald-500 rounded text-xs w-24 text-right font-bold"
                          />
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span>
                              {r.currency}{" "}
                              {(Number(r.grandTotal) || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => onSelectForDetails(r)}
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                            title="Inspect item breakdown and translate"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete receipt for "${r.storeName}" from ledger?`)) {
                                onDeleteReceipt(r.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete receipt record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          /* TAB 2: LINE ITEMS FLATTENED TABLE */
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Itemized Product Description</th>
                <th className="py-3 px-3">Parent Merchant</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Choice / Classification</th>
                <th className="py-3 px-2 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-right">VAT (15%)</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-center">Receipt Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredLineItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No itemized products found matching filters.
                  </td>
                </tr>
              ) : (
                filteredLineItems.map((item, idx) => {
                  const parent = receipts.find((r) => r.id === item.parentReceiptId);
                  const catColor = CATEGORY_COLORS[item.category || "Food & Dining"] || "#64748b";

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                      {/* Description */}
                      <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                        <div>
                          <span>{item.description}</span>
                          {item.originalDescription && item.originalDescription !== item.description && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {item.originalDescription}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Parent Merchant */}
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="font-medium">{item.storeName}</span>
                          <span className="text-[10px] text-slate-400 block">{item.date}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                          style={{ backgroundColor: catColor }}
                        >
                          {item.category || "General"}
                        </span>
                      </td>

                      {/* Product Choice */}
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium">
                          {item.productChoice || "Kitchen Supply"}
                        </span>
                      </td>

                      {/* Qty */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                        {item.quantity}
                      </td>

                      {/* Unit Price */}
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 tabular-nums font-medium">
                        {(Number(item.unitPrice) || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* VAT Amount */}
                      <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 tabular-nums font-medium">
                        {(Number(item.vatAmount) || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Total Amount */}
                      <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {item.currency}{" "}
                        {(Number(item.totalAmount) || (item.quantity * item.unitPrice)).toLocaleString(
                          undefined,
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}
                      </td>

                      {/* Parent Link */}
                      <td className="py-2.5 px-3 text-center">
                        {parent && (
                          <button
                            type="button"
                            onClick={() => onSelectForDetails(parent)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Footer Summary bar */}
      <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
        <span>
          Showing {activeTab === "receipts" ? filteredReceipts.length : filteredLineItems.length} records
        </span>
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          Standard VAT 15% (Saudi Tax Law compliant)
        </span>
      </div>
    </div>
  );
};
