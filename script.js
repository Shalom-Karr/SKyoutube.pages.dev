// --- START OF FILE script.js ---

// --- Supabase Configuration ---
import { supabase } from './supabase-client.js';

// --- CONFIGURATION ---
const colorThief = new ColorThief();

// --- DOM ELEMENT REFERENCES ---
const body = document.body;
const dashboardWrapper = document.getElementById('dashboard-wrapper');
const preloaderScreen = document.getElementById('preloader-screen');
const accessDeniedScreen = document.getElementById('access-denied-screen');
const statusMessage = document.getElementById('status-message');
const sidebar = document.getElementById('sidebar');
const actionPanel = document.getElementById('action-panel');
const expandSidebarBtn = document.getElementById('expand-sidebar-btn');
const channelsList = document.getElementById('channels-list');
const checkVideosBtn = document.getElementById('checkVideosBtn');
const savedVideoList = document.getElementById('video-list');
const sortSavedVideosSelect = document.getElementById('sort-saved-videos');
const videoModal = document.getElementById('video-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const videoFrame = document.getElementById('videoFrame');
const ambientBg = document.getElementById('ambient-bg');
const thumbnailLoader = document.getElementById('thumbnail-loader');
const modalVideoInfo = document.getElementById('modal-video-info');
const ytTitle = document.getElementById('ytTitle');
const ytChannel = document.getElementById('ytChannel');
const ytViews = document.getElementById('ytViews');
const ytDate = document.getElementById('ytDate');
const actionTabs = document.querySelectorAll('.action-tab');
const tabContents = document.querySelectorAll('.tab-content');
const toggleSidebarMobileBtn = document.getElementById('toggle-sidebar-mobile');
const toggleActionsMobileBtn = document.getElementById('toggle-actions-mobile');
const closeActionsMobileBtn = document.getElementById('close-actions-mobile');
const closeSidebarMobileBtn = document.getElementById('close-sidebar-mobile');
const overlay = document.getElementById('overlay');

// --- LOCAL STATE ---
let savedVideos = [];
let followedChannels = {};
let clientIp = 'unknown';

// --- UTILITY FUNCTION FOR STATUS MESSAGES ---
function showStatusMessage(message, type = 'success', duration = 4000) {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `show ${type}`;
    if (statusMessage.timeoutId) clearTimeout(statusMessage.timeoutId);
    statusMessage.timeoutId = setTimeout(() => {
        statusMessage.classList.remove('show', 'success', 'error');
        statusMessage.textContent = '';
    }, duration);
}

// --- HELPER FUNCTIONS ---
const getYouTubeVideoId = (url) => url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/)?. [1] || null;
const getVimeoVideoId = (url) => url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)?.[1] || null;
const getPlaylistId = (url) => url.match(/[?&]list=([a-zA-Z0-9_-]+)/)?.[1] || null;
const getYTMusicChannelId = (url) => url.match(/music\.youtube\.com\/channel\/([a-zA-Z0-9_-]+)/)?.[1] || null;
const getYTMusicBrowseId = (url) => url.match(/music\.youtube\.com\/browse\/([a-zA-Z0-9_-]+)/)?.[1] || null;

function parseYTDuration(iso) {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = iso.match(regex);
    if (!matches) return 0;
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
}
function formatViews(views) {
    if (!views) return '0';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(0) + 'K';
    return views.toLocaleString();
}
function timeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    const intervals = [
        { label: 'year', seconds: 31536000 }, { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 }, { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 }, { label: 'minute', seconds: 60 }, { label: 'second', seconds: 1 },
    ];
    for (const interval of intervals) {
        const count = Math.floor(seconds / interval.seconds);
        if (count >= 1) return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
    return 'just now';
}

async function isClientIpBlocked() {
    try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        clientIp = ipData.ip;
        const { data, error } = await supabase.from('blocked_ips').select('ip_address');
        if (error) {
            console.error("Error checking for blocked IP:", error);
            return false;
        }
        const blockedIps = data.map(d => d.ip_address);
        return blockedIps.some(blocked => clientIp === blocked || (blocked.split('.').length === 3 && clientIp.startsWith(blocked + '.')));
    } catch (e) {
        console.error("Could not detect client IP address. Assuming non-blocked.", e);
        return false;
    }
}

async function logUserActivity(url, title) {
    if (clientIp === 'unknown') {
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            clientIp = (await ipResponse.json()).ip;
        } catch (e) { console.error("Could not detect client IP for logging."); }
    }
    const { error } = await supabase.from('user_logs').insert([{ video_url: url, video_title: title, ip_address: clientIp }]);
    if (error) console.error("Error logging user activity:", error);
}

// --- LOCAL STORAGE & STATE MANAGEMENT ---
function loadStateFromStorage() {
    savedVideos = JSON.parse(localStorage.getItem('universalVideoManager')) || [];
    followedChannels = JSON.parse(localStorage.getItem('followedChannels')) || {};
}
function saveVideosToStorage() { localStorage.setItem('universalVideoManager', JSON.stringify(savedVideos)); }
function saveChannelsToStorage() { localStorage.setItem('followedChannels', JSON.stringify(followedChannels)); }

// --- API CALLS ---
async function fetchWithKeyRotation(pathAndParams) {
    const endpoint = pathAndParams.match(/^([a-zA-Z]+)/)?.[1];
    if (!endpoint) throw new Error("Invalid API path provided to proxy.");
    const params = pathAndParams.match(/\?(.*)/)?.[1] || '';
    const hostname = window.location.hostname;
    let proxyPath;
    if (hostname.endsWith('netlify.app')) {
        proxyPath = '/.netlify/functions/youtubeproxy';
    } else {
        proxyPath = '/api/youtubeproxy';
    }
    const proxyUrl = `${proxyPath}?endpoint=${endpoint}&params=${encodeURIComponent(params)}`;
    try {
        const res = await fetch(proxyUrl);
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || `Proxy failed with status: ${res.status}`);
        return data;
    } catch (error) {
        console.error(`Proxy API Error: ${error.message}`);
        throw new Error(`Failed to fetch data via proxy: ${error.message}`);
    }
}

// --- MODAL VIDEO PLAYER LOGIC ---
function playVideoInModal(youtubeId) {
    if (!youtubeId) return;
    videoFrame.src = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${window.location.origin}&autoplay=1`;
    setAmbientColor(youtubeId);
    updateVideoInfoInModal(youtubeId);
    videoModal.classList.add('visible');
    body.style.overflow = 'hidden';
}
function closePlayer() {
    videoModal.classList.remove('visible');
    videoFrame.src = "";
    ambientBg.style.backgroundColor = 'transparent';
    modalVideoInfo.classList.remove('visible');
    body.style.overflow = '';
}
function setAmbientColor(videoId) {
    thumbnailLoader.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    thumbnailLoader.onload = () => {
        try {
            const [r, g, b] = colorThief.getColor(thumbnailLoader);
            ambientBg.style.backgroundColor = `rgba(${r},${g},${b},0.5)`;
        } catch (e) { console.error("ColorThief error:", e); }
    };
}
async function updateVideoInfoInModal(videoId) {
    modalVideoInfo.classList.remove('visible');
    ytTitle.textContent = 'Loading...';
    ytChannel.textContent = ''; ytViews.textContent = ''; ytDate.textContent = '';
    try {
        const data = await fetchWithKeyRotation(`videos?part=snippet,statistics&id=${videoId}`);
        const video = data.items[0];
        if (video) {
            ytTitle.textContent = video.snippet.title;
            ytChannel.textContent = video.snippet.channelTitle;
            ytViews.textContent = `${parseInt(video.statistics.viewCount).toLocaleString()} views`;
            ytDate.textContent = `Published on ${new Date(video.snippet.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
            modalVideoInfo.classList.add('visible');
            logUserActivity(`https://www.youtube.com/watch?v=${videoId}`, video.snippet.title);            
        }
    } catch (e) {
        console.error("Error fetching video info:", e);
        ytTitle.textContent = 'Could not load video details.';
        modalVideoInfo.classList.add('visible');
    }
}

// --- SAVED VIDEOS GRID LOGIC ---
function renderSavedVideos(sortKey = 'date-added-desc') {
    sortSavedVideos(sortKey);
    savedVideoList.innerHTML = savedVideos.length === 0 ? '<p style="text-align:center; grid-column: 1 / -1;">No videos saved yet.</p>' : '';
    savedVideos.forEach((video, index) => {
        const youtubeId = getYouTubeVideoId(video.url);
        const vimeoId = getVimeoVideoId(video.url);
        if (!youtubeId && !vimeoId) return;
        const thumbnailUrl = youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg` : `https://vumbnail.com/${vimeoId}.jpg`;
        const item = document.createElement('div');
        item.className = 'video-item';
        item.innerHTML = `
            <div class="thumbnail-container"><img class="video-item-thumbnail" src="${thumbnailUrl}" alt="${video.title}" data-youtube-id="${youtubeId || ''}"></div>
            <div class="video-item-info">
                <p class="video-item-title">${video.title || video.url}</p>
                <div class="video-item-footer">
                    <span class="platform-badge platform-${youtubeId ? 'youtube' : 'vimeo'}">${youtubeId ? 'YouTube' : 'Vimeo'}</span>
                    <button class="delete-btn material-icons" data-id="${video.id}" title="Delete Video">delete</button>
                </div>
            </div>`;
        item.style.animationDelay = `${index * 50}ms`;
        savedVideoList.appendChild(item);
        setTimeout(() => item.classList.add('reveal'), 50);
    });
}
function sortSavedVideos(key) {
    const compareFn = (a, b) => {
        if (key.includes('title')) return a.title.localeCompare(b.title);
        return (a.dateAdded || 0) - (b.dateAdded || 0);
    };
    savedVideos.sort(compareFn);
    if (key.endsWith('desc')) savedVideos.reverse();
}
async function saveVideo(url, title = null) {
    if (savedVideos.some(v => v.url === url)) {
        showStatusMessage('This video is already saved.', 'error');
        return;
    }
    let videoTitle = title;
    if (!videoTitle && getYouTubeVideoId(url)) {
        try {
            const videoId = getYouTubeVideoId(url);
            const data = await fetchWithKeyRotation(`videos?part=snippet&id=${videoId}`);
            if (data.items.length > 0) videoTitle = data.items[0].snippet.title;
        } catch (e) { console.error("Could not fetch video title", e); }
    }
    const newVideo = { id: crypto.randomUUID(), url, title: videoTitle || url, dateAdded: Date.now() };
    savedVideos.unshift(newVideo);
    saveVideosToStorage();
    renderSavedVideos(sortSavedVideosSelect.value);
    showStatusMessage('Video saved successfully!', 'success');
    await logUserActivity(url, videoTitle);
}
async function deleteVideo(id) {
    savedVideos = savedVideos.filter(video => video.id !== id);
    saveVideosToStorage();
    renderSavedVideos(sortSavedVideosSelect.value);
    showStatusMessage('Video deleted.', 'success');
}

// --- ACTION PANEL LOGIC ---
async function searchYouTube(query, type, resultsContainer) {
    resultsContainer.innerHTML = '<div class="loader"></div>';
    try {
        const data = await fetchWithKeyRotation(`search?part=snippet&type=${type}&maxResults=20&q=${encodeURIComponent(query)}`);
        resultsContainer.innerHTML = data.items.length === 0 ? '<p>No results found.</p>' : '';
        if (type === 'video') renderVideoSearchResults(data.items, resultsContainer);
        if (type === 'channel') renderChannelSearchResults(data.items, resultsContainer);
    } catch (error) {
        resultsContainer.innerHTML = `<p style="color: var(--red-color);">Error: ${error.message}</p>`;
    }
}
function renderVideoSearchResults(items, container) {
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'video-result-card';
        card.innerHTML = `
            <img src="${item.snippet.thumbnails.medium.url}" alt="${item.snippet.title}">
            <div class="result-info">
                <div class="result-title">${item.snippet.title}</div>
                <div class="result-creator">${item.snippet.channelTitle}</div>
                <div class="result-time">${timeAgo(new Date(item.snippet.publishedAt))}</div>
            </div>`;
        card.onclick = () => saveVideo(`https://www.youtube.com/watch?v=${item.id.videoId}`, item.snippet.title);
        container.appendChild(card);
    });
}

async function getSuggestions() {
    const resultsContainer = document.getElementById('suggestions-results');
    resultsContainer.innerHTML = '<div class="loader"></div>';

    try {
        const videoIds = savedVideos.map(v => getYouTubeVideoId(v.url)).filter(Boolean);
        const channelIds = Object.values(followedChannels).map(c => c.id);

        let seedVideoId = videoIds.length > 0 ? videoIds[Math.floor(Math.random() * videoIds.length)] : null;
        let seedChannelId = channelIds.length > 0 ? channelIds[Math.floor(Math.random() * channelIds.length)] : null;

        if (!seedVideoId && !seedChannelId) {
            resultsContainer.innerHTML = '<p>Follow some channels or save some videos to get suggestions.</p>';
            return;
        }

        let suggestions = [];
        if (seedVideoId) {
            const data = await fetchWithKeyRotation(`search?part=snippet&relatedToVideoId=${seedVideoId}&type=video&maxResults=10`);
            suggestions = suggestions.concat(data.items);
        }

        if (seedChannelId && suggestions.length < 20) {
            const data = await fetchWithKeyRotation(`search?part=snippet&channelId=${seedChannelId}&type=video&maxResults=10`);
            suggestions = suggestions.concat(data.items);
        }

        if (suggestions.length === 0) {
            resultsContainer.innerHTML = '<p>No suggestions found.</p>';
            return;
        }

        resultsContainer.innerHTML = '';
        renderVideoSearchResults(suggestions, resultsContainer);

    } catch (error) {
        resultsContainer.innerHTML = `<p style="color: var(--red-color);">Error: ${error.message}</p>`;
    }
}
function renderChannelSearchResults(items, container) {
    items.forEach(item => {
        const { channelId, title, description, thumbnails } = item.snippet;
        const internalName = title.replace(/\s/g, '');
        const isFollowing = !!followedChannels[internalName];
        const card = document.createElement('div');
        card.className = 'channel-result-card';
        card.innerHTML = `
            <img src="${thumbnails.medium.url}" alt="${title}">
            <div class="result-info">
                <div class="result-title">${title}</div>
                <div class="result-description">${description}</div>
            </div>
            <button class="follow-btn ${isFollowing ? 'unfollow' : ''}">${isFollowing ? 'Follow' : 'Follow'}</button>`;
        card.querySelector('.follow-btn').onclick = (e) => {
            e.stopPropagation();
            if (isFollowing) removeYoutubeChannel(internalName);
            else addYoutubeChannel(internalName, title, channelId, thumbnails.medium.url);
            searchYouTube(document.getElementById('channel-search-input').value, 'channel', document.getElementById('channel-search-results'));
        };
        container.appendChild(card);
    });
}

// --- SIDEBAR LOGIC ---
function renderFollowedChannels() {
    channelsList.innerHTML = '';
    Object.entries(followedChannels).forEach(([internalName, data]) => {
        const isPlaylist = data.type === 'playlist';
        const elementDiv = document.createElement('div');
        elementDiv.className = 'channel';
        elementDiv.dataset.channel = internalName;

        const icon = isPlaylist ? 'playlist_play' : 'expand_more';
        const musicBadge = data.isMusic ? '<span class="music-badge">Music</span>' : '';

        elementDiv.innerHTML = `
            <div class="channel-info" data-name="${internalName}">
                <span class="expandChannel material-icons">${icon}</span>
                <img src="${data.thumbnailUrl}" alt="${data.displayName}">
                <span class="creator">${data.displayName}</span>
                ${musicBadge}
                <button class="remove-btn material-icons" data-internal-name="${internalName}" title="Remove">close</button>
                ${!isPlaylist ? `<span class="notification-dot" id="notif-${internalName}" style="display: none;"></span>` : ''}
            </div>
            <div class="video-dropdown" id="dropdown-${internalName}">
                ${!isPlaylist ? `
                <div class="dropdown-controls">
                     <select class="sort-dropdown styled-select" data-channel-name="${internalName}">
                        <option value="newest">Newest</option>
                        <option value="views">Most Views</option>
                        <option value="shortest">Shortest</option>
                        <option value="longest">Longest</option>
                    </select>
                </div>` : ''}
            </div>`;
        channelsList.appendChild(elementDiv);

        if (isPlaylist && data.videos) {
            const container = document.getElementById(`dropdown-${internalName}`);
            data.videos.forEach(video => {
                container.insertAdjacentHTML('beforeend', `
                    <div class="dropdown-video" data-video-id="${video.id}" data-channel-name="${internalName}" data-title="${video.title}">
                        <img class="dropdown-thumbnail" src="${video.thumbnail}" alt="${video.title}">
                        <div class="dropdown-info">
                            <div class="dropdown-title">${video.title}</div>
                             <div class="dropdown-meta"><span>${timeAgo(new Date(video.publishedAt))}</span></div>
                        </div>
                    </div>`);
            });
        }
    });
}
async function addPlaylistById(playlistId, isMusic = false) {
    if (!playlistId) return;

    const isAlreadyFollowed = Object.values(followedChannels).some(c => c.id === playlistId && c.type === 'playlist');
    if (isAlreadyFollowed) {
        showStatusMessage('This playlist is already in your following list.', 'error');
        return;
    }

    try {
        const playlistData = await fetchWithKeyRotation(`playlists?part=snippet&id=${playlistId}`);
        if (!playlistData.items || playlistData.items.length === 0) throw new Error("Playlist not found or is private.");

        const { title: playlistTitle, thumbnails } = playlistData.items[0].snippet;
        const playlistThumbnail = thumbnails.medium.url;

        const videoData = await fetchWithKeyRotation(`playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50`);
        const videos = videoData.items
            .filter(item => item.snippet.resourceId && item.snippet.resourceId.videoId)
            .map(item => ({
                id: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails?.medium?.url || 'path/to/default/thumbnail.jpg',
                publishedAt: item.snippet.publishedAt,
                viewCount: 0,
                duration: 0
            }));

        const internalName = `playlist_${playlistId}`;
        followedChannels[internalName] = {
            id: playlistId,
            displayName: playlistTitle,
            thumbnailUrl: playlistThumbnail,
            type: 'playlist',
            isMusic: isMusic,
            videos: videos
        };

        saveChannelsToStorage();
        renderFollowedChannels();
        showStatusMessage(`Playlist "${playlistTitle}" added successfully!`, 'success');
        logUserActivity(`https://www.youtube.com/playlist?list=${playlistId}`, `Followed Playlist: ${playlistTitle}`);

    } catch (error) {
        console.error("Error adding playlist:", error);
        showStatusMessage(`Failed to add playlist: ${error.message}`, 'error');
    }
}

async function addChannelByHandle(handle) {
    if (!handle) return;

    try {
        const channelData = await fetchWithKeyRotation(`channels?part=snippet&forHandle=${handle}`);
        if (!channelData.items || channelData.items.length === 0) {
            throw new Error("Channel handle not found.");
        }
        const { id, snippet } = channelData.items[0];
        const { title, thumbnails } = snippet;
        const internalName = title.replace(/\s/g, '');

        if (followedChannels[internalName]) {
            showStatusMessage(`You are already following ${title}.`, 'info');
            return;
        }

        addYoutubeChannel(internalName, title, id, thumbnails.medium.url);
        logUserActivity(`https://www.youtube.com/handle/@${handle}`, `Followed Channel by Handle: ${title}`);

    } catch (error) {
        console.error("Error adding channel by handle:", error);
        showStatusMessage(`Failed to follow channel: ${error.message}`, 'error');
    }
}

async function addChannelById(channelId, isMusic = false) {
    if (!channelId) return;

    try {
        const channelData = await fetchWithKeyRotation(`channels?part=snippet&id=${channelId}`);
        if (!channelData.items || channelData.items.length === 0) {
            throw new Error("Channel not found.");
        }
        const { id, snippet } = channelData.items[0];
        const { title, thumbnails } = snippet;
        const internalName = title.replace(/\s/g, '');

        if (followedChannels[internalName]) {
            showStatusMessage(`You are already following ${title}.`, 'info');
            return;
        }

        addYoutubeChannel(internalName, title, id, thumbnails.medium.url, isMusic);
        logUserActivity(`https://www.youtube.com/channel/${id}`, `Followed Channel by ID: ${title}`);

    } catch (error) {
        console.error("Error adding channel by ID:", error);
        showStatusMessage(`Failed to follow channel: ${error.message}`, 'error');
    }
}

function addYoutubeChannel(internalName, displayName, channelId, thumbnailUrl, isMusic = false) {
    if (followedChannels[internalName]) return;
    followedChannels[internalName] = { id: channelId, displayName, thumbnailUrl, isMusic };
    saveChannelsToStorage();
    renderFollowedChannels();
    showStatusMessage(`Following ${displayName}`, 'success');
    logUserActivity(`https://www.youtube.com/channel/${channelId}`, `Followed: ${displayName}`);
}
function removeYoutubeChannel(internalName) {
    const channelData = followedChannels[internalName];
    if (!channelData) return;

    const isPlaylist = channelData.type === 'playlist';
    const message = isPlaylist ? `Playlist "${channelData.displayName}" removed.` : `Unfollowed ${channelData.displayName}.`;

    delete followedChannels[internalName];
    saveChannelsToStorage();
    renderFollowedChannels();
    showStatusMessage(message, 'success');
}
async function fetchAndCacheChannelVideos(channelName, channelId) {
    const channelDiv = document.querySelector(`.channel[data-channel="${channelName}"]`);
    try {
        const searchData = await fetchWithKeyRotation(`search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video`);
        const videoIds = searchData.items.map(v => v.id.videoId).join(',');
        if (!videoIds) return;
        const detailsData = await fetchWithKeyRotation(`videos?part=snippet,statistics,contentDetails&id=${videoIds}`);
        const videos = detailsData.items.map(item => ({
            id: item.id, title: item.snippet.title, thumbnail: item.snippet.thumbnails.medium.url,
            publishedAt: item.snippet.publishedAt, viewCount: parseInt(item.statistics.viewCount || 0),
            duration: parseYTDuration(item.contentDetails.duration)
        }));
        if (videos.length > 0) updateChannelDropdown(channelName, videos, true);
        if (channelDiv) {
            channelDiv.classList.add("highlight-green");
            channelDiv.addEventListener("animationend", () => channelDiv.classList.remove("highlight-green"), { once: true });
        }
    } catch (err) { console.error(`Error checking ${channelName}:`, err); }
}
async function checkAllChannels() {
    checkVideosBtn.classList.add('loading');
    const promises = Object.values(followedChannels).map(data => fetchAndCacheChannelVideos(data.displayName.replace(/\s/g, ''), data.id));
    await Promise.all(promises);
    checkVideosBtn.classList.remove('loading');
}
function updateChannelDropdown(channelName, videos, merge = false) {
    const container = document.getElementById(`dropdown-${channelName}`);
    const notification = document.getElementById(`notif-${channelName}`);
    if (!container || !notification) return;
    const storageKey = `videos-${channelName}`;
    let existingVideos = [];
    if (merge) {
        try { existingVideos = JSON.parse(localStorage.getItem(storageKey))?.videos || []; } 
        catch (e) { console.error("Could not parse existing videos, starting fresh."); }
    }
    const newVideos = videos.filter(v => !existingVideos.some(ev => ev.id === v.id));
    const allVideos = [...newVideos, ...existingVideos];
    const dataToStore = { timestamp: Date.now(), videos: allVideos };
    localStorage.setItem(storageKey, JSON.stringify(dataToStore));
    sortDropdownVideos(allVideos, container.querySelector('.sort-dropdown')?.value || 'newest');
    container.querySelectorAll('.dropdown-video').forEach(el => el.remove());
    allVideos.forEach(video => {
        const isSaved = savedVideos.some(sv => getYouTubeVideoId(sv.url) === video.id);
        container.insertAdjacentHTML('beforeend', `
            <div class="dropdown-video" data-video-id="${video.id}" data-channel-name="${channelName}" data-title="${video.title}">
                <img class="dropdown-thumbnail" src="${video.thumbnail}" alt="${video.title}">
                <div class="dropdown-info">
                    <div class="dropdown-title">${video.title}</div>
                    <div class="dropdown-meta"><span>${formatViews(video.viewCount)} views</span> • <span>${timeAgo(new Date(video.publishedAt))}</span></div>
                </div>
            </div>`);
    });
    notification.style.display = allVideos.length > 0 ? 'block' : 'none';
}
function sortDropdownVideos(videos, key) {
    const SORTS = {
        'views': (a, b) => (b.viewCount || 0) - (a.viewCount || 0),
        'shortest': (a, b) => (a.duration || 0) - (b.duration || 0),
        'longest': (a, b) => (b.duration || 0) - (a.duration || 0),
        'newest': (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    };
    videos.sort(SORTS[key] || SORTS['newest']);
}
async function handleDropdownVideoClick(videoElement) {
    const { videoId, title, channelName } = videoElement.dataset;
    await saveVideo(`https://www.youtube.com/watch?v=${videoId}`, title);
    try {
        const storageKey = `videos-${channelName}`;
        const storedData = JSON.parse(localStorage.getItem(storageKey)) || { videos: [] };
        storedData.videos = storedData.videos.filter(v => v.id !== videoId);
        localStorage.setItem(storageKey, JSON.stringify(storedData));
        videoElement.remove();
        if (storedData.videos.length === 0) {
            const notification = document.getElementById(`notif-${channelName}`);
            if (notification) notification.style.display = 'none';
        }
    } catch (e) { console.error("Error updating dropdown cache after save:", e); }
}

// --- INITIALIZATION & EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', async () => {
    preloaderScreen.classList.add('hidden');
    if (await isClientIpBlocked()) {
        accessDeniedScreen.classList.add('visible');
        return;
    }
    dashboardWrapper.style.display = 'flex';
    loadStateFromStorage();
    renderSavedVideos();
    renderFollowedChannels();
    restoreDropdownVideosFromStorage();

    // Check for video or playlist source in URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoSource = urlParams.get('source');
    const channelSource = urlParams.get('channel_source');
    const isMusic = urlParams.get('isMusic') === 'true';
    if (window.location.pathname.includes('/video') && videoSource) {
        playVideoInModal(videoSource);
    } else if (window.location.pathname.includes('/playlist') && videoSource) {
        addPlaylistById(videoSource, isMusic);
    } else if (window.location.pathname.includes('/channel') && videoSource) {
        // Check if the source is a channel ID or a handle
        if (videoSource.startsWith('UC') || videoSource.startsWith('HC')) {
            addChannelById(videoSource, isMusic);
        } else {
            addChannelByHandle(videoSource);
        }
    } else if (channelSource) {
        addChannelByHandle(channelSource);
    }
});
closeModalBtn.addEventListener('click', closePlayer);
videoModal.addEventListener('click', e => e.target === videoModal && closePlayer());
sortSavedVideosSelect.addEventListener('change', e => renderSavedVideos(e.target.value));
savedVideoList.addEventListener('click', e => {
    if (e.target.closest('.delete-btn')) {
        if (confirm('Are you sure you want to delete this video?')) deleteVideo(e.target.closest('.delete-btn').dataset.id);
    } else if (e.target.closest('.video-item-thumbnail')?.dataset.youtubeId) {
        playVideoInModal(e.target.closest('.video-item-thumbnail').dataset.youtubeId);
    }
});
expandSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    body.classList.toggle('sidebar-collapsed');
    expandSidebarBtn.textContent = sidebar.classList.contains('collapsed') ? 'chevron_right' : 'chevron_left';
});
checkVideosBtn.addEventListener('click', checkAllChannels);
channelsList.addEventListener('click', e => {
    const removeBtn = e.target.closest('.remove-btn');
    if (removeBtn) {
        const internalName = removeBtn.dataset.internalName;
        if (internalName) {
            removeYoutubeChannel(internalName);
        }
        return; // Stop further processing
    }

    const channelInfo = e.target.closest('.channel-info');
    const dropdownVideo = e.target.closest('.dropdown-video');
    const sortSelect = e.target.closest('.sort-dropdown');

    if (channelInfo) {
        const channelElement = channelInfo.parentElement;
        const wasOpen = channelElement.classList.contains('dropdown-open');

        // First, close any other open channels
        channelsList.querySelectorAll('.channel.dropdown-open').forEach(openChannel => {
            openChannel.classList.remove('dropdown-open');
        });

        // If the clicked channel was NOT already open, open it
        if (!wasOpen) {
            channelElement.classList.add('dropdown-open');
        }

        // Now, toggle the master class on the sidebar itself
        const isAnyChannelOpen = !!channelsList.querySelector('.channel.dropdown-open');
        sidebar.classList.toggle('channel-expanded', isAnyChannelOpen);

    } else if (dropdownVideo) {
        handleDropdownVideoClick(dropdownVideo);
    } else if (sortSelect) {
        const storedData = JSON.parse(localStorage.getItem(`videos-${sortSelect.dataset.channelName}`)) || { videos: [] };
        updateChannelDropdown(sortSelect.dataset.channelName, storedData.videos, false);
    }
});
actionTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        actionTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});
document.getElementById('embed-button').addEventListener('click', async () => {
    const input = document.getElementById('embed-url-input');
    const url = input.value.trim();
    const playlistId = getPlaylistId(url);
    const ytMusicChannelId = getYTMusicChannelId(url);
    const ytMusicBrowseId = getYTMusicBrowseId(url);

    if (playlistId) {
        await addPlaylistById(playlistId, url.includes('music.youtube.com'));
        input.value = '';
    } else if (ytMusicChannelId) {
        await addChannelById(ytMusicChannelId, true);
        input.value = '';
    } else if (ytMusicBrowseId) {
        showStatusMessage("Auto-generated mixes and artist pages are not supported yet.", "info");
    } else if (getYouTubeVideoId(url) || getVimeoVideoId(url)) {
        await saveVideo(url);
        input.value = '';
    } else {
        showStatusMessage("Please enter a valid YouTube, Vimeo, or YouTube Music URL.", "error");
    }
});
document.getElementById('video-search-button').addEventListener('click', () => {
    const query = document.getElementById('video-search-input').value.trim();
    if (query) searchYouTube(query, 'video', document.getElementById('video-search-results'));
});
document.getElementById('channel-search-button').addEventListener('click', () => {
    const query = document.getElementById('channel-search-input').value.trim();
    if (query) searchYouTube(query, 'channel', document.getElementById('channel-search-results'));
});

document.getElementById('suggestions-button').addEventListener('click', getSuggestions);
['embed-url-input', 'video-search-input', 'channel-search-input'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') e.target.nextElementSibling.click();
    });
});
const togglePanel = (panel, isOpen) => {
    panel.classList.toggle('mobile-open', isOpen);
    overlay.classList.toggle('visible', isOpen);
    toggleActionsMobileBtn.style.visibility = isOpen && panel.id === 'sidebar' ? 'hidden' : 'visible';
    toggleSidebarMobileBtn.style.visibility = isOpen && panel.id === 'action-panel' ? 'hidden' : 'visible';
};
toggleSidebarMobileBtn.addEventListener('click', () => togglePanel(sidebar, true));
toggleActionsMobileBtn.addEventListener('click', () => togglePanel(actionPanel, true));
closeActionsMobileBtn.addEventListener('click', () => togglePanel(actionPanel, false));
closeSidebarMobileBtn.addEventListener('click', () => togglePanel(sidebar, false));
overlay.addEventListener('click', () => {
    togglePanel(sidebar, false);
    togglePanel(actionPanel, false);
});
function restoreDropdownVideosFromStorage() {
    Object.entries(followedChannels).forEach(([channelName, channelData]) => {
        // If it's a playlist, we don't need to do anything here as the videos are stored with the playlist object itself.
        if (channelData.type === 'playlist') {
            return;
        }

        const storageKey = `videos-${channelName}`;
        const storedDataJSON = localStorage.getItem(storageKey);
        if (!storedDataJSON) {
            console.log(`No cache for ${channelName}. Fetching initial data...`);
            fetchAndCacheChannelVideos(channelName, channelData.id);
            return;
        }
        try {
            const storedData = JSON.parse(storedDataJSON);
            const thirtyDaysInMillis = 30 * 24 * 60 * 60 * 1000;
            if (!storedData.timestamp || (Date.now() - storedData.timestamp > thirtyDaysInMillis)) {
                console.log(`Cache for ${channelName} is stale. Auto-refreshing...`);
                fetchAndCacheChannelVideos(channelName, channelData.id);
            } 
            else if (storedData.videos && storedData.videos.length > 0) {
                updateChannelDropdown(channelName, storedData.videos, false);
            }
        } catch (e) {
            console.error(`Clearing corrupted data for ${channelName} and re-fetching:`, e);
            localStorage.removeItem(storageKey);
            fetchAndCacheChannelVideos(channelName, channelData.id);
        }
    });
}

