// netlify/functions/youtube-proxy.js

// This function handles YouTube API requests for Netlify deployments.
// It uses the YOUTUBE_API_KEY stored securely in Netlify environment variables.

exports.handler = async (event, context) => {
    // 1. Get the API Key from environment variables
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
        console.error("YOUTUBE_API_KEY is missing in Netlify environment variables.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server configuration error: API Key missing." })
        };
    }

    // 2. Extract parameters passed from the client
    const { endpoint, params } = event.queryStringParameters;
    
    if (!endpoint) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing 'endpoint' parameter." })
        };
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
            console.error(`YouTube API Error via Netlify proxy (${endpoint}):`, data.error.message);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: data.error.message || "YouTube API call failed." })
            };
        }

        // 6. Return data to the client
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Netlify Proxy Fetch Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to connect to YouTube API via proxy." })
        };
    }
};
