// --- CLOUDFLARE PAGES FUNCTION PROXY ---
export async function fetchFromProxy(endpoint, params) {
    const proxyUrl = `/api/youtubeproxy?endpoint=${endpoint}&params=${encodeURIComponent(params)}`;
    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Proxy API Error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch from proxy:", error);
        throw error;
    }
}
