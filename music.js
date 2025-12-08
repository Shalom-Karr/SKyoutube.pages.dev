import { fetchFromProxy } from './api.js';

// --- API & DOM REFERENCES ---
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const mainContent = document.getElementById('main-content');

// --- RENDERING ---
function renderMusicGrid(items) {
    mainContent.innerHTML = ''; // Clear previous results
    if (!items || items.length === 0) {
        mainContent.innerHTML = '<p>No music found.</p>';
        return;
    }

    items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const artist = item.snippet.channelTitle;
        const thumbnail = item.snippet.thumbnails.medium.url;

        const card = document.createElement('div');
        card.className = 'music-card';
        card.innerHTML = `
            <img src="${thumbnail}" alt="${title}">
            <div class="music-card-info">
                <div class="music-card-title">${title}</div>
                <div class="music-card-artist">${artist}</div>
            </div>
        `;
        // In a full app, this would open a player
        card.addEventListener('click', () => {
            window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        });
        mainContent.appendChild(card);
    });
}

// --- EVENT LISTENERS & INITIALIZATION ---
async function searchMusic(query) {
    const searchParams = `part=snippet&type=video&maxResults=20&q=${query}`;
    try {
        const data = await fetchFromProxy('search', searchParams);
        if (data && data.items) {
            renderMusicGrid(data.items);
        }
    } catch (error) {
        mainContent.innerHTML = `<p style="color:red;">Error loading music. Please try again later.</p>`;
    }
}

searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
        searchMusic(query);
    }
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        searchButton.click();
    }
});

// Load initial popular music
document.addEventListener('DOMContentLoaded', () => {
    searchMusic('Popular music');
});
