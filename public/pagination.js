/**
 * Pagination System for Data Dumpster Diver
 * Provides client-side pagination with performance optimizations
 */

class PaginationSystem {
  constructor(options = {}) {
    this.items = [];
    this.currentPage = 1;
    this.pageSize = options.pageSize || 20;
    this.totalItems = 0;
    this.totalPages = 0;
    this.filteredItems = [];
    this.searchTerm = '';
    this.sortBy = options.sortBy || 'date';
    this.sortOrder = options.sortOrder || 'desc';

    // Callbacks
    this.onPageChange = options.onPageChange || (() => {});
    this.onItemsUpdate = options.onItemsUpdate || (() => {});

    // Performance
    this.renderCache = new Map();
    this.debounceTimer = null;
  }

  /**
   * Set items and initialize pagination
   */
  setItems(items) {
    this.items = items;
    this.totalItems = items.length;
    this.applyFilters();
    this.updatePagination();
  }

  /**
   * Apply search and sort filters
   */
  applyFilters() {
    let filtered = [...this.items];

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(
        item =>
          item.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
          item.date.includes(this.searchTerm)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[this.sortBy] || '';
      let bVal = b[this.sortBy] || '';

      // Handle date sorting
      if (this.sortBy === 'date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (this.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    this.filteredItems = filtered;
    this.totalItems = filtered.length;
    this.currentPage = 1; // Reset to first page when filters change
  }

  /**
   * Update pagination calculations
   */
  updatePagination() {
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);

    // Ensure current page is valid
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  /**
   * Get items for current page
   */
  getCurrentPageItems() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    return this.filteredItems.slice(startIndex, endIndex);
  }

  /**
   * Navigate to specific page
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;

    this.currentPage = page;
    this.onPageChange(this.currentPage, this.getCurrentPageItems());
  }

  /**
   * Navigate to next page
   */
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  /**
   * Navigate to previous page
   */
  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  /**
   * Change page size
   */
  setPageSize(size) {
    this.pageSize = parseInt(size);
    this.updatePagination();
    this.goToPage(1); // Reset to first page
  }

  /**
   * Set search term with debouncing
   */
  setSearchTerm(term) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.searchTerm = term;
      this.applyFilters();
      this.updatePagination();
      this.onPageChange(this.currentPage, this.getCurrentPageItems());
    }, 300);
  }

  /**
   * Set sorting
   */
  setSorting(sortBy, order = 'desc') {
    this.sortBy = sortBy;
    this.sortOrder = order;
    this.applyFilters();
    this.updatePagination();
    this.goToPage(1);
  }

  /**
   * Get pagination info object
   */
  getInfo() {
    const startItem =
      this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
    const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);

    return {
      currentPage: this.currentPage,
      totalPages: this.totalPages,
      totalItems: this.totalItems,
      pageSize: this.pageSize,
      startItem,
      endItem,
      hasNextPage: this.currentPage < this.totalPages,
      hasPrevPage: this.currentPage > 1,
    };
  }

  /**
   * Generate page numbers for pagination controls
   */
  getPageNumbers() {
    const pages = [];
    const { currentPage, totalPages } = this;

    // Always show first page
    if (totalPages > 0) {
      pages.push(1);
    }

    // Calculate range around current page
    let start = Math.max(2, currentPage - 2);
    let end = Math.min(totalPages - 1, currentPage + 2);

    // Adjust range if too close to edges
    if (start === 2) end = Math.min(totalPages - 1, start + 4);
    if (end === totalPages - 1) start = Math.max(2, end - 4);

    // Add ellipsis after first page if needed
    if (start > 2) {
      pages.push('...');
    }

    // Add page range
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Add ellipsis before last page if needed
    if (end < totalPages - 1) {
      pages.push('...');
    }

    // Always show last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  }

  /**
   * Render pagination controls
   */
  renderControls(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const info = this.getInfo();
    const pageNumbers = this.getPageNumbers();

    const html = `
      <div class="pagination-container">
        <div class="pagination-controls">
          <div class="pagination-info">
            <span>Showing ${info.startItem}-${info.endItem} of ${info.totalItems} conversations</span>
          </div>
          
          <div class="pagination-buttons">
            <button class="pagination-btn" ${!info.hasPrevPage ? 'disabled' : ''} 
                    onclick="window.paginationSystem.prevPage()">
              ← Previous
            </button>
            
            ${pageNumbers
              .map(page => {
                if (page === '...') {
                  return '<span class="pagination-ellipsis">...</span>';
                }
                return `
                <button class="pagination-btn ${page === info.currentPage ? 'active' : ''}" 
                        onclick="window.paginationSystem.goToPage(${page})">
                  ${page}
                </button>
              `;
              })
              .join('')}
            
            <button class="pagination-btn" ${!info.hasNextPage ? 'disabled' : ''} 
                    onclick="window.paginationSystem.nextPage()">
              Next →
            </button>
          </div>
          
          <div class="page-size-selector">
            <label for="page-size">Show:</label>
            <select id="page-size" class="page-size-select" onchange="window.paginationSystem.setPageSize(this.value)">
              <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10</option>
              <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20</option>
              <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50</option>
              <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100</option>
            </select>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  /**
   * Render skeleton loading state
   */
  renderSkeletons(containerId, count = this.pageSize) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skeletons = Array(count)
      .fill('')
      .map(
        (_, index) => `
      <div class="skeleton-item" style="animation-delay: ${index * 50}ms">
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
   * Clear render cache
   */
  clearCache() {
    this.renderCache.clear();
  }

  /**
   * Destroy pagination system
   */
  destroy() {
    clearTimeout(this.debounceTimer);
    this.clearCache();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaginationSystem;
} else {
  window.PaginationSystem = PaginationSystem;
}
