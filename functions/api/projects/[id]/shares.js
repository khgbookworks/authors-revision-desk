import { json, readJson, newId, newSecret, hashSecret, requireBindings, authorizeOwner, errorResponse } from "../../_shared.js";

export async function onRequestPost({ request, env, params }) {
  try {
    await requireBindings(env);
    const project = await authorizeOwner(request, env, params.id);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);
    const payload = await readJson(request);
    const role = payload.role === "editor" ? "editor" : "author_review";
    const label = String(payload.label || (role === "editor" ? "Editor access" : "Author review")).trim().slice(0, 100);
    const expiresInDays = Math.max(1, Math.min(90, Number(payload.expiresInDays) || 14));
    const shareId = newId("shr");
    const token = newSecret();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + expiresInDays * 86400000).toISOString();
    await env.DB.prepare(
      "INSERT INTO project_shares (id, project_id, version_id, token_hash, role, label, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(shareId, project.id, project.current_version_id, await hashSecret(token), role, label, createdAt, expiresAt).run();
    return json({
      ok: true,
      share: { id: shareId, role, label, createdAt, expiresAt },
      token,
      warning: "Copy the private access key now. It is shown only once."
    }, 201);
  } catch (error) {
    return errorResponse(error, "The collaboration link could not be created.");
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    await requireBindings(env);
    const project = await authorizeOwner(request, env, params.id);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);
    const url = new URL(request.url);
    const shareId = url.searchParams.get("shareId") || "";
    if (!shareId) return json({ ok: false, message: "A share ID is required." }, 400);
    const result = await env.DB.prepare(
      "UPDATE project_shares SET revoked_at = ? WHERE id = ? AND project_id = ? AND revoked_at IS NULL"
    ).bind(new Date().toISOString(), shareId, project.id).run();
    return json({ ok: true, revoked: Number(result.meta?.changes || 0) > 0 });
  } catch (error) {
    return errorResponse(error, "The collaboration link could not be revoked.");
  }
}
