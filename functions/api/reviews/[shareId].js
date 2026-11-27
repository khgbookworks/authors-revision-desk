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
    const submissions = share.role === "editor" ? await env.DB.prepare(
      "SELECT id, submission_json, created_at FROM editor_submissions WHERE share_id = ? AND version_id = ? ORDER BY created_at DESC"
    ).bind(share.id, version.id).all() : { results: [] };
    return json({
      ok: true,
      project: { id: share.project_id, title: share.title },
      access: { role: share.role, expiresAt: share.expires_at },
      version: { id: version.id, number: version.version_number, label: version.label, createdAt: version.created_at },
      snapshot,
      decisions: decisions.results || [],
      submissions: (submissions.results || []).map((item) => ({ id: item.id, createdAt: item.created_at, ...JSON.parse(item.submission_json) }))
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
    const payload = await readJson(request);
    if (share.role === "editor") {
      const item = payload.submission || {};
      const original = String(item.original || "").slice(0, 12000);
      const proposed = String(item.proposed || "").slice(0, 12000);
      const reason = String(item.reason || "").trim().slice(0, 3000);
      const location = String(item.location || "").trim().slice(0, 300);
      if (!original.trim() || !proposed.trim() || !reason) return json({ ok: false, message: "An editor submission needs the original text, proposed text, and reason." }, 400);
      if (original === proposed) return json({ ok: false, message: "The proposed wording must differ from the original text." }, 400);
      const submission = { original, proposed, reason, location, category: String(item.category || "editorial").slice(0, 80) };
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO editor_submissions (id, share_id, project_id, version_id, submission_json, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(newId("eds"), share.id, share.project_id, share.version_id, JSON.stringify(submission), now).run();
      return json({ ok: true, submission, createdAt: now }, 201);
    }
    if (share.role !== "author_review") return json({ ok: false, message: "This link does not allow submissions." }, 403);
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
