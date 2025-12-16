// CryptoTracker - Markets Page

(function() {
  'use strict';
  
  const { API, Format, DOM, Skeleton, debounce, RateLimitError, AbortError } = window.CryptoTracker;
  
  // ============ State ============
  const state = {
    coins: [],           // All loaded coins
    filteredCoins: [],   // Filtered by search
    currentPage: 1,      // Current page loaded
    perPage: 50,         // Coins per page
    searchQuery: '',     // Current search query
    isLoading: false,
    hasMore: true,
    lastUpdated: null,
    
    // Polling state
    pollInterval: 45000,     // Default 45s
    minPollInterval: 30000,  // Never faster than 30s
    maxPollInterval: 300000, // Max 5 minutes on rate limit
    pollTimer: null,
    isRateLimited: false,
    backoffMultiplier: 1
  };
  
  // ============ DOM Elements ============
  const elements = {
    tableBody: document.getElementById('crypto-table-body'),
    loadingSkeleton: document.getElementById('loading-skeleton'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    loadMoreWrapper: document.getElementById('load-more-wrapper'),
    searchInput: document.getElementById('search-input'),
    lastUpdated: document.getElementById('last-updated'),
    liveIndicator: document.getElementById('live-indicator'),
    rateLimitWarning: document.getElementById('rate-limit-warning'),
    rateLimitMessage: document.getElementById('rate-limit-message')
  };
  
  // ============ API ============
  async function fetchCoinsPage(page) {
    const endpoint = `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${state.perPage}&page=${page}&sparkline=false`;
    return API.fetch(endpoint, { key: `markets-page-${page}` });
  }
  
  async function fetchAllLoadedPages() {
    const promises = [];
    for (let i = 1; i <= state.currentPage; i++) {
      promises.push(fetchCoinsPage(i).catch(err => {
        console.warn(`Failed to fetch page ${i}:`, err.message);
        return null;
      }));
    }
    
    const results = await Promise.all(promises);
    return results.filter(Boolean).flat();
  }
  
  // ============ Rendering ============
  function createCoinRow(coin) {
    const row = document.createElement('tr');
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'row');
    row.setAttribute('data-coin-id', coin.id);
    row.setAttribute('aria-label', `${coin.name}, Price: ${Format.currency(coin.current_price)}, 24h change: ${Format.percentage(coin.price_change_percentage_24h)}`);
    
    const priceChangeClass = coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative';
    
    row.innerHTML = `
      <td>
        <span class="coin-rank">${coin.market_cap_rank || '-'}</span>
      </td>
      <td>
        <div class="coin-cell">
          <img 
            class="coin-icon" 
            src="${coin.image}" 
            alt="" 
            loading="lazy"
            onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect fill=%22%23374151%22 width=%2232%22 height=%2232%22 rx=%2216%22/></svg>'"
          >
          <div class="coin-info">
            <span class="coin-name">${escapeHTML(coin.name)}</span>
            <span class="coin-symbol">${escapeHTML(coin.symbol)}</span>
          </div>
        </div>
      </td>
      <td>
        <span class="coin-price">${Format.currency(coin.current_price)}</span>
      </td>
      <td>
        <span class="coin-change ${priceChangeClass}">${Format.percentage(coin.price_change_percentage_24h)}</span>
      </td>
      <td>
        <span class="coin-marketcap">${Format.compactCurrency(coin.market_cap)}</span>
      </td>
    `;
    
    // Click handler
    row.addEventListener('click', () => navigateToCoin(coin.id));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToCoin(coin.id);
      }
    });
    
    return row;
  }
  
  function renderCoins(coins, append = false) {
    if (!append) {
      DOM.clear(elements.tableBody);
    }
    
    const fragment = document.createDocumentFragment();
    coins.forEach(coin => {
      fragment.appendChild(createCoinRow(coin));
    });
    
    elements.tableBody.appendChild(fragment);
  }
  
  function updateCoinRow(coin) {
    const existingRow = elements.tableBody.querySelector(`tr[data-coin-id="${coin.id}"]`);
    if (!existingRow) return false;
    
    // Update price
    const priceEl = existingRow.querySelector('.coin-price');
    if (priceEl) priceEl.textContent = Format.currency(coin.current_price);
    
    // Update change
    const changeEl = existingRow.querySelector('.coin-change');
    if (changeEl) {
      changeEl.textContent = Format.percentage(coin.price_change_percentage_24h);
      changeEl.className = `coin-change ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}`;
    }
    
    // Update market cap
    const mcapEl = existingRow.querySelector('.coin-marketcap');
    if (mcapEl) mcapEl.textContent = Format.compactCurrency(coin.market_cap);
    
    // Update rank
    const rankEl = existingRow.querySelector('.coin-rank');
    if (rankEl) rankEl.textContent = coin.market_cap_rank || '-';
    
    // Update aria-label
    existingRow.setAttribute('aria-label', `${coin.name}, Price: ${Format.currency(coin.current_price)}, 24h change: ${Format.percentage(coin.price_change_percentage_24h)}`);
    
    return true;
  }
  
  function mergeUpdates(newCoins) {
    const coinMap = new Map(state.coins.map(c => [c.id, c]));
    
    newCoins.forEach(newCoin => {
      coinMap.set(newCoin.id, newCoin);
    });
    
    state.coins = Array.from(coinMap.values());
    
    // Re-sort by market cap rank
    state.coins.sort((a, b) => (a.market_cap_rank || 9999) - (b.market_cap_rank || 9999));
    
    // Update displayed rows (don't rebuild entire DOM)
    newCoins.forEach(coin => {
      updateCoinRow(coin);
    });
    
    // Apply current filter
    applyFilter();
  }
  
  function applyFilter() {
    const query = state.searchQuery.toLowerCase().trim();
    
    if (!query) {
      state.filteredCoins = [...state.coins];
    } else {
      state.filteredCoins = state.coins.filter(coin => 
        coin.name.toLowerCase().includes(query) ||
        coin.symbol.toLowerCase().includes(query)
      );
    }
    
    renderCoins(state.filteredCoins);
    
    // Show/hide load more based on filter
    if (query) {
      DOM.hide(elements.loadMoreWrapper);
    } else {
      elements.loadMoreWrapper.style.display = state.hasMore ? '' : 'none';
    }
  }
  
  // ============ Loading States ============
  function showLoading() {
    state.isLoading = true;
    DOM.hide(elements.errorState);
    
    if (state.coins.length === 0) {
      // Show skeleton only on initial load
      elements.loadingSkeleton.innerHTML = '';
      elements.loadingSkeleton.appendChild(Skeleton.createTableRows(10));
      DOM.show(elements.loadingSkeleton);
      DOM.hide(elements.tableBody);
    }
    
    elements.loadMoreBtn.disabled = true;
    elements.loadMoreBtn.textContent = 'Loading...';
  }
  
  function hideLoading() {
    state.isLoading = false;
    DOM.hide(elements.loadingSkeleton);
    DOM.show(elements.tableBody);
    
    elements.loadMoreBtn.disabled = false;
    elements.loadMoreBtn.textContent = 'Load More';
  }
  
  function showError(message) {
    DOM.hide(elements.loadingSkeleton);
    DOM.hide(elements.tableBody);
    DOM.show(elements.errorState);
    elements.errorMessage.textContent = message;
    DOM.hide(elements.loadMoreWrapper);
  }
  
  function hideError() {
    DOM.hide(elements.errorState);
    DOM.show(elements.tableBody);
  }
  
  function updateLastUpdated() {
    state.lastUpdated = new Date();
    elements.lastUpdated.textContent = `Last updated: ${Format.time(state.lastUpdated)}`;
  }
  
  function showRateLimitWarning(seconds) {
    state.isRateLimited = true;
    elements.rateLimitMessage.textContent = `Rate limited. Retrying in ${Math.round(seconds)}s...`;
    DOM.show(elements.rateLimitWarning);
    elements.liveIndicator.querySelector('.live-dot').style.background = 'var(--danger)';
  }
  
  function hideRateLimitWarning() {
    state.isRateLimited = false;
    DOM.hide(elements.rateLimitWarning);
    elements.liveIndicator.querySelector('.live-dot').style.background = '';
  }
  
  // ============ Data Loading ============
  async function loadInitialData() {
    showLoading();
    
    try {
      const coins = await fetchCoinsPage(1);
      state.coins = coins;
      state.filteredCoins = coins;
      state.hasMore = coins.length === state.perPage;
      
      hideError();
      renderCoins(coins);
      updateLastUpdated();
      hideLoading();
      
      // Reset rate limit state on success
      state.backoffMultiplier = 1;
      hideRateLimitWarning();
      
      // Start polling
      startPolling();
      
    } catch (error) {
      hideLoading();
      
      if (error instanceof RateLimitError) {
        handleRateLimit();
      } else if (!(error instanceof AbortError)) {
        showError(error.message || 'Failed to load cryptocurrency data');
      }
    }
  }
  
  async function loadMoreCoins() {
    if (state.isLoading || !state.hasMore) return;
    
    showLoading();
    state.currentPage++;
    
    try {
      const coins = await fetchCoinsPage(state.currentPage);
      
      if (coins.length === 0) {
        state.hasMore = false;
      } else {
        state.coins = [...state.coins, ...coins];
        state.hasMore = coins.length === state.perPage;
        applyFilter();
      }
      
      hideLoading();
      
      // Reset rate limit state on success
      state.backoffMultiplier = 1;
      hideRateLimitWarning();
      
    } catch (error) {
      state.currentPage--; // Revert page increment
      hideLoading();
      
      if (error instanceof RateLimitError) {
        handleRateLimit();
      } else if (!(error instanceof AbortError)) {
        console.error('Load more error:', error);
      }
    }
  }
  
  // ============ Polling ============
  function startPolling() {
    stopPolling();
    
    const poll = async () => {
      if (state.isLoading) return;
      
      try {
        const coins = await fetchAllLoadedPages();
        
        if (coins.length > 0) {
          mergeUpdates(coins);
          updateLastUpdated();
          
          // Reset backoff on success
          state.backoffMultiplier = 1;
          hideRateLimitWarning();
        }
        
      } catch (error) {
        if (error instanceof RateLimitError) {
          handleRateLimit();
          return; // Don't schedule next poll, handleRateLimit does it
        } else if (!(error instanceof AbortError)) {
          console.warn('Poll error:', error.message);
        }
      }
      
      // Schedule next poll
      scheduleNextPoll();
    };
    
    // Initial delay before first poll
    scheduleNextPoll();
  }
  
  function scheduleNextPoll() {
    stopPolling();
    
    const interval = Math.min(
      state.pollInterval * state.backoffMultiplier,
      state.maxPollInterval
    );
    
    state.pollTimer = setTimeout(async () => {
      if (state.isLoading) return;
      
      try {
        const coins = await fetchAllLoadedPages();
        
        if (coins.length > 0) {
          mergeUpdates(coins);
          updateLastUpdated();
          
          state.backoffMultiplier = 1;
          hideRateLimitWarning();
        }
        
        scheduleNextPoll();
        
      } catch (error) {
        if (error instanceof RateLimitError) {
          handleRateLimit();
        } else if (!(error instanceof AbortError)) {
          console.warn('Poll error:', error.message);
          scheduleNextPoll();
        }
      }
    }, interval);
  }
  
  function stopPolling() {
    if (state.pollTimer) {
      clearTimeout(state.pollTimer);
      state.pollTimer = null;
    }
  }
  
  function handleRateLimit() {
    state.backoffMultiplier = Math.min(state.backoffMultiplier * 2, 10);
    
    const nextInterval = Math.min(
      state.pollInterval * state.backoffMultiplier,
      state.maxPollInterval
    );
    
    showRateLimitWarning(nextInterval / 1000);
    
    // Schedule retry with backoff
    scheduleNextPoll();
  }
  
  // ============ Navigation ============
  function navigateToCoin(coinId) {
    window.location.href = `coin.html?id=${encodeURIComponent(coinId)}`;
  }
  
  // ============ Search ============
  const handleSearch = debounce((query) => {
    state.searchQuery = query;
    applyFilter();
  }, 250);
  
  // ============ Utilities ============
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  // ============ Event Listeners ============
  function bindEvents() {
    // Search
    elements.searchInput.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });
    
    // Load more
    elements.loadMoreBtn.addEventListener('click', loadMoreCoins);
    
    // Retry
    elements.retryBtn.addEventListener('click', () => {
      state.currentPage = 1;
      state.coins = [];
      state.backoffMultiplier = 1;
      hideError();
      loadInitialData();
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      stopPolling();
      API.cancelAll();
    });
    
    // Pause polling when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopPolling();
      } else {
        // Resume polling after tab becomes visible
        if (!state.isRateLimited) {
          scheduleNextPoll();
        }
      }
    });
  }
  
  // ============ Initialize ============
  function init() {
    bindEvents();
    loadInitialData();
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
