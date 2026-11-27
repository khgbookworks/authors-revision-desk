import { json, readJson, newId, requireBindings, authorizeOwner, loadProjectSnapshot, errorResponse } from "../_shared.js";

export async function onRequestGet({ request, env, params }) {
  try {
    await requireBindings(env);
    const project = await authorizeOwner(request, env, params.id);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);
    const versions = await env.DB.prepare(
      "SELECT id, version_number, label, created_at, created_by FROM project_versions WHERE project_id = ? ORDER BY version_number DESC"
    ).bind(project.id).all();
    const requestedVersionId = new URL(request.url).searchParams.get("versionId");
    const currentVersion = requestedVersionId
      ? await env.DB.prepare(
          "SELECT id, version_number, label, object_key, created_at FROM project_versions WHERE id = ? AND project_id = ?"
        ).bind(requestedVersionId, project.id).first()
      : await env.DB.prepare(
          "SELECT id, version_number, label, object_key, created_at FROM project_versions WHERE id = ? AND project_id = ?"
        ).bind(project.current_version_id, project.id).first();
    if (!currentVersion) return json({ ok: false, message: "That saved version could not be found in this project." }, 404);
    const snapshot = await loadProjectSnapshot(env, currentVersion);
    const reviewDecisions = await env.DB.prepare(
      "SELECT d.suggestion_id, d.version_id, d.decision, d.comment, d.updated_at, s.label AS share_label, s.role FROM review_decisions d JOIN project_shares s ON s.id = d.share_id WHERE s.project_id = ? ORDER BY d.updated_at DESC"
    ).bind(project.id).all();
    return json({ ok: true, project, currentVersion, isCurrentVersion: currentVersion.id === project.current_version_id, versions: versions.results || [], reviewDecisions: reviewDecisions.results || [], snapshot });
  } catch (error) {
    return errorResponse(error, "The project could not be loaded.");
  }
}

export async function onRequestPut({ request, env, params }) {
  try {
    await requireBindings(env);
    const project = await authorizeOwner(request, env, params.id);
    if (!project) return json({ ok: false, message: "Project access was not authorized." }, 401);
    const payload = await readJson(request);
    if (!payload.snapshot || typeof payload.snapshot !== "object" || Array.isArray(payload.snapshot)) {
      return json({ ok: false, message: "A complete project snapshot is required." }, 400);
    }
    const label = String(payload.label || "Saved revision").trim().slice(0, 120) || "Saved revision";
    const latest = await env.DB.prepare(
      "SELECT COALESCE(MAX(version_number), 0) AS version_number FROM project_versions WHERE project_id = ?"
    ).bind(project.id).first();
    const versionNumber = Number(latest?.version_number || 0) + 1;
    const versionId = newId("ver");
    const now = new Date().toISOString();
    const objectKey = `projects/${project.id}/versions/${versionNumber}.json`;
    await env.MANUSCRIPTS.put(objectKey, JSON.stringify(payload.snapshot), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { projectId: project.id, versionId, versionNumber: String(versionNumber) }
    });
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO project_versions (id, project_id, version_number, label, object_key, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 'owner')"
        ).bind(versionId, project.id, versionNumber, label, objectKey, now),
        env.DB.prepare(
          "UPDATE projects SET current_version_id = ?, updated_at = ? WHERE id = ?"
        ).bind(versionId, now, project.id)
      ]);
    } catch (error) {
      await env.MANUSCRIPTS.delete(objectKey);
      throw error;
    }
    return json({ ok: true, version: { id: versionId, versionNumber, label, createdAt: now } }, 201);
  } catch (error) {
    return errorResponse(error, "The project version could not be saved.");
  }
}
