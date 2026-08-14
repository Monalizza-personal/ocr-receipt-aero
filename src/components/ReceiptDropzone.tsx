import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  Camera,
  Sparkles,
  Loader2,
  AlertCircle,
  Plus,
  Key,
} from "lucide-react";
import { ExpenseReceipt } from "../types";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { PasteTextModal } from "./PasteTextModal";

interface ReceiptDropzoneProps {
  onReceiptProcessed: (receipt: ExpenseReceipt) => void;
}

export const ReceiptDropzone: React.FC<ReceiptDropzoneProps> = ({ onReceiptProcessed }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);

  // File drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Clipboard Paste Support (Ctrl+V anywhere on window / dropzone)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleFiles(imageFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Preprocess & optimize image for Gemini OCR (ultra-fast, lightweight max 1600px dimension)
  const prepareFileForOCR = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: reader.result as string, mimeType: "application/pdf" });
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ base64: e.target?.result as string, mimeType: file.type || "image/jpeg" });
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          resolve({ base64: dataUrl, mimeType: "image/jpeg" });
        };
        img.onerror = () => {
          resolve({ base64: e.target?.result as string, mimeType: file.type || "image/jpeg" });
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process uploaded files through backend OCR
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setErrorMessage(null);
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      try {
        setProcessingStatus(`[File ${i + 1}/${files.length}] Reading "${file.name}"...`);
        setProgressPercent(20);

        const { base64, mimeType } = await prepareFileForOCR(file);
        setProgressPercent(45);
        setProcessingStatus(`[File ${i + 1}/${files.length}] Scanning with Gemini Vision AI...`);

        const response = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: mimeType,
            filename: file.name,
          }),
        });

        setProgressPercent(80);
        setProcessingStatus(`Structuring line items, prices, and tax numbers...`);

        const rawText = await response.text();
        let data: any = null;
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }

        if (!response.ok) {
          const errMsg =
            data?.error ||
            data?.message ||
            (rawText && rawText.length < 250 ? rawText : `Server error (${response.status})`);
          throw new Error(errMsg);
        }

        if (!data) {
          throw new Error("Invalid response format received from server.");
        }

        // Build completed ExpenseReceipt item with bilingual fields
        const newReceipt: ExpenseReceipt = {
          id: "rec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          storeName: data.storeNameEn || data.storeName || "Scanned Store Merchant",
          originalStoreName: data.storeName || data.storeNameEn,
          storeAddress: data.storeAddressEn || data.storeAddress || "",
          originalStoreAddress: data.storeAddress || "",
          storePhone: data.storePhone || "",
          taxId: data.taxId || "",
          invoiceNo: data.invoiceNo || "INV-" + Math.floor(1000 + Math.random() * 9000),
          date: data.date || new Date().toISOString().split("T")[0],
          time: data.time || new Date().toTimeString().substring(0, 5),
          currency: data.currency || "SAR",
          category: data.category || "Food & Dining",
          paymentMethod: data.paymentMethod || "Card",
          subtotal: Number(data.subtotal) || 0,
          vatTotal: Number(data.vatTotal) || 0,
          grandTotal: Number(data.grandTotal) || 0,
          notes: data.notes || `AI-scanned receipt with ${data.items?.length || 0} line items`,
          isTranslated: Boolean(data.storeNameEn && data.storeName && data.storeNameEn !== data.storeName),
          items: Array.isArray(data.items)
            ? data.items.map((it: any, idx: number) => ({
                id: "item_" + idx + "_" + Date.now(),
                description: it.descriptionEn || it.description || "Unlabeled Item",
                originalDescription: it.description,
                quantity: Number(it.quantity) || 1,
                unitPrice: Number(it.unitPrice) || 0,
                vatAmount: Number(it.vatAmount) || 0,
                totalAmount: Number(it.totalAmount) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
                category: it.category || data.category || "Food & Dining",
                productChoice: it.productChoice || "General Supply",
              }))
            : [],
          imageUrl: isPdf ? undefined : base64,
          thumbnailUrl: isPdf ? undefined : base64,
          isPdf: isPdf,
          createdAt: Date.now(),
        };

        setProgressPercent(100);
        onReceiptProcessed(newReceipt);
      } catch (err: any) {
        console.error("Error processing file:", err);
        setErrorMessage(
          `Failed to parse "${file.name}": ${err.message || "Unknown error"}.`
        );
      }
    }

    setIsProcessing(false);
    setProgressPercent(0);
    setProcessingStatus("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Explicit demo receipt generator
  const handleTryDemoReceipt = async () => {
    setIsProcessing(true);
    setProgressPercent(30);
    setProcessingStatus("Loading interactive demo receipt...");

    try {
      const demoOptions = ["food", "electronics", "appliances"];
      const randomOption = demoOptions[Math.floor(Math.random() * demoOptions.length)];

      const res = await fetch(`/api/demo?type=${randomOption}`);
      const rawText = await res.text();
      let demo: any = null;
      try {
        demo = JSON.parse(rawText);
      } catch {
        demo = null;
      }

      if (!res.ok || !demo) {
        throw new Error(demo?.error || "Demo receipt service unavailable");
      }

      setProgressPercent(85);

      const demoReceipt: ExpenseReceipt = {
        id: "demo_" + Date.now(),
        storeName: demo.storeNameEn || demo.storeName,
        originalStoreName: demo.storeName,
        storeAddress: demo.storeAddressEn || demo.storeAddress || "",
        originalStoreAddress: demo.storeAddress || "",
        storePhone: demo.storePhone || "",
        taxId: demo.taxId || "300481239900003",
        invoiceNo: demo.invoiceNo || "INV-DEMO-2025",
        date: demo.date || new Date().toISOString().split("T")[0],
        time: demo.time || "14:30",
        currency: demo.currency || "SAR",
        category: demo.category || "Food & Dining",
        paymentMethod: demo.paymentMethod || "Card",
        subtotal: Number(demo.subtotal) || 0,
        vatTotal: Number(demo.vatTotal) || 0,
        grandTotal: Number(demo.grandTotal) || 0,
        notes: demo.notes || "Interactive sample demonstration invoice.",
        isTranslated: Boolean(demo.storeNameEn && demo.storeName && demo.storeNameEn !== demo.storeName),
        items: Array.isArray(demo.items)
          ? demo.items.map((it: any, idx: number) => ({
              id: "demo_item_" + idx + "_" + Date.now(),
              description: it.descriptionEn || it.description,
              originalDescription: it.description,
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              vatAmount: Number(it.vatAmount) || 0,
              totalAmount: Number(it.totalAmount) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
              category: it.category || demo.category || "Food & Dining",
              productChoice: it.productChoice || "Sample Supply",
            }))
          : [],
        createdAt: Date.now(),
      };

      setProgressPercent(100);
      onReceiptProcessed(demoReceipt);
    } catch (err: any) {
      console.error("Demo failed:", err);
      setErrorMessage("Could not load sample receipt: " + (err.message || ""));
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
      setProcessingStatus("");
    }
  };

  // Camera capture handler
  const handleCameraCaptured = async (base64Image: string) => {
    setIsProcessing(true);
    setProgressPercent(30);
    setProcessingStatus("Analyzing camera snapshot with Gemini Vision AI...");

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          mimeType: "image/jpeg",
          filename: "camera_capture.jpg",
        }),
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errMsg =
          data?.error ||
          data?.message ||
          (rawText && rawText.length < 250 ? rawText : `Camera scan error (${response.status})`);
        throw new Error(errMsg);
      }

      if (!data) {
        throw new Error("Invalid response format received from server.");
      }

      setProgressPercent(85);
      setProcessingStatus("Structuring ledger records...");

      const newReceipt: ExpenseReceipt = {
        id: "rec_cam_" + Date.now(),
        storeName: data.storeNameEn || data.storeName || "Camera Scanned Store",
        originalStoreName: data.storeName || data.storeNameEn,
        storeAddress: data.storeAddressEn || data.storeAddress || "",
        originalStoreAddress: data.storeAddress || "",
        storePhone: data.storePhone || "",
        taxId: data.taxId || "",
        invoiceNo: data.invoiceNo || "CAM-" + Math.floor(1000 + Math.random() * 9000),
        date: data.date || new Date().toISOString().split("T")[0],
        time: data.time || new Date().toTimeString().substring(0, 5),
        currency: data.currency || "SAR",
        category: data.category || "Food & Dining",
        paymentMethod: data.paymentMethod || "Card",
        subtotal: Number(data.subtotal) || 0,
        vatTotal: Number(data.vatTotal) || 0,
        grandTotal: Number(data.grandTotal) || 0,
        notes: data.notes || "Captured directly via device camera",
        isTranslated: Boolean(data.storeNameEn && data.storeName && data.storeNameEn !== data.storeName),
        items: Array.isArray(data.items)
          ? data.items.map((it: any, idx: number) => ({
              id: "item_cam_" + idx + "_" + Date.now(),
              description: it.descriptionEn || it.description || "Scanned item",
              originalDescription: it.description,
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unitPrice) || 0,
              vatAmount: Number(it.vatAmount) || 0,
              totalAmount: Number(it.totalAmount) || (Number(it.quantity) || 1) * (Number(it.unitPrice) || 0),
              category: it.category || data.category || "Food & Dining",
              productChoice: it.productChoice || "General Supply",
            }))
          : [],
        imageUrl: base64Image,
        thumbnailUrl: base64Image,
        createdAt: Date.now(),
      };

      setProgressPercent(100);
      onReceiptProcessed(newReceipt);
    } catch (err: any) {
      console.error("Camera OCR error:", err);
      setErrorMessage(`Camera OCR Failed: ${err.message || "Could not parse camera snapshot."}`);
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
      setProcessingStatus("");
    }
  };

  return (
    <div className="w-full">
      {/* Dropzone Container */}
      <div
        id="receipt-dropzone-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 scale-[1.008] ring-4 ring-emerald-500/20"
            : "border-slate-300/90 dark:border-slate-700 bg-gradient-to-b from-white via-white to-slate-50/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80 hover:border-emerald-500/80 dark:hover:border-emerald-400"
        } shadow-xs hover:shadow-md`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.heic,.heif,.webp,.avif"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          id="file-upload-input"
        />

        {/* Processing overlay with progress bar */}
        {isProcessing ? (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            </div>
            <div className="space-y-2 max-w-md w-full px-4">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Processing Document with AI...
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {processingStatus || "Analyzing invoice layout..."}
              </p>
              <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-2 overflow-hidden shadow-inner">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Normal Prompt State */
          <div className="flex flex-col items-center justify-center space-y-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/15 via-teal-500/10 to-sky-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs ring-2 ring-emerald-500/10">
              <UploadCloud className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Drop any receipt image, photo, or PDF here, or{" "}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-emerald-600 dark:text-emerald-400 font-extrabold hover:underline cursor-pointer"
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5 flex-wrap">
                <span>Accepts all images (photos, WhatsApp images, screenshots, PDFs) or press <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md">Ctrl+V</kbd> to paste</span>
              </p>
            </div>

            {/* Quick Action Badges / Triggers */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                id="btn-scan-with-camera"
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60 shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Scan with Camera</span>
              </button>

              <button
                id="btn-paste-text-receipt"
                type="button"
                onClick={() => setIsTextModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200/60 dark:border-slate-700/60 shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Paste Text / SMS</span>
              </button>

              <button
                id="btn-try-demo-receipt"
                type="button"
                onClick={handleTryDemoReceipt}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-900/60 dark:hover:to-orange-900/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Try Demo Receipt</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert Message */}
      {errorMessage && (
        <div className="mt-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{errorMessage}</p>
            {errorMessage.toLowerCase().includes("key") && (
              <p className="text-[11px] text-rose-700 dark:text-rose-400">
                To use live AI vision for custom images, add your <strong>GEMINI_API_KEY</strong> in Settings &gt; Secrets, or click <strong>&quot;Try Demo Receipt&quot;</strong> / <strong>&quot;Paste Text / SMS&quot;</strong> to test immediately.
              </p>
            )}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            type="button"
            className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCaptured}
      />

      {/* Paste Text / SMS Modal */}
      <PasteTextModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        onReceiptProcessed={onReceiptProcessed}
      />
    </div>
  );
};
