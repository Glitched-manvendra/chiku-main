// CryptoTracker - Coin Details Page

(function() {
  'use strict';
  
  const { API, Format, DOM, URLUtils, RateLimitError, AbortError, stripHTML } = window.CryptoTracker;
  
  // ============ State ============
  const state = {
    coinId: null,
    coinData: null,
    isLoading: false
  };
  
  // ============ DOM Elements ============
  const elements = {
    loadingState: document.getElementById('loading-state'),
    coinContent: document.getElementById('coin-content'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    
    // Coin elements
    coinImage: document.getElementById('coin-image'),
    coinName: document.getElementById('coin-name'),
    coinSymbol: document.getElementById('coin-symbol'),
    coinPrice: document.getElementById('coin-price'),
    coinChange: document.getElementById('coin-change'),
    
    // Stats
    statMarketcap: document.getElementById('stat-marketcap'),
    statHigh: document.getElementById('stat-high'),
    statLow: document.getElementById('stat-low'),
    statVolume: document.getElementById('stat-volume'),
    
    // Description
    descriptionSection: document.getElementById('description-section'),
    coinDescription: document.getElementById('coin-description'),
    
    // Links
    websiteLink: document.getElementById('website-link')
  };
  
  // ============ API ============
  async function fetchCoinDetails(id) {
    const endpoint = `/coins/${encodeURIComponent(id)}`;
    return API.fetch(endpoint, { key: 'coin-details' });
  }
  
  // ============ Rendering ============
  function renderCoin(coin) {
    // Update page title
    document.title = `${coin.name} (${coin.symbol.toUpperCase()}) - CryptoTracker`;
    
    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', `${coin.name} price, market cap, and detailed information. Current price: ${Format.currency(coin.market_data?.current_price?.inr)}`);
    }
    
    // Image
    elements.coinImage.src = coin.image?.large || coin.image?.small || '';
    elements.coinImage.alt = `${coin.name} logo`;
    
    // Name and symbol
    elements.coinName.textContent = coin.name;
    elements.coinSymbol.textContent = coin.symbol.toUpperCase();
    
    // Price
    const currentPrice = coin.market_data?.current_price?.inr;
    elements.coinPrice.textContent = Format.currency(currentPrice);
    
    // 24h change
    const priceChange = coin.market_data?.price_change_percentage_24h;
    elements.coinChange.textContent = Format.percentage(priceChange);
    elements.coinChange.className = `coin-change ${priceChange >= 0 ? 'positive' : 'negative'}`;
    
    // Stats
    elements.statMarketcap.textContent = Format.compactCurrency(coin.market_data?.market_cap?.inr);
    elements.statHigh.textContent = Format.currency(coin.market_data?.high_24h?.inr);
    elements.statLow.textContent = Format.currency(coin.market_data?.low_24h?.inr);
    elements.statVolume.textContent = Format.compactCurrency(coin.market_data?.total_volume?.inr);
    
    // Description (sanitized)
    const rawDescription = coin.description?.en || '';
    if (rawDescription) {
      // Strip HTML tags for security, keep plain text
      const cleanDescription = stripHTML(rawDescription);
      // Truncate if too long
      const truncated = cleanDescription.length > 800 
        ? cleanDescription.substring(0, 800) + '...' 
        : cleanDescription;
      elements.coinDescription.textContent = truncated;
      DOM.show(elements.descriptionSection);
    } else {
      DOM.hide(elements.descriptionSection);
    }
    
    // Official website
    const homepage = coin.links?.homepage?.[0];
    if (homepage && isValidURL(homepage)) {
      elements.websiteLink.href = homepage;
      DOM.show(elements.websiteLink);
    } else {
      DOM.hide(elements.websiteLink);
    }
  }
  
  // ============ Loading States ============
  function showLoading() {
    state.isLoading = true;
    DOM.show(elements.loadingState);
    DOM.hide(elements.coinContent);
    DOM.hide(elements.errorState);
  }
  
  function hideLoading() {
    state.isLoading = false;
    DOM.hide(elements.loadingState);
  }
  
  function showContent() {
    hideLoading();
    DOM.show(elements.coinContent);
    DOM.hide(elements.errorState);
  }
  
  function showError(message) {
    hideLoading();
    DOM.hide(elements.coinContent);
    DOM.show(elements.errorState);
    elements.errorMessage.textContent = message;
  }
  
  // ============ Data Loading ============
  async function loadCoinData() {
    if (!state.coinId) {
      showError('No coin ID provided. Please go back and select a coin.');
      return;
    }
    
    showLoading();
    
    try {
      const coin = await fetchCoinDetails(state.coinId);
      state.coinData = coin;
      renderCoin(coin);
      showContent();
      
    } catch (error) {
      if (error instanceof RateLimitError) {
        showError('Rate limit exceeded. Please wait a moment and try again.');
      } else if (error instanceof AbortError) {
        // Request was cancelled, do nothing
      } else if (error.message?.includes('404')) {
        showError(`Coin "${state.coinId}" not found. It may have been delisted.`);
      } else {
        showError(error.message || 'Failed to load coin data. Please try again.');
      }
    }
  }
  
  // ============ Utilities ============
  function isValidURL(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  // ============ Event Listeners ============
  function bindEvents() {
    elements.retryBtn.addEventListener('click', loadCoinData);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      API.cancelAll();
    });
  }
  
  // ============ Initialize ============
  function init() {
    // Get coin ID from URL
    state.coinId = URLUtils.getParam('id');
    
    if (!state.coinId) {
      showError('No coin ID provided. Please go back and select a coin.');
      return;
    }
    
    bindEvents();
    loadCoinData();
  }
  
  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
