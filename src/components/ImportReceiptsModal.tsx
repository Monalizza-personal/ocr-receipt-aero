import React, { useState, useRef } from "react";
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { ExpenseReceipt } from "../types";
import { parseImportedReceiptsFile } from "../utils/importReceipts";

interface ImportReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (receipts: ExpenseReceipt[], replaceAll: boolean) => void;
}

export const ImportReceiptsModal: React.FC<ImportReceiptsModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pastedContent, setPastedContent] = useState("");
  const [parsedPreview, setParsedPreview] = useState<ExpenseReceipt[] | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessText = (content: string, filename = "") => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      const parsed = parseImportedReceiptsFile(content, filename);
      setParsedPreview(parsed);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse import file.");
      setParsedPreview(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesChange = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;
    setFiles(selectedFiles);
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const allParsed: ExpenseReceipt[] = [];
      for (const f of selectedFiles) {
        const text = await f.text();
        const parsed = parseImportedReceiptsFile(text, f.name);
        allParsed.push(...parsed);
      }
      if (allParsed.length === 0) {
        throw new Error("No valid receipts found in the selected document(s).");
      }
      setParsedPreview(allParsed);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse import file(s).");
      setParsedPreview(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesChange(Array.from(e.dataTransfer.files));
    }
  };

  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;
    onImportSuccess(parsedPreview, replaceAll);
    handleClose();
  };

  const handleClose = () => {
    setFiles([]);
    setPastedContent("");
    setParsedPreview(null);
    setErrorMessage(null);
    onClose();
  };

  const totalAmount = parsedPreview
    ? parsedPreview.reduce((sum, r) => sum + (Number(r.grandTotal) || 0), 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="modal-import-receipts"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Import Receipts & Datasheet
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload or paste a CSV or JSON file from InstaSheet or spreadsheet exports
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* File Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              dragActive
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/50 bg-slate-50/50 dark:bg-slate-800/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json,text/plain"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFilesChange(Array.from(e.target.files));
                }
              }}
            />
            <UploadCloud className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {files.length > 1
                  ? `${files.length} documents selected (${files.map((f) => f.name).join(", ")})`
                  : files.length === 1
                  ? files[0].name
                  : "Click to select or drag single or multiple CSV / JSON files here"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-file supported &bull; Accepts InstaSheet exports, receipts CSV, line items CSV, or JSON
              </p>
            </div>
          </div>

          {/* Or Paste text */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-slate-400" />
                Or Paste Raw CSV / JSON
              </label>
              {pastedContent && (
                <button
                  type="button"
                  onClick={() => {
                    setPastedContent("");
                    setParsedPreview(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={pastedContent}
              onChange={(e) => {
                const val = e.target.value;
                setPastedContent(val);
                if (val.trim()) {
                  handleProcessText(val, "pasted_data");
                } else {
                  setParsedPreview(null);
                }
              }}
              placeholder="Paste comma-separated CSV rows or JSON array here..."
              rows={3}
              className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Error display */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Preview Card */}
          {parsedPreview && parsedPreview.length > 0 && (
            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Ready to Import {parsedPreview.length} Receipt{parsedPreview.length > 1 ? "s" : ""}
                </span>
                <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300">
                  Total: {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} SAR
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {parsedPreview.slice(0, 5).map((r, i) => (
                  <div
                    key={r.id || i}
                    className="flex items-center justify-between text-[11px] bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-slate-700 dark:text-slate-300"
                  >
                    <span className="font-semibold truncate max-w-[200px]">{r.storeName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400">{r.date}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {Number(r.grandTotal).toFixed(2)} {r.currency || "SAR"}
                      </span>
                    </div>
                  </div>
                ))}
                {parsedPreview.length > 5 && (
                  <p className="text-[11px] text-center text-slate-500 italic">
                    + {parsedPreview.length - 5} more receipts...
                  </p>
                )}
              </div>

              {/* Replace or Append */}
              <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceAll}
                  onChange={(e) => setReplaceAll(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Replace all existing ledger entries (uncheck to merge into current list)
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white bg-slate-200/70 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-confirm-import-receipts"
            disabled={!parsedPreview || parsedPreview.length === 0 || isProcessing}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Import {parsedPreview ? parsedPreview.length : 0} Receipts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
