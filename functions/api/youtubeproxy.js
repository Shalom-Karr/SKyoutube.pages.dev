// functions/api/youtubeproxy.js

const ALLOWED_ENDPOINTS = new Set(['search', 'videos', 'channels', 'playlists', 'playlistItems']);

export async function onRequest(context) {
    const YOUTUBE_API_KEY = context.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
        console.error("YOUTUBE_API_KEY is missing in Cloudflare environment variables.");
        return new Response(
            JSON.stringify({ error: "Server configuration error: API Key missing." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const url = new URL(context.request.url);
    const endpoint = url.searchParams.get('endpoint');
    const params = url.searchParams.get('params');

    if (!endpoint) {
        return new Response(
            JSON.stringify({ error: "Missing 'endpoint' parameter." }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
        return new Response(
            JSON.stringify({ error: "Invalid 'endpoint' parameter." }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let youtubeUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${YOUTUBE_API_KEY}`;

    if (params) {
        youtubeUrl += `&${params}`;
    }

    try {
        const response = await fetch(youtubeUrl);
        const data = await response.json();

        if (data.error) {
            console.error(`YouTube API Error via Cloudflare proxy (${endpoint}):`, data.error.message);
            return new Response(
                JSON.stringify({ error: data.error.message || "YouTube API call failed." }),
                { status: response.status, headers: { 'Content-Type': 'application/json' } }
            );
        }

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
