
import { supabase } from '../supabase-client.js';

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

async function getCachedData(key) {
    const cached = localStorage.getItem(key);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        }
    }
    return null;
}

function setCachedData(key, data) {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
}

export async function fetchFromProxy(endpoint, params) {
    const url = `/.netlify/functions/youtubeproxy?endpoint=${endpoint}&${params}`;
    const cached = await getCachedData(url);
    if (cached) return cached;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube API Error: ${response.status}`);
    const data = await response.json();
    setCachedData(url, data);
    return data;
}

export async function fetchArtistWhitelist() {
    const cacheKey = 'artistWhitelistWithAvatars';
    const cached = await getCachedData(cacheKey);
    if (cached) return cached;

    try {
        const { data: artists, error } = await supabase.from('artists').select('*');
        if (error) throw error;
        if (!artists || artists.length === 0) {
            return [];
        }

        const allChannelItems = [];
        const channelIds = artists.map(a => a.channel_id);
        const chunkSize = 50;

        for (let i = 0; i < channelIds.length; i += chunkSize) {
            const chunk = channelIds.slice(i, i + chunkSize);
            if (chunk.length > 0) {
                const channelData = await fetchFromProxy('channels', `part=snippet&id=${chunk.join(',')}`);
                if (channelData.items) {
                    allChannelItems.push(...channelData.items);
                }
            }
        }

        const artistsWithAvatars = artists.map(artist => {
            const channel = allChannelItems.find(c => c.id === artist.channel_id);
            return {
                ...artist,
                avatar: channel ? channel.snippet.thumbnails.default.url : null,
            };
        });

        setCachedData(cacheKey, artistsWithAvatars);
        return artistsWithAvatars;
    } catch (error) {
        console.error('Error fetching artist whitelist:', error);
        return [];
    }
}
