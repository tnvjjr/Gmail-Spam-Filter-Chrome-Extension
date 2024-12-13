console.log('Background script loading...');

// Initialize state
let isRunning = true;
let stats = { processed: 0, spam: 0 };
let ports = new Map(); // Use Map to store ports with their names

// Load saved state on startup
chrome.storage.local.get(['stats', 'isRunning'], (result) => {
    if (result.stats) {
        stats = result.stats;
        debugLog('Loaded saved stats', stats);
    }
    if (result.hasOwnProperty('isRunning')) {
        isRunning = result.isRunning;
        debugLog('Loaded saved running state', isRunning);
    }
});

// Detailed logging function
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[SPAM-FILTER][${timestamp}] ${message}`, data || '');
    
    // Optional: Store logs in chrome storage for later review
    chrome.storage.local.get(['debugLogs'], (result) => {
        const logs = result.debugLogs || [];
        logs.push({ timestamp, message, data });
        
        // Keep only last 100 logs
        const trimmedLogs = logs.slice(-100);
        chrome.storage.local.set({ debugLogs: trimmedLogs });
    });
}

// Comprehensive stats update function
function updateStats(processed = 0, spam = 0) {
    debugLog('Updating Stats', { processed, spam, currentStats: stats });
    
    try {
        // Update memory stats
        stats.processed += processed;
        stats.spam += spam;
        
        // Save to storage
        chrome.storage.local.set({ 
            stats: stats,
            isRunning: isRunning 
        }, () => {
            if (chrome.runtime.lastError) {
                debugLog('Storage Update Error', chrome.runtime.lastError);
            } else {
                debugLog('Stats Saved Successfully', stats);
                // Broadcast update to all connected ports
                broadcastMessage({
                    type: 'state',
                    stats: stats,
                    isRunning: isRunning
                });
            }
        });
    } catch (error) {
        debugLog('Stats Update Error', error);
    }
}

// Reset stats function
function resetStats() {
    stats = { processed: 0, spam: 0 };
    updateStats(0, 0);
    debugLog('Stats reset', stats);
}

// Function to broadcast message to all connected ports
function broadcastMessage(message) {
    console.log('Broadcasting message:', message);
    ports.forEach((port, name) => {
        try {
            port.postMessage(message);
        } catch (error) {
            console.error(`Failed to send message to ${name}:`, error);
            ports.delete(name);
        }
    });
}

// Function to send message to specific port
function sendMessageToPort(portName, message) {
    const port = ports.get(portName);
    if (port) {
        try {
            port.postMessage(message);
        } catch (error) {
            console.error(`Failed to send message to ${portName}:`, error);
            ports.delete(portName);
        }
    }
}

// Function to log and broadcast message
function logMessage(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${timestamp} - ${message}`);
    
    broadcastMessage({
        type: type,
        message: message,
        timestamp: timestamp
    });
}

// Enhanced message handler
function handleMessage(message, sender, sendResponse) {
    debugLog('Received Message', { 
        action: message.action, 
        sender: sender.tab ? sender.tab.url : 'Unknown',
        fullMessage: message 
    });
    
    try {
        switch (message.action) {
            case 'updateStats':
                updateStats(
                    message.processed || 1, 
                    message.spam || 0
                );
                sendResponse({ 
                    status: 'success', 
                    stats: stats,
                    message: 'Stats updated successfully' 
                });
                break;
            
            case 'getState':
                sendResponse({
                    type: 'state',
                    stats: stats,
                    isRunning: isRunning,
                    message: 'Current state retrieved'
                });
                break;
            
            case 'resetStats':
                resetStats();
                sendResponse({ 
                    status: 'success', 
                    stats: stats,
                    message: 'Stats reset successfully' 
                });
                break;
            
            case 'startFiltering':
                isRunning = true;
                chrome.storage.local.set({ isRunning: true });
                sendResponse({ 
                    status: 'started',
                    message: 'Spam filtering activated' 
                });
                break;
            
            case 'stopFiltering':
                isRunning = false;
                chrome.storage.local.set({ isRunning: false });
                sendResponse({ 
                    status: 'stopped',
                    message: 'Spam filtering deactivated' 
                });
                break;
            
            case 'spamDetected':
                updateStats(1, 1);
                
                // Create notification
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon48.png',
                    title: 'Spam Email Detected',
                    message: `From: ${message.emailInfo.sender}\nSubject: ${message.emailInfo.subject}\nConfidence: ${message.spamCheck.confidence}%`,
                    priority: 2
                });
                
                // Log spam detection
                logMessage('Spam email detected!', 'error');
                broadcastMessage({
                    type: 'error',
                    message: 'Spam email detected!',
                    emailInfo: message.emailInfo,
                    spamCheck: message.spamCheck
                });
                break;
            
            default:
                debugLog('Unhandled Message Type', message);
                sendResponse({ 
                    status: 'error', 
                    message: 'Unrecognized action' 
                });
        }
    } catch (error) {
        debugLog('Message Handling Error', error);
        sendResponse({ 
            status: 'error', 
            message: error.toString() 
        });
    }
    
    return true; // Enable asynchronous response
}

// Handle connection from popup or content script
chrome.runtime.onConnect.addListener((port) => {
    console.log('New connection established:', port.name);
    ports.set(port.name, port);
    
    // Send initial state
    port.postMessage({
        type: 'state',
        isRunning: isRunning,
        stats: stats
    });
    
    port.onDisconnect.addListener(() => {
        console.log('Connection closed:', port.name);
        ports.delete(port.name);
    });
    
    port.onMessage.addListener((message) => {
        handleMessage(message, port);
    });
});

// Message listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    return handleMessage(message, sender, sendResponse);
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    debugLog('Extension Installed');
    chrome.storage.local.set({
        stats: { processed: 0, spam: 0 },
        isRunning: true,
        installTimestamp: Date.now()
    });
});

// Restore state on startup
chrome.runtime.onStartup.addListener(() => {
    debugLog('Extension Started');
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('mail.google.com')) {
        console.log('Gmail tab detected, enabling spam filter');
        chrome.tabs.sendMessage(tabId, { action: 'startFiltering' });
    }
});

logMessage('Background script loaded successfully');
