export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      message: "Built-in AI is not configured in this deployment yet."
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
