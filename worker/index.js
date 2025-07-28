export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const proxyUrl = url.searchParams.get("url");

    if (proxyUrl) {
      const response = await fetch(proxyUrl);
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
      newHeaders.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
    }

    const apiKeySelector = request.headers.get("X-API-Key");
    if (!apiKeySelector) {
      return new Response("API key is missing", {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
    }

    // Map the API key selector to actual API key from environment
    let apiKey;
    if (apiKeySelector === "API_KEY_1") {
      apiKey = env.API_KEY_1;
    } else if (apiKeySelector === "API_KEY_2") {
      apiKey = env.API_KEY_2;
    } else {
      return new Response("Invalid API key selector", {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
    }

    if (!apiKey) {
      return new Response("API key not configured", {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
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
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
          },
        });
      }

      const location = response.headers.get("Location");
      return new Response(JSON.stringify({ location }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ message: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
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