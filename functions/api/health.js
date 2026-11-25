export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "authors-revision-desk",
      platform: "cloudflare-pages",
      features: {
        builtInAI: false,
        googleDocs: false
      }
    }),
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}
