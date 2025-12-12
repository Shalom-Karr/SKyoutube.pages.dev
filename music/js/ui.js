
import { setTrackIndex, loadVideo, getCurrentTrack } from './player.js';

let dom = {};

export function cacheDOM() {
    dom.docElement = document.documentElement;
    dom.navItems = document.querySelectorAll('.nav-item');
    dom.pages = document.querySelectorAll('.page');
    dom.pageTitle = document.getElementById('pageTitle');
    dom.playBtn = document.getElementById('playBtn');
    dom.miniPlayBtn = document.getElementById('miniPlayBtn');
    dom.miniPlayer = document.getElementById('miniPlayer');
    dom.playerSheet = document.getElementById('playerSheet');
    dom.playerBackground = document.getElementById('playerBackground');
    dom.miniTitle = document.getElementById('miniTitle');
    dom.miniArtist = document.getElementById('miniArtist');
    dom.miniThumb = document.getElementById('miniThumb');
    dom.trackTitle = document.getElementById('trackTitle');
    dom.trackArtist = document.getElementById('trackArtist');
    dom.artwork = document.getElementById('artwork');
    dom.upNextList = document.getElementById('upNextList');
    dom.artistsContent = document.getElementById('artistsContent');
    dom.searchContent = document.getElementById('searchContent');
    dom.homeContent = document.getElementById('homeContent');
    dom.libraryContent = document.getElementById('libraryContent');
    dom.searchInput = document.getElementById('searchInput');
    dom.searchButton = document.getElementById('searchButton');
    dom.shuffleBtn = document.getElementById('shuffleBtn');
    dom.repeatBtn = document.getElementById('repeatBtn');
    dom.settingsBtn = document.getElementById('settingsBtn');
    dom.settingsPanel = document.getElementById('settingsPanel');
    dom.spinToggle = document.getElementById('spinToggle');
    dom.sidebarPlayer = document.getElementById('sidebarPlayer');
    dom.sidebarPlayerThumb = document.getElementById('sidebarPlayerThumb');
    dom.sidebarPlayerTitle = document.getElementById('sidebarPlayerTitle');
}

export function switchTab(tabIndex, state, renderCallbacks) {
    if (tabIndex === state.currentPage) return;
    state.currentPage = tabIndex;

    dom.pages.forEach((page, index) => {
        page.classList.toggle('active', index === tabIndex);
    });

    dom.navItems.forEach((item) => {
        item.classList.toggle('active', parseInt(item.dataset.page) === tabIndex);
    });

    const pageTitles = ["Home", "Artists", "Search", "Library"];
    dom.pageTitle.textContent = pageTitles[tabIndex] || "SK Music";

    document.getElementById('searchContainer').style.display = (tabIndex === 2) ? 'flex' : 'none';

    if (tabIndex === 0) renderCallbacks.renderHomePage();
    if (tabIndex === 1) renderCallbacks.renderArtists();
    if (tabIndex === 3) renderCallbacks.renderLibraryPage();
}

export function updatePlayButtonState(isPlaying, albumArtSpin) {
    const playIcon = isPlaying
        ? '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    if (dom.playBtn) dom.playBtn.innerHTML = playIcon;
    if (dom.miniPlayBtn) dom.miniPlayBtn.innerHTML = playIcon;

    if (dom.artwork) {
        dom.artwork.classList.toggle('spinning', isPlaying && albumArtSpin);
    }
}

export function updatePlayerUI(track, activeQueue, trackIndex) {
    const thumbnailUrl = track.thumbnail || '';

    dom.miniPlayer.style.display = 'flex';
    dom.miniTitle.textContent = track.title;
    dom.miniArtist.textContent = track.artist;
    dom.miniThumb.innerHTML = `<img src="${thumbnailUrl}" alt="${track.title}">`;

    dom.trackTitle.textContent = track.title;
    dom.trackArtist.textContent = track.artist;
    dom.artwork.innerHTML = `<img src="${thumbnailUrl}" alt="${track.title}">`;
    dom.playerBackground.style.backgroundImage = `url(${thumbnailUrl})`;

    // Update sidebar player
    dom.sidebarPlayer.style.display = 'flex';
    dom.sidebarPlayerThumb.innerHTML = `<img src="${thumbnailUrl}" alt="${track.title}">`;
    dom.sidebarPlayerTitle.textContent = track.title;

    renderUpNext(activeQueue, trackIndex);
    updateNowPlayingIndicator(track.videoId);
}

export function openFullPlayer() {
    dom.playerSheet.classList.add('open');
}

export function closeFullPlayer() {
    dom.playerSheet.classList.remove('open');
}

function renderUpNext(activeQueue, trackIndex) {
    dom.upNextList.innerHTML = '';
    const nextTracks = activeQueue.slice(trackIndex + 1);

    if (nextTracks.length === 0) {
        dom.upNextList.innerHTML = '<div class="empty-queue">Queue is empty</div>';
        return;
    }

    nextTracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'up-next-item';
        item.innerHTML = `
            <div class="up-next-thumb"><img src="${track.thumbnail}" alt="${track.title}"></div>
            <div class="up-next-info">
                <div class="list-title">${track.title}</div>
                <div class="list-sub">${track.artist}</div>
            </div>
        `;
        item.addEventListener('click', () => {
            const newIndex = trackIndex + 1 + index;
            setTrackIndex(newIndex);
            loadVideo(activeQueue[newIndex], true);
        });
        dom.upNextList.appendChild(item);
    });
}

export function renderHomePage(recentlyPlayed, onTrackClick) {
    if (!dom.homeContent) return;
    dom.homeContent.innerHTML = '<h2>Recently Played</h2>';
    if (recentlyPlayed.length > 0) {
        const grid = document.createElement('div');
        grid.className = 'artists-grid';
        recentlyPlayed.forEach(track => {
            const card = createTrackCard(track, recentlyPlayed, onTrackClick);
            grid.appendChild(card);
        });
        dom.homeContent.appendChild(grid);
    } else {
        dom.homeContent.innerHTML += '<p>No recent activity.</p>';
    }
}

export function renderArtists(artistWhitelist, onArtistClick) {
    if (!dom.artistsContent) return;
    dom.artistsContent.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'artists-grid';
    artistWhitelist.forEach(artist => {
        const artistCard = document.createElement('div');
        artistCard.className = 'artist-card';
        // Ensure artist.name exists before trying to access its properties.
        const artistName = artist.name || 'Unnamed Artist';
        const artistAvatar = artist.avatar ?
            `<img src="${artist.avatar}" alt="${artistName}">` :
            `<div class="artist-avatar-placeholder">${artistName.charAt(0)}</div>`;

        artistCard.innerHTML = `
            <div class="artist-avatar">
                ${artistAvatar}
            </div>
            <div class="artist-name">${artistName}</div>
        `;
        artistCard.addEventListener('click', () => onArtistClick(artist));
        grid.appendChild(artistCard);
    });
    dom.artistsContent.appendChild(grid);
}

export function renderArtistPage(artist, albums, songs, onTrackClick, onAlbumClick, favorites, onFavoriteClick) {
    dom.pageTitle.textContent = artist.name;
    dom.artistsContent.innerHTML = ''; // Clear artist grid

    if (albums.length > 0) {
        const albumsGrid = document.createElement('div');
        albumsGrid.className = 'artists-grid';
        albums.forEach(album => {
            const card = createAlbumCard(album, onAlbumClick);
            albumsGrid.appendChild(card);
        });
        dom.artistsContent.appendChild(albumsGrid);
    }

    if (songs.length > 0) {
        const songsList = document.createElement('div');
        songsList.className = 'song-list';
        songs.forEach((song, index) => {
            const isFavorite = favorites.some(f => f.videoId === song.videoId);
            const item = createTrackListItem(song, songs, index, onTrackClick, onFavoriteClick, isFavorite);
            songsList.appendChild(item);
        });
        dom.artistsContent.appendChild(songsList);
    }
}

function createAlbumCard(album, onAlbumClick) {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.innerHTML = `
        <div class="artist-avatar">
            <img src="${album.thumbnail}" alt="${album.title}">
        </div>
        <div class="artist-name">${album.title}</div>
    `;
    card.addEventListener('click', () => onAlbumClick(album));
    return card;
}

export function renderSearchResults(results, onTrackClick, favorites, onFavoriteClick) {
    dom.searchContent.innerHTML = '';
    if (results.length === 0) {
        dom.searchContent.innerHTML = '<p>No results found.</p>';
        return;
    }
    const list = document.createElement('div');
    list.className = 'song-list';
    results.forEach((song, index) => {
        const isFavorite = favorites.some(f => f.videoId === song.videoId);
        const item = createTrackListItem(song, results, index, onTrackClick, onFavoriteClick, isFavorite);
        list.appendChild(item);
    });
    dom.searchContent.appendChild(list);
}

export function renderLibraryPage(playlists, favorites, saveQueueCallback, onTrackClick, onFavoriteClick) {
    if (!dom.libraryContent) return;
    dom.libraryContent.innerHTML = `
        <div class="library-actions">
            <button id="saveQueueBtn" class="btn">Save Queue as Playlist</button>
        </div>
        <div id="playlistsContainer"></div>
        <div id="favoritesContainer"></div>
    `;

    document.getElementById('saveQueueBtn').addEventListener('click', saveQueueCallback);

    const playlistsContainer = document.getElementById('playlistsContainer');
    const favoritesContainer = document.getElementById('favoritesContainer');

    if (playlists.length > 0) {
        playlistsContainer.innerHTML = '<h2>Playlists</h2>';
        const list = document.createElement('div');
        list.className = 'song-list';
        playlists.forEach(p => {
            const item = createPlaylistListItem(p, onTrackClick);
            list.appendChild(item);
        });
        playlistsContainer.appendChild(list);
    }

    if (favorites.length > 0) {
        favoritesContainer.innerHTML = '<h2>Favorites</h2>';
        const list = document.createElement('div');
        list.className = 'song-list';
        favorites.forEach((track, index) => {
            const item = createTrackListItem(track, favorites, index, onTrackClick, onFavoriteClick, true);
            list.appendChild(item);
        });
        favoritesContainer.appendChild(list);
    }
}

function createPlaylistListItem(playlist, onTrackClick) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
        <div class="list-info">
            <div class="list-title">${playlist.name}</div>
            <div class="list-sub">${playlist.tracks.length} songs</div>
        </div>
    `;
    item.addEventListener('click', () => onTrackClick(playlist.tracks, 0));
    return item;
}

function createTrackCard(track, queue, onTrackClick) {
    const card = document.createElement('div');
    card.className = 'artist-card';
    card.dataset.videoId = track.videoId; // Add videoId for tracking
    card.innerHTML = `
        <div class="artist-avatar">
            <img src="${track.thumbnail}" alt="${track.title}">
        </div>
        <div class="artist-name">${track.title}</div>
        <div class="artist-subtitle">${track.artist}</div>
    `;
    card.addEventListener('click', () => onTrackClick(queue, queue.findIndex(t => t.videoId === track.videoId)));
    return card;
}

function createTrackListItem(track, queue, index, onTrackClick, onFavoriteClick, isFavorite = false) {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.dataset.videoId = track.videoId;

    const favoriteIcon = isFavorite ? '&#10005;' : '&#9829;';

    item.innerHTML = `
        <div class="list-thumb"><img src="${track.thumbnail}" alt="${track.title}"></div>
        <div class="list-info">
            <div class="list-title">${track.title}</div>
            <div class="list-sub">${track.artist}</div>
        </div>
        <button class="icon-btn favorite-btn">${favoriteIcon}</button>
    `;

    item.querySelector('.list-info').addEventListener('click', () => onTrackClick(queue, index));
    item.querySelector('.favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        onFavoriteClick(track);
    });

    return item;
}

export function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

export function setLoading(container, isLoading) {
    if (isLoading) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    } else {
        const spinner = container.querySelector('.loading');
        if (spinner) spinner.remove();
    }
}

export function updateNowPlayingIndicator(videoId) {
    document.querySelectorAll('[data-video-id]').forEach(el => {
        el.classList.remove('now-playing');
    });
    document.querySelectorAll(`[data-video-id="${videoId}"]`).forEach(el => {
        el.classList.add('now-playing');
    });
}

export function renderError(container, message) {
    container.innerHTML = `<div class="error-message">${message}</div>`;
}

export function renderAlbumTracklist(album, tracks, onTrackClick, favorites, onFavoriteClick) {
    dom.pageTitle.textContent = album.title;
    dom.artistsContent.innerHTML = ''; // Clear the current view

    const songsList = document.createElement('div');
    songsList.className = 'song-list';
    tracks.forEach((song, index) => {
        const isFavorite = favorites.some(f => f.videoId === song.videoId);
        const item = createTrackListItem(song, tracks, index, onTrackClick, onFavoriteClick, isFavorite);
        songsList.appendChild(item);
    });
    dom.artistsContent.appendChild(songsList);
}
