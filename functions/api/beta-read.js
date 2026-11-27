import {
  json, readJson, requireAiBindings, authorizeOwner, reserveAiUsage,
  runStructuredAi, errorResponse
} from "./_shared.js";

const MAX_CHAPTER_CHARS = 30000;
const reportSchema = {
  type: "object",
  properties: {
    firstImpression: { type: "string" },
    emotionalImpact: { type: "string" },
    characterDevelopment: { type: "string" },
    patterns: { type: "string" },
    plotPacing: { type: "string" },
    clarity: { type: "string" },
    readerExperience: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          suggestion: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["suggestion", "reason", "priority"],
        additionalProperties: false
      }
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          observation: { type: "string" }
        },
        required: ["quote", "observation"],
        additionalProperties: false
      }
    },
    readerQuestions: { type: "array", items: { type: "string" } }
  },
  required: ["firstImpression", "emotionalImpact", "characterDevelopment", "patterns", "plotPacing", "clarity", "readerExperience", "suggestions", "evidence", "readerQuestions"],
  additionalProperties: false
};

export async function onRequestPost({ request, env }) {
  try {
    await requireAiBindings(env);
    const payload = await readJson(request);
    const projectId = String(payload.projectId || "").trim();
    if (!projectId) return json({ ok: false, message: "Create or reconnect a cloud project before requesting an AI beta read." }, 400);
    const project = await authorizeOwner(request, env, projectId);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);

    const text = String(payload.text || "");
    if (!text.trim()) return json({ ok: false, message: "Add chapter text before requesting a reader report." }, 400);
    if (text.length > MAX_CHAPTER_CHARS) return json({ ok: false, message: "This chapter is too long for one AI reading pass. Split it into shorter sections and review each report." }, 413);
    const chapterTitle = String(payload.chapterTitle || "Untitled chapter").slice(0, 180);
    const genre = String(payload.genre || "Not specified").slice(0, 100);
    const focus = String(payload.focus || "No special focus. Give a balanced reader response.").slice(0, 3000);
    const quota = await reserveAiUsage(env, project.id, text.length);

    const prompt = [
      "Read the supplied chapter as a thoughtful, candid beta reader.",
      "Base every observation on this chapter. Do not invent scenes, motivations, character facts, or future plot events.",
      "Do not rewrite the chapter. Do not correct grammar unless a wording issue prevents comprehension.",
      "Be specific: identify what the reader experiences, where attention changes, what creates or weakens emotion, and what remains unclear.",
      "For evidence, use short exact quotations copied from the supplied chapter. Never fabricate or silently paraphrase a quotation.",
      "Balance what works with what may need attention. Avoid generic praise and vague advice.",
      `Book title: ${String(payload.bookTitle || project.title).slice(0, 180)}`,
      `Chapter: ${chapterTitle}`,
      `Genre: ${genre}`,
      `Reader focus: ${focus}`,
      "Chapter text:",
      text
    ].join("\n\n");

    const result = await runStructuredAi(
      env,
      "You are an experienced, honest beta reader. Give grounded reader reactions, not an editorial verdict.",
      prompt,
      reportSchema,
      5000
    );
    const evidence = (Array.isArray(result.evidence) ? result.evidence : [])
      .filter((item) => String(item.quote || "").trim() && text.includes(String(item.quote)))
      .map((item) => ({ quote: String(item.quote).slice(0, 240), observation: String(item.observation || "").slice(0, 1000) }));
    const report = {
      firstImpression: String(result.firstImpression || ""),
      emotionalImpact: String(result.emotionalImpact || ""),
      characterDevelopment: String(result.characterDevelopment || ""),
      patterns: String(result.patterns || ""),
      plotPacing: String(result.plotPacing || ""),
      clarity: String(result.clarity || ""),
      readerExperience: String(result.readerExperience || ""),
      suggestions: (Array.isArray(result.suggestions) ? result.suggestions : []).slice(0, 12).map((item) => ({
        suggestion: String(item.suggestion || "").slice(0, 1000),
        reason: String(item.reason || "").slice(0, 1000),
        priority: ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium"
      })),
      evidence,
      readerQuestions: (Array.isArray(result.readerQuestions) ? result.readerQuestions : []).slice(0, 12).map((item) => String(item).slice(0, 500)),
      generatedAt: new Date().toISOString(),
      source: "AI-assisted beta-reading report. A human reader should review it before sharing."
    };
    return json({ ok: true, chapterId: String(payload.chapterId || ""), report, usage: { requestsToday: quota.requests, inputCharactersToday: quota.input_characters } });
  } catch (error) {
    return errorResponse(error, "The AI beta-reading report could not be completed.");
  }
}
