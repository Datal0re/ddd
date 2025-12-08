/**
 * Navigation System for Data Dumpster Diver
 * Provides persistent navigation, breadcrumbs, and quick access functionality
 */

/**
 * Simple browser logger for frontend modules
 */
const NavigationLogger = {
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(`[Navigation] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    // eslint-disable-next-line no-console
    console.info(`[Navigation] ${message}`, ...args);
  },
  warn: (message, ...args) => {
    // eslint-disable-next-line no-console
    console.warn(`[Navigation] ${message}`, ...args);
  },
  error: (message, ...args) => {
    // eslint-disable-next-line no-console
    console.error(`[Navigation] ${message}`, ...args);
  },
};

/**
 * Navigation System for Data Dumpster Diver
 * Provides persistent navigation, breadcrumbs, and quick access functionality
 */
class NavigationSystem {
  /**
   * Create a new NavigationSystem instance
   */
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.isMobileMenuOpen = false;

    // Cache DOM elements
    this.domCache = {
      body: null,
      mobileMenu: null,
      hamburger: null,
      container: null,
    };

    this.init();
  }

  init() {
    this.createNavigation();
    this.createBreadcrumbs();
    this.createQuickAccessToolbar();
    this.setupEventListeners();
    this.updateActiveNavItem();

    // Cache frequently accessed elements
    this.cacheElements();
  }

  /**
   * Get current page identifier from URL path
   * @returns {string} Current page identifier
   */
  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';

    if (filename === 'index.html' || filename === '') return 'dashboard';
    if (filename === 'conversations.html') return 'conversations';
    if (filename === 'conversation.html') return 'conversation';
    if (filename === 'upload.html') return 'upload';

    return 'unknown';
  }

  /**
   * Create and insert navigation HTML into document
   * @returns {void}
   */
  createNavigation() {
    const navHTML = `
      <nav class="main-nav">
        <div class="nav-container">
          <a href="index.html" class="nav-brand">
            <div class="nav-brand-icon">🗂️</div>
            <span>ddd</span>
          </a>
          
          <div class="nav-menu">
            <a href="index.html" class="nav-item" data-page="dashboard">
              <span>🏠</span>
              <span>Dashboard</span>
            </a>
            <a href="conversations.html" class="nav-item" data-page="conversations">
              <span>💬</span>
              <span>Conversations</span>
            </a>
            <a href="upload.html" class="nav-item" data-page="upload">
              <span>📤</span>
              <span>Upload</span>
            </a>
            <a href="#" class="nav-item" data-page="analytics" onclick="showComingSoon('Analytics'); return false;">
              <span>📊</span>
              <span>Analytics</span>
            </a>
          </div>
          
          <div class="nav-actions">
            <button class="search-toggle" onclick="toggleGlobalSearch()" title="Global Search">
              🔍
            </button>
            <button class="settings-btn" onclick="showComingSoon('Settings')" title="Settings">
              ⚙️
            </button>
            <button class="hamburger-menu" onclick="toggleMobileMenu()">
              ☰
            </button>
          </div>
        </div>
      </nav>
      
      <div class="nav-mobile-menu" id="mobileMenu">
        <div class="nav-menu">
          <a href="index.html" class="nav-item" data-page="dashboard">
            <span>🏠</span>
            <span>Dashboard</span>
          </a>
          <a href="conversations.html" class="nav-item" data-page="conversations">
            <span>💬</span>
            <span>Conversations</span>
          </a>
          <a href="upload.html" class="nav-item" data-page="upload">
            <span>📤</span>
            <span>Upload</span>
          </a>
          <a href="#" class="nav-item" data-page="analytics" onclick="showComingSoon('Analytics'); return false;">
            <span>📊</span>
            <span>Analytics</span>
          </a>
        </div>
      </div>
    `;

    // Insert navigation at the beginning of body
    document.body.insertAdjacentHTML('afterbegin', navHTML);

    // Add page-with-nav class to body for proper spacing
    document.body.classList.add('page-with-nav');
  }

  /**
   * Create and insert breadcrumb navigation
   * @returns {void}
   */
  createBreadcrumbs() {
    const breadcrumbData = this.getBreadcrumbData();
    const breadcrumbHTML = `
      <div class="breadcrumb">
        ${breadcrumbData
          .map(
            (item, _index) => `
          <div class="breadcrumb-item">
            ${
              item.url
                ? `<a href="${item.url}" class="breadcrumb-link">${item.label}</a>`
                : `<span class="breadcrumb-current">${item.label}</span>`
            }
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Find the first container and add breadcrumbs after the nav
    const container = this.domCache.container || document.querySelector('.container');
    if (container) {
      container.insertAdjacentHTML('afterbegin', breadcrumbHTML);
    }
  }

  /**
   * Get breadcrumb data for current page
   * @returns {Array<Object>} Array of breadcrumb items
   */
  getBreadcrumbData() {
    const breadcrumbs = [{ label: 'Home', url: 'index.html' }];

    switch (this.currentPage) {
      case 'dashboard':
        return [{ label: 'Dashboard', url: null }];

      case 'conversations':
        breadcrumbs.push({ label: 'Conversations', url: null });
        break;

      case 'conversation':
        breadcrumbs.push({ label: 'Conversations', url: 'conversations.html' });
        breadcrumbs.push({ label: 'Conversation', url: null });
        break;

      case 'upload':
        breadcrumbs.push({ label: 'Upload', url: null });
        break;

      default:
        breadcrumbs.push({ label: 'Unknown Page', url: null });
    }

    return breadcrumbs;
  }

  /**
   * Create quick access toolbar for certain pages
   * @returns {void}
   */
  createQuickAccessToolbar() {
    // Only show on certain pages
    if (!['dashboard', 'conversations'].includes(this.currentPage)) {
      return;
    }

    const toolbarHTML = `
      <div class="quick-access-toolbar">
        <input type="search" class="quick-search" placeholder="Quick search..." onkeyup="handleQuickSearch(event)">
        <div class="quick-actions">
          ${
            this.currentPage === 'conversations'
              ? `
            <button class="quick-action-btn" onclick="filterConversations('all')">All</button>
            <button class="quick-action-btn" onclick="filterConversations('recent')">Recent</button>
            <button class="quick-action-btn" onclick="filterConversations('starred')">Starred</button>
          `
              : ''
          }
          <button class="quick-action-btn" onclick="showComingSoon('Advanced Search')">🔍 Advanced</button>
          <button class="quick-action-btn" onclick="showComingSoon('Export Data')">📥 Export</button>
        </div>
      </div>
    `;

    // Insert toolbar after breadcrumbs
    const container = this.domCache.container || document.querySelector('.container');
    const breadcrumb = container ? container.querySelector('.breadcrumb') : null;
    if (breadcrumb) {
      breadcrumb.insertAdjacentHTML('afterend', toolbarHTML);
    } else if (container) {
      container.insertAdjacentHTML('afterbegin', toolbarHTML);
    }
  }

  /**
   * Update active state of navigation items
   * @returns {void}
   */
  updateActiveNavItem() {
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Add active class to current page nav items
    document.querySelectorAll(`[data-page="${this.currentPage}"]`).forEach(item => {
      item.classList.add('active');
    });
  }

  /**
   * Setup event listeners for navigation interactions
   * @returns {void}
   */
  setupEventListeners() {
    // Close mobile menu when clicking outside
    document.addEventListener('click', e => {
      const mobileMenu =
        this.domCache.mobileMenu || document.getElementById('mobileMenu');
      const hamburger =
        this.domCache.hamburger || document.querySelector('.hamburger-menu');

      if (
        this.isMobileMenuOpen &&
        mobileMenu &&
        hamburger &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        this.closeMobileMenu();
      }
    });

    // Handle escape key to close mobile menu
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isMobileMenuOpen) {
        this.closeMobileMenu();
      }
    });

    // Handle window resize with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (window.innerWidth > 768 && this.isMobileMenuOpen) {
          this.closeMobileMenu();
        }
      }, 150);
    });
  }

  /**
   * Close mobile navigation menu
   * @returns {void}
   */
  /**
   * Cache frequently accessed DOM elements
   * @returns {void}
   */
  cacheElements() {
    this.domCache.body = document.body;
    this.domCache.mobileMenu = document.getElementById('mobileMenu');
    this.domCache.hamburger = document.querySelector('.hamburger-menu');
    this.domCache.container = document.querySelector('.container');
  }

  closeMobileMenu() {
    const mobileMenu =
      this.domCache.mobileMenu || document.getElementById('mobileMenu');
    if (mobileMenu) {
      mobileMenu.classList.remove('active');
      this.isMobileMenuOpen = false;
    }
  }
}

// Global functions for navigation
// eslint-disable-next-line no-unused-vars
function toggleMobileMenu() {
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.classList.toggle('active');
    window.navigation.isMobileMenuOpen = mobileMenu.classList.contains('active');
  }
}

// eslint-disable-next-line no-unused-vars
function toggleGlobalSearch() {
  showComingSoon('Global Search');
}

// eslint-disable-next-line no-unused-vars
function handleQuickSearch(event) {
  const query = event.target.value.trim();

  if (window.navigation.currentPage === 'conversations' && window.filter) {
    // Use existing filter function on conversations page
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.value = query;
      window.filter();
    }
  } else {
    // For other pages, implement quick search
    NavigationLogger.debug('Quick search:', query);
  }
}

// eslint-disable-next-line no-unused-vars
function filterConversations(filter) {
  NavigationLogger.debug('Filter conversations:', filter);
  showComingSoon(`${filter} conversations filter`);
}

function showComingSoon(feature) {
  // Create a nice toast notification instead of alert
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 1rem 1.5rem;
    color: var(--text-primary);
    box-shadow: 0 4px 6px var(--shadow);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.2rem;">🚧</span>
      <div>
        <div style="font-weight: 600; margin-bottom: 0.25rem;">Coming Soon</div>
        <div style="font-size: 0.875rem; color: var(--text-secondary);">${feature} feature is under development</div>
      </div>
    </div>
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Initialize navigation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.navigation = new NavigationSystem();
});
