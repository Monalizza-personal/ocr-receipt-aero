import React, { useState, useEffect } from "react";
import {
  X,
  Languages,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Building2,
  FileText,
  Calendar,
  CreditCard,
  Percent,
  Receipt,
  Eye,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ExpenseReceipt, ExpenseItem } from "../types";
import { containsArabic } from "../utils/arabicDetector";
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCT_CHOICES } from "../data/seedData";

interface ReceiptDetailModalProps {
  receipt: ExpenseReceipt | null;
  onClose: () => void;
  onSave: (updated: ExpenseReceipt) => void;
}

export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receipt,
  onClose,
  onSave,
}) => {
  if (!receipt) return null;

  const [formData, setFormData] = useState<ExpenseReceipt>({ ...receipt });
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [productChoices, setProductChoices] = useState<string[]>(DEFAULT_PRODUCT_CHOICES);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [customCatInput, setCustomCatInput] = useState("");
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [customChoiceInput, setCustomChoiceInput] = useState("");
  const [showAddChoiceModal, setShowAddChoiceModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "image">("details");

  useEffect(() => {
    setFormData({ ...receipt });
  }, [receipt]);

  // Check if current text contains Arabic
  const hasArabic =
    containsArabic(formData.storeName) ||
    containsArabic(formData.storeAddress) ||
    formData.items.some((it) => containsArabic(it.description));

  // Recalculate totals from items
  const recalculateFromItems = (items: ExpenseItem[]) => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
    const vat = items.reduce((acc, it) => acc + (Number(it.vatAmount) || 0), 0);
    const grandTotal = items.reduce(
      (acc, it) => acc + (Number(it.totalAmount) || (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1) + (Number(it.vatAmount) || 0)),
      0
    );

    return {
      subtotal: Number(subtotal.toFixed(2)),
      vatTotal: Number(vat.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
    };
  };

  // Item field change handler
  const handleItemChange = (index: number, field: keyof ExpenseItem, value: any) => {
    const updatedItems = [...formData.items];
    const currentItem = { ...updatedItems[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      const qty = field === "quantity" ? Number(value) || 0 : currentItem.quantity;
      const price = field === "unitPrice" ? Number(value) || 0 : currentItem.unitPrice;
      const baseLineTotal = qty * price;
      const vatRate = 0.15; // 15% VAT default
      currentItem.vatAmount = Number((baseLineTotal * vatRate).toFixed(2));
      currentItem.totalAmount = Number((baseLineTotal + currentItem.vatAmount).toFixed(2));
    }

    if (field === "vatAmount") {
      const qty = currentItem.quantity || 1;
      const price = currentItem.unitPrice || 0;
      const baseLineTotal = qty * price;
      currentItem.totalAmount = Number((baseLineTotal + (Number(value) || 0)).toFixed(2));
    }

    updatedItems[index] = currentItem;
    const totals = recalculateFromItems(updatedItems);

    setFormData((prev) => ({
      ...prev,
      items: updatedItems,
      ...totals,
    }));
  };

  // Add new item row
  const handleAddItemRow = () => {
    const newItem: ExpenseItem = {
      id: "item_manual_" + Date.now(),
      description: "New Item Description",
      quantity: 1,
      unitPrice: 0,
      vatAmount: 0,
      totalAmount: 0,
      category: formData.category || "Food & Dining",
      productChoice: "Kitchen Essentials",
    };
    const updatedItems = [...formData.items, newItem];
    const totals = recalculateFromItems(updatedItems);
    setFormData((prev) => ({
      ...prev,
      items: updatedItems,
      ...totals,
    }));
  };

  // Remove item row
  const handleRemoveItem = (index: number) => {
    const updatedItems = formData.items.filter((_, i) => i !== index);
    const totals = recalculateFromItems(updatedItems);
    setFormData((prev) => ({
      ...prev,
      items: updatedItems,
      ...totals,
    }));
  };

  // AI Translation Handler
  const handleTranslateAll = async () => {
    setIsTranslating(true);
    setTranslationError(null);

    try {
      let translatedStore = formData.storeName;
      let translatedAddress = formData.storeAddress;

      // Translate Store Name
      if (formData.storeName && containsArabic(formData.storeName)) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: formData.storeName }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.translatedText) translatedStore = json.translatedText;
        }
      }

      // Translate Store Address
      if (formData.storeAddress && containsArabic(formData.storeAddress)) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: formData.storeAddress }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.translatedText) translatedAddress = json.translatedText;
        }
      }

      // Translate Item descriptions
      let updatedItems = [...formData.items];
      const itemsToTranslate = formData.items.map((it) => ({ description: it.description }));
      const resItems = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsToTranslate }),
      });

      if (resItems.ok) {
        const json = await resItems.json();
        if (Array.isArray(json.translatedItems) && json.translatedItems.length === updatedItems.length) {
          updatedItems = updatedItems.map((item, idx) => ({
            ...item,
            originalDescription: item.originalDescription || item.description,
            description: json.translatedItems[idx].description || item.description,
          }));
        }
      }

      setFormData((prev) => ({
        ...prev,
        storeName: translatedStore,
        originalStoreName: prev.originalStoreName || prev.storeName,
        storeAddress: translatedAddress,
        originalStoreAddress: prev.originalStoreAddress || prev.storeAddress,
        items: updatedItems,
        isTranslated: true,
      }));
    } catch (err: any) {
      console.error("Translation error:", err);
      setTranslationError("Translation API request failed. Please check network or retry.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Revert back to original Arabic
  const handleRevertOriginal = () => {
    setFormData((prev) => ({
      ...prev,
      storeName: prev.originalStoreName || prev.storeName,
      storeAddress: prev.originalStoreAddress || prev.storeAddress,
      items: prev.items.map((it) => ({
        ...it,
        description: it.originalDescription || it.description,
      })),
      isTranslated: false,
    }));
  };

  // Handle Save
  const handleSaveModal = () => {
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full my-auto shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20 font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                  Receipt Layout & Itemized Ledger
                </h3>
                <span className="text-xs bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-0.5 rounded-full font-bold">
                  {formData.invoiceNo || "INV-001"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                View extracted line items, detect script, translate and customize values
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              type="button"
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Translation & Detection Banner */}
        <div className="px-6 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Language & Translation Status:
            </span>
            {hasArabic || containsArabic(formData.originalStoreName) ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 shadow-2xs">
                🇸🇦 ARABIC DETECTED
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/60 shadow-2xs">
                ENG / Latin detected
              </span>
            )}

            {formData.isTranslated && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 shadow-2xs">
                Translated to English
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {formData.isTranslated ? (
              <button
                type="button"
                onClick={handleRevertOriginal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 shadow-2xs transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert to Original</span>
              </button>
            ) : (
              <button
                id="btn-translate-receipt-english"
                type="button"
                onClick={handleTranslateAll}
                disabled={isTranslating}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition cursor-pointer"
              >
                {isTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
                <span>{isTranslating ? "Translating with AI..." : "Translate to English"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Translation error if any */}
        {translationError && (
          <div className="px-6 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 border-b border-rose-200 dark:border-rose-900">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>{translationError}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Image Preview and Store Info split */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Visual Receipt Preview (4 cols) */}
            <div className="md:col-span-4 flex flex-col">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Visual Receipt Proof</span>
                {formData.imageUrl && <span className="text-emerald-500 text-[11px] font-medium">Loaded</span>}
              </h4>

              <div className="relative aspect-3/4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center group shadow-xs">
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Receipt visual proof"
                    className="w-full h-full object-contain p-2 hover:scale-105 transition duration-300"
                  />
                ) : formData.isPdf ? (
                  <div className="flex flex-col items-center justify-center p-4 text-slate-400 text-center space-y-2">
                    <FileText className="w-12 h-12 text-slate-400" />
                    <span className="text-xs font-semibold">PDF Document Attached</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 text-slate-400 text-center space-y-2">
                    <Receipt className="w-10 h-10 text-slate-400/60" />
                    <span className="text-xs">No Source Image File</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-bold text-white">
                  {formData.isPdf ? "Source Document (PDF)" : "Source Image (OCR)"}
                </div>
              </div>
            </div>

            {/* Store & Financial Info (8 cols) */}
            <div className="md:col-span-8 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Store & Ledger Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Store Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Merchant Store Name
                  </label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                  />
                </div>

                {/* Invoice # */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Invoice or Receipt No.
                  </label>
                  <input
                    type="text"
                    value={formData.invoiceNo || ""}
                    onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Expense Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCatModal(true)}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      + Custom Category
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tax ID */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    VAT Registration ID
                  </label>
                  <input
                    type="text"
                    value={formData.taxId || ""}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder="310423670800003"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                  />
                </div>

                {/* Date & Time */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                  >
                    <option value="Card">Card / Debit</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Apple Pay">Apple Pay / Mada</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Store Address & Location
                </label>
                <input
                  type="text"
                  value={formData.storeAddress || ""}
                  onChange={(e) => setFormData({ ...formData, storeAddress: e.target.value })}
                  placeholder="Street, City, Branch"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
                />
              </div>

              {/* Calculations Summary Box */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    Subtotal Before VAT
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.subtotal || 0}
                      onChange={(e) => setFormData({ ...formData, subtotal: Number(e.target.value) || 0 })}
                      className="w-24 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                    />
                    <span className="text-xs text-slate-400 font-semibold">{formData.currency}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    VAT / Tax Total (15%)
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.vatTotal || 0}
                      onChange={(e) => setFormData({ ...formData, vatTotal: Number(e.target.value) || 0 })}
                      className="w-24 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                    />
                    <span className="text-xs text-slate-400 font-semibold">{formData.currency}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                    Grand Total Billed
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.grandTotal || 0}
                      onChange={(e) => setFormData({ ...formData, grandTotal: Number(e.target.value) || 0 })}
                      className="w-28 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-600 rounded"
                    />
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      {formData.currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Ledger Line Items Breakdown */}
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ledger Line Items Breakdown
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Itemized product lines with unit price, VAT, and choice classification
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {formData.items.length} listed items
              </span>
            </div>

            {/* Line items Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Itemized Product Description</th>
                    <th className="py-2.5 px-3 w-32">Category</th>
                    <th className="py-2.5 px-3 w-36">Product Choice</th>
                    <th className="py-2.5 px-2 w-16 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-24 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 w-20 text-right">VAT (15%)</th>
                    <th className="py-2.5 px-3 w-24 text-right">Total Amount</th>
                    <th className="py-2.5 px-2 w-12 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {formData.items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400 text-xs">
                        No itemized lines recorded. Click "+ Add New Item Line" below.
                      </td>
                    </tr>
                  ) : (
                    formData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        {/* Description */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 rounded font-medium text-slate-900 dark:text-slate-100"
                          />
                        </td>

                        {/* Category */}
                        <td className="py-2 px-3">
                          <select
                            value={item.category || formData.category}
                            onChange={(e) => handleItemChange(idx, "category", e.target.value)}
                            className="w-full px-1.5 py-1 bg-transparent border-b border-transparent focus:border-emerald-500 text-xs font-semibold rounded"
                          >
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Product Choice */}
                        <td className="py-2 px-3">
                          <select
                            value={item.productChoice || "Kitchen Essentials"}
                            onChange={(e) => handleItemChange(idx, "productChoice", e.target.value)}
                            className="w-full px-1.5 py-1 bg-transparent border-b border-transparent focus:border-emerald-500 text-xs rounded"
                          >
                            {productChoices.map((pc) => (
                              <option key={pc} value={pc}>
                                {pc}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-12 text-center px-1 py-1 bg-transparent border-b border-transparent focus:border-emerald-500 font-bold"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                            className="w-20 text-right px-1 py-1 bg-transparent border-b border-transparent focus:border-emerald-500 font-semibold"
                          />
                        </td>

                        {/* VAT Amount */}
                        <td className="py-2 px-3 text-right font-medium text-slate-500">
                          {(item.vatAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>

                        {/* Total Amount */}
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {(item.totalAmount || item.quantity * item.unitPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>

                        {/* Delete row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Add Item Button */}
            <div className="flex items-center justify-between pt-1">
              <button
                id="btn-add-new-receipt-item-line"
                type="button"
                onClick={handleAddItemRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add New Receipt Item Line</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddChoiceModal(true)}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                + Add Product Choice Classification
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Billed:{" "}
            <span className="font-extrabold text-slate-900 dark:text-white">
              {formData.currency} {formData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-receipt-changes"
              type="button"
              onClick={handleSaveModal}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Apply Changes</span>
            </button>
          </div>
        </div>

        {/* Custom Category Modal */}
        {showAddCatModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Add Custom Category
              </h4>
              <input
                type="text"
                value={customCatInput}
                onChange={(e) => setCustomCatInput(e.target.value)}
                placeholder="e.g. Seafood & Poultry, Tableware..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customCatInput.trim()) {
                      const newCat = customCatInput.trim();
                      setCategories((prev) => [...prev, newCat]);
                      setFormData((prev) => ({ ...prev, category: newCat }));
                      setCustomCatInput("");
                      setShowAddCatModal(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Add Category
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Product Choice Modal */}
        {showAddChoiceModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Add Product Choice Classification
              </h4>
              <input
                type="text"
                value={customChoiceInput}
                onChange={(e) => setCustomChoiceInput(e.target.value)}
                placeholder="e.g. Organic Dairy, Frozen Meat..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddChoiceModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customChoiceInput.trim()) {
                      const newChoice = customChoiceInput.trim();
                      setProductChoices((prev) => [...prev, newChoice]);
                      setCustomChoiceInput("");
                      setShowAddChoiceModal(false);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Add Choice
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
