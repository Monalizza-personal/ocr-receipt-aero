import { GoogleGenAI, Type } from "@google/genai";

// Normalize MIME types for Gemini Vision
export function normalizeMimeType(mime?: string, base64?: string): string {
  if (mime) {
    const lower = mime.toLowerCase();
    if (lower === "image/jpg" || lower === "image/pjpeg") return "image/jpeg";
    if (lower.includes("pdf")) return "application/pdf";
    if (lower.includes("png")) return "image/png";
    if (lower.includes("webp")) return "image/webp";
    if (lower.includes("heic") || lower.includes("heif")) return "image/jpeg";
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
export function cleanAndParseJson(raw: string): any {
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
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const sub = cleaned.substring(firstBracket, lastBracket + 1);
      return JSON.parse(sub);
    }
    throw new Error("Unable to parse structured JSON from OCR response.");
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Robust Gemini generation with immediate model fallback for 503 / 429 / high demand
export async function generateWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
    primaryModel?: string;
  }
) {
  const modelsToTry = [
    params.primaryModel || "gemini-3.1-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.8-flash",
  ];

  const uniqueModels = Array.from(new Set(modelsToTry));
  let lastError: any = null;

  for (let mIdx = 0; mIdx < uniqueModels.length; mIdx++) {
    const currentModel = uniqueModels[mIdx];
    try {
      const responsePromise = ai.models.generateContent({
        model: currentModel,
        contents: params.contents,
        config: params.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout on model ${currentModel}`)), 12000)
      );

      const response: any = await Promise.race([responsePromise, timeoutPromise]);

      if (response && response.text) {
        return { response, modelUsed: currentModel };
      }
    } catch (err: any) {
      lastError = err;
      const errString = String(err?.message || err || "");
      console.warn(`[Gemini Attempt] Model "${currentModel}" failed:`, errString.substring(0, 150));
    }
  }

  throw lastError || new Error("Failed to generate content across available AI models.");
}

export const OCR_PROMPT = `You are an elite, highly accurate bilingual Arabic & English receipt OCR and expense classification engine.
Analyze this receipt image/document with extreme precision. It could be from Saudi Arabia (ZATCA e-invoice / tax invoice / simple receipt / POS slip / gas slip / kitchen market bill / WhatsApp order / handwritten note) or any international store.

TASK INSTRUCTIONS:
1. Extract the Merchant / Store Name in both original language (Arabic/English) and clear English translation.
2. Extract the Store Address and translate to English if in Arabic.
3. Extract the VAT Registration Number (Tax ID / الرقم الضريبي - usually 15 digits starting with 3 in Saudi Arabia).
4. Extract the Invoice / Receipt Number (رقم الفاتورة / فاتورة ضريبية).
5. Extract the Date (YYYY-MM-DD) and Time (HH:MM 24h format). If missing, use today's date.
6. Extract Currency (e.g. SAR, USD, AED, EUR - default to SAR if in Saudi Arabia).
7. Extract Payment Method (Card, Cash, Mada, Apple Pay, Transfer, Visa, MasterCard).
8. Categorize the receipt into one of: 'Food & Dining', 'Groceries & Kitchen Supplies', 'Appliances & Equipment', 'Repairs & Maintenance', 'Utilities & Water', 'Logistics & Packaging', 'Staff & Operational', 'Other'.
9. Extract ALL line items accurately:
   - "description": Original description in Arabic/English.
   - "descriptionEn": Professional English translation of the product (e.g. "ثلاجة ميديا بابين 400 لتر" -> "Midea Double Door Refrigerator 400L", "طماطم بلدي 2 كجم" -> "Local Tomatoes 2kg", "زيت زيتون بكر" -> "Extra Virgin Olive Oil").
   - "quantity": Number of units (default 1).
   - "unitPrice": Price per single unit.
   - "vatAmount": VAT on this item (0 if not itemized).
   - "totalAmount": Total for this item (quantity * unitPrice).
   - "category": Appropriate subcategory for this item.
   - "productChoice": A standardized English product group name (e.g. "Refrigeration Unit", "Fresh Produce", "Dairy & Eggs", "Cooking Oils", "Sanitation Chemicals", "Packaging Materials").
10. Calculate accurately:
    - "subtotal": Total before tax.
    - "vatTotal": Total VAT/Tax amount (15% in KSA if standard VAT).
    - "grandTotal": Total amount paid.
11. Write a brief executive summary note in "notes".

Return strictly valid JSON matching this schema:
{
  "storeName": "Original Merchant Name",
  "storeNameEn": "English Translated Merchant Name",
  "storeAddress": "Original Address",
  "storeAddressEn": "English Translated Address",
  "storePhone": "Phone or empty",
  "taxId": "Tax/VAT Number or empty",
  "invoiceNo": "Invoice/Bill Number or empty",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "currency": "SAR",
  "category": "Food & Dining",
  "paymentMethod": "Card",
  "subtotal": 0,
  "vatTotal": 0,
  "grandTotal": 0,
  "notes": "Summary note",
  "items": [
    {
      "description": "Original text",
      "descriptionEn": "English translation",
      "quantity": 1,
      "unitPrice": 0,
      "vatAmount": 0,
      "totalAmount": 0,
      "category": "Category",
      "productChoice": "Standardized Product Name"
    }
  ]
}`;

export const PARSE_TEXT_PROMPT_PREFIX = `You are an elite bilingual Arabic & English receipt text parsing engine.
Parse the following unstructured text, WhatsApp message, SMS bank alert, email confirmation, or rough invoice notes into a complete structured receipt JSON.

Input text:
`;

export function getSimulatedExtraction(filename?: string) {
  const isFood = filename && /food|rest|market|snack|cafe|hyper/i.test(filename);
  const isElectronics = filename && /elec|tv|sony|cable|tech/i.test(filename);

  if (isFood) {
    return {
      storeName: "سوبرماركت التميمي للمواد الغذائية",
      storeNameEn: "Tamimi Supermarket Food Supplies",
      storeAddress: "طريق الملك فهد، الرياض، المملكة العربية السعودية",
      storeAddressEn: "King Fahd Road, Riyadh, Saudi Arabia",
      storePhone: "+966 11 456 7890",
      taxId: "310123456700003",
      invoiceNo: "INV-TMM-" + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split("T")[0],
      time: "12:30",
      currency: "SAR",
      category: "Groceries & Kitchen Supplies",
      paymentMethod: "Card",
      subtotal: 310.0,
      vatTotal: 46.5,
      grandTotal: 356.5,
      notes: "Kitchen bulk food ingredients procurement (Simulated Scan).",
      items: [
        {
          description: "زيت زيتون بكر ممتاز 5 لتر",
          descriptionEn: "Extra Virgin Olive Oil 5L",
          quantity: 2,
          unitPrice: 85.0,
          vatAmount: 25.5,
          totalAmount: 195.5,
          category: "Groceries & Kitchen Supplies",
          productChoice: "Cooking Oils & Fats",
        },
        {
          description: "أرز بسمتي هندي ممتاز 10 كجم",
          descriptionEn: "Premium Indian Basmati Rice 10kg",
          quantity: 1,
          unitPrice: 95.0,
          vatAmount: 14.25,
          totalAmount: 109.25,
          category: "Groceries & Kitchen Supplies",
          productChoice: "Grains & Rice",
        },
        {
          description: "بهارات مشكلة للشيف 500 جم",
          descriptionEn: "Chef Specialty Mixed Spices 500g",
          quantity: 3,
          unitPrice: 15.0,
          vatAmount: 6.75,
          totalAmount: 51.75,
          category: "Groceries & Kitchen Supplies",
          productChoice: "Spices & Seasoning",
        },
      ],
    };
  }

  if (isElectronics) {
    return {
      storeName: "مؤسسة إكسترا للأجهزة المنزلية والإلكترونيات",
      storeNameEn: "Extra Electronics & Home Appliances",
      storeAddress: "شارع العليا العام، الرياض",
      storeAddressEn: "Olaya Main Street, Riyadh",
      storePhone: "920004444",
      taxId: "300054812300003",
      invoiceNo: "INV-EXT-" + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split("T")[0],
      time: "16:45",
      currency: "SAR",
      category: "Appliances & Equipment",
      paymentMethod: "Card",
      subtotal: 1800.0,
      vatTotal: 270.0,
      grandTotal: 2070.0,
      notes: "Commercial kitchen prep appliances purchase (Simulated Scan).",
      items: [
        {
          description: "خلاط صناعي عالي التحمل 2000 واط",
          descriptionEn: "Heavy-Duty Commercial Blender 2000W",
          quantity: 1,
          unitPrice: 1200.0,
          vatAmount: 180.0,
          totalAmount: 1380.0,
          category: "Appliances & Equipment",
          productChoice: "Food Preparation Equipment",
        },
        {
          description: "ميزان طعام إلكتروني رقمي دقيق 10 كجم",
          descriptionEn: "Precision Digital Kitchen Scale 10kg",
          quantity: 2,
          unitPrice: 300.0,
          vatAmount: 90.0,
          totalAmount: 690.0,
          category: "Appliances & Equipment",
          productChoice: "Measuring Equipment",
        },
      ],
    };
  }

  return {
    storeName: "متجر الأخضر للأجهزة المنزلية ومستلزمات المطابخ",
    storeNameEn: "Green Store Household Appliances & Kitchen Supplies",
    storeAddress: "المدينة المنورة، المملكة العربية السعودية",
    storeAddressEn: "Al-Madinah Al-Munawwarah, Saudi Arabia",
    storePhone: "+966 14 822 3344",
    taxId: "300481239900003",
    invoiceNo: "INV-GRN-" + Math.floor(1000 + Math.random() * 9000),
    date: new Date().toISOString().split("T")[0],
    time: "14:15",
    currency: "SAR",
    category: "Appliances & Equipment",
    paymentMethod: "Card",
    subtotal: 2450.0,
    vatTotal: 367.5,
    grandTotal: 2817.5,
    notes: "Kitchen cooling storage replacement (Simulated Scan).",
    items: [
      {
        description: "ثلاجة ميديا بابين 400 لتر تبريد سريع",
        descriptionEn: "Midea Double Door Refrigerator 400L Fast Cool",
        quantity: 1,
        unitPrice: 2200.0,
        vatAmount: 330.0,
        totalAmount: 2530.0,
        category: "Appliances & Equipment",
        productChoice: "Refrigeration Unit",
      },
      {
        description: "مجموعة منظمات أرفف ستانلس ستيل",
        descriptionEn: "Stainless Steel Storage Rack Organizers",
        quantity: 1,
        unitPrice: 250.0,
        vatAmount: 37.5,
        totalAmount: 287.5,
        category: "Appliances & Equipment",
        productChoice: "Storage & Shelving",
      },
    ],
  };
}
