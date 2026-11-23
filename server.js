import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = fileURLToPath(new URL(".", import.meta.url));
const staticRoot = process.env.SERVE_DIST === "true" ? join(root, "dist") : root;
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };
const execFileAsync = promisify(execFile);

async function readJson(request) {
  let body = "";
  for await (const chunk of request) { body += chunk; if (body.length > 2_000_000) throw new Error("Request is too large."); }
  return JSON.parse(body || "{}");
}
function json(response, status, payload) { response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); response.end(JSON.stringify(payload)); }
async function aiEdit(payload) {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_BASE) throw new Error("AI bridge credentials are not configured on this server.");
  const segments = String(payload.text || "").split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean).slice(0, 40);
  const prompt = `Return only JSON suggestions for an author-controlled editing pass. Preserve the author's voice. Never invent facts. Keep every suggestion conservative and optional.\nEditing goal: ${payload.editType}\nAuthor brief: ${payload.brief || "none"}\nVoice to protect: ${payload.voice || "not specified"}\nTone: ${payload.tone || "not specified"}\nAudience: ${payload.audience || "not specified"}\nProtected phrases or spellings: ${payload.protectedPhrases || "none"}\nCustom instructions: ${payload.instructions || "none"}\nSegments:\n${segments.map((text, index) => `[${index}] ${text}`).join("\n")}`;
  const response = await fetch(`${process.env.OPENAI_API_BASE}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-6-luna", reasoning: { effort: "low" }, max_completion_tokens: 12000, messages: [{ role: "system", content: "You are a careful manuscript editor. Output JSON only." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "editing_suggestions", strict: true, schema: { type: "object", properties: { suggestions: { type: "array", items: { type: "object", properties: { index: { type: "integer" }, original: { type: "string" }, proposed: { type: "string" }, reason: { type: "string" }, confidence: { type: "string" } }, required: ["index", "original", "proposed", "reason", "confidence"], additionalProperties: false } } }, required: ["suggestions"], additionalProperties: false } } } }) });
  if (!response.ok) throw new Error(`AI service returned ${response.status}.`);
  const result = await response.json();
  return JSON.parse(result.choices?.[0]?.message?.content || "{\"suggestions\":[]}");
}
async function googleCommand(args) { return execFileAsync("gws", args, { timeout: 30000, maxBuffer: 2_000_000 }); }
async function googleDocs(payload, action) {
  if (action === "sync") {
    const documentId = String(payload.documentId || "");
    if (!documentId) throw new Error("A Google Doc ID is required.");
    const current = JSON.parse((await googleCommand(["docs", "documents", "get", "--params", JSON.stringify({ documentId, suggestionsViewMode: "SUGGESTIONS_INLINE" })])).stdout);
    const endIndex = current.body?.content?.at(-1)?.endIndex || 2;
    const requests = [
      { deleteContentRange: { range: { startIndex: 1, endIndex: Math.max(2, endIndex - 1) } } },
      { insertText: { location: { index: 1 }, text: `${payload.sourceText || ""}\n` } }
    ];
    await googleCommand(["docs", "documents", "batchUpdate", "--params", JSON.stringify({ documentId }), "--json", JSON.stringify({ requests, writeControl: { writeMode: "SUGGEST" } })]);
    return { message: "The manuscript was sent to Google Docs in Suggesting mode.", url: `https://docs.google.com/document/d/${documentId}/edit` };
  }
  const create = JSON.parse((await googleCommand(["docs", "documents", "create", "--json", JSON.stringify({ title: payload.title || "Editing review" })])).stdout);
  const documentId = create.documentId;
  await googleCommand(["docs", "documents", "batchUpdate", "--params", JSON.stringify({ documentId }), "--json", JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: `${payload.sourceText || ""}\n` } }] })]);
  return { message: "A Google Docs copy was created. Review suggestions in the Author’s Revision Desk before applying them.", url: `https://docs.google.com/document/d/${documentId}/edit` };
}

const server = http.createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/ai-edit") {
    try { json(response, 200, await aiEdit(await readJson(request))); } catch (error) { json(response, 503, { message: error.message || "AI bridge unavailable." }); }
    return;
  }
  if (request.method === "POST" && /^\/api\/google-docs\/(sync|create)$/.test(request.url)) {
    try { const action = request.url.split("/").pop(); json(response, 200, await googleDocs(await readJson(request), action)); } catch (error) { json(response, 503, { message: error.message || "Google Workspace bridge unavailable." }); }
    return;
  }
  const requested = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const safePath = normalize(requested).replace(/^([.][.][/\\])+/, "");
  const filePath = join(staticRoot, safePath);
  try {
    const data = await readFile(filePath);
    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
    response.end(data);
  } catch {
    if (!extname(safePath)) {
      const data = await readFile(join(staticRoot, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(data);
    } else {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Revision Guide listening on ${port}`);
});
