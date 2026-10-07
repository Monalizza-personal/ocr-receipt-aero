import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
  Lock,
  Percent,
  Calendar,
  X,
  RotateCcw,
  Download,
  SlidersHorizontal,
} from "lucide-react";
import { ExpenseReceipt, ViewTab, ExpenseItem } from "../types";
import { CATEGORY_COLORS, DEFAULT_CATEGORIES, DEFAULT_PRODUCT_CHOICES } from "../data/seedData";
import { getStoredProductChoices, getStoredCategories } from "../utils/choices";
import { exportReceiptsCSV, exportLineItemsCSV } from "../utils/csvExport";
import {
  STANDARD_VAT_RATE,
  isItemVatApplicable,
  toggleItemVat,
  recalculateReceiptTotals,
} from "../utils/vatCalculations";

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
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [datePreset, setDatePreset] = useState<string>("all");
  const [vatFilter, setVatFilter] = useState<"all" | "with-vat" | "no-vat">("all");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [receiptPendingDelete, setReceiptPendingDelete] = useState<ExpenseReceipt | null>(null);

  const handleApplyPreset = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      const today = fmt(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "last7") {
      const end = fmt(now);
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setStartDate(fmt(d));
      setEndDate(end);
    } else if (preset === "last30") {
      const end = fmt(now);
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setStartDate(fmt(d));
      setEndDate(end);
    } else if (preset === "thisMonth") {
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = `${y}-${pad(m + 1)}-01`;
      const last = new Date(y, m + 1, 0);
      setStartDate(start);
      setEndDate(fmt(last));
    } else if (preset === "lastMonth") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = prev.getFullYear();
      const m = prev.getMonth();
      const start = `${y}-${pad(m + 1)}-01`;
      const last = new Date(y, m + 1, 0);
      setStartDate(start);
      setEndDate(fmt(last));
    } else if (preset === "thisYear") {
      setStartDate(`${now.getFullYear()}-01-01`);
      setEndDate(`${now.getFullYear()}-12-31`);
    }
  };

  const handleSortHeader = (field: string) => {
    if (sortBy === `${field}-desc`) {
      setSortBy(`${field}-asc`);
    } else if (sortBy === `${field}-asc`) {
      setSortBy(`${field}-desc`);
    } else {
      if (["date", "amount", "vat", "subtotal", "unitPrice", "qty", "items"].includes(field)) {
        setSortBy(`${field}-desc`);
      } else {
        setSortBy(`${field}-asc`);
      }
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortBy === `${field}-desc`) {
      return <ArrowDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline ml-1 shrink-0" />;
    }
    if (sortBy === `${field}-asc`) {
      return <ArrowUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 inline ml-1 shrink-0" />;
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-40 group-hover/th:opacity-100 inline ml-1 shrink-0 transition" />;
  };

  const availableChoices = useMemo(() => {
    const stored = getStoredProductChoices();
    const fromReceipts = receipts.flatMap((r) =>
      (r.items || []).map((it) => it.productChoice).filter(Boolean) as string[]
    );
    return Array.from(new Set([...stored, ...fromReceipts])).sort();
  }, [receipts]);

  const availableCategories = useMemo(() => {
    const stored = getStoredCategories();
    const fromReceipts = receipts.map((r) => r.category).filter(Boolean);
    return Array.from(new Set([...stored, ...fromReceipts])).sort();
  }, [receipts]);

  // Flattened line items array with parent metadata and original index
  const allLineItems = receipts.flatMap((r) =>
    (r.items || []).map((it, itemIndex) => ({
      ...it,
      itemIndex,
      parentReceiptId: r.id,
      storeName: r.storeName,
      date: r.date,
      invoiceNo: r.invoiceNo,
      currency: r.currency,
      imageUrl: r.imageUrl,
    }))
  );

  // Toggle line item VAT (Got VAT 15% vs No VAT 0%) without changing total amount
  const handleToggleLineItemVat = (parentReceiptId: string, itemIndex: number, newHasVat: boolean) => {
    const parent = receipts.find((r) => r.id === parentReceiptId);
    if (!parent || !parent.items || !parent.items[itemIndex]) return;

    const updatedItems = [...parent.items];
    const amended = toggleItemVat(updatedItems[itemIndex], newHasVat);
    updatedItems[itemIndex] = amended;
    const totals = recalculateReceiptTotals(updatedItems);

    onUpdateReceipt(parentReceiptId, {
      ...parent,
      items: updatedItems,
      ...totals,
    });
  };

  // Change line item product choice / classification
  const handleUpdateItemChoice = (parentReceiptId: string, itemIndex: number, newChoice: string) => {
    const parent = receipts.find((r) => r.id === parentReceiptId);
    if (!parent || !parent.items || !parent.items[itemIndex]) return;

    const updatedItems = [...parent.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      productChoice: newChoice,
    };

    onUpdateReceipt(parentReceiptId, {
      ...parent,
      items: updatedItems,
    });
  };

  // Change line item category
  const handleUpdateItemCategory = (parentReceiptId: string, itemIndex: number, newCategory: string) => {
    const parent = receipts.find((r) => r.id === parentReceiptId);
    if (!parent || !parent.items || !parent.items[itemIndex]) return;

    const updatedItems = [...parent.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      category: newCategory,
    };

    onUpdateReceipt(parentReceiptId, {
      ...parent,
      items: updatedItems,
    });
  };

  const matchDate = (dateStr?: string) => {
    if (!startDate && !endDate) return true;
    if (!dateStr) return false;
    const clean = dateStr.trim().slice(0, 10);
    if (startDate && clean < startDate) return false;
    if (endDate && clean > endDate) return false;
    return true;
  };

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts
      .filter((r) => {
        const sName = (r.storeName || "").toLowerCase();
        const inv = (r.invoiceNo || "").toLowerCase();
        const notes = (r.notes || "").toLowerCase();
        const sTerm = searchTerm.toLowerCase();

        const matchSearch =
          searchTerm === "" ||
          sName.includes(sTerm) ||
          inv.includes(sTerm) ||
          notes.includes(sTerm) ||
          (Array.isArray(r.items) &&
            r.items.some((it) => (it?.description || "").toLowerCase().includes(sTerm)));

        const matchCat = selectedCategory === "All Categories" || r.category === selectedCategory;
        const inDateRange = matchDate(r.date);

        const matchVat =
          vatFilter === "all"
            ? true
            : vatFilter === "with-vat"
            ? (Number(r.vatTotal) || 0) > 0
            : (Number(r.vatTotal) || 0) === 0;

        return matchSearch && matchCat && inDateRange && matchVat;
      })
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        const validTimeA = isNaN(timeA) ? 0 : timeA;
        const validTimeB = isNaN(timeB) ? 0 : timeB;

        switch (sortBy) {
          case "date-desc":
            return validTimeB - validTimeA;
          case "date-asc":
            return validTimeA - validTimeB;
          case "amount-desc":
            return (Number(b.grandTotal) || 0) - (Number(a.grandTotal) || 0);
          case "amount-asc":
            return (Number(a.grandTotal) || 0) - (Number(b.grandTotal) || 0);
          case "store-asc":
            return (a.storeName || "").localeCompare(b.storeName || "");
          case "store-desc":
            return (b.storeName || "").localeCompare(a.storeName || "");
          case "category-asc":
            return (a.category || "").localeCompare(b.category || "");
          case "category-desc":
            return (b.category || "").localeCompare(a.category || "");
          case "invoice-asc":
            return (a.invoiceNo || "").localeCompare(b.invoiceNo || "");
          case "invoice-desc":
            return (b.invoiceNo || "").localeCompare(a.invoiceNo || "");
          case "vat-desc":
            return (Number(b.vatTotal) || 0) - (Number(a.vatTotal) || 0);
          case "vat-asc":
            return (Number(a.vatTotal) || 0) - (Number(b.vatTotal) || 0);
          case "subtotal-desc":
            return (Number(b.subtotal) || 0) - (Number(a.subtotal) || 0);
          case "subtotal-asc":
            return (Number(a.subtotal) || 0) - (Number(b.subtotal) || 0);
          case "items-desc":
            return (b.items ? b.items.length : 0) - (a.items ? a.items.length : 0);
          case "items-asc":
            return (a.items ? a.items.length : 0) - (b.items ? b.items.length : 0);
          default:
            return validTimeB - validTimeA;
        }
      });
  }, [receipts, searchTerm, selectedCategory, startDate, endDate, vatFilter, sortBy]);

  // Filter line items
  const filteredLineItems = useMemo(() => {
    return allLineItems
      .filter((it) => {
        const desc = (it.description || "").toLowerCase();
        const sName = (it.storeName || "").toLowerCase();
        const inv = (it.invoiceNo || "").toLowerCase();
        const sTerm = searchTerm.toLowerCase();

        const matchSearch =
          searchTerm === "" ||
          desc.includes(sTerm) ||
          sName.includes(sTerm) ||
          inv.includes(sTerm);

        const matchCat =
          selectedCategory === "All Categories" || (it.category || "General") === selectedCategory;

        const matchChoice =
          selectedChoice === "All Choices" || (it.productChoice || "General") === selectedChoice;

        const inDateRange = matchDate(it.date);
        const hasVat = isItemVatApplicable(it);
        const matchVat =
          vatFilter === "all" ? true : vatFilter === "with-vat" ? hasVat : !hasVat;

        return matchSearch && matchCat && matchChoice && inDateRange && matchVat;
      })
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        const validTimeA = isNaN(timeA) ? 0 : timeA;
        const validTimeB = isNaN(timeB) ? 0 : timeB;

        const totalA =
          Number(a.totalAmount) ||
          (Number(a.unitPrice) || 0) * (Number(a.quantity) || 1) + (Number(a.vatAmount) || 0);
        const totalB =
          Number(b.totalAmount) ||
          (Number(b.unitPrice) || 0) * (Number(b.quantity) || 1) + (Number(b.vatAmount) || 0);

        switch (sortBy) {
          case "date-desc":
            return validTimeB - validTimeA;
          case "date-asc":
            return validTimeA - validTimeB;
          case "amount-desc":
            return totalB - totalA;
          case "amount-asc":
            return totalA - totalB;
          case "desc-asc":
            return (a.description || "").localeCompare(b.description || "");
          case "desc-desc":
            return (b.description || "").localeCompare(a.description || "");
          case "store-asc":
            return (a.storeName || "").localeCompare(b.storeName || "");
          case "store-desc":
            return (b.storeName || "").localeCompare(a.storeName || "");
          case "category-asc":
            return (a.category || "").localeCompare(b.category || "");
          case "category-desc":
            return (b.category || "").localeCompare(a.category || "");
          case "choice-asc":
            return (a.productChoice || "").localeCompare(b.productChoice || "");
          case "choice-desc":
            return (b.productChoice || "").localeCompare(a.productChoice || "");
          case "unitPrice-desc":
            return (Number(b.unitPrice) || 0) - (Number(a.unitPrice) || 0);
          case "unitPrice-asc":
            return (Number(a.unitPrice) || 0) - (Number(b.unitPrice) || 0);
          case "qty-desc":
            return (Number(b.quantity) || 1) - (Number(a.quantity) || 1);
          case "qty-asc":
            return (Number(a.quantity) || 1) - (Number(b.quantity) || 1);
          case "vat-desc":
            return (Number(b.vatAmount) || 0) - (Number(a.vatAmount) || 0);
          case "vat-asc":
            return (Number(a.vatAmount) || 0) - (Number(b.vatAmount) || 0);
          default:
            return validTimeB - validTimeA;
        }
      });
  }, [allLineItems, searchTerm, selectedCategory, selectedChoice, startDate, endDate, vatFilter, sortBy]);

  const isFiltered =
    searchTerm.trim() !== "" ||
    startDate !== "" ||
    endDate !== "" ||
    selectedCategory !== "All Categories" ||
    (activeTab === "items" && selectedChoice !== "All Choices") ||
    vatFilter !== "all";

  const handleResetFilters = () => {
    setSearchTerm("");
    setStartDate("");
    setEndDate("");
    setDatePreset("all");
    setSelectedCategory("All Categories");
    setSelectedChoice("All Choices");
    setVatFilter("all");
  };

  const filteredReceiptsSummary = useMemo(() => {
    const totalAmount = filteredReceipts.reduce((acc, r) => acc + (Number(r.grandTotal) || 0), 0);
    const totalVat = filteredReceipts.reduce((acc, r) => acc + (Number(r.vatTotal) || 0), 0);
    const totalSubtotal = filteredReceipts.reduce((acc, r) => acc + (Number(r.subtotal) || 0), 0);
    return { totalAmount, totalVat, totalSubtotal };
  }, [filteredReceipts]);

  const filteredLineItemsSummary = useMemo(() => {
    const totalAmount = filteredLineItems.reduce((acc, it) => {
      const amt =
        Number(it.totalAmount) ||
        (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1) + (Number(it.vatAmount) || 0);
      return acc + amt;
    }, 0);
    const totalVat = filteredLineItems.reduce((acc, it) => acc + (Number(it.vatAmount) || 0), 0);
    return { totalAmount, totalVat };
  }, [filteredLineItems]);

  const handleExportFiltered = () => {
    if (activeTab === "receipts") {
      exportReceiptsCSV(filteredReceipts);
    } else {
      const pseudoReceipts: ExpenseReceipt[] = filteredLineItems.map((it) => ({
        id: it.parentReceiptId,
        storeName: it.storeName,
        date: it.date,
        invoiceNo: it.invoiceNo,
        category: it.category || "General",
        currency: it.currency || "SAR",
        subtotal: (it.unitPrice || 0) * (it.quantity || 1),
        vatTotal: it.vatAmount || 0,
        grandTotal: it.totalAmount || 0,
        items: [it],
      }));
      exportLineItemsCSV(pseudoReceipts);
    }
  };

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
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        {/* Row 1: Search & Date Range & Primary Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search input with Clear icon */}
          <div className="relative flex-1 min-w-[240px] max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="ledger-search-input"
              type="text"
              placeholder="Search stores, items, invoice #, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9.5 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Selector: Quick Presets + From Date + To Date */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            {/* Quick Preset Selector */}
            <div className="relative">
              <select
                id="date-preset-selector"
                value={datePreset}
                onChange={(e) => handleApplyPreset(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 pr-7 appearance-none cursor-pointer focus:outline-emerald-500"
                title="Quick date filter preset"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="last7">Last 7 Days</option>
                <option value="last30">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="thisYear">This Year</option>
                {datePreset === "custom" && <option value="custom">Custom Range</option>}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* From Date */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From:</span>
              <input
                id="date-filter-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="text-xs bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
                title="Filter start date"
              />
              {startDate && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate("");
                    if (!endDate) setDatePreset("all");
                    else setDatePreset("custom");
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear start date"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* To Date */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To:</span>
              <input
                id="date-filter-end"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset("custom");
                }}
                className="text-xs bg-transparent text-slate-800 dark:text-slate-200 font-semibold focus:outline-hidden cursor-pointer"
                title="Filter end date"
              />
              {endDate && (
                <button
                  type="button"
                  onClick={() => {
                    setEndDate("");
                    if (!startDate) setDatePreset("all");
                    else setDatePreset("custom");
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Clear end date"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setDatePreset("all");
                }}
                className="px-2 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                title="Clear date range"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters + Sorting + View Export */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="relative">
              <select
                id="select-filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
              >
                <option value="All Categories">All Categories</option>
                {availableCategories.map((cat) => (
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
                  id="select-filter-by-choice"
                  value={selectedChoice}
                  onChange={(e) => setSelectedChoice(e.target.value)}
                  className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
                >
                  <option value="All Choices">All Choices</option>
                  {availableChoices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Tax / VAT Filter */}
            <div className="relative">
              <select
                id="select-filter-vat"
                value={vatFilter}
                onChange={(e) => setVatFilter(e.target.value as any)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
              >
                <option value="all">All Tax Statuses</option>
                <option value="with-vat">Got VAT (15%)</option>
                <option value="no-vat">No VAT (0% Exempt)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                id="select-sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:outline-emerald-500 text-slate-700 dark:text-slate-300 pr-8 appearance-none cursor-pointer"
              >
                <option value="date-desc">Date: Newest First</option>
                <option value="date-asc">Date: Oldest First</option>
                <option value="amount-desc">Amount: Highest First</option>
                <option value="amount-asc">Amount: Lowest First</option>
                <option value="store-asc">Merchant: A → Z</option>
                <option value="store-desc">Merchant: Z → A</option>
                <option value="category-asc">Category: A → Z</option>
                <option value="invoice-asc">Invoice #: A → Z</option>
                <option value="vat-desc">VAT: Highest First</option>
                <option value="subtotal-desc">Subtotal: Highest First</option>
                {activeTab === "receipts" && <option value="items-desc">Items: Most First</option>}
                {activeTab === "items" && <option value="desc-asc">Product: A → Z</option>}
                {activeTab === "items" && <option value="unitPrice-desc">Unit Price: Highest First</option>}
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Export Filtered View Button */}
          <div className="flex items-center gap-2">
            <button
              id="btn-export-filtered-view"
              type="button"
              onClick={handleExportFiltered}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
              title={`Download ${activeTab === 'receipts' ? filteredReceipts.length : filteredLineItems.length} filtered items as CSV`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV ({activeTab === "receipts" ? filteredReceipts.length : filteredLineItems.length})</span>
            </button>
          </div>
        </div>

        {/* Row 3: Active Filter Chips Bar & Live Totals */}
        {isFiltered && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-emerald-50/50 dark:bg-slate-800/40 border border-emerald-100 dark:border-slate-800 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-emerald-600" />
                Active Filters:
              </span>

              {/* Date Tag */}
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs">
                  <Calendar className="w-3 h-3 text-emerald-600" />
                  <span>
                    {startDate ? startDate : "Start"} → {endDate ? endDate : "End"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setDatePreset("all");
                    }}
                    className="hover:text-rose-500 cursor-pointer ml-0.5"
                    title="Remove date filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Search Tag */}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs">
                  <span>Search: "{searchTerm}"</span>
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="hover:text-rose-500 cursor-pointer ml-0.5"
                    title="Remove search filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Category Tag */}
              {selectedCategory !== "All Categories" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs">
                  <span>Category: {selectedCategory}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory("All Categories")}
                    className="hover:text-rose-500 cursor-pointer ml-0.5"
                    title="Remove category filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Choice Tag */}
              {activeTab === "items" && selectedChoice !== "All Choices" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs">
                  <span>Choice: {selectedChoice}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedChoice("All Choices")}
                    className="hover:text-rose-500 cursor-pointer ml-0.5"
                    title="Remove choice filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* VAT Tag */}
              {vatFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-2xs">
                  <span>Tax: {vatFilter === "with-vat" ? "Got VAT (15%)" : "No VAT (0% Exempt)"}</span>
                  <button
                    type="button"
                    onClick={() => setVatFilter("all")}
                    className="hover:text-rose-500 cursor-pointer ml-0.5"
                    title="Remove tax status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Reset All Button */}
              <button
                id="btn-reset-all-filters"
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-xs transition cursor-pointer border border-rose-200/60 dark:border-rose-800/60 ml-1"
                title="Clear all active filters"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            </div>

            {/* Filtered Financial Metrics Summary */}
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-3">
              <span>
                Filtered Total:{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-black">
                  SAR{" "}
                  {(activeTab === "receipts"
                    ? filteredReceiptsSummary.totalAmount
                    : filteredLineItemsSummary.totalAmount
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
              <span>
                Filtered VAT:{" "}
                <span className="text-amber-600 dark:text-amber-400 font-black">
                  SAR{" "}
                  {(activeTab === "receipts"
                    ? filteredReceiptsSummary.totalVat
                    : filteredLineItemsSummary.totalVat
                  ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Table Content Area */}
      <div className="overflow-x-auto">
        {activeTab === "receipts" ? (
          /* TAB 1: RECEIPTS SUMMARY TABLE */
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-14 text-center">Proof</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("store")}
                  title="Click to sort by Merchant Name"
                >
                  <div className="flex items-center gap-1">
                    <span>Merchant / Store Name</span>
                    {renderSortIcon("store")}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("invoice")}
                  title="Click to sort by Invoice #"
                >
                  <div className="flex items-center gap-1">
                    <span>Invoice #</span>
                    {renderSortIcon("invoice")}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("date")}
                  title="Click to sort by Transaction Date"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {renderSortIcon("date")}
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("category")}
                  title="Click to sort by Category"
                >
                  <div className="flex items-center gap-1">
                    <span>Category</span>
                    {renderSortIcon("category")}
                  </div>
                </th>
                <th className="py-3 px-3">Tax ID</th>
                <th
                  className="py-3 px-2 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("items")}
                  title="Click to sort by Item Count"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Items</span>
                    {renderSortIcon("items")}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("subtotal")}
                  title="Click to sort by Subtotal"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Subtotal</span>
                    {renderSortIcon("subtotal")}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("vat")}
                  title="Click to sort by VAT Amount"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>VAT (15%)</span>
                    {renderSortIcon("vat")}
                  </div>
                </th>
                <th
                  className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                  onClick={() => handleSortHeader("amount")}
                  title="Click to sort by Grand Total"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Grand Total</span>
                    {renderSortIcon("amount")}
                  </div>
                </th>
                <th className="py-3 px-3 w-28 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                      <p className="text-sm font-medium">No expense records found matching filters.</p>
                      {isFiltered && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset all filters</span>
                        </button>
                      )}
                    </div>
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
                            id={`btn-delete-receipt-${r.id}`}
                            type="button"
                            onClick={() => setReceiptPendingDelete(r)}
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
          <div className="space-y-2">
            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-300">
              <div className="flex items-center gap-2">
                <Percent className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Amend VAT & Classification in Ledger:</strong> Click <strong>VAT 15%</strong> or <strong>No VAT (0%)</strong>, or select a new Category or Choice classification. The total billed amount is <strong>strictly locked and preserved</strong>.
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                {filteredLineItems.length} lines
              </span>
            </div>

            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th
                    className="py-3 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("desc")}
                    title="Click to sort by Product Description"
                  >
                    <div className="flex items-center gap-1">
                      <span>Itemized Product Description</span>
                      {renderSortIcon("desc")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("store")}
                    title="Click to sort by Parent Merchant"
                  >
                    <div className="flex items-center gap-1">
                      <span>Parent Merchant</span>
                      {renderSortIcon("store")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("date")}
                    title="Click to sort by Transaction Date"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      {renderSortIcon("date")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 w-40 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("category")}
                    title="Click to sort by Category"
                  >
                    <div className="flex items-center gap-1">
                      <span>Category</span>
                      {renderSortIcon("category")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 w-44 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("choice")}
                    title="Click to sort by Classification Choice"
                  >
                    <div className="flex items-center gap-1">
                      <span>Choice / Classification</span>
                      {renderSortIcon("choice")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-2 text-center w-12 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("qty")}
                    title="Click to sort by Quantity"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Qty</span>
                      {renderSortIcon("qty")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right w-20 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("unitPrice")}
                    title="Click to sort by Unit Price"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Unit Price</span>
                      {renderSortIcon("unitPrice")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-center w-44 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("vat")}
                    title="Click to sort by VAT Amount"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>VAT Status (Amend)</span>
                      {renderSortIcon("vat")}
                    </div>
                  </th>
                  <th
                    className="py-3 px-3 text-right w-28 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition select-none group/th"
                    onClick={() => handleSortHeader("amount")}
                    title="Click to sort by Total Amount"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Amount</span>
                      {renderSortIcon("amount")}
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center w-16">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredLineItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                        <p className="text-sm font-medium">No itemized products found matching filters.</p>
                        {isFiltered && (
                          <button
                            type="button"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reset all filters</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLineItems.map((item, idx) => {
                    const parent = receipts.find((r) => r.id === item.parentReceiptId);
                    const hasVat = isItemVatApplicable(item);
                    const totalAmt =
                      Number(item.totalAmount) ||
                      (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1) +
                        (Number(item.vatAmount) || 0);

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
                          <span className="font-medium">{item.storeName}</span>
                        </td>

                        {/* Transaction Date */}
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap font-medium">
                          {item.date}
                        </td>

                        {/* Category Classification (Editable) */}
                        <td className="py-2.5 px-3">
                          <select
                            value={item.category || "General"}
                            onChange={(e) =>
                              handleUpdateItemCategory(item.parentReceiptId, item.itemIndex, e.target.value)
                            }
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer focus:border-emerald-500 focus:outline-hidden"
                            title="Change item category classification"
                          >
                            {availableCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Product Choice / Classification (Editable) */}
                        <td className="py-2.5 px-3">
                          <select
                            value={item.productChoice || "General"}
                            onChange={(e) =>
                              handleUpdateItemChoice(item.parentReceiptId, item.itemIndex, e.target.value)
                            }
                            className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer focus:border-emerald-500 focus:outline-hidden"
                            title="Change item classification choice"
                          >
                            {availableChoices.map((pc) => (
                              <option key={pc} value={pc}>
                                {pc}
                              </option>
                            ))}
                          </select>
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

                        {/* VAT Status (Interactive Toggle) */}
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleLineItemVat(item.parentReceiptId, item.itemIndex, true)
                                }
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                  hasVat
                                    ? "bg-amber-500 text-white shadow-xs"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="Amend to Got VAT (15%) - Total amount unchanged"
                              >
                                VAT 15%
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleLineItemVat(item.parentReceiptId, item.itemIndex, false)
                                }
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                  !hasVat
                                    ? "bg-slate-700 text-white dark:bg-slate-600 shadow-xs"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="Amend to No VAT (0% Exempt) - Total amount unchanged"
                              >
                                No VAT (0%)
                              </button>
                            </div>
                            <span className="text-[10px] tabular-nums font-semibold text-slate-500 dark:text-slate-400">
                              {hasVat
                                ? `VAT: ${(Number(item.vatAmount) || 0).toFixed(2)}`
                                : "0.00 (Exempt)"}
                            </span>
                          </div>
                        </td>

                        {/* Total Amount (Preserved & Locked) */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {item.currency} {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span
                              className="text-[10px] text-slate-400 flex items-center gap-0.5 font-medium"
                              title="Billed total is preserved when amending VAT or classification"
                            >
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                              <span>Locked</span>
                            </span>
                          </div>
                        </td>

                        {/* Parent Link */}
                        <td className="py-2.5 px-3 text-center">
                          {parent && (
                            <button
                              type="button"
                              onClick={() => onSelectForDetails(parent)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              title="Inspect full parent receipt"
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
          </div>
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

      {/* In-App Delete Confirmation Modal (Avoids window.confirm iframe blocking) */}
      {receiptPendingDelete && (
        <div
          id="modal-delete-receipt-confirm"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Receipt Record?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Merchant / Store:</span>
                <span className="font-bold text-slate-900 dark:text-white">{receiptPendingDelete.storeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{receiptPendingDelete.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {receiptPendingDelete.currency}{" "}
                  {Number(receiptPendingDelete.grandTotal || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              {receiptPendingDelete.items && receiptPendingDelete.items.length > 0 && (
                <div className="flex justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700 text-slate-400">
                  <span>Itemized lines:</span>
                  <span>{receiptPendingDelete.items.length} line items</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                id="btn-cancel-delete-receipt"
                type="button"
                onClick={() => setReceiptPendingDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-delete-receipt"
                type="button"
                onClick={() => {
                  onDeleteReceipt(receiptPendingDelete.id);
                  setReceiptPendingDelete(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
