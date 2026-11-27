const MAX_JSON_BYTES = 6 * 1024 * 1024;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function readJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_JSON_BYTES) throw new Error("Request is too large.");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
    throw new Error("Request is too large.");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

export function newId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashSecret(secret) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bearer(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return match ? match[1] : "";
}

export async function requireBindings(env) {
  if (!env.DB || !env.MANUSCRIPTS) {
    throw new Error("Backend storage is not configured. Connect the D1 database and R2 bucket before using cloud projects.");
  }
}

export async function requireAiBindings(env) {
  if (!env.DB) throw new Error("The D1 database is not configured.");
  if (!env.AI) throw new Error("Workers AI is not connected to this Pages project.");
}

export async function reserveAiUsage(env, projectId, inputCharacters) {
  const usageDate = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    "INSERT INTO ai_usage (project_id, usage_date, requests, input_characters) VALUES (?, ?, 1, ?) ON CONFLICT(project_id, usage_date) DO UPDATE SET requests = requests + 1, input_characters = input_characters + excluded.input_characters WHERE requests < 40 AND input_characters + excluded.input_characters <= 250000 RETURNING requests, input_characters"
  ).bind(projectId, usageDate, inputCharacters).first();
  if (!row) throw new Error("The project's daily AI allowance has been reached. Try again after the daily reset.");
  return row;
}

export async function runStructuredAi(env, systemPrompt, userPrompt, schema, maxTokens = 3000) {
  const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: maxTokens,
    response_format: { type: "json_schema", json_schema: schema }
  });
  let output = result?.response ?? result?.result ?? result;
  if (typeof output === "string") {
    try { output = JSON.parse(output); }
    catch { throw new Error("The AI service returned an unreadable structured response. Please retry."); }
  }
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("The AI service did not return the expected report format. Please retry.");
  }
  return output;
}

export async function loadProjectSnapshot(env, version) {
  if (!version?.object_key) return null;
  const object = await env.MANUSCRIPTS.get(version.object_key);
  if (!object) throw new Error("The saved manuscript version could not be found.");
  return object.json();
}

export async function authorizeOwner(request, env, projectId) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await hashSecret(token);
  return env.DB.prepare(
    "SELECT id, title, current_version_id, created_at, updated_at FROM projects WHERE id = ? AND owner_token_hash = ? AND archived_at IS NULL"
  ).bind(projectId, tokenHash).first();
}

export async function authorizeShare(request, env, shareId) {
  const token = bearer(request);
  if (!token) return null;
  const tokenHash = await hashSecret(token);
  return env.DB.prepare(
    "SELECT s.id, s.project_id, s.version_id, s.role, s.expires_at, p.title FROM project_shares s JOIN projects p ON p.id = s.project_id WHERE s.id = ? AND s.token_hash = ? AND s.revoked_at IS NULL AND p.archived_at IS NULL"
  ).bind(shareId, tokenHash).first().then((share) => {
    if (!share) return null;
    if (share.expires_at && Date.parse(share.expires_at) <= Date.now()) return null;
    return share;
  });
}

export function errorResponse(error, fallback = "The request could not be completed.") {
  const message = error?.message || fallback;
  const status = /not configured|not connected/i.test(message) ? 503
    : /daily AI allowance|quota|rate limit|neuron|capacity/i.test(message) ? 429
    : /too large/i.test(message) ? 413
    : /valid JSON|is required|must be/i.test(message) ? 400
    : 500;
  return json({ ok: false, message: status === 500 ? fallback : message }, status);
}
