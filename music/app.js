import { supabase } from './supabase-client.js';
import { fetchFromProxy } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log("Zemer Music player is loading...");

  // --- STATE ---
  const state = {
    currentPage: 0, // 0: Home, 1: Artists, 2: Search, 3: Library
    player: null,
    playerReady: false,
    currentTrack: null,
    queue: [],
    shuffledQueue: [],
    trackIndex: -1,
    artistWhitelist: [],
    progressInterval: null,
    recentlyPlayed: JSON.parse(localStorage.getItem('recentlyPlayed')) || [],
    favorites: JSON.parse(localStorage.getItem('favorites')) || [],
    theme: localStorage.getItem('theme') || 'dark',
    repeatMode: 'off', // off, all, one
    shuffleMode: false,
  };

  // --- DOM REFERENCES ---
  const docElement = document.documentElement;
  const viewport = document.getElementById('viewport');
  const navItems = document.querySelectorAll('.nav-item');
  const topTitle = document.getElementById('topTitle');
  const playBtn = document.getElementById('playBtn');
  const miniPlayBtn = document.getElementById('miniPlayBtn');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const miniPlayer = document.getElementById('miniPlayer');
  const playerSheet = document.getElementById('playerSheet');
  const closePlayerBtn = document.getElementById('closePlayerBtn');
  const miniTitle = document.getElementById('miniTitle');
  const miniArtist = document.getElementById('miniArtist');
  const miniThumb = document.getElementById('miniThumb');
  const trackTitle = document.getElementById('trackTitle');
  const trackArtist = document.getElementById('trackArtist');
  const artwork = document.getElementById('artwork');
  const artistsContent = document.getElementById('artistsContent');
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const searchContent = document.getElementById('searchContent');
  const slider = document.getElementById('slider');
  const sliderFill = document.getElementById('sliderFill');
  const miniProgress = document.getElementById('miniProgress');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const homeContent = document.getElementById('homeContent');
  const libraryContent = document.getElementById('libraryContent');
  const themeBtn = document.getElementById('themeBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const queueBtn = document.getElementById('queueBtn');


  // --- UTILS ---
  function getAvatarColor(name) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colors = [
          ['#ED5564', '#D63C4D'], // Red
          ['#FC6E51', '#E9573F'], // Orange
          ['#FFCE54', '#F6BB42'], // Yellow
          ['#A0D468', '#8CC152'], // Green
          ['#48CFAD', '#37BC9B'], // Mint
          ['#4FC1E9', '#3BAFDA'], // Aqua
          ['#5D9CEC', '#4A89DC'], // Blue
          ['#AC92EC', '#967ADC'], // Purple
          ['#EC87C0', '#D770AD'], // Pink
      ];
      return colors[Math.abs(hash) % colors.length];
  }


  // --- NAVIGATION ---
  const pageTitles = ["Zemer", "Artists", "Search", "Library"];

  function switchTab(tabIndex) {
    if (tabIndex === state.currentPage) return;
    state.currentPage = tabIndex;
    viewport.style.transform = `translateX(-${100 * tabIndex}%)`;
    navItems.forEach((item, index) => {
      item.classList.toggle('active', index === tabIndex);
    });
    topTitle.textContent = pageTitles[tabIndex] || "Zemer";
    if (tabIndex === 0) renderHomePage();
    if (tabIndex === 1) renderArtists();
    if (tabIndex === 3) renderLibraryPage();
    console.log(`Switched to tab ${tabIndex}`);
  }

  // --- YOUTUBE PLAYER ---
  function onYouTubeIframeAPIReady() {
    console.log("YouTube API is ready.");
    state.player = new YT.Player('yt-player', {
      height: '1',
      width: '1',
      playerVars: {
        'playsinline': 1,
        'controls': 0,
        'autoplay': 0,
        'enablejsapi': 1
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
  }

  function onPlayerReady(event) {
    console.log("YouTube Player is ready.");
    state.playerReady = true;
  }

    function onPlayerStateChange(event) {
        const isPlaying = event.data === YT.PlayerState.PLAYING;
        const playIcon = isPlaying ?
            '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>' :
            '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
        playBtn.innerHTML = playIcon;
        miniPlayBtn.innerHTML = playIcon;

        if (isPlaying) {
            startProgressUpdates();
        } else {
            stopProgressUpdates();
        }

        if (event.data === YT.PlayerState.ENDED) {
            playNext(true); // Autoplay next
        }
    }


  function loadVideo(track, play = false) {
    if (state.playerReady) {
      state.currentTrack = track;
      state.player.loadVideoById(track.videoId);
      if (play) {
        state.player.playVideo();
      }
      updatePlayerUI(track);
      addRecentlyPlayed(track);
    }
  }

    function setQueue(newQueue, trackIndex) {
        state.queue = newQueue;
        if (state.shuffleMode) {
            shuffleQueue(trackIndex);
        } else {
            state.trackIndex = trackIndex;
        }
        loadVideo(getCurrentTrack(), true);
    }

    function playNext(autoplay = false) {
        const currentTrack = getCurrentTrack();
        if (state.repeatMode === 'one' && autoplay) {
            loadVideo(currentTrack, true);
            return;
        }

        if (state.trackIndex < getActiveQueue().length - 1) {
            state.trackIndex++;
            loadVideo(getCurrentTrack(), true);
        } else if (state.repeatMode === 'all') {
            state.trackIndex = 0;
            loadVideo(getCurrentTrack(), true);
        }
    }


  function playPrev() {
      if (state.trackIndex > 0) {
          state.trackIndex--;
          loadVideo(getCurrentTrack(), true);
      }
  }

  function togglePlay() {
    if (!state.playerReady) return;
    const playerState = state.player.getPlayerState();
    if (playerState === YT.PlayerState.PLAYING) {
      state.player.pauseVideo();
    } else {
      state.player.playVideo();
    }
  }

  function seek(e) {
      if (!state.playerReady) return;
      const sliderWidth = slider.offsetWidth;
      const clickX = e.offsetX;
      const duration = state.player.getDuration();
      const seekTime = (clickX / sliderWidth) * duration;
      state.player.seekTo(seekTime, true);
  }

  function formatTime(seconds) {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${min}:${sec}`;
  }

  function startProgressUpdates() {
      stopProgressUpdates(); // Clear any existing interval
      state.progressInterval = setInterval(() => {
          if (state.playerReady && state.player.getPlayerState() === YT.PlayerState.PLAYING) {
              const currentTime = state.player.getCurrentTime();
              const duration = state.player.getDuration();
              const progress = (currentTime / duration) * 100;

              sliderFill.style.width = `${progress}%`;
              miniProgress.style.width = `${progress}%`;
              currentTimeEl.textContent = formatTime(currentTime);
              totalTimeEl.textContent = formatTime(duration);
          }
      }, 1000);
  }

  function stopProgressUpdates() {
      clearInterval(state.progressInterval);
  }

  // --- LOCAL STORAGE & SETTINGS ---
    function addRecentlyPlayed(track) {
        state.recentlyPlayed = [track, ...state.recentlyPlayed.filter(t => t.videoId !== track.videoId)].slice(0, 20);
        localStorage.setItem('recentlyPlayed', JSON.stringify(state.recentlyPlayed));
    }

    function toggleFavorite(track) {
        const isFavorite = state.favorites.some(t => t.videoId === track.videoId);
        if (isFavorite) {
            state.favorites = state.favorites.filter(t => t.videoId !== track.videoId);
        } else {
            state.favorites = [track, ...state.favorites];
        }
        localStorage.setItem('favorites', JSON.stringify(state.favorites));
        renderLibraryPage();
    }

    function toggleTheme() {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        docElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('theme', state.theme);
    }

    function toggleShuffle() {
        state.shuffleMode = !state.shuffleMode;
        shuffleBtn.classList.toggle('active', state.shuffleMode);
        if (state.shuffleMode) {
            shuffleQueue(state.trackIndex);
        } else {
            // Return to original order, maintaining current track
            const currentTrack = getCurrentTrack();
            state.trackIndex = state.queue.findIndex(t => t.videoId === currentTrack.videoId);
        }
    }


    function cycleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(state.repeatMode);
        state.repeatMode = modes[(currentIndex + 1) % modes.length];
        repeatBtn.classList.remove('active');
        if (state.repeatMode !== 'off') {
            repeatBtn.classList.add('active');
        }
        // You might want to update the icon here to show 'one' vs 'all'
    }

    function shuffleQueue(currentIndex) {
        const currentTrack = state.queue[currentIndex];
        const remainingTracks = state.queue.filter((_, i) => i !== currentIndex);
        // Fisher-Yates shuffle
        for (let i = remainingTracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
        }
        state.shuffledQueue = [currentTrack, ...remainingTracks];
        state.trackIndex = 0;
    }

    function getActiveQueue() {
        return state.shuffleMode ? state.shuffledQueue : state.queue;
    }

    function getCurrentTrack() {
        return getActiveQueue()[state.trackIndex];
    }


  // --- UI UPDATES ---
  function updatePlayerUI(track) {
    miniPlayer.classList.add('active');
    miniTitle.textContent = track.title;
    miniArtist.textContent = track.artist;
    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;

    const thumbnailUrl = track.thumbnail || '';
    const fallback = '<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;font-size:20px;">🎵</div>';
    miniThumb.innerHTML = thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${track.title}">` : fallback;
    artwork.innerHTML = thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${track.title}">` : fallback.replace('20px', '64px');
  }

  function openFullPlayer() {
    playerSheet.classList.add('open');
  }

  function closeFullPlayer() {
    playerSheet.classList.remove('open');
  }

    function openQueue() {
        const queueOverlay = document.createElement('div');
        queueOverlay.className = 'queue-overlay open';
        queueOverlay.innerHTML = `
            <div class="queue-drawer">
                <div class="queue-header">
                    <h2 class="queue-title">Queue</h2>
                    <button class="icon-btn close-queue-btn">
                        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
                <div class="queue-list"></div>
            </div>
        `;
        document.body.appendChild(queueOverlay);

        const closeBtn = queueOverlay.querySelector('.close-queue-btn');
        closeBtn.addEventListener('click', () => queueOverlay.remove());
        queueOverlay.addEventListener('click', (e) => {
            if (e.target === queueOverlay) {
                queueOverlay.remove();
            }
        });

        renderQueue(queueOverlay.querySelector('.queue-list'));
    }

    function renderQueue(queueListEl) {
        queueListEl.innerHTML = '';
        getActiveQueue().forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item' + (index === state.trackIndex ? ' current' : '');
            item.innerHTML = `
                <div class="queue-item-info">
                    <img src="${track.thumbnail}" class="queue-item-thumb">
                    <div class="queue-item-text">
                        <div class="queue-item-title">${track.title}</div>
                        <div class="queue-item-artist">${track.artist}</div>
                    </div>
                </div>
            `;
            item.addEventListener('click', () => {
                state.trackIndex = index;
                loadVideo(track, true);
            });
            queueListEl.appendChild(item);
        });
    }

  // --- DATA FETCHING ---
  async function fetchArtistWhitelist() {
    try {
      const { data, error } = await supabase.from('artists').select('*');
      if (error) {
        throw error;
      }
      state.artistWhitelist = data;
      console.log('Fetched artist whitelist:', state.artistWhitelist);
    } catch (error) {
      console.error('Error fetching artists:', error);
      artistsContent.innerHTML = `<div class="empty"><div class="empty-icon">😢</div><div class="empty-title">Error</div><div class="empty-text">Could not load artist list.</div></div>`;
    }
  }

  async function searchMusic(query) {
    searchContent.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await fetchFromProxy('search', `part=snippet&type=video&maxResults=50&q=${query}`);
      if (data && data.items) {
        const whitelistedArtistIds = new Set(state.artistWhitelist.map(a => a.channel_id));
        const filteredItems = data.items.filter(item => whitelistedArtistIds.has(item.snippet.channelId));
        renderSearchResults(filteredItems);
      }
    } catch (error) {
      console.error('Search error:', error);
      searchContent.innerHTML = `<div class="empty"><div class="empty-icon">😢</div><div class="empty-title">Error</div><div class="empty-text">Search failed. Please try again later.</div></div>`;
    }
  }

  // --- RENDERING ---
    function renderHomePage() {
        homeContent.innerHTML = '';
        if (state.recentlyPlayed.length > 0) {
            const section = document.createElement('div');
            section.className = 'section';
            section.innerHTML = '<div class="section-title">Recently Played</div>';
            const list = document.createElement('div');
            list.className = 'h-scroll';
            state.recentlyPlayed.forEach(track => {
                const card = createTrackCard(track, state.recentlyPlayed);
                list.appendChild(card);
            });
            section.appendChild(list);
            homeContent.appendChild(section);
        } else {
            homeContent.innerHTML = '<div class="empty"><div class="empty-icon">🎵</div><div class="empty-title">No recent activity</div><div class="empty-text">Songs you play will appear here.</div></div>';
        }
    }

    function renderLibraryPage() {
        libraryContent.innerHTML = '';
        if (state.favorites.length > 0) {
            const section = document.createElement('div');
            section.className = 'section';
            section.innerHTML = '<div class="section-title">Favorites</div>';
            state.favorites.forEach((track, index) => {
                const card = createTrackListItem(track, state.favorites, index);
                section.appendChild(card);
            });
            libraryContent.appendChild(section);
        } else {
            libraryContent.innerHTML = '<div class="empty"><div class="empty-icon">❤️</div><div class="empty-title">No favorites yet</div><div class="empty-text">Add songs to your favorites to see them here.</div></div>';
        }
    }


  function renderArtists() {
    artistsContent.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'artists-grid';

    state.artistWhitelist.forEach(artist => {
      const [color1, color2] = getAvatarColor(artist.name);
      const artistCard = document.createElement('div');
      artistCard.className = 'grid-item';
      artistCard.innerHTML = `
        <div class="thumb circle">
          <div style="width:100%;height:100%;background:linear-gradient(135deg, ${color1}, ${color2});display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:500;color:white;">${artist.name.charAt(0)}</div>
        </div>
        <div class="grid-title">${artist.name}</div>
        <div class="grid-sub">Artist</div>
      `;
      grid.appendChild(artistCard);
    });
    artistsContent.appendChild(grid);
  }

  function renderSearchResults(items) {
    searchContent.innerHTML = '';
    if (!items || items.length === 0) {
      searchContent.innerHTML = '<div class="empty"><div class="empty-icon">🤷</div><div class="empty-title">No Results</div><div class="empty-text">No music found from whitelisted artists.</div></div>';
      return;
    }

    const searchQueue = [];
    items.forEach(item => {
      const videoId = item.id.videoId;
      const title = item.snippet.title;
      const artist = item.snippet.channelTitle;
      const thumbnail = item.snippet.thumbnails.medium.url;
      searchQueue.push({ videoId, title, artist, thumbnail });
    });


    searchQueue.forEach((track, index) => {
      const card = createTrackListItem(track, searchQueue, index);
      searchContent.appendChild(card);
    });
  }

    function createTrackCard(track, queue) {
        const card = document.createElement('div');
        card.className = 'grid-item';
        const fallback = '<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;font-size:20px;">🎵</div>';
        card.innerHTML = `
            <div class="thumb">${track.thumbnail ? `<img src="${track.thumbnail}" alt="${track.title}">` : fallback}</div>
            <div class="grid-title">${track.title}</div>
            <div class="grid-sub">${track.artist}</div>
        `;
        card.addEventListener('click', () => setQueue(queue, queue.findIndex(t => t.videoId === track.videoId)));
        return card;
    }

    function createTrackListItem(track, queue, index) {
        const item = document.createElement('div');
        item.className = 'list-item';
        const fallback = '<div style="width:48px;height:48px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));display:flex;align-items:center;justify-content:center;font-size:20px;">🎵</div>';
        item.innerHTML = `
            <div class="list-thumb">${track.thumbnail ? `<img src="${track.thumbnail}" alt="${track.title}">` : fallback}</div>
            <div class="list-info">
                <div class="list-title">${track.title}</div>
                <div class="list-sub">${track.artist}</div>
            </div>
        `;
        item.addEventListener('click', () => setQueue(queue, index));
        return item;
    }


  // --- EVENT LISTENERS ---
  navItems.forEach((item, index) => {
    item.addEventListener('click', () => switchTab(index));
  });

  playBtn.addEventListener('click', togglePlay);
  miniPlayBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', () => playNext(false));
  prevBtn.addEventListener('click', playPrev);
  slider.addEventListener('click', seek);
  themeBtn.addEventListener('click', toggleTheme);
  shuffleBtn.addEventListener('click', toggleShuffle);
  repeatBtn.addEventListener('click', cycleRepeat);
  queueBtn.addEventListener('click', openQueue);

  miniPlayer.addEventListener('click', (e) => {
    if (e.target.closest('.mini-btn')) return;
    openFullPlayer();
  });
  closePlayerBtn.addEventListener('click', closeFullPlayer);

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

  artwork.addEventListener('dblclick', () => {
    if (state.currentTrack) {
      toggleFavorite(state.currentTrack);
    }
  });


  // --- INITIALIZATION ---
  window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

  async function init() {
    docElement.setAttribute('data-theme', state.theme);
    await fetchArtistWhitelist();
    renderHomePage();
    console.log("Zemer Music player loaded and ready.");
  }

  init();
});
