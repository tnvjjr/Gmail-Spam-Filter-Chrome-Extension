// Connect to background script
let port = chrome.runtime.connect({ name: 'gmail-spam-filter' });

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    const filterToggle = document.getElementById('filterToggle');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusDot = document.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('span:last-child');

    function updateStatus(enabled) {
        if (enabled) {
            statusDot.style.background = '#4f46e5';
            statusDot.style.boxShadow = '0 0 0 2px rgba(79, 70, 229, 0.2)';
            statusText.textContent = 'Protection Active';
            statusIndicator.style.background = '#f3f4f6';
            statusIndicator.style.color = '#374151';
        } else {
            statusDot.style.background = '#d1d5db';
            statusDot.style.boxShadow = '0 0 0 2px rgba(209, 213, 219, 0.2)';
            statusText.textContent = 'Protection Disabled';
            statusIndicator.style.background = '#f3f4f6';
            statusIndicator.style.color = '#6b7280';
        }
    }

    // Toggle spam filtering
    filterToggle.addEventListener('change', () => {
        const isEnabled = filterToggle.checked;
        updateStatus(isEnabled);
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleFilter',
                enabled: isEnabled
            });
        });
    });

    // Get initial state
    chrome.storage.local.get(['isEnabled'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('Failed to get state:', chrome.runtime.lastError);
            return;
        }
        const isEnabled = result.isEnabled !== false;
        filterToggle.checked = isEnabled;
        updateStatus(isEnabled);
    });
});
