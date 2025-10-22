// functions/api/youtube-proxy.js

// This function handles YouTube API requests for Cloudflare Pages deployments.
// It uses the YOUTUBE_API_KEY stored securely in Cloudflare Pages environment variables.

export async function onRequest(context) {
    // 1. Get the API Key from environment variables (context.env)
    const YOUTUBE_API_KEY = context.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
        console.error("YOUTUBE_API_KEY is missing in Cloudflare environment variables.");
        return new Response(
            JSON.stringify({ error: "Server configuration error: API Key missing." }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 2. Extract parameters passed from the client via query string
    const url = new URL(context.request.url);
    const endpoint = url.searchParams.get('endpoint');
    const params = url.searchParams.get('params');

    if (!endpoint) {
        return new Response(
            JSON.stringify({ error: "Missing 'endpoint' parameter." }), 
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // 3. Construct the full YouTube API URL
    let youtubeUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${YOUTUBE_API_KEY}`;
    
    if (params) {
        youtubeUrl += `&${params}`;
    }
    
    try {
        // 4. Make the secure API call
        const response = await fetch(youtubeUrl);
        const data = await response.json();

        // 5. Check for YouTube API errors
        if (data.error) {
            console.error(`YouTube API Error via Cloudflare proxy (${endpoint}):`, data.error.message);
            return new Response(
                JSON.stringify({ error: data.error.message || "YouTube API call failed." }), 
                { status: response.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // 6. Return data to the client
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Cloudflare Proxy Fetch Error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to connect to YouTube API via proxy." }), 
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
