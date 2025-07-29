export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const proxyUrl = url.searchParams.get("url");

    // Debug endpoint
    if (url.pathname === "/debug") {
      return new Response(JSON.stringify({
        message: "Worker debug info",
        environment: {
          availableKeys: Object.keys(env),
          apiKey1Exists: 'API_KEY_1' in env,
          apiKey2Exists: 'API_KEY_2' in env,
          apiKey3Exists: 'API_KEY_3' in env,
          apiKey4Exists: 'API_KEY_4' in env,
          apiKey5Exists: 'API_KEY_5' in env,
          apiKey1Length: env.API_KEY_1 ? env.API_KEY_1.length : 0,
          apiKey2Length: env.API_KEY_2 ? env.API_KEY_2.length : 0,
          apiKey3Length: env.API_KEY_3 ? env.API_KEY_3.length : 0,
          apiKey4Length: env.API_KEY_4 ? env.API_KEY_4.length : 0,
          apiKey5Length: env.API_KEY_5 ? env.API_KEY_5.length : 0,
          apiKey1Preview: env.API_KEY_1 ? `${env.API_KEY_1.substring(0, 5)}...` : 'not set',
          apiKey2Preview: env.API_KEY_2 ? `${env.API_KEY_2.substring(0, 5)}...` : 'not set',
          apiKey3Preview: env.API_KEY_3 ? `${env.API_KEY_3.substring(0, 5)}...` : 'not set',
          apiKey4Preview: env.API_KEY_4 ? `${env.API_KEY_4.substring(0, 5)}...` : 'not set',
          apiKey5Preview: env.API_KEY_5 ? `${env.API_KEY_5.substring(0, 5)}...` : 'not set'
        },
        timestamp: new Date().toISOString()
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization"
        }
      });
    }

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
    } else if (apiKeySelector === "API_KEY_3") {
      apiKey = env.API_KEY_3;
    } else if (apiKeySelector === "API_KEY_4") {
      apiKey = env.API_KEY_4;
    } else if (apiKeySelector === "API_KEY_5") {
      apiKey = env.API_KEY_5;
    } else {
      return new Response(JSON.stringify({
        message: "Invalid API key selector",
        received: apiKeySelector,
        expected: ["API_KEY_1", "API_KEY_2", "API_KEY_3", "API_KEY_4", "API_KEY_5"]
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
    console.log("API Key length:", apiKey ? apiKey.length : 0);

    if (!apiKey || apiKey.trim() === '') {
      return new Response(JSON.stringify({
        message: "API key not configured or empty",
        selector: apiKeySelector,
        availableKeys: Object.keys(env).filter(key => key.startsWith('API_KEY')),
        keyExists: apiKeySelector in env,
        keyEmpty: apiKey === '' || apiKey === undefined || apiKey === null,
        debug: {
          envKeys: Object.keys(env),
          apiKeyValue: apiKey ? `${apiKey.substring(0, 5)}...` : 'null/undefined'
        }
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