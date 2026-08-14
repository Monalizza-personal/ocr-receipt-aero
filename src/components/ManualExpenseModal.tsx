import React, { useState } from "react";
import { X, Plus, Trash2, CheckCircle2, DollarSign, Calendar, Building2 } from "lucide-react";
import { ExpenseReceipt, ExpenseItem } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCT_CHOICES } from "../data/seedData";

interface ManualExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (expense: ExpenseReceipt) => void;
}

export const ManualExpenseModal: React.FC<ManualExpenseModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [storeName, setStoreName] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("INV-" + Math.floor(1000 + Math.random() * 9000));
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("Food & Dining");
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const [storeAddress, setStoreAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ExpenseItem[]>([
    {
      id: "item_1",
      description: "Kitchen Consumables / Food Item",
      quantity: 1,
      unitPrice: 100,
      vatAmount: 15,
      totalAmount: 115,
      category: "Food & Dining",
      productChoice: "Kitchen Essentials",
    },
  ]);

  const handleItemChange = (index: number, field: keyof ExpenseItem, val: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: val };
    if (field === "quantity" || field === "unitPrice") {
      const q = field === "quantity" ? Number(val) || 0 : item.quantity;
      const p = field === "unitPrice" ? Number(val) || 0 : item.unitPrice;
      const base = q * p;
      item.vatAmount = Number((base * 0.15).toFixed(2));
      item.totalAmount = Number((base + item.vatAmount).toFixed(2));
    }
    updated[index] = item;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: "item_" + Date.now(),
        description: "",
        quantity: 1,
        unitPrice: 0,
        vatAmount: 0,
        totalAmount: 0,
        category: category,
        productChoice: "Kitchen Essentials",
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((acc, it) => acc + (it.unitPrice || 0) * (it.quantity || 1), 0);
  const vatTotal = items.reduce((acc, it) => acc + (it.vatAmount || 0), 0);
  const grandTotal = items.reduce((acc, it) => acc + (it.totalAmount || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      alert("Please enter a merchant or store name.");
      return;
    }

    const newReceipt: ExpenseReceipt = {
      id: "rec_man_" + Date.now(),
      storeName: storeName.trim(),
      originalStoreName: storeName.trim(),
      invoiceNo: invoiceNo.trim() || "INV-MANUAL",
      date,
      time: "12:00",
      category,
      paymentMethod,
      currency: "SAR",
      storeAddress: storeAddress.trim(),
      originalStoreAddress: storeAddress.trim(),
      taxId: taxId.trim(),
      notes: notes.trim() || "Manually recorded expense voucher",
      items,
      subtotal: Number(subtotal.toFixed(2)),
      vatTotal: Number(vatTotal.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      createdAt: Date.now(),
    };

    onAdd(newReceipt);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl max-w-2xl w-full my-auto shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Add Manual Expense Row</h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Merchant / Vendor Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Medina Food Supplies"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Invoice / Receipt #
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              >
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Transaction Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              >
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Apple Pay">Apple Pay</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Tax ID / VAT #
              </label>
              <input
                type="text"
                placeholder="Optional VAT number"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-emerald-500"
              />
            </div>
          </div>

          {/* Items Sub-table */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Line Items
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-2"
                >
                  <input
                    type="text"
                    required
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                    className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded"
                  />
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                      className="w-14 px-2 py-1 text-xs text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                      className="w-20 px-2 py-1 text-xs text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded"
                    />
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 w-20 text-right">
                      SAR {item.totalAmount}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Subtotal: </span>
              <span className="font-bold">SAR {subtotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500">VAT (15%): </span>
              <span className="font-bold">SAR {vatTotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">Grand Total: </span>
              <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">
                SAR {grandTotal.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            >
              Save Manual Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
