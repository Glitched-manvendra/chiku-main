// CryptoTracker - Shared JavaScript Utilities

// ============ Theme Management ============
const ThemeManager = {
  STORAGE_KEY: 'cryptotracker-theme',
  
  init() {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'dark'); // Default to dark
    
    this.setTheme(theme);
    this.bindToggle();
  },
  
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
    this.updateToggleIcon(theme);
  },
  
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  },
  
  updateToggleIcon(theme) {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    
    toggle.innerHTML = theme === 'dark' 
      ? `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
         </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
         </svg>`;
    
    toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  },
  
  bindToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => this.toggle());
    }
  }
};

// ============ API Utilities ============
const API = {
  BASE_URL: 'https://api.coingecko.com/api/v3',
  
  // Active request controllers for cancellation
  controllers: new Map(),
  
  async fetch(endpoint, options = {}) {
    const url = `${this.BASE_URL}${endpoint}`;
    const key = options.key || endpoint;
    
    // Cancel any existing request with the same key
    if (this.controllers.has(key)) {
      this.controllers.get(key).abort();
    }
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        ...options
      });
      
      this.controllers.delete(key);
      
      if (response.status === 429) {
        throw new RateLimitError('Rate limit exceeded');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      this.controllers.delete(key);
      
      if (error.name === 'AbortError') {
        throw new AbortError('Request cancelled');
      }
      
      throw error;
    }
  },
  
  cancelAll() {
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }
};

// Custom error classes
class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class AbortError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AbortError';
  }
}

// ============ Formatting Utilities ============
const Format = {
  currency(value, decimals = 2) {
    if (value === null || value === undefined) return 'N/A';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  },
  
  compactCurrency(value) {
    if (value === null || value === undefined) return 'N/A';
    
    if (value >= 1e12) return '$' + (value / 1e12).toFixed(2) + 'T';
    if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
    
    return this.currency(value);
  },
  
  percentage(value) {
    if (value === null || value === undefined) return 'N/A';
    
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  },
  
  time(date) {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date);
  }
};

// ============ DOM Utilities ============
const DOM = {
  // Create element with attributes
  create(tag, attributes = {}, children = []) {
    const el = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'textContent') {
        el.textContent = value;
      } else if (key === 'innerHTML') {
        // Sanitize HTML content
        el.textContent = value; // Default to text
      } else if (key.startsWith('data-')) {
        el.setAttribute(key, value);
      } else if (key.startsWith('aria-')) {
        el.setAttribute(key, value);
      } else {
        el[key] = value;
      }
    });
    
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child) {
        el.appendChild(child);
      }
    });
    
    return el;
  },
  
  // Safely set text content (sanitized)
  setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  },
  
  // Remove all children
  clear(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  },
  
  // Show/hide elements
  show(element) {
    if (element) element.style.display = '';
  },
  
  hide(element) {
    if (element) element.style.display = 'none';
  }
};

// ============ Skeleton Loaders ============
const Skeleton = {
  createTableRow() {
    const row = document.createElement('div');
    row.className = 'skeleton-row';
    row.innerHTML = `
      <div class="skeleton skeleton-icon"></div>
      <div style="flex: 1;">
        <div class="skeleton skeleton-text" style="width: 120px; margin-bottom: 4px;"></div>
        <div class="skeleton skeleton-text-sm" style="width: 60px;"></div>
      </div>
      <div class="skeleton skeleton-text" style="width: 80px;"></div>
      <div class="skeleton skeleton-text" style="width: 60px;"></div>
    `;
    return row;
  },
  
  createTableRows(count = 10) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      fragment.appendChild(this.createTableRow());
    }
    return fragment;
  }
};

// ============ Debounce Utility ============
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============ URL Utilities ============
const URLUtils = {
  getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
};

// ============ Sanitize HTML ============
function sanitizeHTML(html) {
  if (!html) return '';
  
  // Create a temporary element
  const temp = document.createElement('div');
  temp.textContent = html;
  
  // Return sanitized text
  return temp.innerHTML;
}

// Strip HTML tags but keep text
function stripHTML(html) {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
});

// Export for use in other scripts
window.CryptoTracker = {
  ThemeManager,
  API,
  Format,
  DOM,
  Skeleton,
  URLUtils,
  RateLimitError,
  AbortError,
  debounce,
  sanitizeHTML,
  stripHTML
};
