// Application State
let state = {
    updates: [],
    selectedIds: new Set(),
    currentFilter: 'all',
    searchQuery: '',
    isLoading: false,
    lastFetchedTime: null
};

// DOM Elements
const DOM = {
    btnRefresh: document.getElementById('btn-refresh'),
    btnRetry: document.getElementById('btn-retry'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    btnTweetSelected: document.getElementById('btn-tweet-selected'),
    themeToggleCheckbox: document.getElementById('theme-toggle-checkbox'),
    
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterChips: document.querySelectorAll('.chip'),
    
    notesFeed: document.getElementById('notes-feed'),
    skeletonFeed: document.getElementById('skeleton-feed'),
    errorBanner: document.getElementById('error-banner'),
    errorMessage: document.getElementById('error-message'),
    emptyState: document.getElementById('empty-state'),
    
    syncStatus: document.getElementById('sync-status'),
    totalCountBadge: document.getElementById('total-count-badge'),
    totalCount: document.getElementById('total-count'),
    
    floatingToolbar: document.getElementById('floating-toolbar'),
    selectedCountText: document.getElementById('selected-count-text')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupTheme();
    setupEventListeners();
    fetchReleaseNotes(false);
});

// Setup Initial Theme Checkbox State
function setupTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (DOM.themeToggleCheckbox) {
        DOM.themeToggleCheckbox.checked = currentTheme === 'light';
    }
}

// Event Listeners
function setupEventListeners() {
    // Refresh buttons
    DOM.btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    DOM.btnRetry.addEventListener('click', () => fetchReleaseNotes(true));
    DOM.btnResetFilters.addEventListener('click', resetFilters);
    
    // Search input
    DOM.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        toggleClearSearchButton();
        renderFeed();
    });
    
    DOM.clearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        state.searchQuery = '';
        toggleClearSearchButton();
        renderFeed();
        DOM.searchInput.focus();
    });

    // Filter Chips
    DOM.filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            DOM.filterChips.forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            state.currentFilter = e.target.dataset.type;
            renderFeed();
        });
    });

    // Theme Toggle Switch
    if (DOM.themeToggleCheckbox) {
        DOM.themeToggleCheckbox.addEventListener('change', (e) => {
            const nextTheme = e.target.checked ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('theme', nextTheme);
        });
    }

    // Floating Selection Toolbar
    DOM.btnClearSelection.addEventListener('click', clearSelection);
    DOM.btnTweetSelected.addEventListener('click', tweetSelectedUpdates);
}

// Helper: Show/Hide clear button in search input
function toggleClearSearchButton() {
    if (DOM.searchInput.value.length > 0) {
        DOM.clearSearch.style.display = 'block';
    } else {
        DOM.clearSearch.style.display = 'none';
    }
}

// Reset all search and filters
function resetFilters() {
    DOM.searchInput.value = '';
    state.searchQuery = '';
    toggleClearSearchButton();
    
    DOM.filterChips.forEach(c => {
        if (c.dataset.type === 'all') c.classList.add('active');
        else c.classList.remove('active');
    });
    state.currentFilter = 'all';
    
    renderFeed();
}

// Fetch Release Notes from API
async function fetchReleaseNotes(force = false) {
    if (state.isLoading) return;
    
    // Toggle loading UI states
    setLoadingState(true);
    
    try {
        const url = `/api/release-notes${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'error') {
            throw new Error(data.message || 'Unknown error occurred while parsing the feed.');
        }
        
        state.updates = data.updates || [];
        state.lastFetchedTime = data.last_fetched;
        
        // Success states
        showError(false);
        clearSelection();
        updateStats();
        renderFeed();
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        DOM.errorMessage.textContent = error.message || 'Could not fetch release notes at this time.';
        showError(true);
    } finally {
        setLoadingState(false);
    }
}

// Toggle loading UI
function setLoadingState(loading) {
    state.isLoading = loading;
    
    const refreshIcon = DOM.btnRefresh.querySelector('svg');
    const refreshText = DOM.btnRefresh.querySelector('span');
    
    if (loading) {
        refreshIcon.classList.add('spinning');
        DOM.btnRefresh.disabled = true;
        refreshText.textContent = 'Syncing...';
        
        // Show skeletons and hide active items
        DOM.skeletonFeed.classList.remove('hidden');
        DOM.notesFeed.classList.add('hidden');
        DOM.emptyState.classList.add('hidden');
        DOM.errorBanner.classList.add('hidden');
        
        // Header status indicator
        DOM.syncStatus.querySelector('.status-indicator').className = 'status-indicator';
        DOM.syncStatus.querySelector('.status-text').textContent = 'Syncing feed...';
    } else {
        refreshIcon.classList.remove('spinning');
        DOM.btnRefresh.disabled = false;
        refreshText.textContent = 'Refresh';
        DOM.skeletonFeed.classList.add('hidden');
    }
}

// Show error screen
function showError(show) {
    if (show) {
        DOM.errorBanner.classList.remove('hidden');
        DOM.notesFeed.classList.add('hidden');
        DOM.emptyState.classList.add('hidden');
        
        DOM.syncStatus.querySelector('.status-indicator').className = 'status-indicator error';
        DOM.syncStatus.querySelector('.status-text').textContent = 'Sync failed';
    } else {
        DOM.errorBanner.classList.add('hidden');
    }
}

// Update totals and sync times in header
function updateStats() {
    if (state.updates.length > 0) {
        DOM.totalCount.textContent = state.updates.length;
        DOM.totalCountBadge.classList.remove('hidden');
        
        // Format last fetched time
        const date = new Date(state.lastFetchedTime * 1000);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        DOM.syncStatus.querySelector('.status-indicator').className = 'status-indicator live';
        DOM.syncStatus.querySelector('.status-text').textContent = `Synced at ${timeStr}`;
    } else {
        DOM.totalCountBadge.classList.add('hidden');
        DOM.syncStatus.querySelector('.status-indicator').className = 'status-indicator';
        DOM.syncStatus.querySelector('.status-text').textContent = 'No updates loaded';
    }
}

// Render feed list
function renderFeed() {
    if (state.isLoading) return;
    
    // Filter updates
    const filteredUpdates = state.updates.filter(update => {
        // Type filter
        const matchesFilter = state.currentFilter === 'all' || 
                             update.type.toLowerCase() === state.currentFilter.toLowerCase();
        
        // Search filter
        const matchesSearch = !state.searchQuery || 
                             update.text.toLowerCase().includes(state.searchQuery) ||
                             update.type.toLowerCase().includes(state.searchQuery) ||
                             update.date.toLowerCase().includes(state.searchQuery);
                             
        return matchesFilter && matchesSearch;
    });
    
    // Check if empty
    if (filteredUpdates.length === 0) {
        DOM.notesFeed.classList.add('hidden');
        DOM.emptyState.classList.remove('hidden');
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    DOM.notesFeed.classList.remove('hidden');
    
    // Build feed HTML
    DOM.notesFeed.innerHTML = '';
    
    filteredUpdates.forEach(update => {
        const isChecked = state.selectedIds.has(update.id);
        const cardClass = isChecked ? 'note-card selected' : 'note-card';
        
        const card = document.createElement('div');
        card.className = cardClass;
        card.dataset.id = update.id;
        
        // Build card HTML structure
        card.innerHTML = `
            <div class="card-select-container">
                <label class="checkbox-custom">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} data-id="${update.id}">
                    <span class="checkmark"></span>
                </label>
            </div>
            <div class="card-body">
                <div class="card-header">
                    <div class="card-meta-left">
                        <span class="type-badge ${update.type.toLowerCase()}">${update.type}</span>
                        <span class="card-date">
                            <!-- Calendar Icon SVG -->
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/>
                                <line x1="8" y1="2" x2="8" y2="6"/>
                                <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            <span>${update.date}</span>
                        </span>
                    </div>
                    <div class="card-actions">
                        <button class="btn btn-icon-only btn-tweet-card" title="Tweet this update">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                        </button>
                        <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="btn btn-icon-only" title="Open source documentation">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                        </a>
                    </div>
                </div>
                <div class="card-content">
                    ${update.html}
                </div>
            </div>
        `;
        
        // Add card event listeners
        // Checkbox click
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => handleCheckboxChange(update.id, e.target.checked));
        
        // Card Body click (allow selecting by clicking card background as long as it's not a link or button)
        card.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.card-select-container')) {
                return;
            }
            checkbox.checked = !checkbox.checked;
            handleCheckboxChange(update.id, checkbox.checked);
        });
        
        // Single Card Tweet Button
        card.querySelector('.btn-tweet-card').addEventListener('click', (e) => {
            e.stopPropagation();
            tweetSingleUpdate(update);
        });
        
        DOM.notesFeed.appendChild(card);
    });
}

// Handle Checkbox Change state
function handleCheckboxChange(id, checked) {
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    
    if (checked) {
        state.selectedIds.add(id);
        if (card) card.classList.add('selected');
    } else {
        state.selectedIds.delete(id);
        if (card) card.classList.remove('selected');
    }
    
    updateFloatingToolbar();
}

// Update floating selection toolbar status
function updateFloatingToolbar() {
    const count = state.selectedIds.size;
    
    if (count > 0) {
        DOM.selectedCountText.textContent = `${count} ${count === 1 ? 'update' : 'updates'} selected`;
        DOM.floatingToolbar.classList.add('visible');
    } else {
        DOM.floatingToolbar.classList.remove('visible');
    }
}

// Clear Selection
function clearSelection() {
    state.selectedIds.clear();
    
    // Reset checkboxes and classes in DOM
    const checkboxes = DOM.notesFeed.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    const cards = DOM.notesFeed.querySelectorAll('.note-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    updateFloatingToolbar();
}

// Helper: Truncate text nicely
function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
}

// Tweet standard intent window open
function openTwitterIntent(text) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'width=550,height=420,referrerpolicy=no-referrer');
}

// Tweet a single update
function tweetSingleUpdate(update) {
    const header = `📊 BigQuery ${update.type} • ${update.date}\n\n`;
    const footer = `\n\nDetails: ${update.link}`;
    
    // Character limits: 280 total.
    // URL takes up 23 characters.
    // Length left for text description = 280 - header length - footer details (approx 10 for label + 23 for URL)
    const baseLength = header.length + 35; // 35 accounts for space, details label, and X shortened URL
    const maxDescLength = 280 - baseLength;
    
    const desc = truncate(update.text, maxDescLength);
    const tweetText = `${header}${desc}${footer}`;
    
    openTwitterIntent(tweetText);
}

// Tweet multiple selected updates combined
function tweetSelectedUpdates() {
    if (state.selectedIds.size === 0) return;
    
    const selectedUpdates = state.updates.filter(up => state.selectedIds.has(up.id));
    
    if (selectedUpdates.length === 1) {
        tweetSingleUpdate(selectedUpdates[0]);
        return;
    }
    
    // Format Multi-tweet content
    const header = `📊 BigQuery Updates (${selectedUpdates.length} items):\n\n`;
    
    // For multiple items, we compile a list of bullet points.
    // We try to fit as much details of the bullet points as possible.
    let listContent = '';
    
    selectedUpdates.forEach((up, idx) => {
        const itemText = `• [${up.type}] ${up.text}\n`;
        listContent += itemText;
    });
    
    // We want to link to the main release notes or the first link
    const firstLink = selectedUpdates[0].link.split('#')[0]; // Go to general release notes page
    const footer = `\nDetails: ${firstLink}`;
    
    const baseLength = header.length + footer.length + 5;
    const maxListLength = 280 - baseLength;
    
    const finalContent = truncate(listContent.trim(), maxListLength);
    const tweetText = `${header}${finalContent}\n${footer}`;
    
    openTwitterIntent(tweetText);
}
