
let player;
let playerReady = false;
const state = {
    currentTrack: null,
    queue: [],
    shuffledQueue: [],
    trackIndex: -1,
    repeatMode: 'off', // off, all, one
    shuffleMode: false,
};

let onStateChangeCallback;

export function initYouTubePlayer(onReadyCallback, onStateChange) {
    onStateChangeCallback = onStateChange;
    window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API is ready.");
        player = new YT.Player('yt-player', {
            height: '1',
            width: '1',
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'autoplay': 0,
                'enablejsapi': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': () => onPlayerReady(onReadyCallback),
                'onStateChange': onPlayerStateChange
            }
        });
    };
}

function onPlayerReady(callback) {
    console.log("YouTube Player is ready.");
    playerReady = true;
    if (callback) callback();
}

export function loadVideo(track, play = false) {
    if (playerReady) {
        state.currentTrack = track;
        player.loadVideoById(track.videoId);
        if (play) {
            player.playVideo();
        }
        // Call the state change callback to update the UI
        if (onStateChangeCallback) onStateChangeCallback({ data: -1 }); // Emulate a state change
    }
}

export function setQueue(newQueue, trackIndex) {
    state.queue = newQueue;
    if (state.shuffleMode) {
        shuffleQueue(trackIndex);
    } else {
        state.trackIndex = trackIndex;
    }
    loadVideo(getCurrentTrack(), true);
}

export function playNext(autoplay = false) {
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

export function playPrev() {
    if (state.trackIndex > 0) {
        state.trackIndex--;
        loadVideo(getCurrentTrack(), true);
    }
}

export function togglePlay() {
    if (!playerReady || !state.currentTrack) return;
    const playerState = player.getPlayerState();
    if (playerState === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

export function seek(e, slider) {
    if (!playerReady) return;
    const sliderWidth = slider.offsetWidth;
    const clickX = e.offsetX;
    const duration = player.getDuration();
    const seekTime = (clickX / sliderWidth) * duration;
    player.seekTo(seekTime, true);
}

export function toggleShuffle() {
    state.shuffleMode = !state.shuffleMode;
    if (state.shuffleMode) {
        shuffleQueue(state.trackIndex);
    } else {
        const currentTrack = getCurrentTrack();
        state.trackIndex = state.queue.findIndex(t => t.videoId === currentTrack.videoId);
    }
    return state.shuffleMode;
}

export function cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(state.repeatMode);
    state.repeatMode = modes[(currentIndex + 1) % modes.length];
    return state.repeatMode;
}

function shuffleQueue(currentIndex) {
    const currentTrack = state.queue[currentIndex];
    const remainingTracks = state.queue.filter((_, i) => i !== currentIndex);
    for (let i = remainingTracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingTracks[i], remainingTracks[j]] = [remainingTracks[j], remainingTracks[i]];
    }
    state.shuffledQueue = [currentTrack, ...remainingTracks];
    state.trackIndex = 0;
}

export function getActiveQueue() {
    return state.shuffleMode ? state.shuffledQueue : state.queue;
}

export function getCurrentTrack() {
    return getActiveQueue()[state.trackIndex];
}

export function getPlayer() {
    return player;
}

export function getPlayerState() {
    return state;
}

export function setTrackIndex(index) {
    state.trackIndex = index;
}
