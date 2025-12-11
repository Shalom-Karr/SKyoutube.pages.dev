// netlify/functions/youtubeproxy.js
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// --- NEW FUNCTION TO GENERATE SQL ---
async function generateArtistSql(apiKey) {
    const artistFilePath = path.join(__dirname, '..', '..', 'artist_names.txt');
    const sqlFilePath = path.join(__dirname, '..', '..', 'artists.sql');
    const TABLE_NAME = 'artists';

    try {
        const artistNames = fs.readFileSync(artistFilePath, 'utf-8').split('\n').filter(Boolean);
        console.log(`Found ${artistNames.length} artists.`);

        let sqlStatements = [];
        for (const artistName of artistNames) {
            const sanitizedName = artistName.replace(/'/g, "''").trim();
            if (!sanitizedName) continue;

            const youtubeUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(sanitizedName)}&type=channel&maxResults=1&key=${apiKey}`;

            try {
                const response = await fetch(youtubeUrl);
                const data = await response.json();

                if (data.items && data.items.length > 0) {
                    const channelId = data.items[0].id.channelId;
                    const channelTitle = data.items[0].snippet.title;
                    console.log(`Found channel for '${sanitizedName}': '${channelTitle}' (ID: ${channelId})`);
                    sqlStatements.push(`INSERT INTO ${TABLE_NAME} (name, channel_id) VALUES ('${sanitizedName}', '${channelId}');`);
                } else {
                    console.log(`-> No channel found for '${sanitizedName}'. Skipping.`);
                }
            } catch (error) {
                console.error(`Error fetching channel for '${sanitizedName}':`, error);
            }
        }

        fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'), 'utf-8');
        console.log(`\n✅ Successfully generated '${sqlFilePath}' with ${sqlStatements.length} artists.`);
        return {
            statusCode: 200,
            body: `SQL file generated with ${sqlStatements.length} artists.`
        };

    } catch (error) {
        console.error('Error generating SQL file:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to generate SQL file.' })
        };
    }
}


exports.handler = async function(event, context) {
    const YOUTUBE_API_KEY = "AIzaSyDpJwIbEiVo5jkw79G92eUKpHSV6U4_vnc";

    if (!YOUTUBE_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: API Key missing.' }),
        };
    }

    // --- TEMPORARY: Trigger SQL Generation ---
    if (event.queryStringParameters.generate_sql === 'true') {
        return generateArtistSql(YOUTUBE_API_KEY);
    }


    const queryParams = event.queryStringParameters;
    const endpoint = queryParams.endpoint;

    if (!endpoint) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing 'endpoint' parameter." }),
        };
    }

    // The 'endpoint' parameter is for our function's routing, not for the YouTube API.
    // We remove it and forward everything else.
    delete queryParams.endpoint;

    const forwardedParams = new URLSearchParams(queryParams).toString();
    const youtubeUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${YOUTUBE_API_KEY}&${forwardedParams}`;

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
