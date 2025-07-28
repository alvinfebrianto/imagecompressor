export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const apiKey = request.headers.get("X-API-Key");
    if (!apiKey) {
      return new Response("API key is missing", { status: 400 });
    }

    try {
      const response = await fetch("https://api.tinify.com/shrink", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`api:${apiKey}`),
          "Content-Type": request.headers.get("Content-Type"),
        },
        body: request.body,
      });

      if (!response.ok) {
        const error = await response.json();
        return new Response(JSON.stringify(error), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const location = response.headers.get("Location");
      return new Response(JSON.stringify({ location }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(error.message, { status: 500 });
    }
  },
};

function handleOptions(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
  };
  return new Response(null, { headers });
}