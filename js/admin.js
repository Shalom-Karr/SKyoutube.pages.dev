import { supabase } from './supabase-client.js';

// --- DOM ELEMENT REFERENCES ---
const loginForm = document.querySelector('.login-form');
const loginWrapper = document.getElementById('login-wrapper'); // REFERENCE FOR NARROW LOGIN CONTAINER
const adminContent = document.getElementById('admin-content');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const logoutButton = document.getElementById('logout-button');

const refreshLogsBtn = document.getElementById('refresh-logs-btn');
const ipFilterInput = document.getElementById('ip-filter');
const logsDisplay = document.getElementById('logs-display');
const addIpInput = document.getElementById('add-ip-input');
const addIpBtn = document.getElementById('add-ip-btn');
const ipsDisplay = document.getElementById('ips-display');
const statusMessage = document.getElementById('status-message'); // NEW: Status display

// --- Utility Functions for Status Messages ---
function showStatusMessage(message, type = 'success', duration = 4000) {
    statusMessage.textContent = message;
    statusMessage.className = `show ${type}`; 
    
    // Auto-hide the message
    if (statusMessage.timeoutId) {
        clearTimeout(statusMessage.timeoutId);
    }
    statusMessage.timeoutId = setTimeout(() => {
        statusMessage.classList.remove('show', 'success', 'error');
        statusMessage.textContent = '';
    }, duration);
}


// --- Authentication Functions ---
async function handleLogin(email, password) {
    loginError.textContent = ''; 
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error('Login error:', error);
            loginError.textContent = error.message || 'An unexpected error occurred.';
            return;
        }

        const user = data.user;
        if (user) {
            const { data: profile, error: profileError } = await supabase.from('users').select('user_role').eq('id', user.id).single();
            
            if (profileError || !profile || profile.user_role !== 'admin') {
                 console.warn('User logged in but not an admin.');
                 await supabase.auth.signOut();
                 loginError.textContent = 'You do not have administrator access.';
                 return;
            }
        }

        console.log('Login successful:', data.user);
        loginWrapper.classList.add('hidden'); // Use loginWrapper
        adminContent.classList.remove('hidden');
        await loadAdminPanelContent();

    } catch (error) {
        console.error('Login catch block error:', error);
        loginError.textContent = error.message || 'An unexpected error occurred.';
    }
}

async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error("Logout error:", error);
        showStatusMessage("Failed to log out.", 'error'); // Replaced alert
    } else {
        loginWrapper.classList.remove('hidden'); // Use loginWrapper
        adminContent.classList.add('hidden');
        // Clear inputs on logout for security
        emailInput.value = '';
        passwordInput.value = '';
        loginError.textContent = 'Logged out successfully.';
    }
}

async function checkAuthStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile, error: profileError } = await supabase.from('users').select('user_role').eq('id', user.id).single();
        if (profileError || !profile || profile.user_role !== 'admin') {
            console.warn('User logged in but not an admin.');
            await supabase.auth.signOut();
            loginWrapper.classList.remove('hidden');
            adminContent.classList.add('hidden');
            loginError.textContent = 'You do not have administrator access.';
        } else {
            loginWrapper.classList.add('hidden');
            adminContent.classList.remove('hidden');
            await loadAdminPanelContent();
        }
    } else {
        loginWrapper.classList.remove('hidden');
        adminContent.classList.add('hidden');
    }
}

async function loadAdminPanelContent() {
    const { data: logs, error: logsError } = await supabase.from('user_logs').select('*').order('timestamp', { ascending: false });
    if (logsError) {
        console.error('Error fetching logs:', logsError);
        logsDisplay.innerHTML = '<p style="color: var(--red-color);">Error loading logs.</p>';
    } else {
        renderLogs(logs);
    }

    const { data: blockedIps, error: ipsError } = await supabase.from('blocked_ips').select('*').order('blocked_at', { ascending: false });
    if (ipsError) {
        console.error('Error fetching blocked IPs:', ipsError);
        ipsDisplay.innerHTML = '<p style="color: var(--red-color);">Error loading blocked IPs.</p>';
    } else {
        renderBlockedIPs(blockedIps.map(ip => ip.ip_address));
    }

    const adminTabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            adminTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
    });
    
    // Removed confirmation dialogs (confirm())
    logsDisplay.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('delete-log-btn')) {
            const id = target.dataset.id;
            // Note: In a real app, you might want a custom modal confirmation here,
            // but per instruction, we perform the action directly.
            await deleteLog(id);
            
        } else if (target.classList.contains('block-ip-btn')) {
            const ip = target.dataset.ip;
            await blockIp(ip);
        }
    });

    // Removed confirmation dialogs (confirm())
    ipsDisplay.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('remove-ip-btn')) {
            const ip = target.dataset.ip;
            await removeIpFromBlockList(ip);
        }
    });

    refreshLogsBtn.addEventListener('click', refreshLogs);
    ipFilterInput.addEventListener('input', refreshLogs);
    addIpBtn.addEventListener('click', addIpToBlockList);
    addIpInput.addEventListener('keydown', e => { if (e.key === 'Enter') addIpToBlockList(); });
}


// --- Log Management Functions ---
function renderLogs(logs, filterIp = '') {
    logsDisplay.innerHTML = '';
    if (!logs || logs.length === 0) {
        logsDisplay.innerHTML = '<p>No logs found.</p>';
        return;
    }

    // Updated filtering to check if log IP starts with the filter IP, allowing prefix filtering
    const filteredLogs = filterIp 
        ? logs.filter(log => log.ip_address.startsWith(filterIp)) 
        : logs;

    if (filteredLogs.length === 0 && filterIp) {
         logsDisplay.innerHTML = `<p>No logs found for IP address: ${filterIp}</p>`;
         return;
    }

    filteredLogs.forEach(log => {
        // Use video title, fall back to URL if title is null
        const displayTitle = log.video_title || log.video_url; 
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        entry.innerHTML = `
            <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
            
            <a href="${log.video_url}" target="_blank" rel="noopener noreferrer" class="log-title" title="${log.video_url}">
                ${displayTitle}
            </a>
            
            <span class="log-ip">${log.ip_address}</span>
            
            <div class="log-actions">
                <button class="delete-log-btn material-icons" title="Delete Log" data-id="${log.id}">delete</button>
                <button class="block-ip-btn material-icons" title="Block IP" data-ip="${log.ip_address}">block</button>
            </div>
        `;
        logsDisplay.appendChild(entry);
    });
}

async function deleteLog(id) {
    const { error } = await supabase.from('user_logs').delete().eq('id', id);
    if (error) {
        console.error('Error deleting log:', error);
        showStatusMessage('Failed to delete log entry.', 'error'); // Replaced alert
    } else {
        console.log('Log deleted:', id);
        showStatusMessage('Log entry deleted successfully.', 'success'); // Replaced alert
        await refreshLogs(); 
    }
}

async function blockIp(ipAddress) {
    // Check if the address is already blocked (exact match)
    const { data: existingBlock, error: fetchError } = await supabase.from('blocked_ips').select('*').eq('ip_address', ipAddress).maybeSingle();
    
    if (fetchError && fetchError.code !== 'PGRST116') { 
        console.error('Error checking blocked IPs:', fetchError);
        showStatusMessage('Failed to check blocked IPs.', 'error'); 
        return;
    }
    if (existingBlock) {
        showStatusMessage(`IP address ${ipAddress} is already blocked.`, 'error'); 
        return;
    }

    const { error } = await supabase.from('blocked_ips').insert([{ ip_address: ipAddress }]);
    
    if (error) {
        console.error('Error blocking IP:', error);
        showStatusMessage('Failed to block IP address. It might already exist or there was another error.', 'error'); 
    } else {
        console.log('IP blocked:', ipAddress);
        showStatusMessage(`IP address ${ipAddress} has been blocked.`, 'success'); 
        await refreshAdminPanelContent(); 
    }
}


// --- IP Blocking Management Functions ---
function renderBlockedIPs(ips) {
    ipsDisplay.innerHTML = '';
    if (!ips || ips.length === 0) {
        ipsDisplay.innerHTML = '<p>No IP addresses are currently blocked.</p>';
        return;
    }

    ips.forEach(ip => {
        const entry = document.createElement('div');
        entry.className = 'blocked-ip-entry';
        entry.innerHTML = `
            <span class="ip-address">${ip}</span>
            <button class="remove-ip-btn material-icons" title="Unblock IP" data-ip="${ip}">cancel</button>
        `;
        ipsDisplay.appendChild(entry);
    });
}

/**
 * Adds an IP address or a 3-octet prefix to the block list.
 */
async function addIpToBlockList() {
    const ip = addIpInput.value.trim();
    if (!ip) {
        showStatusMessage("Please enter an IP address (e.g., 192.168.1.1) or a 3-octet prefix (e.g., 192.168.1) to block.", 'error');
        return;
    }
    
    // Regex allows 4 octets (full IP) OR 3 octets (prefix like 192.168.1)
    // Note: The second part of the regex assumes the user enters a full three octets without a trailing dot (192.168.1)
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9]{1,3}\.){2}[0-9]{1,3}$/; 
    
    if (!ipRegex.test(ip)) {
        showStatusMessage("Please enter a valid IPv4 address (e.g., 192.168.1.1) or a 3-octet prefix (e.g., 192.168.1).", 'error'); 
        return;
    }
    
    // Ensure 3-octet prefixes don't have a trailing dot if the user accidentally types it
    const finalIp = ip.endsWith('.') ? ip.slice(0, -1) : ip; 

    const { error } = await supabase.from('blocked_ips').insert([{ ip_address: finalIp }]);
    
    if (error) {
        if (error.code === '23505') { // PostgreSQL Unique Violation Code
            showStatusMessage(`IP address ${finalIp} is already blocked.`, 'error');
        } else {
            console.error('Error adding IP:', error);
            showStatusMessage('Failed to add IP address to block list.', 'error'); 
        }
    } else {
        console.log('IP added to block list:', finalIp);
        addIpInput.value = ''; 
        showStatusMessage(`IP address ${finalIp} has been blocked.`, 'success'); 
        await refreshAdminPanelContent(); 
    }
}

async function removeIpFromBlockList(ipToRemove) {
    const { error } = await supabase.from('blocked_ips').delete().eq('ip_address', ipToRemove);
    if (error) {
        console.error('Error removing IP:', error);
        showStatusMessage('Failed to unblock IP address.', 'error'); // Replaced alert
    } else {
        console.log('IP unblocked:', ipToRemove);
        showStatusMessage(`IP address ${ipToRemove} has been unblocked.`, 'success'); // Replaced alert
        await refreshAdminPanelContent(); 
    }
}

// --- Utility Functions ---
async function refreshLogs() {
    const { data: logs, error: logsError } = await supabase.from('user_logs').select('*').order('timestamp', { ascending: false });
    if (logsError) {
        console.error('Error fetching logs:', logsError);
        logsDisplay.innerHTML = '<p style="color: var(--red-color);">Error loading logs.</p>';
    } else {
        // Pass the filter input value to renderLogs
        renderLogs(logs, ipFilterInput.value); 
    }
}

async function refreshBlockedIPs() {
     const { data: blockedIps, error: ipsError } = await supabase.from('blocked_ips').select('*').order('blocked_at', { ascending: false });
     if (ipsError) {
         console.error('Error fetching blocked IPs:', ipsError);
         ipsDisplay.innerHTML = '<p style="color: var(--red-color);">Error loading blocked IPs.</p>';
     } else {
         renderBlockedIPs(blockedIps.map(ip => ip.ip_address));
     }
}

async function refreshAdminPanelContent() {
    await refreshLogs();
    await refreshBlockedIPs();
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus(); 

    loginButton.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        handleLogin(email, password);
    });
    
    // NEW LOGOUT LISTENER
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }


    emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') { passwordInput.focus(); } });
    passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') { handleLogin(emailInput.value.trim(), passwordInput.value.trim()); } });
});