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
    console.log("API Key Selector:", apiKeySelector);
    console.log("Available env keys:", Object.keys(env));

    let apiKey;
    if (apiKeySelector === "API_KEY_1") {
      apiKey = env.API_KEY_1;
    } else if (apiKeySelector === "API_KEY_2") {
      apiKey = env.API_KEY_2;
    } else {
      return new Response(JSON.stringify({
        message: "Invalid API key selector",
        received: apiKeySelector,
        expected: ["API_KEY_1", "API_KEY_2"]
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
    }

    console.log("API Key found:", !!apiKey);

    if (!apiKey) {
      return new Response(JSON.stringify({
        message: "API key not configured",
        selector: apiKeySelector,
        availableKeys: Object.keys(env).filter(key => key.startsWith('API_KEY'))
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
    }

    try {
      let requestBody = null;
      let fileData = null;
      let operation = 'compress';
      let originalContentType = null;

      // Check if request is JSON (for resize/convert) or binary (for compress)
      const contentType = request.headers.get("Content-Type");

      if (contentType === "application/json") {
        requestBody = await request.json();
        operation = requestBody.operation || 'compress';
        originalContentType = requestBody.fileType;

        // Convert base64 back to binary for TinyPNG API
        if (requestBody.fileData) {
          const binaryString = atob(requestBody.fileData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileData = bytes.buffer;
        }
      } else {
        // Direct file upload for compress operation
        fileData = await request.arrayBuffer();
        originalContentType = contentType;
        operation = 'compress'; // Default to compress for binary uploads
      }

      if (!fileData) {
        return new Response(JSON.stringify({ message: "No file data provided" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
          }
        });
      }

      // First, compress the image
      const compressResponse = await fetch("https://api.tinify.com/shrink", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`api:${apiKey}`),
          "Content-Type": originalContentType || contentType,
        },
        body: fileData,
      });

      if (!compressResponse.ok) {
        const error = await compressResponse.json();
        return new Response(JSON.stringify(error), {
          status: compressResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
          },
        });
      }

      const location = compressResponse.headers.get("Location");
      let finalLocation = location;

      // Apply additional operations if specified
      if (operation !== 'compress' && requestBody) {
        const transformPayload = {};

        if (operation === 'resize' && requestBody.resize) {
          transformPayload.resize = requestBody.resize;
        }

        if (operation === 'convert' && requestBody.convert) {
          transformPayload.convert = requestBody.convert;
          if (requestBody.transform) {
            transformPayload.transform = requestBody.transform;
          }
        }

        if (Object.keys(transformPayload).length > 0) {
          const transformResponse = await fetch(location, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`api:${apiKey}`),
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transformPayload),
          });

          if (transformResponse.ok) {
            // For transform operations, the response body is the final image
            const finalImageData = await transformResponse.arrayBuffer();
            return new Response(finalImageData, {
              headers: {
                "Content-Type": transformResponse.headers.get("Content-Type"),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
                "Image-Width": transformResponse.headers.get("Image-Width"),
                "Image-Height": transformResponse.headers.get("Image-Height"),
                "Content-Length": transformResponse.headers.get("Content-Length"),
              },
            });
          }
        }
      }

      // Return the location for simple compression
      let responseData;
      try {
        const compressData = await compressResponse.clone().json();
        responseData = {
          location: finalLocation,
          input: compressData.input,
          output: compressData.output
        };
      } catch (e) {
        // If response is not JSON, just return location
        responseData = { location: finalLocation };
      }

      return new Response(JSON.stringify(responseData), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        },
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }), {
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

function handleOptions() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
  };
  return new Response(null, { headers });
}