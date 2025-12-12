
import { fetchArtistWhitelist, fetchFromProxy, parseYoutubeItem, fetchArtistAlbums, fetchPlaylistItems } from './api.js';
import * as Player from './player.js';
import * as UI from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("SK Music player is loading...");

    const state = {
        currentPage: 0,
        artistWhitelist: [],
        recentlyPlayed: JSON.parse(localStorage.getItem('recentlyPlayed')) || [],
        favorites: JSON.parse(localStorage.getItem('favorites')) || [],
        playlists: JSON.parse(localStorage.getItem('playlists')) || [],
        theme: localStorage.getItem('theme') || 'dark',
        settings: {
            albumArtSpin: true,
        }
    };

    let progressInterval = null;

    UI.cacheDOM();

    function onTrackClick(queue, index) {
        Player.setQueue(queue, index);
    }

    function onPlayerStateChange(event) {
        const isPlaying = event.data === YT.PlayerState.PLAYING;
        UI.updatePlayButtonState(isPlaying, state.settings.albumArtSpin);

        if (isPlaying) {
            startProgressUpdates();
            const playerState = Player.getPlayerState();
            UI.updatePlayerUI(Player.getCurrentTrack(), Player.getActiveQueue(), playerState.trackIndex);
            addRecentlyPlayed(Player.getCurrentTrack());
        } else {
            stopProgressUpdates();
        }

        if (event.data === YT.PlayerState.ENDED) {
            Player.playNext(true);
        }
    }

    function startProgressUpdates() {
        stopProgressUpdates();
        progressInterval = setInterval(() => {
            const player = Player.getPlayer();
            if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
                const currentTime = player.getCurrentTime();
                const duration = player.getDuration();
                const progress = (currentTime / duration) * 100;

                const sliderFill = document.getElementById('sliderFill');
                const currentTimeEl = document.getElementById('currentTime');
                const totalTimeEl = document.getElementById('totalTime');

                if (sliderFill) sliderFill.style.width = `${progress}%`;
                if (currentTimeEl) currentTimeEl.textContent = formatTime(currentTime);
                if (totalTimeEl) totalTimeEl.textContent = formatTime(duration);
            }
        }, 1000);
    }

    function stopProgressUpdates() {
        clearInterval(progressInterval);
    }

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${min}:${sec}`;
    }

    function addRecentlyPlayed(track) {
        if (!track) return;
        state.recentlyPlayed = [track, ...state.recentlyPlayed.filter(t => t.videoId !== track.videoId)].slice(0, 20);
        localStorage.setItem('recentlyPlayed', JSON.stringify(state.recentlyPlayed));
    }

    function toggleFavorite(track) {
        if (!track) return;
        const isFavorite = state.favorites.some(t => t.videoId === track.videoId);
        if (isFavorite) {
            state.favorites = state.favorites.filter(t => t.videoId !== track.videoId);
        } else {
            state.favorites = [track, ...state.favorites];
        }
        localStorage.setItem('favorites', JSON.stringify(state.favorites));
        renderLibraryPage();
    }

    function saveQueueAsPlaylist() {
        const playlistName = prompt("Enter playlist name:");
        if (playlistName && playlistName.trim() !== '') {
            const newPlaylist = {
                name: playlistName,
                tracks: [...Player.getActiveQueue()]
            };
            state.playlists.push(newPlaylist);
            localStorage.setItem('playlists', JSON.stringify(state.playlists));
            renderLibraryPage();
        }
    }

    async function fetchArtistDetails(artist) {
        const artistsContent = document.getElementById('artistsContent');
        UI.setLoading(artistsContent, true);
        try {
            const [songsData, albumsData] = await Promise.all([
                fetchFromProxy('search', `part=snippet&type=video&maxResults=50&channelId=${artist.channel_id}`),
                fetchArtistAlbums(artist.channel_id)
            ]);

            const songs = songsData.items.map(parseYoutubeItem).filter(Boolean);
            UI.renderArtistPage(artist, albumsData, songs, onTrackClick, onAlbumClick);
        } catch (error) {
            console.error('Error fetching artist details:', error);
            UI.renderArtistPage(artist, [], [], onTrackClick, onAlbumClick);
        }
    }

    async function onAlbumClick(album) {
        const artistsContent = document.getElementById('artistsContent');
        UI.setLoading(artistsContent, true);
        try {
            const songs = await fetchPlaylistItems(album.id);
            Player.setQueue(songs, 0);
        } catch (error) {
            console.error('Error fetching album tracks:', error);
        }
    }

    async function shuffleAll() {
        UI.setLoading(document.getElementById('homeContent'), true);
        let allSongs = [];
        try {
            for (const artist of state.artistWhitelist) {
                const data = await fetchFromProxy('search', `part=snippet&type=video&maxResults=5&channelId=${artist.channel_id}`);
                const songs = data.items.map(item => ({
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    artist: item.snippet.channelTitle,
                    thumbnail: item.snippet.thumbnails.high.url,
                }));
                allSongs.push(...songs);
            }

            for (let i = allSongs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allSongs[i], allSongs[j]] = [allSongs[j], allSongs[i]];
            }

            if (allSongs.length > 0) {
                Player.setQueue(allSongs, 0);
            }
        } catch (error) {
            console.error('Error during Shuffle All:', error);
        } finally {
            UI.setLoading(document.getElementById('homeContent'), false);
            renderHomePage();
        }
    }

    async function searchMusic() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        const searchContent = document.getElementById('searchContent');
        UI.setLoading(searchContent, true);
        try {
            const data = await fetchFromProxy('search', `part=snippet&type=video&maxResults=50&q=${query}`);
            const whitelistedIds = new Set(state.artistWhitelist.map(a => a.channel_id));
            const results = data.items
                .filter(item => whitelistedIds.has(item.snippet.channelId))
                .map(parseYoutubeItem)
                .filter(Boolean); // Filter out any null results from parsing
            UI.renderSearchResults(results, onTrackClick);
        } catch (error) {
            console.error('Search Error:', error);
            UI.renderSearchResults([], onTrackClick);
        }
    }

    function renderHomePage() {
        UI.renderHomePage(state.recentlyPlayed, onTrackClick);
    }

    function renderArtists() {
        UI.renderArtists(state.artistWhitelist, fetchArtistDetails);
    }

    function renderLibraryPage() {
        UI.renderLibraryPage(state.playlists, state.favorites, saveQueueAsPlaylist, onTrackClick);
    }

    function bindEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => UI.switchTab(parseInt(item.dataset.page), state, {
                renderHomePage,
                renderArtists,
                renderLibraryPage
            }));
        });

        document.getElementById('searchButton').addEventListener('click', searchMusic);
        document.getElementById('searchInput').addEventListener('keyup', (e) => {
            if (e.key === 'Enter') searchMusic();
        });

        document.getElementById('playBtn').addEventListener('click', Player.togglePlay);
        document.getElementById('miniPlayBtn').addEventListener('click', Player.togglePlay);
        document.getElementById('nextBtn').addEventListener('click', () => Player.playNext(false));
        document.getElementById('prevBtn').addEventListener('click', Player.playPrev);
        document.getElementById('slider').addEventListener('click', (e) => Player.seek(e, document.getElementById('slider')));

        document.getElementById('shuffleBtn').addEventListener('click', () => {
            const isShuffling = Player.toggleShuffle();
            document.getElementById('shuffleBtn').classList.toggle('active', isShuffling);
        });

        document.getElementById('repeatBtn').addEventListener('click', () => {
            const repeatMode = Player.cycleRepeat();
            const repeatBtn = document.getElementById('repeatBtn');
            repeatBtn.classList.remove('all', 'one');
            if (repeatMode !== 'off') {
                repeatBtn.classList.add(repeatMode);
            }
        });

        document.getElementById('artwork').addEventListener('dblclick', () => {
            toggleFavorite(Player.getCurrentTrack());
        });

        document.getElementById('shuffleAllBtn').addEventListener('click', shuffleAll);

        document.getElementById('miniPlayer').addEventListener('click', (e) => {
            if (e.target.closest('.play-btn')) return;
            UI.openFullPlayer();
        });

        document.getElementById('closePlayerBtn').addEventListener('click', UI.closeFullPlayer);

        document.getElementById('settingsBtn').addEventListener('click', () => {
            document.getElementById('settingsPanel').classList.toggle('visible');
        });

        document.getElementById('spinToggle').addEventListener('change', (e) => {
            state.settings.albumArtSpin = e.target.checked;
            const artwork = document.getElementById('artwork');
            const isPlaying = Player.getPlayer().getPlayerState() === YT.PlayerState.PLAYING;
            artwork.classList.toggle('spinning', isPlaying && state.settings.albumArtSpin);
        });
    }

    async function init() {
        document.documentElement.setAttribute('data-theme', state.theme);
        Player.initYouTubePlayer(null, onPlayerStateChange);
        let artistData = await fetchArtistWhitelist();
        state.artistWhitelist = artistData;

        document.getElementById('spinToggle').checked = state.settings.albumArtSpin;
        renderHomePage();
        bindEventListeners();
        console.log("SK Music player loaded and ready.");
    }

    init();
});
