export async function onRequest({ params }) {
  const action = String(params.action || "");
  if (!["create", "sync"].includes(action)) {
    return new Response(
      JSON.stringify({ message: "Unknown Google Docs action." }),
      {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }

  return new Response(
    JSON.stringify({
      message: "Google Docs integration is not configured in this deployment yet."
    }),
    {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    }
  );
}
