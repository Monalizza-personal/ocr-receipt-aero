import { GoogleGenAI } from "@google/genai";

function cleanAndParseJson(text: string): any {
  if (!text) return null;
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    cleaned = jsonMatch[1].trim();
  }
  const firstBrace = cleaned.indexOf("[");
  const lastBrace = cleaned.lastIndexOf("]");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  let body = req.body;
  if (!body || typeof body === "string" || Buffer.isBuffer(body)) {
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch {}
    } else if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString("utf-8")); } catch {}
    } else {
      try {
        const chunks: any[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          const raw = Buffer.concat(chunks).toString("utf-8");
          body = JSON.parse(raw);
        }
      } catch {}
    }
  }

  const { text, items } = body || {};
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    if (text) return res.status(200).json({ translatedText: `[EN] ${text}` });
    if (items && Array.isArray(items)) {
      return res.status(200).json({
        translatedItems: items.map((it: any) => ({
          ...it,
          description: `[EN] ${it.description || ""}`,
        })),
      });
    }
    return res.status(200).json({ translatedText: text || "" });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    if (text) {
      const prompt = `Translate this Arabic text to clear, professional English. Return ONLY the translation:\n${text}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
      });
      return res.status(200).json({ translatedText: response.text?.trim() || text });
    }

    if (items && Array.isArray(items)) {
      const prompt = `Translate the description of each item from Arabic to English. Return a JSON array: [{"description": "English name"}]\nItems: ${JSON.stringify(items)}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      const parsed = cleanAndParseJson(response.text?.trim() || "");
      if (parsed && Array.isArray(parsed)) {
        return res.status(200).json({ translatedItems: parsed });
      }
    }
  } catch (err) {
    console.warn("Translation failed:", err);
  }

  // Graceful fallback
  if (text) return res.status(200).json({ translatedText: text });
  if (items) return res.status(200).json({ translatedItems: items });
  return res.status(200).json({});
}
