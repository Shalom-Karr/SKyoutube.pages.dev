// netlify/functions/youtubeproxy.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const { YOUTUBE_API_KEY } = process.env;

    if (!YOUTUBE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }),
        };
    }

    const { endpoint, params } = event.queryStringParameters;

    if (!endpoint) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing 'endpoint' parameter." }),
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
            console.error(`YouTube API Error (${endpoint}):`, data.error.message);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: data.error.message || 'YouTube API call failed.' }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data),
        };
    } catch (error) {
        console.error('Proxy Fetch Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to connect to YouTube API via proxy.' }),
        };
    }
};
