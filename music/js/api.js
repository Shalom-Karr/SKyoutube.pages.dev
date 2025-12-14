
import { supabase } from '../supabase-client.js';

const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const CACHE_PREFIX = 'api_cache_';

async function getCachedData(key) {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (cached) {
        try {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                // Update timestamp to mark as recently used
                const updatedItem = JSON.stringify({ timestamp: Date.now(), data });
                localStorage.setItem(CACHE_PREFIX + key, updatedItem);
                return data;
            }
        } catch (e) {
            console.error("Error parsing cache data, ignoring.", e);
            localStorage.removeItem(CACHE_PREFIX + key);
        }
    }
    return null;
}

function setCachedData(key, data) {
    const item = { timestamp: Date.now(), data };
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            console.warn('Cache quota exceeded. Starting progressive eviction.');

            // Stage 1: Evict 80% of the cache and retry
            try {
                evictCache(0.8);
                localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
                console.log("Successfully set cache item after partial eviction.");
                return;
            } catch (e2) {
                console.warn("Partial eviction insufficient. Clearing entire API cache.");

                // Stage 2: Clear the entire API cache and retry
                try {
                    clearApiCache();
                    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
                    console.log("Successfully set cache item after full cache clear.");
                } catch (e3) {
                    console.error("Failed to set cache item even after clearing entire cache:", e3);
                    // At this point, the item is likely too large for localStorage.
                }
            }
        } else {
            console.error("Failed to set cache item:", e);
        }
    }
}

function evictCache(percentage = 0.2) {
    let items = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(CACHE_PREFIX)) {
            try {
                const item = JSON.parse(localStorage.getItem(key));
                items.push({ key, timestamp: item.timestamp || 0 });
            } catch (e) {
                // Invalid item, remove it
                localStorage.removeItem(key);
            }
        }
    }

    // Sort by timestamp, oldest first
    items.sort((a, b) => a.timestamp - b.timestamp);

    // Remove the oldest percentage of the cache
    const itemsToRemove = Math.ceil(items.length * percentage);
    for (let i = 0; i < itemsToRemove; i++) {
        console.log(`Evicting ${items[i].key} from cache.`);
        localStorage.removeItem(items[i].key);
    }
}

function clearApiCache() {
    console.warn("Clearing the entire API cache.");
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key.startsWith(CACHE_PREFIX)) {
            localStorage.removeItem(key);
        }
    }
}


export async function fetchFromProxy(endpoint, params) {
    // Correctly encode the parameters
    const queryString = new URLSearchParams(params).toString();
    const url = `/.netlify/functions/youtubeproxy?endpoint=${endpoint}&${queryString}`;

    const cached = await getCachedData(url);
    if (cached) return cached;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`YouTube API Error: ${response.status}`);
    const data = await response.json();
    setCachedData(url, data);
    return data;
}

// New Strategy: Fetch and cache only the basic artist list (index) initially.
// Fetch and cache full artist details (like avatars) on-demand.

export async function fetchArtistWhitelist() {
    const cacheKey = 'artist_whitelist_basic';
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    try {
        const { data: artists, error } = await supabase.from('artists').select('name, channel_id');
        if (error) throw error;
        if (!artists || artists.length === 0) return [];

        const validArtists = artists.filter(a => a.channel_id && a.channel_id.trim() !== '');

        setCachedData(cacheKey, validArtists);
        return validArtists;
    } catch (error) {
        console.error('Error fetching artist whitelist:', error);
        return [];
    }
}

export async function getArtistDetails(artist) {
    const cacheKey = `artist_detail_${artist.channel_id}`;
    const cachedData = await getCachedData(cacheKey);
    if (cachedData) {
        // Return a merged object, ensuring the latest name from the whitelist is used.
        return { ...cachedData, name: artist.name };
    }

    try {
        const channelData = await fetchFromProxy('channels', {
            part: 'snippet',
            id: artist.channel_id,
        });

        if (channelData && channelData.items && channelData.items.length > 0) {
            const channel = channelData.items[0];
            let avatarUrl = channel.snippet.thumbnails.default.url;

            if (avatarUrl && avatarUrl.startsWith('//')) {
                avatarUrl = 'https:' + avatarUrl;
            } else if (avatarUrl) {
                avatarUrl = avatarUrl.replace(/^http:/, 'https:');
            }

            const details = { ...artist, avatar: avatarUrl };
            setCachedData(cacheKey, details);
            return details;
        }
        return artist; // Return basic artist info if API fails
    } catch (error) {
        console.error(`Error fetching details for artist ${artist.name}:`, error);
        return artist; // Return basic info on error
    }
}

export async function fetchArtistAlbums(channelId) {
    try {
        const data = await fetchFromProxy('search', {
            part: 'snippet',
            type: 'playlist',
            channelId: channelId,
            maxResults: 50
        });
        return data.items.map(item => ({
            id: item.id.playlistId,
            title: item.snippet.title,
            thumbnail: getBestThumbnail(item.snippet.thumbnails),
            artist: item.snippet.channelTitle
        }));
    } catch (error) {
        console.error('Error fetching artist albums:', error);
        return [];
    }
}

export async function fetchPlaylistItems(playlistId) {
    try {
        const data = await fetchFromProxy('playlistItems', {
            part: 'snippet',
            playlistId: playlistId,
            maxResults: 50
        });
        return data.items.map(item => ({
            videoId: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            artist: item.snippet.videoOwnerChannelTitle,
            thumbnail: getBestThumbnail(item.snippet.thumbnails),
        }));
    } catch (error) {
        console.error('Error fetching playlist items:', error);
        return [];
    }
}

function getBestThumbnail(thumbnails) {
    if (!thumbnails) return 'https://via.placeholder.com/150';
    const preferredOrder = ['high', 'medium', 'default'];
    for (const quality of preferredOrder) {
        if (thumbnails[quality] && thumbnails[quality].url) {
            return thumbnails[quality].url.replace(/^http:/, 'https:');
        }
    }
    return 'https://via.placeholder.com/150';
}

export function parseYoutubeItem(item) {
    if (!item || !item.snippet) return null;

    return {
        videoId: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail: getBestThumbnail(item.snippet.thumbnails),
    };
}
