// Edge function: AI quality check on a job's after-photos (Phase C).
//
// Downloads the job's "after" photos, sends them to Gemini vision, and gets back
// a clean/guest-ready score + flagged issues. Result is stored in
// job_photo_assessments (one row per job, re-runnable). Manager-triggered.
//
// Auth: verify_jwt=true, admin/manager only. Needs GEMINI_API_KEY.
// Body: { job_id }
// Response: { ok:true, assessment } | { ok:false, error }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "gemini-2.5-flash";
const BUCKET = "job-photos";

const SYSTEM = `You are a meticulous short-term-rental turnover inspector. You are shown the AFTER-cleaning photos a cleaner submitted for one turnover. Judge whether each space looks genuinely clean and guest-ready: surfaces wiped, beds made crisply, floors clean, no trash/clutter/dishes, bathroom fresh, staging neat.

Be fair but not lax — owners rely on this. A space with visible dirt, stains, clutter, unmade beds, or trash should be flagged. Reference photos by their 1-based index in the order provided.

Always call record_assessment with:
- overallScore 0-100 (100 = flawless, guest-ready),
- verdict 'pass' (ready) or 'review' (needs another look),
- summary: one or two plain sentences,
- issues: a list of { photo: <1-based index>, issue: <short description> } (empty if none).`;

const functionDeclaration = {
  name: "record_assessment",
  description: "Record the cleaning quality assessment for the turnover.",
  parameters: {
    type: "object",
    properties: {
      overallScore: { type: "integer" },
      verdict: { type: "string", enum: ["pass", "review"] },
      summary: { type: "string" },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: { photo: { type: "integer" }, issue: { type: "string" } },
          required: ["photo", "issue"],
        },
      },
    },
    required: ["overallScore", "verdict", "summary", "issues"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await authClient.auth.getUser();
    if (!u?.user) return json({ ok: false, error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin" || r.role === "manager")) {
      return json({ ok: false, error: "forbidden" }, 403);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ ok: false, error: "GEMINI_API_KEY not configured" }, 200);

    const body = (await req.json().catch(() => null)) as { job_id?: string } | null;
    const jobId = body?.job_id;
    if (!jobId) return json({ ok: false, error: "missing job_id" }, 400);

    // After-photos for this job.
    const { data: photos } = await admin
      .from("job_photos")
      .select("storage_path")
      .eq("job_id", jobId)
      .eq("type", "after")
      .order("uploaded_at", { ascending: true });
    if (!photos || photos.length === 0) {
      return json({ ok: false, error: "No after-photos to assess on this job" }, 200);
    }

    // Download each as base64 inline_data for Gemini.
    const parts: Array<Record<string, unknown>> = [
      { text: `Inspect these ${photos.length} after-cleaning photo(s) for one turnover.` },
    ];
    for (const p of photos) {
      const { data: blob, error } = await admin.storage.from(BUCKET).download(p.storage_path);
      if (error || !blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      parts.push({ inline_data: { mime_type: blob.type || "image/jpeg", data: btoa(bin) } });
    }
    if (parts.length === 1) return json({ ok: false, error: "Could not read the after-photos" }, 200);

    const gBody = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts }],
      tools: [{ functionDeclarations: [functionDeclaration] }],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["record_assessment"] } },
    };
    const gUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
    const res = await fetch(gUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(gBody) });
    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error", res.status, t);
      return json({ ok: false, error: res.status === 429 ? "Rate limited — try again shortly" : `Gemini error ${res.status}` }, 502);
    }
    const data = await res.json();
    const call = (data?.candidates?.[0]?.content?.parts ?? []).find(
      (p: { functionCall?: { name?: string } }) => p.functionCall?.name === "record_assessment",
    )?.functionCall;
    if (!call?.args) return json({ ok: false, error: "AI did not return a structured assessment" }, 502);

    const a = call.args as { overallScore: number; verdict: string; summary: string; issues: unknown[] };
    const score = Math.max(0, Math.min(100, Math.round(a.overallScore)));
    const verdict = a.verdict === "pass" ? "pass" : "review";

    await admin.from("job_photo_assessments").upsert(
      {
        job_id: jobId,
        score,
        verdict,
        summary: a.summary ?? null,
        issues: a.issues ?? [],
        assessed_at: new Date().toISOString(),
        assessed_by: u.user.id,
      },
      { onConflict: "job_id" },
    );

    return json({ ok: true, assessment: { job_id: jobId, score, verdict, summary: a.summary, issues: a.issues } });
  } catch (e) {
    console.error("assess-clean-photos error", e);
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
