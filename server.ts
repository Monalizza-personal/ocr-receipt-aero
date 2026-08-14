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

// Helper to pause execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Robust Gemini generation with automatic retry and model fallback for 503 / 429 / high demand
async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }
) {
  // Valid, supported models according to the Gemini API specification
  const modelsToTry = [
    params.primaryModel || "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
  ];

  // Remove duplicates while preserving order
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: any = null;

  for (let mIdx = 0; mIdx < uniqueModels.length; mIdx++) {
    const currentModel = uniqueModels[mIdx];
    
    // Up to 2 attempts per model with exponential backoff
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          config: params.config,
        });

        if (response && response.text) {
          return { response, modelUsed: currentModel };
        }
      } catch (err: any) {
        lastError = err;
        const errString = String(err?.message || err || "");
        const isTransient =
          errString.includes("503") ||
          errString.includes("429") ||
          errString.includes("high demand") ||
          errString.includes("UNAVAILABLE") ||
          errString.includes("RESOURCE_EXHAUSTED") ||
          errString.includes("overloaded") ||
          errString.includes("Quota");

        console.warn(
          `[Gemini Attempt] Model "${currentModel}" (attempt ${attempt}/2) failed:`,
          errString.substring(0, 200)
        );

        if (isTransient) {
          // Wait before retrying or switching models
          await delay(attempt * 400);
        } else {
          // If model is not found (404) or unsupported, immediately break to next model
          break;
        }
      }
    }
  }

  throw lastError || new Error("Failed to generate content across all available AI models.");
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

    const prompt = `You are a highly resilient and expert OCR receipt and financial parser.
Analyze the provided receipt/invoice/bill/slip image, regardless of whether it is high-resolution, low-resolution, blurry, cropped, wrinkled, dark, handwritten, a phone screenshot, or a POS slip.

Extract and structure ALL available receipt information into JSON:
1. "storeName": Merchant or store name (Arabic, English, or other language). If partially unreadable, make a best reasonable inference based on available text.
2. "storeNameEn": English translation of store name if originally in Arabic or other language.
3. "storeAddress": Address or location if visible (or empty string).
4. "storeAddressEn": English translation of address if in Arabic.
5. "storePhone": Phone number if visible (or empty string).
6. "taxId": VAT/Tax registration number (or empty string).
7. "invoiceNo": Invoice, bill, order, or transaction reference number (or generate a standard reference like INV-xxxx if not printed).
8. "date": Date in YYYY-MM-DD format (use current date if not visible).
9. "time": Time in HH:MM format (24-hour).
10. "currency": Currency code (e.g. "SAR", "USD", "AED", "EUR", "EGP", "GBP", "KWD", "QAR"). Default "SAR" if from Saudi Arabia or if currency symbol is SAR / SR / ر.س.
11. "category": Best matching category from: ["Food & Dining", "Kitchen Supplies", "Household", "Electronics", "Utilities", "Maintenance", "Ingredients", "Beverages", "Packaging", "Other"].
12. "paymentMethod": "Card", "Cash", "Mada", "Apple Pay", "Bank Transfer", "Online", or "Other".
13. "items": Array of itemized products or services. If individual items are not completely listed or photo is cut off, create line items for whatever is visible, or at minimum one item representing the total purchase:
    - "description": Product name/service description as written.
    - "descriptionEn": English translation of item description.
    - "quantity": Number of units (default 1).
    - "unitPrice": Unit price (number).
    - "vatAmount": VAT or tax amount for this item (number, e.g. 15% VAT).
    - "totalAmount": Total line price (number).
    - "category": Matching item category.
    - "productChoice": Short classification (e.g. "Produce", "Pantry", "Appliance", "Dairy", "Beverage", "Cleaning", "Bakery", "Meat", "Hardware", "Packaging", "General Supply").
14. "subtotal": Subtotal before tax/VAT (number).
15. "vatTotal": Total VAT/tax amount (number).
16. "grandTotal": Final total amount paid or charged (number).
17. "notes": Brief 1-sentence description or summary.

Return strictly valid JSON only.`;

    const { response, modelUsed } = await generateWithFallback(ai, {
      primaryModel: "gemini-3.7-flash",
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

    console.log(`OCR processed successfully with model: ${modelUsed}`);
    const textOutput = response.text?.trim();
    if (!textOutput) {
      throw new Error("AI was unable to read text from this image. Please ensure the image contains visible receipt text.");
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
      error: error.message || "Failed to process receipt with Gemini Vision OCR.",
    });
  }
});

// POST /api/parse-text: Parses raw pasted receipt text or SMS confirmation without any image requirement
app.post("/api/parse-text", async (req, res) => {
  try {
    const { textContent } = req.body;

    if (!textContent || typeof textContent !== "string" || textContent.trim().length === 0) {
      return res.status(400).json({ error: "No text content provided for parsing." });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(503).json({
        error: "Gemini API key is not configured. Please add GEMINI_API_KEY to AI Studio Settings.",
      });
    }

    const prompt = `You are an expert accountant AI. Parse the following pasted receipt/invoice text, order confirmation, bank SMS, or WhatsApp receipt and extract all structured data into JSON:

Input text:
"""
${textContent.trim()}
"""

Extract the following JSON fields:
1. "storeName": Merchant name.
2. "storeNameEn": English merchant name.
3. "storeAddress": Store location if mentioned (or empty).
4. "storeAddressEn": English store location.
5. "storePhone": Phone if mentioned.
6. "taxId": Tax/VAT number if mentioned.
7. "invoiceNo": Invoice number or order ID.
8. "date": Transaction date formatted as YYYY-MM-DD.
9. "time": Transaction time formatted as HH:MM.
10. "currency": Currency code (e.g., "SAR", "USD", "AED", "EUR"). Default "SAR".
11. "category": Best matching category from: ["Food & Dining", "Kitchen Supplies", "Household", "Electronics", "Utilities", "Maintenance", "Ingredients", "Beverages", "Packaging", "Other"].
12. "paymentMethod": "Card", "Cash", "Mada", "Apple Pay", "Bank Transfer", "Online", or "Other".
13. "items": Array of itemized products:
    - "description": Product name
    - "descriptionEn": English description
    - "quantity": Number
    - "unitPrice": Number
    - "vatAmount": Number
    - "totalAmount": Number
    - "category": Category
    - "productChoice": Specific classification
14. "subtotal": Total before tax
15. "vatTotal": Total VAT/tax
16. "grandTotal": Final grand total
17. "notes": 1-sentence note

Return ONLY valid JSON.`;

    const { response, modelUsed } = await generateWithFallback(ai, {
      primaryModel: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    console.log(`Text parsed successfully with model: ${modelUsed}`);
    const textOutput = response.text?.trim();
    if (!textOutput) {
      throw new Error("Unable to parse structured receipt from text.");
    }

    const parsed = cleanAndParseJson(textOutput);

    if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      parsed.items = [
        {
          description: parsed.storeName || "Expense Item",
          descriptionEn: parsed.storeNameEn || parsed.storeName || "Expense Item",
          quantity: 1,
          unitPrice: Number(parsed.grandTotal) || 0,
          vatAmount: Number(parsed.vatTotal) || 0,
          totalAmount: Number(parsed.grandTotal) || 0,
          category: parsed.category || "Food & Dining",
          productChoice: "General Supply",
        },
      ];
    }

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
    console.error("Text receipt parsing error:", error);
    return res.status(500).json({
      error: error.message || "Failed to parse receipt text with AI.",
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
      const { response } = await generateWithFallback(ai, {
        primaryModel: "gemini-3.7-flash",
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

      const { response } = await generateWithFallback(ai, {
        primaryModel: "gemini-3.7-flash",
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
