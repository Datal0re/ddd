/**
 * Loading States and Skeleton Screens System
 * Provides consistent loading UI across the application
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
   * Add loader styles to document
   */
  addLoaderStyles() {
    if (document.getElementById('loader-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'loader-styles';
    styles.textContent = `
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease-out;
      }
      
      .loading-overlay.hiding {
        animation: fadeOut 0.3s ease-out forwards;
      }
      
      .loading-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(4px);
      }
      
      .loading-content {
        position: relative;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 0.75rem;
        padding: 2rem;
        text-align: center;
        box-shadow: 0 8px 25px var(--shadow);
        min-width: 200px;
        max-width: 400px;
        z-index: 1;
      }
      
      .loading-spinner {
        width: 48px;
        height: 48px;
        border: 3px solid var(--border-color);
        border-top: 3px solid var(--primary-blue);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
      }
      
      .loading-message {
        color: var(--text-primary);
        font-size: 0.9rem;
        margin-bottom: 1rem;
        line-height: 1.4;
      }
      
      .loading-progress {
        margin-top: 1rem;
      }
      
      .progress-bar {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 0.25rem;
        height: 8px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--primary-blue), var(--secondary-purple));
        transition: width 0.3s ease;
      }
      
      .progress-text {
        color: var(--text-secondary);
        font-size: 0.8rem;
        font-weight: 500;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;

    document.head.appendChild(styles);
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
   * Add skeleton styles
   */
  static addSkeletonStyles() {
    if (document.getElementById('skeleton-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'skeleton-styles';
    styles.textContent = `
      .skeleton {
        background: linear-gradient(90deg, var(--bg-tertiary) 25%, var(--border-color) 50%, var(--bg-tertiary) 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 0.25rem;
      }
      
      @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      
      .skeleton-item {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 0.5rem;
        padding: 1rem 1.25rem;
        margin-bottom: 0.75rem;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
      }
      
      .skeleton-title {
        height: 1.25rem;
        width: 60%;
        margin-bottom: 0.5rem;
      }
      
      .skeleton-date {
        height: 0.875rem;
        width: 40%;
      }
      
      .skeleton-arrow {
        height: 1.25rem;
        width: 1.25rem;
        flex-shrink: 0;
      }
      
      .skeleton-message {
        margin-bottom: 1.5rem;
        display: flex;
        flex-direction: column;
      }
      
      .skeleton-message.user {
        align-items: flex-end;
      }
      
      .skeleton-message.assistant {
        align-items: flex-start;
      }
      
      .skeleton-author {
        height: 0.75rem;
        width: 80px;
        margin-bottom: 0.5rem;
      }
      
      .skeleton-content {
        height: 3rem;
        width: 100%;
        margin-bottom: 0.5rem;
        border-radius: 1.25rem;
      }
      
      .skeleton-timestamp {
        height: 0.7rem;
        width: 120px;
      }
      
      .skeleton-card {
        min-height: 150px;
      }
      
      .skeleton-header {
        height: 1.5rem;
        width: 70%;
        margin-bottom: 1rem;
      }
      
      .skeleton-text {
        height: 1rem;
        width: 100%;
        margin-bottom: 0.5rem;
      }
    `;

    document.head.appendChild(styles);
  }
}

// Initialize skeleton styles
SkeletonSystem.addSkeletonStyles();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LoadingSystem, SkeletonSystem };
} else {
  window.LoadingSystem = LoadingSystem;
  window.SkeletonSystem = SkeletonSystem;
}
