// Parse a checklist from text, image, or PDF into structured sections.
//
// Auth: needs GEMINI_API_KEY (set via `supabase secrets set GEMINI_API_KEY=...`).
// Free tier at aistudio.google.com is plenty for this use case.
//
// Input  (POST body): { text?, fileBase64?, mimeType?, fileName? }
// Output (JSON): { name: string, sections: [{ name, items: string[] }] }

import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SECTIONS = [
  "General",
  "Bedrooms",
  "Bathrooms",
  "Kitchen",
  "Living areas",
  "Outdoor",
  "Amenities",
  "Laundry",
] as const;

const MODEL = "gemini-2.5-flash";

const SYSTEM = `You are a property cleaning checklist assistant. Read the provided checklist (text or image) and organize every actionable task into the correct section.

Allowed section names (use only these, omit empty ones): ${SECTIONS.join(", ")}.

Rules:
- Each item must be a single, concise actionable task (e.g., "Wipe down counters", "Replace bath towels").
- Do not invent items that are not implied by the source.
- Group similar tasks; deduplicate.
- "General" is for whole-property tasks (trash, lock up, thermostat, etc.).
- "Amenities" is for hot tub, pool, BBQ, game room, etc.
- Always call the build_checklist function with the structured result.`;

const functionDeclaration = {
  name: "build_checklist",
  description: "Organize the input into a structured property checklist.",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "A short title for the checklist." },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", enum: [...SECTIONS] },
            items: { type: "array", items: { type: "string" } },
          },
          required: ["name", "items"],
        },
      },
    },
    required: ["name", "sections"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { text, fileBase64, mimeType, fileName } = await req.json();

    if (!text && !fileBase64) {
      return json({ error: "Provide text or a file." }, 400);
    }

    // Assemble the user message parts: text first, then any inline image.
    const parts: Array<Record<string, unknown>> = [];
    const textPieces: string[] = [];

    if (text && text.trim()) textPieces.push(text.trim());

    if (fileBase64 && mimeType) {
      if (mimeType === "application/pdf") {
        // PDFs aren't supported as inline_data on gemini-flash directly;
        // extract text server-side and feed it as text.
        const bin = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const pdf = await getDocumentProxy(bin);
        const { text: pdfText } = await extractText(pdf, { mergePages: true });
        if (!pdfText || !pdfText.trim()) {
          return json({ error: "Could not extract text from this PDF." }, 400);
        }
        textPieces.push(`--- PDF (${fileName ?? "upload"}) ---\n${pdfText.trim()}`);
      } else if (mimeType.startsWith("image/")) {
        parts.push({
          inline_data: { mime_type: mimeType, data: fileBase64 },
        });
      } else {
        return json({ error: `Unsupported file type: ${mimeType}` }, 400);
      }
    }

    const promptText = textPieces.length
      ? textPieces.join("\n\n")
      : "Read the attached image and organize it into a property checklist.";
    parts.unshift({ text: promptText });

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      tools: [{ functionDeclarations: [functionDeclaration] }],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: ["build_checklist"],
        },
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", res.status, errText);
      if (res.status === 429) return json({ error: "Rate limit reached. Try again shortly." }, 429);
      if (res.status === 401 || res.status === 403) {
        return json({ error: "Invalid or unauthorized Gemini API key." }, 401);
      }
      return json({ error: `Gemini error ${res.status}` }, 502);
    }

    const data = await res.json();
    const candidateParts = data?.candidates?.[0]?.content?.parts ?? [];
    const call = candidateParts.find(
      (p: { functionCall?: { name?: string; args?: unknown } }) =>
        p.functionCall?.name === "build_checklist",
    )?.functionCall;
    if (!call?.args) {
      console.error("No functionCall in Gemini response:", JSON.stringify(data));
      throw new Error("AI did not return structured output");
    }

    // Gemini already returns args as an object — no JSON.parse needed.
    return json(call.args);
  } catch (e) {
    console.error("parse-checklist error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
