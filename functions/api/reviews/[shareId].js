import { json, readJson, requireBindings, authorizeShare, loadProjectSnapshot, newId, errorResponse } from "../_shared.js";

export async function onRequestGet({ request, env, params }) {
  try {
    await requireBindings(env);
    const share = await authorizeShare(request, env, params.shareId);
    if (!share) return json({ ok: false, message: "This review link is invalid, expired, or revoked." }, 401);
    const version = await env.DB.prepare(
      "SELECT id, version_number, label, object_key, created_at FROM project_versions WHERE id = ? AND project_id = ?"
    ).bind(share.version_id, share.project_id).first();
    const snapshot = await loadProjectSnapshot(env, version);
    const decisions = await env.DB.prepare(
      "SELECT suggestion_id, decision, comment, updated_at FROM review_decisions WHERE share_id = ? AND version_id = ? ORDER BY updated_at DESC"
    ).bind(share.id, version.id).all();
    return json({
      ok: true,
      project: { id: share.project_id, title: share.title },
      access: { role: share.role, expiresAt: share.expires_at },
      version: { id: version.id, number: version.version_number, label: version.label, createdAt: version.created_at },
      snapshot,
      decisions: decisions.results || []
    });
  } catch (error) {
    return errorResponse(error, "The review workspace could not be loaded.");
  }
}

export async function onRequestPost({ request, env, params }) {
  try {
    await requireBindings(env);
    const share = await authorizeShare(request, env, params.shareId);
    if (!share) return json({ ok: false, message: "This review link is invalid, expired, or revoked." }, 401);
    if (share.role !== "author_review") return json({ ok: false, message: "This link does not allow author review decisions." }, 403);
    const payload = await readJson(request);
    const suggestionId = String(payload.suggestionId || "").trim().slice(0, 160);
    const decision = String(payload.decision || "");
    const comment = String(payload.comment || "").trim().slice(0, 4000);
    const versionId = share.version_id;
    if (!suggestionId) return json({ ok: false, message: "A suggestion ID is required." }, 400);
    if (!["accepted", "rejected", "commented"].includes(decision)) {
      return json({ ok: false, message: "Choose accepted, rejected, or commented." }, 400);
    }
    const version = await env.DB.prepare(
      "SELECT id FROM project_versions WHERE id = ? AND project_id = ?"
    ).bind(versionId, share.project_id).first();
    if (!version) return json({ ok: false, message: "That manuscript version is not part of this project." }, 404);
    const existing = await env.DB.prepare(
      "SELECT id FROM review_decisions WHERE share_id = ? AND version_id = ? AND suggestion_id = ?"
    ).bind(share.id, versionId, suggestionId).first();
    const now = new Date().toISOString();
    if (existing) {
      await env.DB.prepare(
        "UPDATE review_decisions SET decision = ?, comment = ?, updated_at = ? WHERE id = ?"
      ).bind(decision, comment, now, existing.id).run();
    } else {
      await env.DB.prepare(
        "INSERT INTO review_decisions (id, share_id, version_id, suggestion_id, decision, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(newId("dec"), share.id, versionId, suggestionId, decision, comment, now, now).run();
    }
    return json({ ok: true, suggestionId, decision, comment, updatedAt: now });
  } catch (error) {
    return errorResponse(error, "The review decision could not be saved.");
  }
}
