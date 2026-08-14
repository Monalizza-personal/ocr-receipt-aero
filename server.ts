import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy Google GenAI Client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Helper for Arabic text detection
function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text || "");
}

// Normalize MIME types for Gemini Vision
function normalizeMimeType(mime?: string, base64?: string): string {
  if (mime) {
    const lower = mime.toLowerCase();
    if (lower === "image/jpg" || lower === "image/pjpeg") return "image/jpeg";
    if (lower.includes("pdf")) return "application/pdf";
    if (lower.includes("png")) return "image/png";
    if (lower.includes("webp")) return "image/webp";
    if (lower.includes("heic") || lower.includes("heif")) return "image/heic";
    if (lower.includes("jpeg")) return "image/jpeg";
  }
  if (base64) {
    if (base64.startsWith("/9j/")) return "image/jpeg";
    if (base64.startsWith("iVBORw0KGgo")) return "image/png";
    if (base64.startsWith("JVBERi0")) return "application/pdf";
    if (base64.startsWith("UklGR")) return "image/webp";
  }
  return "image/jpeg";
}

// Clean and safely parse JSON strings from Gemini responses
function cleanAndParseJson(raw: string): any {
  if (!raw) throw new Error("Empty response from AI engine");
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sub = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(sub);
    }
    throw new Error("Unable to parse structured JSON from OCR response.");
  }
}

// Demo extraction generator (used exclusively when user requests sample demo)
function getSimulatedExtraction(filename?: string) {
  const isFood = filename && /food|rest|market|snack|cafe|hyper/i.test(filename);
  const isElectronics = filename && /elec|tv|sony|cable|tech/i.test(filename);

  if (isFood) {
    return {
      storeName: "Saudia Gourmet Market & Kitchen Supplies",
      storeNameEn: "Saudia Gourmet Market & Kitchen Supplies",
      storeAddress: "King Abdullah Road, Medina, KSA",
      storePhone: "+966 14 848 2200",
      taxId: "300481239900003",
      invoiceNo: "S-" + Math.floor(100000 + Math.random() * 900000),
      date: new Date().toISOString().split("T")[0],
      time: "14:30",
      currency: "SAR",
      category: "Food & Dining",
      paymentMethod: "Card",
      items: [
        {
          description: "Fresh Arabica Coffee Beans Ground 1KG",
          descriptionEn: "Fresh Arabica Coffee Beans Ground 1KG",
          quantity: 2,
          unitPrice: 85,
          vatAmount: 25.5,
          totalAmount: 195.5,
          category: "Food & Dining",
          productChoice: "Pantry & Ingredients",
        },
        {
          description: "Organic Cooking Olive Oil 5L",
          descriptionEn: "Organic Cooking Olive Oil 5L",
          quantity: 1,
          unitPrice: 160,
          vatAmount: 24,
          totalAmount: 184,
          category: "Food & Dining",
          productChoice: "Kitchen Essentials",
        },
        {
          description: "Commercial Food Prep Containers Set",
          descriptionEn: "Commercial Food Prep Containers Set",
          quantity: 3,
          unitPrice: 45,
          vatAmount: 20.25,
          totalAmount: 155.25,
          category: "Kitchen Supplies",
          productChoice: "Storage & Packaging",
        },
      ],
      subtotal: 465,
      vatTotal: 69.75,
      grandTotal: 534.75,
      notes: "Commercial kitchen stock restock and staff coffee supplies.",
    };
  }

  if (isElectronics) {
    return {
      storeName: "Digital Kitchen Equipment & Tech",
      storeNameEn: "Digital Kitchen Equipment & Tech",
      storeAddress: "Prince Mohammad Bin Abdulaziz Rd, Al Madinah",
      storePhone: "+966 92 000 4123",
      taxId: "300051234400003",
      invoiceNo: "TXN-" + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split("T")[0],
      time: "11:20",
      currency: "SAR",
      category: "Electronics",
      paymentMethod: "Card",
      items: [
        {
          description: "Commercial Digital Kitchen Precision Scale",
          descriptionEn: "Commercial Digital Kitchen Precision Scale",
          quantity: 2,
          unitPrice: 320,
          vatAmount: 96,
          totalAmount: 736,
          category: "Electronics",
          productChoice: "Hardware Equipment",
        },
        {
          description: "Thermal POS Kitchen Order Printer 80mm",
          descriptionEn: "Thermal POS Kitchen Order Printer 80mm",
          quantity: 1,
          unitPrice: 580,
          vatAmount: 87,
          totalAmount: 667,
          category: "Electronics",
          productChoice: "Hardware Equipment",
        },
      ],
      subtotal: 1220,
      vatTotal: 183,
      grandTotal: 1403,
      notes: "Hardware and measurement tools for food station.",
    };
  }

  // Default Green Store receipt simulation
  return {
    storeName: "متجر الأخضر للأجهزة المنزلية",
    storeNameEn: "Green Store Household & Kitchen Appliances",
    storeAddress: "المدينة المنورة، سوق الحراج، المملكة العربية السعودية",
    storeAddressEn: "Al-Madinah Al-Munawwarah, Al-Haraj Market, Saudi Arabia",
    storePhone: "0540883720",
    taxId: "310423670800003",
    invoiceNo: "2025/00008/04",
    date: new Date().toISOString().split("T")[0],
    time: "15:45",
    currency: "SAR",
    category: "Household",
    paymentMethod: "Card",
    items: [
      {
        description: "ثلاجة ميديا بابين سعة 400 لتر موفرة للطاقة",
        descriptionEn: "Midea Double Door Refrigerator 400L Energy Saver",
        quantity: 1,
        unitPrice: 2695.65,
        vatAmount: 404.35,
        totalAmount: 3100,
        category: "Household",
        productChoice: "Refrigeration Unit",
      },
    ],
    subtotal: 2695.65,
    vatTotal: 404.35,
    grandTotal: 3100,
    notes: "Commercial heavy appliance delivery and installation voucher.",
  };
}

// POST /api/demo: Explicit endpoint for sample receipt demonstration
app.get("/api/demo", (req, res) => {
  const type = req.query.type as string;
  res.json(getSimulatedExtraction(type));
});

// POST /api/ocr: Parses actual receipt image using Gemini 3.7 Flash
app.post("/api/ocr", async (req, res) => {
  try {
    const { imageBase64, mimeType, filename } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 in request body." });
    }

    const ai = getAI();
    if (!ai) {
      console.warn("GEMINI_API_KEY environment variable is not defined.");
      return res.status(503).json({
        error: "Gemini API key is not configured. Please ensure GEMINI_API_KEY is added in the AI Studio Settings > Secrets panel.",
      });
    }

    // Clean base64 string
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const effectiveMimeType = normalizeMimeType(mimeType, cleanBase64);

    const prompt = `You are an expert OCR engine and accountant AI specializing in receipt parsing, itemized ledgers, and tax invoices.
Analyze the provided receipt/invoice/bill image with 100% accuracy and extract ALL fields.

Instructions:
1. "storeName": The exact store or merchant name as printed on the receipt.
2. "storeNameEn": English translation of store name if printed in Arabic or other non-English language.
3. "storeAddress": Address/location printed on the receipt (or empty string if not found).
4. "storeAddressEn": English translation of address if in Arabic.
5. "storePhone": Merchant phone number (or empty string).
6. "taxId": VAT/Tax registration number (e.g. 15-digit number in KSA, or Tax ID).
7. "invoiceNo": Invoice number, receipt number, or transaction reference code.
8. "date": Transaction date formatted as YYYY-MM-DD. If year is missing, assume current year (2025/2026).
9. "time": Transaction time formatted as HH:MM (24-hour).
10. "currency": Currency code (e.g., "SAR", "USD", "AED", "EUR", "GBP", "KWD", "QAR"). Default "SAR" for Saudi receipts or when "ر.س" / "SR" is shown.
11. "category": Primary expense category, choose best match from: ["Food & Dining", "Kitchen Supplies", "Household", "Electronics", "Utilities", "Maintenance", "Ingredients", "Beverages", "Packaging", "Other"].
12. "paymentMethod": "Card", "Cash", "Mada", "Apple Pay", "Bank Transfer", "Online", or "Other".
13. "items": Array of itemized products/services visible on the receipt. For EACH item:
    - "description": Exact product/service name as printed on receipt.
    - "descriptionEn": English translation of item description if originally in Arabic.
    - "quantity": Number of units (default 1).
    - "unitPrice": Price per single unit (number).
    - "vatAmount": VAT or tax amount for this item (number, e.g. 15% VAT).
    - "totalAmount": Total line price (number).
    - "category": Best matching category.
    - "productChoice": Specific classification (e.g. "Pantry", "Produce", "Equipment", "Coffee", "Dairy", "Appliance", "Cutlery", "Hardware", "Cleaning", "Snacks", "Meat").
14. Financial totals:
    - "subtotal": Subtotal before VAT/tax (number).
    - "vatTotal": Total VAT/tax amount (number).
    - "grandTotal": Final paid total amount (number).
    - "discountTotal": Total discount if shown (number, 0 if none).
15. "notes": Brief 1-sentence summary of the invoice.

Return ONLY a strictly valid JSON object matching these fields without markdown or commentary.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType: effectiveMimeType,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const textOutput = response.text?.trim();
    if (!textOutput) {
      throw new Error("Gemini AI returned an empty response. Please ensure image contains clear receipt text.");
    }

    const parsed = cleanAndParseJson(textOutput);

    // Sanitize and calculate any missing totals
    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      parsed.items = [
        {
          description: parsed.storeName || "Scanned Receipt Item",
          descriptionEn: parsed.storeNameEn || parsed.storeName || "Scanned Receipt Item",
          quantity: 1,
          unitPrice: Number(parsed.grandTotal) || 0,
          vatAmount: Number(parsed.vatTotal) || 0,
          totalAmount: Number(parsed.grandTotal) || 0,
          category: parsed.category || "Food & Dining",
          productChoice: "General Supply",
        },
      ];
    }

    // Ensure numeric totals are well-formed
    if (!parsed.subtotal && parsed.items.length > 0) {
      parsed.subtotal = parsed.items.reduce((s: number, it: any) => s + (Number(it.unitPrice || 0) * Number(it.quantity || 1)), 0);
    }
    if (!parsed.vatTotal && parsed.subtotal) {
      parsed.vatTotal = parsed.items.reduce((s: number, it: any) => s + Number(it.vatAmount || 0), 0) || Number((parsed.subtotal * 0.15).toFixed(2));
    }
    if (!parsed.grandTotal) {
      parsed.grandTotal = parsed.items.reduce((s: number, it: any) => s + Number(it.totalAmount || 0), 0) || Number((Number(parsed.subtotal || 0) + Number(parsed.vatTotal || 0)).toFixed(2));
    }

    return res.json(parsed);
  } catch (error: any) {
    console.error("Gemini OCR extraction error:", error);
    return res.status(500).json({
      error: error.message || "Failed to process receipt with Gemini Vision OCR. Please verify the image is readable.",
    });
  }
});

// POST /api/translate: Translates Arabic store and item names into English
app.post("/api/translate", async (req, res) => {
  try {
    const { text, items } = req.body;
    const ai = getAI();

    // If single text translation
    if (text) {
      if (!ai) {
        // Simple dictionary fallback for common store/product terms
        const fallbackText = text
          .replace(/متجر الأخضر للأجهزة المنزلية/g, "Green Store Household Appliances")
          .replace(/مؤسسة إكسترا للإلكترونيات/g, "Extra Electronics Trading")
          .replace(/سوبرماركت السعودية/g, "Saudia Hypermarket")
          .replace(/شركة المياه الوطنية/g, "National Water & Electricity Co")
          .replace(/سوق الحراج/g, "Al-Haraj Market")
          .replace(/المدينة المنورة/g, "Al-Madinah Al-Munawwarah")
          .replace(/ثلاجة ميديا بابين/g, "Midea Double Door Refrigerator 400L")
          .replace(/بن قهوة عربي محمص/g, "Roasted Arabica Coffee Beans 1KG")
          .replace(/زيت زيتون بكر/g, "Virgin Olive Oil 5L");
        return res.json({ translatedText: fallbackText !== text ? fallbackText : `[EN] ${text}` });
      }

      const prompt = `Translate the following Arabic merchant/product/address text into natural professional English. Return ONLY the English translation string without any commentary or quotes:\n\n${text}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
      });
      return res.json({ translatedText: response.text?.trim() || text });
    }

    // If item list translation
    if (items && Array.isArray(items)) {
      if (!ai) {
        const translated = items.map((item: any) => ({
          ...item,
          description: item.description ? `[EN] ${item.description}` : item.description,
        }));
        return res.json({ translatedItems: translated });
      }

      const prompt = `Translate the 'description' field of each item in this JSON array from Arabic to clear English food/kitchen/retail product names while maintaining any numbers, sizes, brands (e.g. Midea, Sony, Tefal, Arabica):
${JSON.stringify(items)}

Return strictly a JSON array with objects matching: { "description": "English translated text" }`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
              },
              required: ["description"],
            },
          },
        },
      });

      const translatedItems = cleanAndParseJson(response.text?.trim() || "[]");
      return res.json({ translatedItems });
    }

    res.status(400).json({ error: "Provide either 'text' or 'items' array." });
  } catch (error: any) {
    console.error("Translation API error:", error);
    res.status(500).json({ error: error.message || "Failed to translate text" });
  }
});

// Start full-stack server
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kitchen Expenses & Receipt OCR Server listening on port ${PORT}`);
  });
}

start();
