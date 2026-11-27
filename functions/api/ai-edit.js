import {
  json, readJson, requireAiBindings, authorizeOwner, reserveAiUsage,
  runStructuredAi, errorResponse
} from "./_shared.js";

const MAX_TEXT_CHARS = 35000;
const suggestionSchema = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          original: { type: "string" },
          proposed: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["index", "original", "proposed", "reason", "confidence"],
        additionalProperties: false
      }
    }
  },
  required: ["suggestions"],
  additionalProperties: false
};

export async function onRequestPost({ request, env }) {
  try {
    await requireAiBindings(env);
    const payload = await readJson(request);
    const projectId = String(payload.projectId || "").trim();
    if (!projectId) return json({ ok: false, message: "Create or reconnect a cloud project before using AI editing." }, 400);
    const project = await authorizeOwner(request, env, projectId);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);

    const source = String(payload.text || "");
    if (!source.trim()) return json({ ok: false, message: "Add manuscript text before requesting suggestions." }, 400);
    if (source.length > MAX_TEXT_CHARS) return json({ ok: false, message: "This editing request is too large. Work on a shorter section at a time." }, 413);
    const segments = source.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    if (!segments.length) return json({ ok: false, message: "No editable text sections were found." }, 400);
    if (segments.length > 40) return json({ ok: false, message: "This request contains too many separate sections. Work on a shorter passage so no text is silently skipped." }, 413);

    const quota = await reserveAiUsage(env, project.id, source.length);
    const editType = String(payload.editType || "copyedit").slice(0, 40);
    const prompt = [
      "Return optional manuscript-editing suggestions as structured JSON.",
      "Preserve the author's voice, dialect, intentional fragments, point of view, tense, and character-specific language.",
      "Never invent facts, change plot events, flatten emotional texture, or alter protected phrases.",
      "For developmental, structural, continuity, or sensitivity work, suggest focused notes rather than rewriting prose.",
      "For copyediting, line editing, or proofreading, propose only changes supported by the supplied passage.",
      "Every original field must reproduce its source segment exactly. Do not create suggestions for text that is not supplied.",
      `Editing goal: ${editType}`,
      `Author brief: ${String(payload.brief || "None supplied").slice(0, 3000)}`,
      `Voice to protect: ${String(payload.voice || "Not specified").slice(0, 1500)}`,
      `Tone: ${String(payload.tone || "Not specified").slice(0, 1000)}`,
      `Audience: ${String(payload.audience || "Not specified").slice(0, 1000)}`,
      `Protected phrases: ${String(payload.protectedPhrases || "None supplied").slice(0, 2000)}`,
      `Additional instructions: ${String(payload.instructions || "None supplied").slice(0, 3000)}`,
      "Source sections:",
      ...segments.map((segment, index) => `[${index}] ${segment}`)
    ].join("\n\n");

    const result = await runStructuredAi(
      env,
      "You are a careful, candid manuscript editor. Your suggestions are optional and must be grounded in the exact supplied text.",
      prompt,
      suggestionSchema,
      5000
    );
    const suggestions = (Array.isArray(result.suggestions) ? result.suggestions : [])
      .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < segments.length)
      .filter((item) => String(item.original || "") === segments[item.index])
      .filter((item) => String(item.proposed || "").trim() && String(item.reason || "").trim())
      .map((item) => ({
        index: item.index,
        original: segments[item.index],
        proposed: String(item.proposed),
        reason: String(item.reason).slice(0, 1200),
        confidence: ["high", "medium", "low"].includes(item.confidence) ? item.confidence : "unrated",
        source: "ai",
        status: "pending"
      }));

    return json({ ok: true, suggestions, usage: { requestsToday: quota.requests, inputCharactersToday: quota.input_characters } });
  } catch (error) {
    return errorResponse(error, "The AI editing request could not be completed.");
  }
}
