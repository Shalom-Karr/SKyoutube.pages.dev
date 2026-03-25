// netlify/functions/youtubeproxy.js

const ALLOWED_ENDPOINTS = new Set(['search', 'videos', 'channels', 'playlists', 'playlistItems']);

exports.handler = async (event) => {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
        console.error("YOUTUBE_API_KEY is missing in Netlify environment variables.");
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Server configuration error: API Key missing." }),
        };
    }

    const { endpoint, params } = event.queryStringParameters || {};

    if (!endpoint) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Missing 'endpoint' parameter." }),
        };
    }

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Invalid 'endpoint' parameter." }),
        };
    }

    let youtubeUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${YOUTUBE_API_KEY}`;

    if (params) {
        youtubeUrl += `&${params}`;
    }

    try {
        const response = await fetch(youtubeUrl);
        const data = await response.json();

        if (data.error) {
            console.error(`YouTube API Error via Netlify proxy (${endpoint}):`, data.error.message);
            return {
                statusCode: response.status,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: data.error.message || "YouTube API call failed." }),
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        };

    } catch (error) {
        console.error("Netlify Proxy Fetch Error:", error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: "Failed to connect to YouTube API via proxy." }),
        };
    }
};
