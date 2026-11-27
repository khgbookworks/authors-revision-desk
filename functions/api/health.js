export async function onRequestGet({ env }) {
  const databaseConfigured = Boolean(env.DB);
  const manuscriptStorageConfigured = Boolean(env.MANUSCRIPTS);
  const backendReady = databaseConfigured && manuscriptStorageConfigured;
  return new Response(
    JSON.stringify({
      ok: true,
      service: "authors-revision-desk",
      platform: "cloudflare-pages",
      backend: {
        ready: backendReady,
        databaseConfigured,
        manuscriptStorageConfigured,
        storageMode: backendReady ? "cloudflare-d1+r2" : "local-browser-only"
      },
      features: {
        persistentProjects: backendReady,
        versionHistory: backendReady,
        privateCollaborationLinks: backendReady,
        authorReviewDecisions: backendReady,
        builtInAI: Boolean(env.AI),
        googleDocs: false
      }
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    }
  );
}
