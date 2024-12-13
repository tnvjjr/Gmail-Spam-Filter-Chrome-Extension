console.log('Gmail Spam Filter: Content script loaded');

// Initialize state variables
let isFilteringEnabled = true;
let observer = null;
let port = null;
let isExtensionValid = true;

// Function to establish connection with background script
function connectToBackground() {
    try {
        port = chrome.runtime.connect({ name: 'gmail-spam-filter' });
        
        port.onDisconnect.addListener(() => {
            console.log('[CONTENT] Port disconnected, attempting reconnection...');
            isExtensionValid = false;
            setTimeout(reconnect, 1000);
        });
        
        isExtensionValid = true;
        console.log('[CONTENT] Connected to background script');
    } catch (error) {
        console.error('[CONTENT] Connection failed:', error);
        isExtensionValid = false;
    }
}

// Function to attempt reconnection
function reconnect() {
    if (!isExtensionValid) {
        try {
            connectToBackground();
        } catch (error) {
            console.error('[CONTENT] Reconnection failed:', error);
            setTimeout(reconnect, 1000);
        }
    }
}

// Enhanced stats update function with retry mechanism
function updateStats(isSpam = false) {
    if (!isExtensionValid) {
        console.log('[CONTENT] Extension invalid, queuing stats update');
        setTimeout(() => updateStats(isSpam), 1000);
        return;
    }
    
    console.log('[CONTENT] Updating stats', { isSpam });
    
    try {
        chrome.runtime.sendMessage({
            action: 'updateStats',
            processed: 1,
            spam: isSpam ? 1 : 0
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[CONTENT] Stats update error', chrome.runtime.lastError);
                isExtensionValid = false;
                setTimeout(() => updateStats(isSpam), 1000);
                return;
            }
            
            if (response?.success) {
                console.log('[CONTENT] Stats updated successfully', response.stats);
            }
        });
    } catch (error) {
        console.error('[CONTENT] Stats update failed', error);
        isExtensionValid = false;
        setTimeout(() => updateStats(isSpam), 1000);
    }
}

// Function to initialize the extension
function initialize() {
    console.log('[CONTENT] Initializing extension...');
    
    try {
        // Connect to background script
        connectToBackground();
        
        // Check initial state
        chrome.storage.local.get(['isEnabled'], (result) => {
            if (chrome.runtime.lastError) {
                console.error('[CONTENT] Storage access error:', chrome.runtime.lastError);
                return;
            }
            
            isFilteringEnabled = result.isEnabled !== false;
            console.log('[CONTENT] Initial filtering state:', isFilteringEnabled);
            
            // Start observing after initialization
            if (isFilteringEnabled) {
                startObserving();
            }
        });
        
        // Listen for messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'toggleFilter') {
                isFilteringEnabled = message.enabled;
                if (isFilteringEnabled) {
                    startObserving();
                } else {
                    stopObserving();
                }
                sendResponse({ success: true });
            }
        });
        
    } catch (error) {
        console.error('[CONTENT] Initialization failed:', error);
        isExtensionValid = false;
        setTimeout(initialize, 1000);
    }
}

// Enhanced cleanup function
function stopObserving() {
    console.log('[CONTENT] Stopping observation...');
    
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    
    // Remove all labels and styling
    try {
        document.querySelectorAll('tr[role="row"]').forEach(row => {
            row.style.backgroundColor = '';
            const label = row.querySelector('.label-container');
            if (label) {
                label.remove();
            }
            delete row.dataset.processed;
            delete row.dataset.lastProcessed;
        });
    } catch (error) {
        console.error('[CONTENT] Cleanup error:', error);
    }
}

// Function to inject custom styles
function injectCustomStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Spam Label Styling */
        .spam-ham-label {
            position: absolute !important;
            right: 10px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            z-index: 100 !important;
            
            /* Enhanced Label Design */
            background-color: rgba(255, 68, 68, 0.95) !important;
            color: white !important;
            padding: 4px 10px !important;
            border-radius: 16px !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.5px !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            transition: all 0.3s ease !important;
            min-width: 70px !important;
            text-align: center !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }

        /* Ham Label Styling */
        .ham-label {
            background-color: rgba(76, 175, 80, 0.95) !important;
        }

        /* Dismiss Button Styling */
        .dismiss-button {
            position: absolute !important;
            right: -25px !important;
            top: 50% !important;
            transform: translateY(-50%) !important;
            width: 24px !important;
            height: 24px !important;
            background-color: rgba(255, 255, 255, 0.9) !important;
            color: red !important;
            border: 1px solid rgba(255, 0, 0, 0.2) !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer !important;
            opacity: 0 !important;
            transition: all 0.3s ease !important;
            font-size: 16px !important;
            font-weight: bold !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
        }

        /* Dismiss Button Hover and Active States */
        .dismiss-button:hover {
            background-color: rgba(255, 0, 0, 0.1) !important;
            border-color: rgba(255, 0, 0, 0.4) !important;
            transform: translateY(-50%) scale(1.1) !important;
        }

        .dismiss-button:active {
            background-color: rgba(255, 0, 0, 0.2) !important;
            transform: translateY(-50%) scale(0.95) !important;
        }

        /* Show dismiss button on row hover */
        tr[role="row"]:hover .dismiss-button {
            opacity: 1 !important;
        }

        /* Ensure parent container supports absolute positioning */
        tr[role="row"] {
            position: relative !important;
        }
    `;
    document.head.appendChild(styleElement);
}

injectCustomStyles();

// Function to check if text contains spam patterns
function checkForSpam(text) {
    // Convert text to lowercase for case-insensitive matching
    const lowercaseText = text.toLowerCase();

    // Comprehensive and aggressive spam pattern categories
    const spamPatterns = {
        extremelyHighRiskPatterns: [
            // Ultra-high confidence spam indicators
            /\b(you have won|congratulations winner|claim your prize)\b/i,
            /\b(wire transfer.*processing fee)\b/i,
            /\b(nigerian bank|prince|royal family)\b/i,
            /\b(urgent.*offer expires)\b/i,
            /\b(act now|limited time)\b/i,
            /\b(unclaimed millions|inheritance)\b/i
        ],
        financialScams: [
            // Advanced financial fraud indicators
            /\b(urgent transfer|wire transfer|inheritance|unclaimed funds|dormant account)\b/i,
            /\b(bank transfer|swift code|routing number|account verification)\b/i,
            /\b(financial opportunity|guaranteed returns|risk-free investment)\b/i,
            /\b(millions of dollars|unexpected windfall)\b/i,
            /\b(offshore account|tax-free|money laundering)\b/i,
            /\b(prince|royal family|diplomat|foreign official)\b/i
        ],
        urgentActionScams: [
            // Pressure and urgency tactics
            /\b(immediate action required|urgent|time-sensitive|act now)\b/i,
            /\b(last chance|limited time|expires soon|final warning)\b/i,
            /\b(account suspended|security breach|unauthorized access)\b/i,
            /\b(verify immediately|confirm now|update required)\b/i
        ],
        suspiciousLanguage: [
            // Manipulative and suspicious language patterns
            /\b(dear winner|congratulations|selected|chosen)\b/i,
            /\b(no risk|guaranteed|100% sure|absolutely)\b/i,
            /\b(click here|visit site|claim now)\b/i,
            /\b(processing fee|small payment|verification charge)\b/i
        ]
    };

    // Combine all pattern arrays
    const allPatterns = Object.values(spamPatterns).flat();

    // Track matched patterns with weighted scoring
    const matches = [];
    const weightedScores = {
        extremelyHighRiskPatterns: 30,  // Highest weight
        financialScams: 20,
        urgentActionScams: 15,
        suspiciousLanguage: 10
    };

    let totalScore = 0;

    // Check for pattern matches with weighted scoring
    Object.entries(spamPatterns).forEach(([category, patterns]) => {
        patterns.forEach(pattern => {
            if (pattern.test(lowercaseText)) {
                matches.push(pattern.source);
                totalScore += weightedScores[category];
            }
        });
    });

    // Additional aggressive contextual scoring
    const contextualScoring = {
        urgentLanguage: /\b(urgent|immediately|now|today|final|last chance)\b/i.test(lowercaseText) ? 15 : 0,
        financialPressure: /\b(money|payment|transfer|funds|dollars)\b/i.test(lowercaseText) ? 10 : 0,
        suspiciousContact: /\b(prince|bank officer|diplomat|agent)\b/i.test(lowercaseText) ? 15 : 0,
        excessiveClaims: /\b(million|billion|guaranteed|100%)\b/i.test(lowercaseText) ? 10 : 0
    };

    // Calculate spam probability with aggressive scoring
    const contextualScore = Object.values(contextualScoring).reduce((a, b) => a + b, 0);
    
    // Extremely aggressive spam probability calculation
    const spamProbability = Math.min(
        99, // Cap at 99% to allow a tiny chance of false positive
        totalScore + contextualScore + (matches.length * 5)
    );

    // Update statistics for every processed email
    updateStats(spamProbability > 70);

    return {
        isSpam: spamProbability > 70, // Much higher threshold
        spamProbability: Math.round(spamProbability),
        hamProbability: 100 - Math.round(spamProbability),
        matches: matches
    };
}

// Enhanced logging for spam detection
function logSpamDetection(text, result) {
    if (result.isSpam) {
        console.log('🚨 SPAM DETECTED 🚨', {
            text: text,
            probability: result.spamProbability + '%',
            matchedPatterns: result.matches
        });
    }
}

// Modified createProbabilityLabel function
function createProbabilityLabel(spamCheck) {
    const labelContainer = document.createElement('div');
    labelContainer.className = 'label-container';
    
    const label = document.createElement('div');
    const isSpam = spamCheck.spamProbability > 50;
    
    label.className = `spam-ham-label ${isSpam ? 'spam-label' : 'ham-label'}`;
    
    // Create label text with percentage
    const percentage = Math.round(isSpam ? spamCheck.spamProbability : spamCheck.hamProbability);
    label.textContent = isSpam ? `SPAM ${percentage}%` : `HAM ${percentage}%`;
    
    // Create dismiss button
    const dismissButton = document.createElement('div');
    dismissButton.className = 'dismiss-button';
    dismissButton.innerHTML = '×';
    dismissButton.title = 'Dismiss warning';
    
    // Dismiss button click handler
    dismissButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent email selection
        
        const row = label.closest('tr[role="row"]');
        if (row) {
            // Remove the label
            labelContainer.remove();
            
            // Reset row styling
            row.style.backgroundColor = '';
            
            // Get email thread ID
            const threadId = row.getAttribute('data-thread-id');
            
            // Store dismissed email in Chrome storage
            if (threadId) {
                chrome.storage.local.get(['dismissedEmails'], (result) => {
                    const dismissedEmails = result.dismissedEmails || {};
                    dismissedEmails[threadId] = Date.now();
                    
                    // Limit stored dismissed emails (remove entries older than 30 days)
                    const cleanedDismissedEmails = Object.fromEntries(
                        Object.entries(dismissedEmails)
                            .filter(([_, timestamp]) => 
                                Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000 // 30 days
                            )
                    );
                    
                    chrome.storage.local.set({ 
                        dismissedEmails: cleanedDismissedEmails 
                    });
                });
            }
            
            // Mark row as dismissed
            row.dataset.warningDismissed = 'true';
        }
    });
    
    // Add dismiss button to label
    label.appendChild(dismissButton);
    labelContainer.appendChild(label);
    
    return labelContainer;
}

// Modify processEmailRow to respect previously dismissed emails
function processEmailRow(row) {
    // Skip if filtering is disabled
    if (!isFilteringEnabled) {
        return;
    }
    
    // Get email thread ID
    const threadId = row.getAttribute('data-thread-id');
    
    // Check if email was previously dismissed
    if (threadId) {
        chrome.storage.local.get(['dismissedEmails'], (result) => {
            const dismissedEmails = result.dismissedEmails || {};
            
            // If email was dismissed less than 30 days ago, skip processing
            if (dismissedEmails[threadId] && 
                (Date.now() - dismissedEmails[threadId]) < 30 * 24 * 60 * 60 * 1000) {
                return;
            }
            
            // Continue with spam processing
            continueProcessing(row);
        });
    } else {
        // If no thread ID, proceed with processing
        continueProcessing(row);
    }
}

// Existing processing logic
function continueProcessing(row) {
    // Skip if already processed recently
    const lastProcessed = parseInt(row.dataset.lastProcessed || '0');
    if (lastProcessed && Date.now() - lastProcessed < 60000) { // Don't reprocess within 1 minute
        return;
    }
    
    // Get email content
    const subject = row.querySelector('[data-thread-id]')?.textContent || '';
    const preview = row.querySelector('.y2')?.textContent || '';
    const sender = row.querySelector('.yP, .zF')?.textContent || '';
    
    // Only process if we have some content
    if (!subject && !preview && !sender) {
        return;
    }
    
    // Combine text for spam check
    const fullText = `${sender} ${subject} ${preview}`;
    const spamCheck = checkForSpam(fullText);
    
    // Remove any existing labels
    row.querySelector('.label-container')?.remove();
    
    // Create and add new label
    const label = createProbabilityLabel(spamCheck);
    if (label) {
        const firstCell = row.querySelector('td');
        if (firstCell) {
            firstCell.appendChild(label);
        }
    }
    
    // Update background color for spam
    if (spamCheck.isSpam) {
        const opacity = (spamCheck.spamProbability / 200) * 0.5;
        row.style.backgroundColor = `rgba(255, 68, 68, ${opacity})`;
    } else {
        row.style.backgroundColor = '';
    }
    
    // Mark as processed and update timestamp
    row.dataset.lastProcessed = Date.now().toString();
    
    // Update stats
    updateStats(spamCheck.isSpam);
}

// Function to add dismiss functionality to existing labels
function addDismissToExistingLabels() {
    console.log('Adding dismiss buttons to labels');
    
    // Use a more robust selector to find labels
    const existingLabels = document.querySelectorAll('.spam-ham-label, .spam-label, .ham-label');
    
    console.log(`Found ${existingLabels.length} labels to add dismiss buttons`);
    
    existingLabels.forEach((label, index) => {
        // Ensure the label doesn't already have a dismiss button
        if (!label.querySelector('.dismiss-button')) {
            const dismissButton = document.createElement('div');
            dismissButton.className = 'dismiss-button';
            dismissButton.innerHTML = '×';
            dismissButton.title = 'Dismiss warning';
            
            // Add a unique identifier for debugging
            dismissButton.dataset.dismissIndex = index;
            
            dismissButton.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`Dismiss button clicked for label index ${index}`);
                
                const row = label.closest('tr[role="row"]');
                if (row) {
                    // Try multiple ways to remove the label
                    try {
                        // First, try removing the label container
                        const labelContainer = label.closest('.label-container');
                        if (labelContainer) {
                            console.log('Removing label container');
                            labelContainer.remove();
                        } else {
                            // If no container, remove the label directly
                            console.log('Removing label directly');
                            label.remove();
                        }
                        
                        // Reset row styling
                        row.style.backgroundColor = '';
                        row.dataset.warningDismissed = 'true';
                        
                        // Subtle animation
                        row.style.transition = 'opacity 0.3s ease';
                        row.style.opacity = '0.7';
                        setTimeout(() => {
                            row.style.opacity = '1';
                        }, 300);
                    } catch (error) {
                        console.error('Error removing label:', error);
                    }
                } else {
                    console.warn('No row found for label');
                }
            });
            
            // Append dismiss button to the label
            label.appendChild(dismissButton);
            console.log(`Added dismiss button to label index ${index}`);
        } else {
            console.log(`Dismiss button already exists for label index ${index}`);
        }
    });
}

// Ensure dismiss buttons are added after page load and on dynamic content changes
function setupDismissButtons() {
    console.log('Setting up dismiss buttons');
    
    // Add buttons immediately
    addDismissToExistingLabels();
    
    // Use a MutationObserver to add buttons to dynamically loaded content
    const observer = new MutationObserver((mutations) => {
        let labelsAdded = false;
        
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const newLabels = node.querySelectorAll('.spam-ham-label, .spam-label, .ham-label');
                        if (newLabels.length > 0) {
                            labelsAdded = true;
                        }
                    }
                });
            }
        });
        
        if (labelsAdded) {
            console.log('New labels detected, adding dismiss buttons');
            addDismissToExistingLabels();
        }
    });
    
    // Configure the observer
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Call setup function when script loads
setupDismissButtons();

// Initialize: check if filtering should be enabled
chrome.storage.local.get('isRunning', (data) => {
    if (data.isRunning) {
        isFilteringEnabled = true;
        startObserving();
    }
});

// Periodic stats update to ensure communication
function initializeStatsTracking() {
    console.log('[CONTENT] Initializing stats tracking');
    
    // Initial stats update
    updateStats(false);
    
    // Periodic update
    setInterval(() => {
        console.log('[CONTENT] Periodic stats update');
        updateStats(false);
    }, 10000);
}

// Call initialization on script load
initializeStatsTracking();

// Enhanced observer setup
function startObserving() {
    if (observer) {
        observer.disconnect();
    }
    
    // Process existing rows
    document.querySelectorAll('tr[role="row"]').forEach(row => {
        processEmailRow(row);
    });
    
    // Set up new observer with improved handling
    observer = new MutationObserver((mutations) => {
        const now = Date.now();
        
        mutations.forEach(mutation => {
            // Handle added nodes
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Element node
                    if (node.matches('tr[role="row"]')) {
                        processEmailRow(node);
                    }
                    // Also check children for rows
                    node.querySelectorAll('tr[role="row"]').forEach(row => {
                        processEmailRow(row);
                    });
                }
            });
            
            // Handle modified nodes
            if (mutation.type === 'attributes' && mutation.target.matches('tr[role="row"]')) {
                const row = mutation.target;
                const lastProcessed = parseInt(row.dataset.processed || '0');
                
                // Reprocess if it's been more than 5 seconds since last processing
                if (now - lastProcessed > 5000) {
                    processEmailRow(row);
                }
            }
        });
    });
    
    // Observe both immediate changes and subtree changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-thread-id']
    });
    
    // Set up periodic check for missing labels
    setInterval(() => {
        document.querySelectorAll('tr[role="row"]').forEach(row => {
            const lastProcessed = parseInt(row.dataset.processed || '0');
            const hasLabel = row.querySelector('.label-container');
            
            // Reprocess if no label or not processed in the last minute
            if (!hasLabel || Date.now() - lastProcessed > 60000) {
                processEmailRow(row);
            }
        });
    }, 5000); // Check every 5 seconds
}

// Initialize the extension
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
