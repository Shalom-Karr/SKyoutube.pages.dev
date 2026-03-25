// ==UserScript==
// @name         Universal SK Redirector
// @namespace    http://tampermonkey.net/
// @version      7.1
// @description  Redirects from YouTube, Reddit, JTech, and Techloq to custom sites or a proxy fallback.
// @author       Shalom Karr / YH Studios
// @match        *://www.youtube.com/*
// @match        *://music.youtube.com/*
// @match        *://forums.jtechforums.org/*
// @match        *://filter.techloq.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CENTRAL CONFIGURATION ---
    const PROXY_DOMAIN = 'https://example.com'; // Replace with the actual proxy domain
    const REDIRECT_CONFIG = [
        { type: 'path', sourceDomain: 'forums.jtechforums.org', targetDomain: 'https://jtechwebsite.shalomkarr.workers.dev' },
        { type: 'youtube', sourceDomain: 'www.youtube.com', targetDomain: 'https://skyoutube.pages.dev' },
        { type: 'youtube', sourceDomain: 'music.youtube.com', targetDomain: 'https://skyoutube.pages.dev' }
    ];

    // Polling Settings for Techloq
    const MAX_TECHLOQ_RETRIES = 1200; // Total time: 5 minutes (1200 * 250ms)
    const TECHLOQ_RETRY_INTERVAL_MS = 250;
    // --- END CONFIGURATION ---

    if (window.top !== window.self) return;

    let techloqAttemptCount = 0;

    // --- REDIRECT HANDLERS ---

    function performPathRedirect(targetDomain, urlObject) {
        const newUrl = `${targetDomain}${urlObject.pathname}${urlObject.search}`;
        window.location.replace(newUrl);
    }

    function performYoutubeRedirect(targetDomain, urlString) {
        const isMusic = urlString.includes('music.youtube.com');
        const musicParam = isMusic ? '&isMusic=true' : '';

        const playlistPattern = /[?&]list=([a-zA-Z0-9_-]+)/;
        const videoPattern = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const channelPattern = /youtube\.com\/@([^\/?]+)/;
        const musicChannelPattern = /music\.youtube\.com\/channel\/([a-zA-Z0-9_-]+)/;

        const playlistId = urlString.match(playlistPattern)?.[1];
        if (playlistId) {
            window.location.replace(`${targetDomain}/playlist?source=${encodeURIComponent(playlistId)}${musicParam}`);
            return;
        }

        const videoId = urlString.match(videoPattern)?.[1];
        if (videoId) {
            window.location.replace(`${targetDomain}/video?source=${encodeURIComponent(videoId)}`);
            return;
        }

        const channelHandle = urlString.match(channelPattern)?.[1];
        if (channelHandle) {
            window.location.replace(`${targetDomain}/channel?source=${encodeURIComponent(channelHandle)}`);
            return;
        }

        const musicChannelId = urlString.match(musicChannelPattern)?.[1];
        if (musicChannelId) {
            window.location.replace(`${targetDomain}/channel?source=${encodeURIComponent(musicChannelId)}${musicParam}`);
            return;
        }


        window.location.replace(targetDomain);
    }

    // --- TECHLOQ POLLING LOGIC ---

    function pollForBlockedUrl() {
        let originalUrlStr = '';

        // Method 1: Check the URL's query parameter first.
        try {
            const params = new URLSearchParams(window.location.search);
            const encodedRedirectUrl = params.get('redirectUrl');
            if (encodedRedirectUrl) {
                originalUrlStr = decodeURIComponent(encodedRedirectUrl);
            }
        } catch (e) {
            console.error("Error parsing Techloq URL query parameters:", e);
        }

        // Method 2 (Fallback): Find the URL in the page content (the <a> tag).
        if (!originalUrlStr) {
             const blockedLinkElement = document.querySelector('div.block-url a');
             if (blockedLinkElement && blockedLinkElement.href) {
                 originalUrlStr = blockedLinkElement.href;
             }
        }

        if (originalUrlStr) {
            // A blocked URL was found. Decide where to redirect.
            try {
                const urlObject = new URL(originalUrlStr);
                const hostname = urlObject.hostname.replace(/^www\./, '');
                let customRedirectFound = false;

                // First, check if there's a custom redirect for this domain.
                for (const rule of REDIRECT_CONFIG) {
                    if (hostname.includes(rule.sourceDomain.replace(/^www\./, ''))) {
                        customRedirectFound = true;
                        if (rule.type === 'path') {
                            performPathRedirect(rule.targetDomain, urlObject);
                        } else if (rule.type === 'youtube') {
                            performYoutubeRedirect(rule.targetDomain, originalUrlStr);
                        }
                        return; // Success, stop polling.
                    }
                }

                // If no custom redirect exists, use the proxy as a fallback.
                if (!customRedirectFound) {
                    window.location.replace(`${PROXY_DOMAIN}/proxy?url=${encodeURIComponent(originalUrlStr)}`);
                    return; // Stop polling.
                }
            } catch (e) {
                console.error("Error processing the blocked URL:", e);
                // Fallback to proxy homepage on error
                window.location.replace(PROXY_DOMAIN);
            }
            return; // Should be unreachable, but good for safety.
        }

        // If no blocked URL is found, continue polling until timeout.
        techloqAttemptCount++;
        if (techloqAttemptCount < MAX_TECHLOQ_RETRIES) {
            setTimeout(pollForBlockedUrl, TECHLOQ_RETRY_INTERVAL_MS);
        } else {
            // Polling timed out. Assume this is not a block page (e.g., settings)
            // or it's the base domain. Redirect to the proxy's homepage.
            window.location.replace(PROXY_DOMAIN);
        }
    }

    // --- SCRIPT EXECUTION LOGIC ---

    const currentHostname = window.location.hostname;

    if (currentHostname.includes('filter.techloq.com')) {
        pollForBlockedUrl();
    } else {
        const currentUrl = window.location.href;

        for (const rule of REDIRECT_CONFIG) {
            if (currentHostname.includes(rule.sourceDomain)) {
                 if (rule.type === 'path') {
                    performPathRedirect(rule.targetDomain, new URL(currentUrl));
                } else if (rule.type === 'youtube') {
                    performYoutubeRedirect(rule.targetDomain, currentUrl);
                }
                break;
            }
        }
    }
})();
