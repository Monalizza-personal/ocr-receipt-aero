import React, { useState } from "react";
import { X, Plus, Trash2, CheckCircle2, DollarSign, Calendar, Building2, Lock, Percent } from "lucide-react";
import { ExpenseReceipt, ExpenseItem } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCT_CHOICES } from "../data/seedData";
import {
  getStoredProductChoices,
  saveCustomProductChoice,
  deleteCustomProductChoice,
  getCustomOnlyProductChoices,
  getStoredCategories,
} from "../utils/choices";
import {
  STANDARD_VAT_RATE,
  isItemVatApplicable,
  toggleItemVat,
  recalculateReceiptTotals,
} from "../utils/vatCalculations";

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
  const [productChoices, setProductChoices] = useState<string[]>(() => getStoredProductChoices());
  const [choiceModalItemIdx, setChoiceModalItemIdx] = useState<number | null>(null);
  const [newChoiceInput, setNewChoiceInput] = useState("");
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

  const handleToggleItemVat = (index: number, newHasVat: boolean) => {
    const updated = [...items];
    if (!updated[index]) return;
    const amended = toggleItemVat(updated[index], newHasVat);
    updated[index] = amended;
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof ExpenseItem, val: any) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: val };
    const hasVat = isItemVatApplicable(item);

    if (field === "quantity" || field === "unitPrice") {
      const q = Math.max(1, field === "quantity" ? Number(val) || 1 : item.quantity || 1);
      const p = field === "unitPrice" ? Number(val) || 0 : item.unitPrice || 0;
      const base = q * p;
      if (hasVat) {
        item.vatAmount = Number((base * STANDARD_VAT_RATE).toFixed(2));
        item.totalAmount = Number((base + item.vatAmount).toFixed(2));
      } else {
        item.vatAmount = 0;
        item.totalAmount = Number(base.toFixed(2));
      }
    }

    if (field === "totalAmount") {
      const newTotal = Number(val) || 0;
      const q = Math.max(1, item.quantity || 1);
      if (hasVat) {
        const preTax = Number((newTotal / (1 + STANDARD_VAT_RATE)).toFixed(2));
        item.vatAmount = Number((newTotal - preTax).toFixed(2));
        item.unitPrice = Number((preTax / q).toFixed(2));
      } else {
        item.vatAmount = 0;
        item.unitPrice = Number((newTotal / q).toFixed(2));
      }
      item.totalAmount = newTotal;
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

  const totals = recalculateReceiptTotals(items);
  const subtotal = totals.subtotal;
  const vatTotal = totals.vatTotal;
  const grandTotal = totals.grandTotal;

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
                {getStoredCategories().map((c) => (
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-emerald-500" />
                <span>Line Items & VAT Amendment</span>
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const hasVat = isItemVatApplicable(item);
                const currentTotal =
                  Number(item.totalAmount) ||
                  (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1) +
                    (Number(item.vatAmount) || 0);

                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center gap-2"
                  >
                    <input
                      type="text"
                      required
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                      className="w-full md:flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white"
                    />

                    {/* Product Choice / Classification */}
                    <select
                      value={item.productChoice || "Kitchen Essentials"}
                      onChange={(e) => {
                        if (e.target.value === "__add_new_choice__") {
                          setChoiceModalItemIdx(idx);
                          setNewChoiceInput("");
                        } else {
                          handleItemChange(idx, "productChoice", e.target.value);
                        }
                      }}
                      className="w-full md:w-32 px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-slate-800 dark:text-slate-200 cursor-pointer"
                      title="Product Choice / Classification"
                    >
                      {productChoices.map((pc) => (
                        <option key={pc} value={pc} className="bg-white dark:bg-slate-900">
                          {pc}
                        </option>
                      ))}
                      <option value="__add_new_choice__" className="font-bold text-emerald-600 bg-emerald-50 dark:bg-slate-800">
                        + Add Choice...
                      </option>
                    </select>

                    <div className="flex items-center gap-1.5 w-full md:w-auto justify-between md:justify-start">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                        className="w-12 px-2 py-1 text-xs text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded font-semibold"
                        title="Quantity"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                        className="w-16 px-2 py-1 text-xs text-right bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded font-medium"
                        title="Unit price"
                      />

                      {/* VAT Toggle */}
                      <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleToggleItemVat(idx, true)}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            hasVat
                              ? "bg-amber-500 text-white shadow-2xs"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          }`}
                          title="Apply 15% VAT while keeping Total Amount unchanged"
                        >
                          15%
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleItemVat(idx, false)}
                          className={`px-1.5 py-0.5 rounded font-bold transition cursor-pointer ${
                            !hasVat
                              ? "bg-slate-700 text-white dark:bg-slate-600 shadow-2xs"
                              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                          }`}
                          title="Set to 0% (Exempt) while keeping Total Amount unchanged"
                        >
                          0%
                        </button>
                      </div>

                      {/* Total Amount (Preserved) */}
                      <div className="flex flex-col items-end min-w-[70px]">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          SAR {currentTotal.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5" title="Amount locked when toggling VAT">
                          <Lock className="w-2 h-2 text-slate-400" />
                          <span>Locked</span>
                        </span>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

        {/* In-Modal Choice Creation & Deletion */}
        {choiceModalItemIdx !== null && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-2xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Add Product Choice Classification
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Type a custom classification to assign to this item row:
              </p>
              <input
                type="text"
                autoFocus
                value={newChoiceInput}
                onChange={(e) => setNewChoiceInput(e.target.value)}
                placeholder="e.g. Seafood & Poultry, Bakery, Packaging..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-emerald-500 text-slate-900 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newChoiceInput.trim()) {
                    const c = newChoiceInput.trim();
                    const updated = saveCustomProductChoice(c);
                    setProductChoices(updated);
                    handleItemChange(choiceModalItemIdx, "productChoice", c);
                    setNewChoiceInput("");
                    setChoiceModalItemIdx(null);
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setChoiceModalItemIdx(null)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (newChoiceInput.trim()) {
                      const c = newChoiceInput.trim();
                      const updated = saveCustomProductChoice(c);
                      setProductChoices(updated);
                      handleItemChange(choiceModalItemIdx, "productChoice", c);
                      setNewChoiceInput("");
                      setChoiceModalItemIdx(null);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                >
                  Add Choice
                </button>
              </div>

              {/* Manage Custom Choices with Delete */}
              {getCustomOnlyProductChoices().length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Delete Custom Choices
                  </h5>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {getCustomOnlyProductChoices().map((choice) => (
                      <div
                        key={choice}
                        className="flex items-center justify-between px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                          {choice}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = deleteCustomProductChoice(choice);
                            setProductChoices(updated);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition cursor-pointer"
                          title={`Delete "${choice}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
