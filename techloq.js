// ==UserScript==
// @name         YouTube to SK Dashboard Redirector
// @namespace    http://tampermonkey.net/
// @version      4.1 // Added Playlist Support
// @description  Instantly redirects from YouTube video and playlist pages. On ALL Techloq pages, it performs immediate and extremely persistent polling.
// @author       Shalom Karr / YH Studios
// @match        *://filter.techloq.com/*
// @match        *://www.youtube.com/watch*
// @match        *://www.youtube.com/playlist*
// @run-at       document-start
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Shalom-Karr/youtube-redirector/main/youtube-redirector.user.js
// @downloadURL  https://raw.githubusercontent.com/Shalom-Karr/youtube-redirector/main/youtube-redirector.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const BASE_DASHBOARD_URL = 'https://skyoutubebeta.netlify.app';

    // Polling Settings
    const MAX_TECHLOQ_RETRIES = 1200;
    const TECHLOQ_RETRY_INTERVAL_MS = 250;
    // --- END CONFIGURATION ---

    if (window.top !== window.self) return;

    let techloqAttemptCount = 0;

    function getVideoId(url) {
        const pattern = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        return url.match(pattern)?.[1] || null;
    }

    function getPlaylistId(url) {
        const pattern = /[?&]list=([a-zA-Z0-9_-]+)/;
        return url.match(pattern)?.[1] || null;
    }

    function redirectToDashboard(type, id) {
        if (!id) return;
        const path = type === 'playlist' ? '/playlist?source=' : '/video?source=';
        const redirectUrl = `${BASE_DASHBOARD_URL}${path}${encodeURIComponent(id)}`;
        window.location.replace(redirectUrl);
    }

    // --- TECHLOQ SPECIFIC LOGIC ---

    function findMediaIds() {
        let videoId = null;
        let playlistId = null;
        let urlToCheck = '';

        try {
            const params = new URLSearchParams(window.location.search);
            const encodedRedirectUrl = params.get('redirectUrl');
            if (encodedRedirectUrl) {
                urlToCheck = decodeURIComponent(encodedRedirectUrl);
            }
        } catch (e) {}

        const blockDiv = document.querySelector('div.block-url a');
        if (blockDiv && blockDiv.href) {
            urlToCheck = blockDiv.href;
        }

        if (urlToCheck) {
            videoId = getVideoId(urlToCheck);
            playlistId = getPlaylistId(urlToCheck);
        }

        return { videoId, playlistId };
    }

    function attemptTechloqRedirect() {
        const { videoId, playlistId } = findMediaIds();

        if (playlistId) {
            redirectToDashboard('playlist', playlistId);
            return;
        }
        if (videoId) {
            redirectToDashboard('video', videoId);
            return;
        }

        techloqAttemptCount++;
        if (techloqAttemptCount < MAX_TECHLOQ_RETRIES) {
            setTimeout(attemptTechloqRedirect, TECHLOQ_RETRY_INTERVAL_MS);
        }
    }

    // --- SCRIPT EXECUTION LOGIC ---

    const currentUrl = window.location.href;
    const currentHostname = window.location.hostname;

    if (currentHostname === 'www.youtube.com') {
        const playlistId = getPlaylistId(currentUrl);
        if (playlistId) {
            redirectToDashboard('playlist', playlistId);
            return;
        }

        const videoId = getVideoId(currentUrl);
        if (videoId) {
            redirectToDashboard('video', videoId);
        }
        return;
    }

    if (currentHostname.includes('filter.techloq.com')) {
        attemptTechloqRedirect();
    }

})();