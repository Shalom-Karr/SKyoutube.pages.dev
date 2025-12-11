// functions/api/youtube-proxy.js

export async function onRequest(context) {
    console.log("youtubeproxy function invoked.");

    const YOUTUBE_API_KEY = context.env.YOUTUBE_API_KEY;

    if (!YOUTUBE_API_KEY) {
        console.error("YOUTUBE_API_KEY is missing in Cloudflare environment variables.");
        return new Response(
            JSON.stringify({ error: "Server configuration error: API Key missing." }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    const url = new URL(context.request.url);
    console.log(`Incoming request URL: ${url}`);

    const endpoint = url.searchParams.get('endpoint');

    // Construct a new search parameters object from the incoming URL,
    // but exclude the 'endpoint' parameter itself.
    const passthroughParams = new URLSearchParams();
    for (const [key, value] of url.searchParams.entries()) {
        if (key !== 'endpoint') {
            passthroughParams.append(key, value);
        }
    }

    console.log(`Endpoint: ${endpoint}`);
    console.log(`Passthrough Params: ${passthroughParams.toString()}`);

    if (!endpoint) {
        console.error("Missing 'endpoint' parameter in the request.");
        return new Response(
            JSON.stringify({ error: "Missing 'endpoint' parameter." }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    let youtubeUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?key=${YOUTUBE_API_KEY}&${passthroughParams.toString()}`;
    console.log(`Constructed YouTube API URL: ${youtubeUrl}`);

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
