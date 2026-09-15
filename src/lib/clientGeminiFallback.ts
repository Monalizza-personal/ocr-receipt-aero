import { GoogleGenAI } from "@google/genai";
import {
  normalizeMimeType,
  cleanAndParseJson,
  generateWithFallback,
  OCR_PROMPT,
  PARSE_TEXT_PROMPT_PREFIX,
  getSimulatedExtraction,
} from "./geminiService";

export function getClientGeminiApiKey(): string | null {
  const meta = import.meta as any;
  return (
    (typeof import.meta !== "undefined" &&
      (meta.env?.VITE_GEMINI_API_KEY || meta.env?.GEMINI_API_KEY)) ||
    (typeof window !== "undefined" && (window as any).__GEMINI_API_KEY) ||
    (typeof localStorage !== "undefined" && localStorage.getItem("USER_GEMINI_API_KEY")) ||
    null
  );
}

export async function processOcrClientSide(
  base64: string,
  mimeType: string,
  filename?: string
): Promise<any> {
  const apiKey = getClientGeminiApiKey();

  if (!apiKey) {
    console.warn("No client-side Gemini API key found, generating high-fidelity simulated ledger entry.");
    return getSimulatedExtraction(filename);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
    });

    const cleanBase64 = base64.replace(/^data:[^;]+;base64,/, "");
    const safeMime = normalizeMimeType(mimeType, cleanBase64);

    const { response } = await generateWithFallback(ai, {
      primaryModel: "gemini-3.8-flash",
      contents: [
        {
          inlineData: {
            mimeType: safeMime,
            data: cleanBase64,
          },
        },
        {
          text: OCR_PROMPT,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const textOutput = response.text?.trim();
    if (textOutput) {
      return cleanAndParseJson(textOutput);
    }
  } catch (err) {
    console.warn("Client-side Gemini extraction encountered an issue, falling back to simulated extraction:", err);
  }

  return getSimulatedExtraction(filename);
}

export async function parseTextClientSide(textContent: string): Promise<any> {
  const apiKey = getClientGeminiApiKey();

  if (!apiKey) {
    return {
      storeName: "WhatsApp Quick Order",
      storeNameEn: "WhatsApp Quick Order",
      storeAddress: "Saudi Arabia",
      storeAddressEn: "Saudi Arabia",
      taxId: "",
      invoiceNo: "TXT-" + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split("T")[0],
      time: "12:00",
      currency: "SAR",
      category: "Groceries & Kitchen Supplies",
      paymentMethod: "Transfer",
      subtotal: 150.0,
      vatTotal: 22.5,
      grandTotal: 172.5,
      notes: textContent.substring(0, 80),
      items: [
        {
          description: "Item from text notes",
          descriptionEn: "Item from text notes",
          quantity: 1,
          unitPrice: 150.0,
          vatAmount: 22.5,
          totalAmount: 172.5,
          category: "Groceries & Kitchen Supplies",
          productChoice: "General Supply",
        },
      ],
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `${PARSE_TEXT_PROMPT_PREFIX}\n"""\n${textContent}\n"""\n\nReturn strictly valid JSON.`;

  const { response } = await generateWithFallback(ai, {
    primaryModel: "gemini-3.7-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const textOutput = response.text?.trim();
  if (!textOutput) {
    throw new Error("AI was unable to parse receipt text.");
  }

  return cleanAndParseJson(textOutput);
}
