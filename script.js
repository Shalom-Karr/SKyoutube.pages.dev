// --- CONFIGURATION ---
const API_KEYS = [
    // IMPORTANT: REPLACE with your own YouTube Data API v3 keys
    'AIzaSyB_O2s3Z5hJ_X8gCbjQSLZ8IfuygNwshBk',
    'AIzaSyAoA6-FpWFCF_vpPREQjxcJ6A7suZlYM-w'
];
let currentApiKeyIndex = 0;
const colorThief = new ColorThief();

// --- DOM ELEMENT REFERENCES ---
const body = document.body;
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
const closeSidebarMobileBtn = document.getElementById('close-sidebar-mobile'); // MODIFIED: Added new button reference
const overlay = document.getElementById('overlay');


// --- LOCAL STATE ---
let savedVideos = [];
let followedChannels = {};

// --- HELPER FUNCTIONS ---
const getYouTubeVideoId = (url) => url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})/)?. [1] || null;
const getVimeoVideoId = (url) => url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/)?.[1] || null;

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


// ==================================================================
// --- LOCAL STORAGE & STATE MANAGEMENT ---
// ==================================================================
function loadStateFromStorage() {
    const storedVideos = localStorage.getItem('universalVideoManager');
    savedVideos = storedVideos ? JSON.parse(storedVideos) : [];
    const storedChannels = localStorage.getItem('followedChannels');
    followedChannels = storedChannels ? JSON.parse(storedChannels) : {};
}
function saveVideosToStorage() { localStorage.setItem('universalVideoManager', JSON.stringify(savedVideos)); }
function saveChannelsToStorage() { localStorage.setItem('followedChannels', JSON.stringify(followedChannels)); }


// ==================================================================
// --- API CALLS ---
// ==================================================================
async function fetchWithKeyRotation(url) {
    let attempts = 0;
    while (attempts < API_KEYS.length) {
        const apiKey = API_KEYS[currentApiKeyIndex];
        const fullUrl = `${url}&key=${apiKey}`;
        try {
            const res = await fetch(fullUrl);
            const data = await res.json();
            if (data.error) throw new Error(data.error.errors[0].reason);
            return data;
        } catch (error) {
            console.error(`API Error (${error.message}) with key index ${currentApiKeyIndex}. Trying next key...`);
            currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
            attempts++;
            if (attempts >= API_KEYS.length) {
                throw new Error("All API keys have failed. Please check your keys and quota.");
            }
        }
    }
}


// ==================================================================
// --- MODAL VIDEO PLAYER LOGIC ---
// ==================================================================
function playVideoInModal(youtubeId) {
    if (!youtubeId) return;
    const origin = window.location.origin;
    videoFrame.src = `https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${origin}&autoplay=1`;
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
        } catch (e) {
            console.error("ColorThief error:", e);
            ambientBg.style.backgroundColor = 'rgba(100,100,100,0.5)';
        }
    };
}
async function updateVideoInfoInModal(videoId) {
    modalVideoInfo.classList.remove('visible');
    ytTitle.textContent = 'Loading...';
    ytChannel.textContent = ''; ytViews.textContent = ''; ytDate.textContent = '';
    try {
        const data = await fetchWithKeyRotation(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}`);
        if (data.items && data.items.length > 0) {
            const video = data.items[0];
            const views = parseInt(video.statistics.viewCount).toLocaleString();
            const date = new Date(video.snippet.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            ytTitle.textContent = video.snippet.title;
            ytChannel.textContent = video.snippet.channelTitle;
            ytViews.textContent = `${views} views`;
            ytDate.textContent = `Published on ${date}`;
            modalVideoInfo.classList.add('visible');
        }
    } catch (e) {
        console.error("Error fetching video info:", e);
        ytTitle.textContent = 'Could not load video details.';
        modalVideoInfo.classList.add('visible');
    }
}


// ==================================================================
// --- SAVED VIDEOS GRID LOGIC ---
// ==================================================================
function renderSavedVideos(sortKey = 'date-added-desc') {
    sortSavedVideos(sortKey);
    savedVideoList.innerHTML = '';
    if (savedVideos.length === 0) {
        savedVideoList.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">No videos saved yet. Use the panel on the right to add some!</p>';
        return;
    }
    savedVideos.forEach((video, index) => {
        const youtubeId = getYouTubeVideoId(video.url);
        const vimeoId = getVimeoVideoId(video.url);
        let platformBadge = '', thumbnailUrl = '', title = video.url;

        if (youtubeId) {
            platformBadge = `<span class="platform-badge platform-youtube">YouTube</span>`;
            thumbnailUrl = `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
            title = video.title || `YouTube Video ${youtubeId}`;
        } else if (vimeoId) {
            platformBadge = `<span class="platform-badge platform-vimeo">Vimeo</span>`;
            thumbnailUrl = `https://vumbnail.com/${vimeoId}.jpg`;
            title = video.title || `Vimeo Video ${vimeoId}`;
        } else {
            return;
        }

        const item = document.createElement('div');
        item.className = 'video-item';
        item.innerHTML = `
            <div class="thumbnail-container">
                <img class="video-item-thumbnail" src="${thumbnailUrl}" alt="${title}" data-youtube-id="${youtubeId || ''}">
            </div>
            <div class="video-item-info">
                <p class="video-item-title">${title}</p>
                <div class="video-item-footer">
                    ${platformBadge}
                    <button class="delete-btn material-icons" data-id="${video.id}" title="Delete Video">delete</button>
                </div>
            </div>
        `;
        item.style.animationDelay = `${index * 50}ms`;
        savedVideoList.appendChild(item);
        setTimeout(() => {
            item.classList.add('reveal');
        }, 50);
    });
}

function sortSavedVideos(key) {
    switch (key) {
        case 'date-added-asc':
            savedVideos.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
            break;
        case 'title-asc':
            savedVideos.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            savedVideos.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'date-added-desc':
        default:
            savedVideos.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
            break;
    }
}

async function saveVideo(url, title = null, showNotification = true) {
    if (savedVideos.some(v => v.url === url)) {
        if (showNotification) alert("This video is already saved.");
        return;
    }
    let videoTitle = title;
    if (!videoTitle && getYouTubeVideoId(url)) {
        try {
            const videoId = getYouTubeVideoId(url);
            const data = await fetchWithKeyRotation(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`);
            if (data.items.length > 0) videoTitle = data.items[0].snippet.title;
        } catch (e) { console.error("Could not fetch video title", e); }
    }
    const newVideo = { id: crypto.randomUUID(), url, title: videoTitle || url, dateAdded: Date.now() };
    savedVideos.unshift(newVideo);
    saveVideosToStorage();
    renderSavedVideos(sortSavedVideosSelect.value);
}

function deleteVideo(id) {
    savedVideos = savedVideos.filter(video => video.id !== id);
    saveVideosToStorage();
    renderSavedVideos(sortSavedVideosSelect.value);
}


// ==================================================================
// --- ACTION PANEL LOGIC (SEARCH, EMBED) ---
// ==================================================================
async function searchYouTube(query, type, resultsContainer) {
    resultsContainer.innerHTML = '<div class="loader"></div>';
    try {
        const data = await fetchWithKeyRotation(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=${type}&maxResults=20&q=${encodeURIComponent(query)}`);
        resultsContainer.innerHTML = '';
        if (data.items.length === 0) {
            resultsContainer.innerHTML = '<p>No results found.</p>';
            return;
        }
        if (type === 'video') renderVideoSearchResults(data.items, resultsContainer);
        if (type === 'channel') renderChannelSearchResults(data.items, resultsContainer);
    } catch (error) {
        resultsContainer.innerHTML = `<p style="color: var(--red-color);">Error: ${error.message}</p>`;
    }
}

function renderVideoSearchResults(items, container) {
    items.forEach(item => {
        const videoUrl = `https://www.youtube.com/watch?v=${item.id.videoId}`;
        const card = document.createElement('div');
        card.className = 'video-result-card';
        card.innerHTML = `
            <img src="${item.snippet.thumbnails.medium.url}" alt="${item.snippet.title}">
            <div class="result-info">
                <div class="result-title">${item.snippet.title}</div>
                <div class="result-creator">${item.snippet.channelTitle}</div>
                <div class="result-time">${timeAgo(new Date(item.snippet.publishedAt))}</div>
            </div>
        `;
        card.onclick = () => saveVideo(videoUrl, item.snippet.title);
        container.appendChild(card);
    });
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
            <button class="follow-btn ${isFollowing ? 'unfollow' : ''}">${isFollowing ? 'Unfollow' : 'Follow'}</button>
        `;

        card.querySelector('.follow-btn').onclick = (e) => {
            e.stopPropagation();
            if (isFollowing) {
                removeYoutubeChannel(internalName);
            } else {
                addYoutubeChannel(internalName, title, channelId, thumbnails.medium.url);
            }
            searchYouTube(document.getElementById('channel-search-input').value, 'channel', document.getElementById('channel-search-results'));
        };
        container.appendChild(card);
    });
}


// ==================================================================
// --- SIDEBAR LOGIC (FOLLOWING) ---
// ==================================================================
function renderFollowedChannels() {
    channelsList.innerHTML = '';
    Object.entries(followedChannels).forEach(([internalName, channelData]) => {
        const channelDiv = document.createElement('div');
        channelDiv.className = 'channel';
        channelDiv.dataset.channel = internalName;
        channelDiv.innerHTML = `
            <div class="channel-info" data-name="${internalName}">
                <span class="expandChannel material-icons">expand_more</span>
                <img src="${channelData.thumbnailUrl}" alt="${channelData.displayName}">
                <span class="creator">${channelData.displayName}</span>
                <span class="notification-dot" id="notif-${internalName}" style="display: none;"></span>
            </div>
            <div class="video-dropdown" id="dropdown-${internalName}">
                <div class="dropdown-controls">
                     <select class="sort-dropdown styled-select" data-channel-name="${internalName}">
                        <option value="newest">Newest</option>
                        <option value="views">Most Views</option>
                        <option value="shortest">Shortest</option>
                        <option value="longest">Longest</option>
                    </select>
                </div>
            </div>
        `;
        channelsList.appendChild(channelDiv);
    });
}

function addYoutubeChannel(internalName, displayName, channelId, thumbnailUrl) {
    followedChannels[internalName] = { id: channelId, displayName, thumbnailUrl };
    saveChannelsToStorage();
    renderFollowedChannels();
}

function removeYoutubeChannel(internalName) {
    delete followedChannels[internalName];
    saveChannelsToStorage();
    renderFollowedChannels();
}

async function checkAllChannels() {
    checkVideosBtn.classList.add('loading');
    const promises = Object.entries(followedChannels).map(async ([name, data]) => {
        const channelDiv = document.querySelector(`.channel[data-channel="${name}"]`);
        try {
            const videos = await getLatestVideosWithDetails(data.id, name);
            if (videos && videos.length > 0) {
                const sortedVideos = videos.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
                updateChannelDropdown(name, sortedVideos, true);
                const newestVideo = sortedVideos[sortedVideos.length - 1];
                localStorage.setItem(`lastWatched-${name}`, newestVideo.publishedAt);
            }
            if (channelDiv) {
                channelDiv.classList.add("highlight-green");
                channelDiv.addEventListener("animationend", () => channelDiv.classList.remove("highlight-green"), { once: true });
            }
        } catch (err) { console.error(`Error checking ${name}:`, err); }
    });
    await Promise.all(promises);
    checkVideosBtn.classList.remove('loading');
}

async function getLatestVideosWithDetails(channelId, channelName) {
    const lastWatchedDateStr = localStorage.getItem(`lastWatched-${channelName}`);
    const lastWatchedDate = lastWatchedDateStr ? new Date(lastWatchedDateStr) : null;
    
    const searchData = await fetchWithKeyRotation(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video`);
    const newVideos = searchData.items.filter(item => !lastWatchedDate || new Date(item.snippet.publishedAt) > lastWatchedDate);

    if (newVideos.length === 0) return [];
    
    const videoIds = newVideos.map(v => v.id.videoId).join(',');
    const detailsData = await fetchWithKeyRotation(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}`);
    
    return detailsData.items.map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium.url,
        publishedAt: item.snippet.publishedAt,
        viewCount: parseInt(item.statistics.viewCount),
        duration: parseYTDuration(item.contentDetails.duration)
    }));
}

function updateChannelDropdown(channelName, videos, append = false) {
    const container = document.getElementById(`dropdown-${channelName}`);
    const notification = document.getElementById(`notif-${channelName}`);
    if (!container || !notification) return;

    const storageKey = `videos-${channelName}`;
    let storedVideos = append ? (JSON.parse(localStorage.getItem(storageKey)) || []) : [];
    
    videos.forEach(video => {
        if (!storedVideos.some(v => v.id === video.id)) storedVideos.push(video);
    });
    localStorage.setItem(storageKey, JSON.stringify(storedVideos));

    const sortKey = container.querySelector('.sort-dropdown')?.value || 'newest';
    sortDropdownVideos(storedVideos, sortKey);

    const videoElements = container.querySelectorAll('.dropdown-video');
    videoElements.forEach(el => el.remove());

    storedVideos.forEach(video => {
        const isSaved = savedVideos.some(sv => getYouTubeVideoId(sv.url) === video.id);
        const videoHTML = `
            <div class="dropdown-video" data-video-id="${video.id}" data-channel-name="${channelName}" data-title="${video.title}"
                 data-views="${video.viewCount}" data-duration="${video.duration}" data-published="${video.publishedAt}">
                <img class="dropdown-thumbnail" src="${video.thumbnail}" alt="${video.title}">
                <div class="dropdown-info">
                    <div class="dropdown-title">${video.title}</div>
                    <div class="dropdown-meta">
                        <span>${formatViews(video.viewCount)} views</span>
                        <span>•</span>
                        <span>${timeAgo(new Date(video.publishedAt))}</span>
                    </div>
                </div>
                <div class="dropdown-actions">
                   <span class="material-icons save-video-btn ${isSaved ? 'saved' : ''}" title="Save to main list">
                        ${isSaved ? 'bookmark_added' : 'bookmark_add'}
                   </span>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', videoHTML);
    });

    notification.style.display = storedVideos.length > 0 ? 'block' : 'none';
}

function restoreDropdownVideosFromStorage() {
    Object.keys(followedChannels).forEach(channelName => {
        const storedVideos = JSON.parse(localStorage.getItem(`videos-${channelName}`)) || [];
        if (storedVideos.length > 0) {
            updateChannelDropdown(channelName, storedVideos);
        }
    });
}

function sortDropdownVideos(videos, key) {
    switch (key) {
        case 'views':
            videos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
            break;
        case 'shortest':
            videos.sort((a, b) => (a.duration || 0) - (b.duration || 0));
            break;
        case 'longest':
            videos.sort((a, b) => (b.duration || 0) - (a.duration || 0));
            break;
        case 'newest':
        default:
            videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            break;
    }
}

function handleDropdownVideoClick(videoElement) {
    const videoId = videoElement.dataset.videoId;
    const channelName = videoElement.dataset.channelName;
    playVideoInModal(videoId);

    const storageKey = `videos-${channelName}`;
    let storedVideos = JSON.parse(localStorage.getItem(storageKey)) || [];
    storedVideos = storedVideos.filter(v => v.id !== videoId);
    localStorage.setItem(storageKey, JSON.stringify(storedVideos));

    videoElement.remove();

    if(storedVideos.length === 0){
        const notification = document.getElementById(`notif-${channelName}`);
        if(notification) notification.style.display = 'none';
    }
}

// ==================================================================
// --- EVENT LISTENERS & INITIALIZATION ---
// ==================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    renderSavedVideos();
    renderFollowedChannels();
    restoreDropdownVideosFromStorage();
});

// --- Modal ---
closeModalBtn.addEventListener('click', closePlayer);
videoModal.addEventListener('click', (e) => e.target === videoModal && closePlayer());

// --- Main Content ---
sortSavedVideosSelect.addEventListener('change', (e) => renderSavedVideos(e.target.value));
savedVideoList.addEventListener('click', (e) => {
    const target = e.target;
    if (target.matches('.delete-btn')) {
        const id = target.dataset.id;
        if (confirm('Are you sure you want to delete this video?')) {
            deleteVideo(id);
        }
    } else if (target.matches('.video-item-thumbnail')) {
        const youtubeId = target.dataset.youtubeId;
        if (youtubeId) {
            playVideoInModal(youtubeId);
        } else {
            alert("Playing non-YouTube videos in the modal is not yet supported.");
        }
    }
});

// --- Sidebar ---
expandSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    body.classList.toggle('sidebar-collapsed');
    expandSidebarBtn.textContent = sidebar.classList.contains('collapsed') ? 'chevron_right' : 'chevron_left';
});
checkVideosBtn.addEventListener('click', checkAllChannels);
channelsList.addEventListener('click', (e) => {
    const channelInfo = e.target.closest('.channel-info');
    const dropdownVideo = e.target.closest('.dropdown-video');
    const saveBtn = e.target.closest('.save-video-btn');
    const sortSelect = e.target.closest('.sort-dropdown');

    if (channelInfo) {
        channelInfo.parentElement.classList.toggle('dropdown-open');
    }
    if (saveBtn && !saveBtn.classList.contains('saved')) {
        e.stopPropagation();
        const videoEl = saveBtn.closest('.dropdown-video');
        const videoId = videoEl.dataset.videoId;
        const videoTitle = videoEl.dataset.title;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        saveVideo(url, videoTitle, false);
        saveBtn.textContent = 'bookmark_added';
        saveBtn.classList.add('saved');
    }
    else if (sortSelect) {
         const channelName = sortSelect.dataset.channelName;
         const storedVideos = JSON.parse(localStorage.getItem(`videos-${channelName}`)) || [];
         updateChannelDropdown(channelName, storedVideos);
    }
    else if (dropdownVideo) {
        handleDropdownVideoClick(dropdownVideo);
    }
});


// --- Action Panel ---
actionTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        actionTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});
document.getElementById('embed-button').addEventListener('click', () => {
    const input = document.getElementById('embed-url-input');
    const url = input.value.trim();
    if(getYouTubeVideoId(url) || getVimeoVideoId(url)){
        saveVideo(url);
        input.value = '';
    } else {
        alert("Please enter a valid YouTube or Vimeo URL.");
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
document.getElementById('embed-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('embed-button').click(); });
document.getElementById('video-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('video-search-button').click(); });
document.getElementById('channel-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('channel-search-button').click(); });

// --- Mobile Panel Toggles ---
const togglePanel = (panel, isOpen) => {
    const isSidebar = panel.id === 'sidebar';
    if(isOpen) {
        panel.classList.add('mobile-open');
        overlay.classList.add('visible');
        if (isSidebar) {
             toggleActionsMobileBtn.style.visibility = 'hidden';
        } else {
             toggleSidebarMobileBtn.style.visibility = 'hidden';
        }
    } else {
        panel.classList.remove('mobile-open');
        overlay.classList.remove('visible');
        toggleActionsMobileBtn.style.visibility = 'visible';
        toggleSidebarMobileBtn.style.visibility = 'visible';
    }
};

toggleSidebarMobileBtn.addEventListener('click', () => togglePanel(sidebar, true));
toggleActionsMobileBtn.addEventListener('click', () => togglePanel(actionPanel, true));
closeActionsMobileBtn.addEventListener('click', () => togglePanel(actionPanel, false));
closeSidebarMobileBtn.addEventListener('click', () => togglePanel(sidebar, false)); // MODIFIED: Added event listener
overlay.addEventListener('click', () => {
    togglePanel(sidebar, false);
    togglePanel(actionPanel, false);
});