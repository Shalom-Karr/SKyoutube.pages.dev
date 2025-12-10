import { supabase } from './supabase-client.js';

let userIP = null;

// --- 1. IP & BLOCKING LOGIC ---
async function getIP() {
    if (userIP) return userIP;
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        userIP = data.ip;
        return userIP;
    } catch (e) {
        console.warn("Tracking: Could not fetch IP");
        return 'unknown';
    }
}

async function checkAccess() {
    const ip = await getIP();

    // Check Supabase Block List
    const { data, error } = await supabase
        .from('blocked_ips')
        .select('ip_address')
        .eq('ip_address', ip)
        .single();

    if (data) {
        // 1. Log the attempted visit before destroying the page
        await window.trackEvent('blocked_visit', 'ACCESS DENIED - BLOCKED IP', window.location.href);

        // 2. User is blocked: Nuke the DOM immediately
        document.body.innerHTML = `
            <div style="display:flex;height:100vh;justify-content:center;align-items:center;background:#000;color:red;font-family:sans-serif;flex-direction:column;">
                <h1 style="font-size:3rem;">ACCESS DENIED</h1>
                <p>Your IP (${ip}) has been banned.</p>
            </div>
        `;
        // 3. Stop all further script execution
        throw new Error("Access Denied: IP Blocked");
    }
}

// --- 2. RICH DATA COLLECTION HELPERS ---
function getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Internet";
    else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
    else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
    else if (ua.indexOf("Edge") > -1) browser = "Edge";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";
    return browser;
}

function getOSInfo() {
    const ua = navigator.userAgent;
    if (ua.indexOf("Win") !== -1) return "Windows";
    if (ua.indexOf("Mac") !== -1) return "MacOS";
    if (ua.indexOf("Linux") !== -1) return "Linux";
    if (ua.indexOf("Android") !== -1) return "Android";
    if (ua.indexOf("like Mac") !== -1) return "iOS";
    return "Unknown OS";
}

// --- 3. PUBLIC TRACKING FUNCTION ---
window.trackEvent = async function(eventType, title, url = window.location.href) {
    const ip = await getIP();

    const metaData = {
        browser: getBrowserInfo(),
        os: getOSInfo(),
        screen: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        userAgent: navigator.userAgent
    };

    // We use 'insert' but we don't await the error handling for normal events
    // to prevent slowing down the UI, unless it's the blocking check.
    const { error } = await supabase.from('user_logs').insert([{
        event_type: eventType,
        video_title: title,
        video_url: url,
        ip_address: ip,
        meta: metaData
    }]);

    if (error) console.error("Tracking Error:", error);
};

// --- 4. INITIALIZE ---
(async () => {
    // 1. Check Block Status First
    await checkAccess();

    // 2. Log the visit if not blocked
    // (Filtered to ensure we don't log API calls as page visits)
    if (!window.location.search.includes('action=')) {
        window.trackEvent('visit', document.title);
    }
})();
