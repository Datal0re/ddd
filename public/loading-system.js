/**
 * Loading States and Skeleton Screens System
 * Provides consistent loading UI across the application
 * Using static CSS classes for better performance and maintainability
 */

class LoadingSystem {
  constructor() {
    this.activeLoaders = new Map();
    this.defaultOptions = {
      showOverlay: true,
      showSpinner: true,
      message: 'Loading...',
      timeout: 30000, // 30 seconds default timeout
    };
  }

  /**
   * Show loading state
   */
  show(id, options = {}) {
    const config = { ...this.defaultOptions, ...options };

    // Remove existing loader with same ID
    this.hide(id);

    const loader = this.createLoader(id, config);
    document.body.appendChild(loader);
    this.activeLoaders.set(id, { loader, config, startTime: Date.now() });

    // Auto-hide after timeout
    if (config.timeout > 0) {
      setTimeout(() => {
        if (this.activeLoaders.has(id)) {
          this.hide(id);
          // eslint-disable-next-line no-console
          console.warn(`Loading timeout for ${id} after ${config.timeout}ms`);
        }
      }, config.timeout);
    }

    return loader;
  }

  /**
   * Hide loading state
   */
  hide(id) {
    const loaderData = this.activeLoaders.get(id);
    if (loaderData) {
      const { loader } = loaderData;
      loader.classList.add('hiding');

      setTimeout(() => {
        if (loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      }, 300);

      this.activeLoaders.delete(id);
    }
  }

  /**
   * Hide all active loaders
   */
  hideAll() {
    this.activeLoaders.forEach((_, id) => {
      this.hide(id);
    });
  }

  /**
   * Create loader element
   */
  createLoader(id, config) {
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.id = `loader-${id}`;

    let content = '';

    if (config.showOverlay) {
      content += `
        <div class="loading-backdrop"></div>
      `;
    }

    content += `
      <div class="loading-content">
    `;

    if (config.showSpinner) {
      content += `
        <div class="loading-spinner"></div>
      `;
    }

    if (config.message) {
      content += `
        <div class="loading-message">${config.message}</div>
      `;
    }

    if (config.progress !== undefined) {
      content += `
        <div class="loading-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${config.progress}%"></div>
          </div>
          <div class="progress-text">${config.progress}%</div>
        </div>
      `;
    }

    content += `
      </div>
    `;

    loader.innerHTML = content;

    // Add CSS animations
    this.addLoaderStyles();

    return loader;
  }

  /**
   * Update loader progress
   */
  updateProgress(id, progress, message) {
    const loaderData = this.activeLoaders.get(id);
    if (loaderData) {
      const { loader } = loaderData;
      const progressFill = loader.querySelector('.progress-fill');
      const progressText = loader.querySelector('.progress-text');
      const messageEl = loader.querySelector('.loading-message');

      if (progressFill) progressFill.style.width = `${progress}%`;
      if (progressText) progressText.textContent = `${progress}%`;
      if (messageEl && message) messageEl.textContent = message;
    }
  }

  /**
   * Add loader styles to document (now using static CSS)
   */
  addLoaderStyles() {
    // Styles are now in static CSS - no dynamic injection needed
    // This method kept for compatibility but does nothing
  }
}

/**
 * Skeleton Screen System
 * Provides skeleton loading states for different content types
 */

class SkeletonSystem {
  /**
   * Create conversation list skeletons
   */
  static createConversationSkeletons(count = 5, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skeletons = Array(count)
      .fill('')
      .map(
        (_, index) => `
      <div class="skeleton-item" style="animation-delay: ${index * 100}ms">
        <div style="flex: 1; min-width: 0;">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-date"></div>
        </div>
        <div class="skeleton skeleton-arrow"></div>
      </div>
    `
      )
      .join('');

    container.innerHTML = skeletons;
  }

  /**
   * Create message skeletons
   */
  static createMessageSkeletons(count = 3, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skeletons = Array(count)
      .fill('')
      .map((_, index) => {
        const isUser = index % 2 === 0;
        return `
        <div class="skeleton-message ${isUser ? 'user' : 'assistant'}" style="animation-delay: ${index * 150}ms">
          <div class="skeleton skeleton-author"></div>
          <div class="skeleton skeleton-content"></div>
          <div class="skeleton skeleton-timestamp"></div>
        </div>
      `;
      })
      .join('');

    container.innerHTML = skeletons;
  }

  /**
   * Create card skeletons
   */
  static createCardSkeletons(count = 3, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skeletons = Array(count)
      .fill('')
      .map(
        (_, index) => `
      <div class="card skeleton-card" style="animation-delay: ${index * 100}ms">
        <div class="skeleton skeleton-header"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text" style="width: 80%"></div>
      </div>
    `
      )
      .join('');

    container.innerHTML = skeletons;
  }

  /**
   * Add skeleton styles to document (now using static CSS)
   */
  addSkeletonStyles() {
    // Styles are now in static CSS - no dynamic injection needed
    // This method kept for compatibility but does nothing
  }
}

// Skeleton styles are now in static CSS - no initialization needed

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LoadingSystem, SkeletonSystem };
} else {
  window.LoadingSystem = LoadingSystem;
  window.SkeletonSystem = SkeletonSystem;
}
