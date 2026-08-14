import React, { useState } from "react";
import { X, Sparkles, Loader2, FileText, Clipboard, AlertCircle } from "lucide-react";
import { ExpenseReceipt } from "../types";

interface PasteTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptProcessed: (receipt: ExpenseReceipt) => void;
}

export const PasteTextModal: React.FC<PasteTextModalProps> = ({
  isOpen,
  onClose,
  onReceiptProcessed,
}) => {
  const [textContent, setTextContent] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!textContent.trim()) {
      setError("Please paste or type receipt text, invoice notes, or an SMS confirmation.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent: textContent.trim() }),
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errDetail =
          data?.error ||
          data?.message ||
          (rawText && rawText.length < 250 ? rawText : `Text parsing failed (${response.status})`);
        throw new Error(errDetail);
      }

      if (!data) {
        throw new Error("Invalid response format received from server.");
      }

      const newReceipt: ExpenseReceipt = {
        id: "rec_txt_" + Date.now(),
        storeName: data.storeNameEn || data.storeName || "Pasted Receipt",
        originalStoreName: data.storeName || data.storeNameEn,
        storeAddress: data.storeAddressEn || data.storeAddress || "",
        originalStoreAddress: data.storeAddress || "",
        storePhone: data.storePhone || "",
        taxId: data.taxId || "",
        invoiceNo: data.invoiceNo || "TXT-" + Math.floor(1000 + Math.random() * 9000),
        date: data.date || new Date().toISOString().split("T")[0],
        time: data.time || new Date().toTimeString().substring(0, 5),
        currency: data.currency || "SAR",
        category: data.category || "Food & Dining",
        paymentMethod: data.paymentMethod || "Card",
        subtotal: Number(data.subtotal) || 0,
        vatTotal: Number(data.vatTotal) || 0,
        grandTotal: Number(data.grandTotal) || 0,
        notes: data.notes || "Parsed from pasted text note",
        isTranslated: Boolean(data.storeNameEn && data.storeName && data.storeNameEn !== data.storeName),
        items: Array.isArray(data.items)
          ? data.items.map((it: any, idx: number) => ({
              id: "item_txt_" + idx + "_" + Date.now(),
              description: it.descriptionEn || it.description || "Parsed item",
              originalDescription: it.description,
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              vatAmount: Number(it.vatAmount) || 0,
              totalAmount: Number(it.totalAmount) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
              category: it.category || data.category || "Food & Dining",
              productChoice: it.productChoice || "General Supply",
            }))
          : [],
        createdAt: Date.now(),
      };

      onReceiptProcessed(newReceipt);
      setTextContent("");
      onClose();
    } catch (err: any) {
      console.error("Error parsing text:", err);
      setError(err.message || "Failed to parse text. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasteSample = (sampleType: "sms" | "whatsapp" | "simple") => {
    if (sampleType === "sms") {
      setTextContent(
        `Purchase Alert from Al-Rajhi Bank:
Amount: SAR 425.50
Merchant: Danube Hypermarket
Card: **8821
Date: ${new Date().toISOString().split("T")[0]}
VAT Included: 15% (SAR 55.50)`
      );
    } else if (sampleType === "whatsapp") {
      setTextContent(
        `Order Confirmation - Coffee Lab Roastery
Order #9928
1. Ethiopian Yirgacheffe 1KG - SAR 140
2. V60 Paper Filters 100pk - SAR 35
3. Barista Oat Milk 1L x 6 - SAR 78
Subtotal: SAR 253.00
VAT 15%: SAR 37.95
Total Paid: SAR 290.95 via Apple Pay`
      );
    } else {
      setTextContent(
        `Green Store Appliances
Invoice: 2025/491
Date: ${new Date().toISOString().split("T")[0]}
1x Commercial Stainless Blender - 450 SAR
2x Replacement Pitcher Jar - 120 SAR each
Total: 690 SAR (VAT Included)`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full my-auto shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Paste Receipt Text / SMS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No image required — paste text from WhatsApp, SMS, or emails
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Receipt Text, Notes, or Messages
            </label>
            <textarea
              rows={7}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste any invoice text, WhatsApp order summary, bank SMS, or rough notes here...&#10;&#10;e.g.&#10;Saudia Gourmet Market&#10;2x Arabica Coffee 1KG: 170 SAR&#10;1x Olive Oil 5L: 160 SAR&#10;Total: 330 SAR"
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none"
            />
          </div>

          {/* Quick Samples */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Quick insert sample templates:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePasteSample("sms")}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition"
              >
                Bank SMS alert
              </button>
              <button
                type="button"
                onClick={() => handlePasteSample("whatsapp")}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition"
              >
                WhatsApp Order
              </button>
              <button
                type="button"
                onClick={() => handlePasteSample("simple")}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition"
              >
                Store summary
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleParse}
            disabled={isProcessing || !textContent.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Structuring with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Parse Text to Ledger</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
