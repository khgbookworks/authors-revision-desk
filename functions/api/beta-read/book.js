import {
  json, readJson, requireAiBindings, authorizeOwner, reserveAiUsage,
  runStructuredAi, errorResponse
} from "../_shared.js";

const MAX_REPORT_CHARS = 100000;
const bookSchema = {
  type: "object",
  properties: {
    overallImpression: { type: "string" },
    narrativeArc: { type: "string" },
    characterArcs: { type: "array", items: { type: "string" } },
    themesAndPatterns: { type: "array", items: { type: "string" } },
    pacingAcrossBook: { type: "string" },
    continuityChecks: { type: "array", items: { type: "string" } },
    readerFit: { type: "string" },
    priorityActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          reason: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["action", "reason", "priority"],
        additionalProperties: false
      }
    }
  },
  required: ["overallImpression", "narrativeArc", "characterArcs", "themesAndPatterns", "pacingAcrossBook", "continuityChecks", "readerFit", "priorityActions"],
  additionalProperties: false
};

export async function onRequestPost({ request, env }) {
  try {
    await requireAiBindings(env);
    const payload = await readJson(request);
    const projectId = String(payload.projectId || "").trim();
    if (!projectId) return json({ ok: false, message: "A cloud project is required for a whole-book synthesis." }, 400);
    const project = await authorizeOwner(request, env, projectId);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);

    const chapters = Array.isArray(payload.chapterReports) ? payload.chapterReports.slice(0, 60) : [];
    if (!chapters.length) return json({ ok: false, message: "Generate chapter reports before requesting a whole-book synthesis." }, 400);
    const source = chapters.map((item, index) => ({
      title: String(item.title || `Chapter ${index + 1}`).slice(0, 180),
      report: item.report || {}
    }));
    const input = JSON.stringify(source);
    if (input.length > MAX_REPORT_CHARS) return json({ ok: false, message: "The chapter reports are too large to synthesize in one request. Reduce the number of reports or summarize them first." }, 413);
    const quota = await reserveAiUsage(env, project.id, input.length);

    const result = await runStructuredAi(
      env,
      "You are a developmental reader synthesizing chapter-level beta reports into a whole-book reader assessment. Do not claim to have read the full manuscript directly. Distinguish recurring patterns supported by the supplied reports from questions that still need human verification.",
      [
        `Book title: ${String(payload.bookTitle || project.title).slice(0, 180)}`,
        `Genre: ${String(payload.genre || "Not specified").slice(0, 100)}`,
        "Synthesize these chapter reports. Identify the book's narrative movement, character arcs, recurring themes, pacing patterns, continuity questions, likely reader fit, and the most useful revision priorities.",
        "Do not invent plot details or claim certainty where the reports do not provide evidence.",
        input
      ].join("\n\n"),
      bookSchema,
      5000
    );
    const report = {
      ...result,
      generatedAt: new Date().toISOString(),
      basis: "Synthesis of the supplied chapter reports, not a fresh reading of the complete manuscript.",
      source: "AI-assisted whole-book synthesis. A human reader should review it before sharing."
    };
    return json({ ok: true, report, chaptersReviewed: chapters.length, usage: { requestsToday: quota.requests, inputCharactersToday: quota.input_characters } });
  } catch (error) {
    return errorResponse(error, "The whole-book synthesis could not be completed.");
  }
}
