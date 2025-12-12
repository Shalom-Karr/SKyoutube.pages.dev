
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

export async function fetchArtistWhitelist() {
    const indexCacheKey = 'artist_whitelist_index';
    const cachedIndex = await getCachedData(indexCacheKey);

    if (cachedIndex) {
        const artists = [];
        for (const channelId of cachedIndex) {
            const artistData = await getCachedData(`artist_detail_${channelId}`);
            if (artistData) {
                artists.push(artistData);
            } else {
                // If any artist is missing, the cache is stale. Fetch all.
                console.warn(`Cache miss for artist ${channelId}. Refetching entire whitelist.`);
                return await fetchAndCacheAllArtists();
            }
        }
        return artists;
    }

    return await fetchAndCacheAllArtists();
}

async function fetchAndCacheAllArtists() {
    try {
        const { data: artists, error } = await supabase.from('artists').select('name, channel_id');
        if (error) throw error;
        if (!artists || artists.length === 0) return [];

        const channelIds = artists
            .map(a => a.channel_id)
            .filter(id => id && id.trim() !== '');

        if (channelIds.length === 0) return [];

        const allChannelItems = [];
        const chunkSize = 50;
        for (let i = 0; i < channelIds.length; i += chunkSize) {
            const chunk = channelIds.slice(i, i + chunkSize);
            const channelData = await fetchFromProxy('channels', {
                part: 'snippet',
                id: chunk.join(','),
            });
            if (channelData && channelData.items) {
                allChannelItems.push(...channelData.items);
            }
        }

        const artistsWithAvatars = artists.map(artist => {
            const channel = allChannelItems.find(c => c.id === artist.channel_id);
            let avatarUrl = channel ? channel.snippet.thumbnails.default.url : null;
            if (avatarUrl && avatarUrl.startsWith('//')) {
                avatarUrl = 'https:' + avatarUrl;
            } else if (avatarUrl) {
                avatarUrl = avatarUrl.replace(/^http:/, 'https:');
            }
            return { ...artist, avatar: avatarUrl };
        });

        // Cache each artist individually and the index
        artistsWithAvatars.forEach(artist => {
            setCachedData(`artist_detail_${artist.channel_id}`, artist);
        });
        const newIndex = artistsWithAvatars.map(a => a.channel_id);
        setCachedData('artist_whitelist_index', newIndex);

        return artistsWithAvatars;
    } catch (error) {
        console.error('Error fetching artist whitelist:', error);
        return [];
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
