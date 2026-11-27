import { json, readJson, newId, newSecret, hashSecret, requireBindings, errorResponse } from "../_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    await requireBindings(env);
    const payload = await readJson(request);
    const title = String(payload.title || "").trim().slice(0, 180);
    const snapshot = payload.snapshot;
    if (!title) return json({ ok: false, message: "A project title is required." }, 400);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return json({ ok: false, message: "A manuscript project snapshot is required." }, 400);
    }

    const projectId = newId("prj");
    const versionId = newId("ver");
    const ownerToken = newSecret();
    const now = new Date().toISOString();
    const objectKey = `projects/${projectId}/versions/1.json`;
    const ownerTokenHash = await hashSecret(ownerToken);
    const body = JSON.stringify(snapshot);

    await env.MANUSCRIPTS.put(objectKey, body, {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: { projectId, versionId, versionNumber: "1" }
    });

    try {
      await env.DB.prepare(
        "INSERT INTO projects (id, title, owner_token_hash, current_version_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(projectId, title, ownerTokenHash, versionId, now, now).run();
      await env.DB.prepare(
        "INSERT INTO project_versions (id, project_id, version_number, label, object_key, created_at, created_by) VALUES (?, ?, 1, ?, ?, ?, 'owner')"
      ).bind(versionId, projectId, "Original manuscript", objectKey, now).run();
    } catch (error) {
      await env.MANUSCRIPTS.delete(objectKey);
      throw error;
    }

    return json({
      ok: true,
      project: { id: projectId, title, currentVersionId: versionId, createdAt: now, updatedAt: now },
      ownerToken,
      warning: "Save this owner key somewhere private. It is shown only once and cannot be recovered."
    }, 201);
  } catch (error) {
    return errorResponse(error, "The project could not be created.");
  }
}
