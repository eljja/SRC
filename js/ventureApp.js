/**
 * Main Application Coordinator for Semiconductor Venture Observatory (ventureApp.js)
 * Initializes all views, manages filter bindings, view tabs, details modals, and exports.
 */

// Corporate Headquarters Coordinates for all 27 Semiconductor Giants
const COMPANY_COORDINATES = {
  "Samsung Electronics": { city: "Suwon / Hwaseong", country: "South Korea", lat: 37.2578, lng: 127.0543 },
  "TSMC": { city: "Hsinchu", country: "Taiwan", lat: 24.7824, lng: 120.9984 },
  "Intel": { city: "Santa Clara, CA", country: "USA", lat: 37.3861, lng: -121.9639 },
  "SK Hynix": { city: "Icheon", country: "South Korea", lat: 37.2435, lng: 127.4812 },
  "GlobalFoundries": { city: "Malta, NY", country: "USA", lat: 42.9818, lng: -73.7846 },
  "Micron Technology": { city: "Boise, ID", country: "USA", lat: 43.6150, lng: -116.2023 },
  "Micron": { city: "Boise, ID", country: "USA", lat: 43.6150, lng: -116.2023 },
  "Infineon Technologies": { city: "Neubiberg / Munich", country: "Germany", lat: 48.0772, lng: 11.6578 },
  "Infineon": { city: "Neubiberg / Munich", country: "Germany", lat: 48.0772, lng: 11.6578 },
  "Arm": { city: "Cambridge", country: "UK", lat: 52.2053, lng: 0.1218 },
  "Kioxia": { city: "Tokyo / Yokkaichi", country: "Japan", lat: 34.9654, lng: 136.6247 },
  "Applied Materials (AMAT)": { city: "Santa Clara, CA", country: "USA", lat: 37.3541, lng: -121.9552 },
  "Applied Materials": { city: "Santa Clara, CA", country: "USA", lat: 37.3541, lng: -121.9552 },
  "NVIDIA": { city: "Santa Clara, CA", country: "USA", lat: 37.3708, lng: -121.9675 },
  "ASML": { city: "Veldhoven", country: "Netherlands", lat: 51.4208, lng: 5.4052 },
  "Lam Research": { city: "Fremont, CA", country: "USA", lat: 37.4988, lng: -121.9427 },
  "KLA Corporation": { city: "Milpitas, CA", country: "USA", lat: 37.4323, lng: -121.8996 },
  "KLA": { city: "Milpitas, CA", country: "USA", lat: 37.4323, lng: -121.8996 },
  "Tokyo Electron (TEL)": { city: "Tokyo / Sendai", country: "Japan", lat: 35.6762, lng: 139.6503 },
  "Tokyo Electron": { city: "Tokyo / Sendai", country: "Japan", lat: 35.6762, lng: 139.6503 },
  "Qualcomm": { city: "San Diego, CA", country: "USA", lat: 32.7157, lng: -117.1611 },
  "MediaTek": { city: "Hsinchu", country: "Taiwan", lat: 24.7732, lng: 121.0142 },
  "Cadence Design Systems": { city: "San Jose, CA", country: "USA", lat: 37.4085, lng: -121.9482 },
  "Cadence": { city: "San Jose, CA", country: "USA", lat: 37.4085, lng: -121.9482 },
  "Broadcom": { city: "San Jose, CA", country: "USA", lat: 37.3382, lng: -121.8863 },
  "Texas Instruments": { city: "Dallas, TX", country: "USA", lat: 32.7767, lng: -96.7970 },
  "Wolfspeed": { city: "Durham, NC", country: "USA", lat: 35.9000, lng: -78.8700 },
  "STMicroelectronics": { city: "Geneva / Grenoble", country: "Switzerland", lat: 46.2044, lng: 6.1432 },
  "NXP Semiconductors": { city: "Eindhoven", country: "Netherlands", lat: 51.4416, lng: 5.4697 },
  "NXP": { city: "Eindhoven", country: "Netherlands", lat: 51.4416, lng: 5.4697 },
  "Sony Semiconductor": { city: "Atsugi / Kumamoto", country: "Japan", lat: 35.4431, lng: 139.3625 },
  "Sony": { city: "Atsugi / Kumamoto", country: "Japan", lat: 35.4431, lng: 139.3625 },
  "Synopsys": { city: "Sunnyvale, CA", country: "USA", lat: 37.3688, lng: -122.0363 },
  "Renesas Electronics": { city: "Tokyo", country: "Japan", lat: 35.6895, lng: 139.6917 },
  "Renesas": { city: "Tokyo", country: "Japan", lat: 35.6895, lng: 139.6917 },
  "Onsemi": { city: "Scottsdale, AZ", country: "USA", lat: 33.5000, lng: -111.9000 }
};

class VentureApp {
  constructor() {
    this.dataManager = new VentureDataManager();
    this.tracker = null;
    this.mapView = null;
    this.networkView = null;
    this.currentView = 'map'; // 'map' | 'network' | 'table' | 'analytics'
    this.tableCurrentPage = 1;
    this.tablePageSize = 25;
    this.analyticsTopN = 10;
    this._searchDebounceTimer = null;
  }

  async init() {
    console.log('Initializing Semiconductor Venture Observatory...');
    const loadingOverlay = document.getElementById('global-loading-overlay');
    const errorBanner = document.getElementById('global-error-banner');

    const retryBtn = document.getElementById('btn-retry-load');
    if (retryBtn && !retryBtn._bound) {
      retryBtn._bound = true;
      retryBtn.addEventListener('click', () => {
        if (errorBanner) errorBanner.style.display = 'none';
        if (loadingOverlay) {
          loadingOverlay.classList.remove('fade-out');
          loadingOverlay.style.display = 'flex';
        }
        this.init();
      });
    }

    const data = await this.dataManager.loadData();
    if (!data) {
      if (loadingOverlay) loadingOverlay.style.display = 'none';
      if (errorBanner) errorBanner.style.display = 'flex';
      return;
    }

    // Hide loading overlay smoothly
    if (loadingOverlay) {
      loadingOverlay.classList.add('fade-out');
      setTimeout(() => { loadingOverlay.style.display = 'none'; }, 350);
    }
    if (errorBanner) errorBanner.style.display = 'none';

    // Initialize Tracker
    if (window.Tracker) {
      this.tracker = new Tracker(data.metadata);
      this.tracker.renderHeaderBadge('header-freshness-badge-container');
    }

    // Initialize Map View
    if (window.MapView) {
      this.mapView = new MapView('map-container', (id) => this.showInvestmentModal(id));
      this.mapView.init();
    }

    // Initialize Network View
    if (window.VentureNetworkView) {
      this.networkView = new VentureNetworkView('network-container', (id) => this.showInvestmentModal(id));
      this.networkView.init();
    } else if (window.NetworkView) {
      this.networkView = new NetworkView('network-container', (id) => this.showInvestmentModal(id));
      this.networkView.init();
    }

    // Populate Sidebar Dropdowns
    this.populateDropdowns();

    // Bind UI Event Listeners
    this.bindEventListeners();

    // Initial Render
    this.updateAllViews();
  }

  // Convert venture investment record into the schema expected by MapView & NetworkView
  _mapVentureToProject(inv) {
    const compInfo = COMPANY_COORDINATES[inv.investor_company] || {
      city: 'Global',
      country: 'USA',
      lat: 37.3541,
      lng: -121.9552
    };

    return {
      id: inv.id,
      title: `${inv.startup_name} (${inv.investment_round} ${inv.investment_amount_display})`,
      topic: inv.startup_name,
      startup_name: inv.startup_name,
      startup_tagline: inv.startup_tagline || '',
      startup_tech_tag: inv.startup_tech_tag || '',
      syndicate_partners: inv.syndicate_partners || [],
      cvc_arm: inv.cvc_arm || '',
      company: inv.investor_company,
      company_city: compInfo.city,
      company_country: compInfo.country,
      company_lat: compInfo.lat,
      company_lng: compInfo.lng,
      university: inv.startup_name, // Map treats this as the destination node
      university_city: inv.startup_hq_city,
      university_country: inv.startup_hq_country,
      university_lat: inv.startup_lat,
      university_lng: inv.startup_lon, // Leaflet needs lng
      category: inv.sector,
      sector: inv.sector,
      status: inv.status || 'active',
      status_detail: `${inv.investment_round} • ${inv.cvc_arm || 'CVC'}`,
      funding_display: inv.investment_amount_display,
      funding_amount_usd: inv.investment_amount_usd,
      start_year: inv.investment_year,
      end_year: inv.investment_year,
      summary: inv.startup_description,
      evidence_type: 'CVC 투자 공시',
      evidence_ref: inv.source_url,
      rawInvestment: inv
    };
  }

  populateDropdowns() {
    // Investor Company
    const compSelect = document.getElementById('filter-company');
    if (compSelect) {
      const companies = this.dataManager.getUniqueCompanies();
      companies.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        compSelect.appendChild(opt);
      });
    }

    // Startup
    const startupSelect = document.getElementById('filter-startup');
    if (startupSelect) {
      const startups = this.dataManager.getUniqueStartups();
      startups.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        startupSelect.appendChild(opt);
      });
    }

    // Sector / Category
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      const sectors = this.dataManager.getUniqueSectors();
      sectors.forEach(sec => {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = sec;
        catSelect.appendChild(opt);
      });
    }

    // Round
    const roundSelect = document.getElementById('filter-round');
    if (roundSelect) {
      const rounds = this.dataManager.getUniqueRounds();
      rounds.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        roundSelect.appendChild(opt);
      });
    }

    // Year
    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
      const years = this.dataManager.getUniqueYears();
      years.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `${y}년`;
        yearSelect.appendChild(opt);
      });
    }
  }

  bindEventListeners() {
    // Search input with 250ms debounce
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this._searchDebounceTimer);
        const clearBtn = document.getElementById('btn-clear-search');
        if (clearBtn) clearBtn.classList.toggle('visible', e.target.value.length > 0);
        this._searchDebounceTimer = setTimeout(() => {
          this.tableCurrentPage = 1;
          this.dataManager.setFilter('searchQuery', e.target.value);
          this.updateAllViews();
        }, 250);
      });
    }

    // Search clear button
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        clearTimeout(this._searchDebounceTimer);
        if (searchInput) searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        this.dataManager.setFilter('searchQuery', '');
        this.tableCurrentPage = 1;
        this.updateAllViews();
      });
    }

    // Filter Dropdowns
    const bindFilter = (elementId, filterKey) => {
      const el = document.getElementById(elementId);
      if (el) {
        el.addEventListener('change', (e) => {
          this.tableCurrentPage = 1;
          this.dataManager.setFilter(filterKey, e.target.value);
          this.updateAllViews();
        });
      }
    };

    bindFilter('filter-company', 'company');
    bindFilter('filter-startup', 'startup');
    bindFilter('filter-category', 'sector');
    bindFilter('filter-round', 'round');
    bindFilter('filter-year', 'year');

    // Status Pills
    const statusPills = document.querySelectorAll('.status-pill');
    statusPills.forEach(pill => {
      pill.addEventListener('click', () => {
        statusPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.tableCurrentPage = 1;
        this.dataManager.setFilter('status', pill.getAttribute('data-status'));
        this.updateAllViews();
      });
    });

    // Sort buttons
    const sortBtns = document.querySelectorAll('.sort-btn');
    sortBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sortBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tableCurrentPage = 1;
        this.dataManager.setFilter('sortBy', btn.getAttribute('data-sort'));
        this.updateAllViews();
      });
    });

    // Reset button
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        clearTimeout(this._searchDebounceTimer);
        this.tableCurrentPage = 1;
        this.dataManager.resetFilters();
        if (searchInput) searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
        
        ['filter-company', 'filter-startup', 'filter-category', 'filter-round', 'filter-year'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = 'all';
        });

        statusPills.forEach(p => p.classList.remove('active'));
        const allPill = document.querySelector('.status-pill[data-status="all"]');
        if (allPill) allPill.classList.add('active');

        this.updateAllViews();
      });
    }

    // View tab switching
    const viewTabs = document.querySelectorAll('.view-tab-btn');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.getAttribute('data-view');
        this.switchView(targetView);
      });
    });

    // Modal close
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeModal());
    }
    const modalOverlay = document.getElementById('project-detail-modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target.id === 'project-detail-modal-overlay') this.closeModal();
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    // Mobile sidebar toggle
    const mobileMenuBtn = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('drawer-open');
        if (backdrop) backdrop.classList.toggle('active');
      });
      if (backdrop) {
        backdrop.addEventListener('click', () => {
          sidebar.classList.remove('drawer-open');
          backdrop.classList.remove('active');
        });
      }
    }

    // Export Data JSON
    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportDataJson());
    }

    // Top-N toggle buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.analytics-topn-btn');
      if (!btn) return;
      document.querySelectorAll('.analytics-topn-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.analyticsTopN = btn.dataset.topn === 'all' ? 999 : parseInt(btn.dataset.topn);
      this.renderAnalytics();
    });

    // Table row click delegation
    const tbody = document.getElementById('table-directory-body');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const row = e.target.closest('.table-row-clickable');
        if (row) {
          const pid = row.getAttribute('data-project-id');
          if (pid) this.showInvestmentModal(pid);
        }
      });
    }

    // Table pagination delegation
    const paginationBar = document.getElementById('table-pagination-bar');
    if (paginationBar) {
      paginationBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.page-btn');
        if (btn && !btn.disabled) {
          const page = parseInt(btn.getAttribute('data-page'));
          if (!isNaN(page)) this.setTablePage(page);
        }
      });
      paginationBar.addEventListener('change', (e) => {
        if (e.target.classList.contains('page-size-select')) {
          this.tablePageSize = parseInt(e.target.value);
          this.tableCurrentPage = 1;
          this.renderTableDirectory();
        }
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
    const activeContainer = document.getElementById(`${viewName}-view`);
    if (activeContainer) activeContainer.classList.add('active');

    const mappedData = this.dataManager.filteredInvestments.map(inv => this._mapVentureToProject(inv));

    if (viewName === 'map' && this.mapView) {
      setTimeout(() => this.mapView.resize && this.mapView.resize(), 100);
      this.mapView.render(mappedData);
    } else if (viewName === 'network' && this.networkView) {
      this.networkView.render(mappedData);
    } else if (viewName === 'table') {
      this.renderTableDirectory();
    } else if (viewName === 'analytics') {
      this.renderAnalytics();
    }
  }

  updateAllViews() {
    const stats = this.dataManager.getSummaryStats();
    const countEl = document.getElementById('stat-total-count');
    const activeEl = document.getElementById('stat-active-count');
    const fundingEl = document.getElementById('stat-funding-total');

    if (countEl) countEl.textContent = stats.total.toLocaleString();
    if (activeEl) activeEl.textContent = stats.active.toLocaleString();
    if (fundingEl) fundingEl.textContent = stats.totalFundingFormatted;

    const mappedData = this.dataManager.filteredInvestments.map(inv => this._mapVentureToProject(inv));

    if (this.currentView === 'map' && this.mapView) {
      this.mapView.render(mappedData);
    } else if (this.currentView === 'network' && this.networkView) {
      this.networkView.render(mappedData);
    } else if (this.currentView === 'table') {
      this.renderTableDirectory();
    } else if (this.currentView === 'analytics') {
      this.renderAnalytics();
    }
  }

  renderTableDirectory() {
    const tbody = document.getElementById('table-directory-body');
    const paginationBar = document.getElementById('table-pagination-bar');
    const countSummary = document.getElementById('table-count-summary');
    if (!tbody) return;

    const list = this.dataManager.filteredInvestments;
    if (countSummary) {
      countSummary.textContent = `총 ${list.length}건 벤처 투자`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">검색 조건에 일치하는 투자 내역이 없습니다.</td></tr>`;
      if (paginationBar) paginationBar.innerHTML = '';
      return;
    }

    const pageSize = this.tablePageSize;
    const totalPages = Math.ceil(list.length / pageSize) || 1;
    if (!this.tableCurrentPage || this.tableCurrentPage < 1) this.tableCurrentPage = 1;
    if (this.tableCurrentPage > totalPages) this.tableCurrentPage = totalPages;

    const startIndex = (this.tableCurrentPage - 1) * pageSize;
    const pageItems = list.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageItems.map(inv => `
      <tr class="table-row-clickable" data-project-id="${inv.id}">
        <td>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <strong class="table-topic-text">${inv.startup_name}</strong>
            ${inv.startup_tech_tag ? `<span class="hud-tag" style="background: rgba(16, 185, 129, 0.18); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35); font-size: 10px; padding: 1px 6px;">${inv.startup_tech_tag}</span>` : ''}
          </div>
          ${inv.startup_tagline ? `<div style="font-size: 11px; color: #93c5fd; margin-top: 3px; font-weight: 500; line-height: 1.35;">💡 ${inv.startup_tagline}</div>` : ''}
          <span class="table-title-sub" style="display: block; margin-top: 2px;">${inv.startup_hq_city || ''}, ${inv.startup_hq_country || ''}</span>
        </td>
        <td><span class="table-company-text">${inv.investor_company}</span></td>
        <td><span class="table-inst-text">${inv.cvc_arm || '-'}</span></td>
        <td><span class="hud-tag" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3);">${inv.sector}</span></td>
        <td><strong class="table-uni-text">${inv.investment_round || '-'}</strong></td>
        <td><span class="table-funding-text">${inv.investment_amount_display || '-'}</span></td>
        <td>
          <span class="badge-status ${(inv.status || 'active') === 'active' ? 'badge-active' : 'badge-completed'}">
            ${(inv.status || 'active') === 'active' ? '진행중' : '완료'}
          </span>
          <span class="table-period-text">(${inv.investment_date || inv.investment_year})</span>
        </td>
      </tr>
    `).join('');

    // Pagination Controls
    if (paginationBar) {
      const cp = this.tableCurrentPage;
      let pageNumsHtml = '';
      const maxVisible = 7;
      let startPage = Math.max(1, cp - Math.floor(maxVisible / 2));
      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
      if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

      if (startPage > 1) pageNumsHtml += `<button class="page-btn page-num" data-page="1">1</button>`;
      if (startPage > 2) pageNumsHtml += `<span class="page-ellipsis">…</span>`;
      for (let i = startPage; i <= endPage; i++) {
        pageNumsHtml += `<button class="page-btn page-num ${i === cp ? 'active' : ''}" data-page="${i}">${i}</button>`;
      }
      if (endPage < totalPages - 1) pageNumsHtml += `<span class="page-ellipsis">…</span>`;
      if (endPage < totalPages) pageNumsHtml += `<button class="page-btn page-num" data-page="${totalPages}">${totalPages}</button>`;

      paginationBar.innerHTML = `
        <div class="pagination-left">
          <button class="page-btn" data-page="1" ${cp === 1 ? 'disabled' : ''}>⏮</button>
          <button class="page-btn" data-page="${cp - 1}" ${cp === 1 ? 'disabled' : ''}>◀</button>
          ${pageNumsHtml}
          <button class="page-btn" data-page="${cp + 1}" ${cp === totalPages ? 'disabled' : ''}>▶</button>
          <button class="page-btn" data-page="${totalPages}" ${cp === totalPages ? 'disabled' : ''}>⏭</button>
        </div>
        <div class="pagination-right">
          <span class="page-info-label">${startIndex + 1}-${Math.min(startIndex + pageSize, list.length)} / ${list.length}건</span>
          <select class="page-size-select" title="페이지 크기">
            <option value="15" ${pageSize === 15 ? 'selected' : ''}>15건</option>
            <option value="25" ${pageSize === 25 ? 'selected' : ''}>25건</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50건</option>
            <option value="100" ${pageSize === 100 ? 'selected' : ''}>100건</option>
          </select>
        </div>
      `;
    }
  }

  setTablePage(page) {
    this.tableCurrentPage = page;
    this.renderTableDirectory();
  }

  renderAnalytics() {
    const rankings = this.dataManager.getAnalyticsRankings(this.analyticsTopN);

    // Bar list renderer
    const renderBarList = (containerId, items, filterType) => {
      const container = document.getElementById(containerId);
      if (!container || !items || items.length === 0) {
        if (container) container.innerHTML = '<div class="analytics-empty">데이터 없음</div>';
        return;
      }
      const maxVal = Math.max(...items.map(i => i[1]), 1);

      container.innerHTML = items.map(([name, count]) => {
        const safeName = name.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        return `
          <div class="ranking-item" tabindex="0" role="button" data-filter-type="${filterType}" data-filter-value="${safeName}" title="클릭: '${name}' 관련 투자 전체 목록">
            <span class="ranking-name">${name}</span>
            <div class="ranking-bar-wrapper">
              <div class="ranking-bar" style="width: ${(count / maxVal) * 100}%;"></div>
            </div>
            <div class="ranking-count-wrapper">
              <strong class="ranking-count-num">${count}건</strong>
              <span class="ranking-arrow">➔</span>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.ranking-item').forEach(item => {
        item.addEventListener('click', () => {
          this.filterByAnalyticsItem(item.dataset.filterType, item.dataset.filterValue);
        });
      });
    };

    renderBarList('analytics-companies-list', rankings.topCompanies, 'company');
    renderBarList('analytics-startups-list', rankings.topStartups, 'startup');
    renderBarList('analytics-categories-list', rankings.categoryBreakdown, 'sector');
    renderBarList('analytics-rounds-list', rankings.roundBreakdown, 'round');

    // D3 Charts
    if (window.d3) {
      this.renderYearlyTrendChart();
      this.renderDomainDonutChart(rankings.categoryBreakdown);
      this.renderRegionalChart();
      this.renderCompanyTopicMatrix();
    }

    // Top-N button active states
    const topNBtns = document.querySelectorAll('.analytics-topn-btn');
    topNBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.topn) === this.analyticsTopN || (btn.dataset.topn === 'all' && this.analyticsTopN >= 999));
    });
  }

  renderYearlyTrendChart() {
    const container = document.getElementById('chart-yearly-trend');
    if (!container) return;
    container.innerHTML = '';

    const trendData = this.dataManager.getYearlyTrend();
    if (!trendData || trendData.length === 0) return;

    const margin = { top: 20, right: 20, bottom: 35, left: 45 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;
    if (width <= 0) return;

    const svg = d3.select(container).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(trendData.map(d => d.year)).range([0, width]).padding(0.3);
    const maxTotal = d3.max(trendData, d => d.total) || 1;
    const y = d3.scaleLinear().domain([0, maxTotal * 1.15]).range([height, 0]);

    // Grid
    svg.append('g').attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.06)');

    // Stacked Bars
    trendData.forEach(d => {
      const barWidth = x.bandwidth();
      // Completed / Acquired (bottom)
      svg.append('rect')
        .attr('x', x(d.year)).attr('y', y(d.completed))
        .attr('width', barWidth).attr('height', height - y(d.completed))
        .attr('fill', '#6b7280').attr('rx', 3).attr('opacity', 0.85);

      // Active (top)
      svg.append('rect')
        .attr('x', x(d.year)).attr('y', y(d.completed + d.active))
        .attr('width', barWidth).attr('height', y(d.completed) - y(d.completed + d.active))
        .attr('fill', '#3b82f6').attr('rx', 3).attr('opacity', 0.9);

      // Value label
      svg.append('text')
        .attr('x', x(d.year) + barWidth / 2).attr('y', y(d.total) - 5)
        .attr('text-anchor', 'middle').attr('fill', '#e5e7eb')
        .attr('font-size', '11px').attr('font-weight', '600')
        .text(`${d.total}건`);
    });

    // Axes
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d}년`))
      .selectAll('text').attr('fill', '#9ca3af').attr('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
      .selectAll('text').attr('fill', '#9ca3af').attr('font-size', '11px');

    svg.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.1)');

    const legend = d3.select(container).append('div').attr('class', 'chart-legend-inline');
    legend.html(`
      <span class="chart-legend-dot" style="background:#3b82f6"></span> 진행중 포트폴리오
      <span class="chart-legend-dot" style="background:#6b7280;margin-left:12px"></span> 회수/완료
    `);
  }

  renderDomainDonutChart(categoryData) {
    const container = document.getElementById('chart-domain-donut');
    if (!container || !categoryData || categoryData.length === 0) return;
    container.innerHTML = '';

    const width = Math.min(container.clientWidth, 260);
    const height = width;
    const radius = width / 2 - 10;
    if (radius <= 0) return;

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#14b8a6', '#eab308', '#a855f7', '#6366f1'];
    const total = categoryData.reduce((s, c) => s + c[1], 0);

    const svg = d3.select(container).append('svg')
      .attr('width', width).attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value(d => d[1]).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);
    const hoverArc = d3.arc().innerRadius(radius * 0.52).outerRadius(radius + 6);

    const arcs = svg.selectAll('.arc').data(pie(categoryData)).enter().append('g');

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colors[i % colors.length])
      .attr('stroke', '#0a0e17').attr('stroke-width', 2)
      .attr('opacity', 0.9)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).transition().duration(150).attr('d', hoverArc).attr('opacity', 1);
        centerLabel.text(`${d.data[0]}`);
        centerCount.text(`${d.data[1]}건 (${((d.data[1] / total) * 100).toFixed(1)}%)`);
      })
      .on('mouseleave', function() {
        d3.select(this).transition().duration(150).attr('d', arc).attr('opacity', 0.9);
        centerLabel.text('기술 섹터');
        centerCount.text(`${total}건`);
      })
      .on('click', (event, d) => {
        this.filterByAnalyticsItem('sector', d.data[0]);
      });

    // Center text
    const centerLabel = svg.append('text')
      .attr('text-anchor', 'middle').attr('y', -6)
      .attr('fill', '#9ca3af').attr('font-size', '11px')
      .text('기술 섹터');
    const centerCount = svg.append('text')
      .attr('text-anchor', 'middle').attr('y', 14)
      .attr('fill', '#f9fafb').attr('font-size', '16px').attr('font-weight', '700')
      .text(`${total}건`);

    // Legend
    const legendDiv = d3.select(container).append('div').attr('class', 'donut-legend');
    categoryData.forEach(([name, count], i) => {
      legendDiv.append('div').attr('class', 'donut-legend-item')
        .html(`<span class="chart-legend-dot" style="background:${colors[i % colors.length]}"></span> ${name} <span class="donut-legend-count">${count}</span>`);
    });
  }

  renderRegionalChart() {
    const container = document.getElementById('chart-regional-dist');
    if (!container) return;
    container.innerHTML = '';

    const regionData = this.dataManager.getRegionalDistribution();
    if (!regionData || regionData.length === 0) return;

    const margin = { top: 10, right: 50, bottom: 5, left: 120 };
    const barHeight = 28;
    const height = regionData.length * barHeight + margin.top + margin.bottom;
    const width = container.clientWidth - margin.left - margin.right;
    if (width <= 0) return;

    const regionColors = {
      '미국 (USA)': '#f59e0b',
      '한국 (South Korea)': '#3b82f6',
      '유럽 (Europe)': '#8b5cf6',
      '캐나다 (Canada)': '#ef4444',
      '이스라엘 (Israel)': '#06b6d4',
      '일본 (Japan)': '#ec4899',
      '기타 (Others)': '#6b7280'
    };

    const svg = d3.select(container).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxCount = d3.max(regionData, d => d.count) || 1;
    const x = d3.scaleLinear().domain([0, maxCount * 1.15]).range([0, width]);
    const y = d3.scaleBand().domain(regionData.map(d => d.region)).range([0, height - margin.top - margin.bottom]).padding(0.25);

    regionData.forEach(d => {
      svg.append('rect')
        .attr('x', 0).attr('y', y(d.region))
        .attr('width', x(d.count)).attr('height', y.bandwidth())
        .attr('fill', regionColors[d.region] || '#3b82f6')
        .attr('rx', 4).attr('opacity', 0.85);

      svg.append('text')
        .attr('x', x(d.count) + 6).attr('y', y(d.region) + y.bandwidth() / 2 + 4)
        .attr('fill', '#e5e7eb').attr('font-size', '12px').attr('font-weight', '600')
        .text(`${d.count}건`);
    });

    svg.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .selectAll('text').attr('fill', '#d1d5db').attr('font-size', '11px');
    svg.selectAll('.domain').remove();
  }

  renderCompanyTopicMatrix() {
    const container = document.getElementById('chart-company-topic-matrix');
    if (!container) return;
    container.innerHTML = '';

    const matrixData = this.dataManager.getCompanyTopicMatrix(10);
    if (!matrixData || !matrixData.companies || matrixData.companies.length === 0) {
      container.innerHTML = '<div class="analytics-empty">데이터 없음</div>';
      return;
    }

    const shortSectorNames = {
      'AI/ML Chips & Accelerators': 'AI 가속기',
      'Optical Interconnect & Photonics': '광인터커넥트',
      'Memory & Interconnect IP': 'CXL·메모리IP',
      'Chiplet & Advanced Architecture': '칩렛·RISC-V',
      'Power Semiconductors & SiC': '전력·SiC',
      'Edge AI & IoT': 'Edge AI·IoT',
      'Quantum Computing': '양자컴퓨팅',
      'Automotive & Sensors': '차량·센서',
      'Advanced Manufacturing': '첨단소재공정',
      'Software & EDA': 'EDA·SW',
      'Robotics & AI Applications': '로봇·응용AI'
    };

    let tableHtml = `
      <div class="matrix-table-wrapper">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="matrix-sticky-col">반도체 기업</th>
              <th>총 투자건수</th>
              ${matrixData.categories.map(c => `<th title="${c}">${shortSectorNames[c] || c}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    matrixData.companies.forEach(row => {
      const safeComp = row.company.replace(/"/g, '&quot;');
      tableHtml += `
        <tr>
          <td class="matrix-sticky-col">
            <span class="matrix-comp-name" data-filter-type="company" data-filter-value="${safeComp}" style="cursor:pointer;" title="클릭: '${row.company}' 벤처 투자 전체 목록">${row.company}</span>
          </td>
          <td><strong style="color: #38bdf8;">${row.total}건</strong></td>
          ${matrixData.categories.map(c => {
            const count = row.categories[c] || 0;
            const pct = row.total > 0 ? (count / row.total) * 100 : 0;
            const intensity = count > 0 ? Math.min(0.85, 0.15 + (count / row.total) * 1.2) : 0;
            const bg = count > 0 ? `rgba(59, 130, 246, ${intensity})` : 'rgba(255,255,255,0.02)';
            const safeCat = c.replace(/"/g, '&quot;');
            return `
              <td style="background: ${bg}; cursor: ${count > 0 ? 'pointer' : 'default'};" 
                  ${count > 0 ? `data-matrix-company="${safeComp}" data-matrix-category="${safeCat}"` : ''}
                  title="${row.company} ➔ ${c}: ${count}건 (${pct.toFixed(1)}%)">
                <span class="matrix-cell-val ${count > 0 ? 'has-data' : ''}">${count > 0 ? `${count}건` : '-'}</span>
                ${count > 0 ? `<div class="matrix-mini-pct">${pct.toFixed(0)}%</div>` : ''}
              </td>
            `;
          }).join('')}
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = tableHtml;

    container.addEventListener('click', (e) => {
      const compName = e.target.closest('[data-filter-type="company"]');
      if (compName) {
        this.filterByAnalyticsItem('company', compName.dataset.filterValue);
        return;
      }
      const cell = e.target.closest('[data-matrix-company]');
      if (cell) {
        this.filterByAnalyticsItem('company', cell.dataset.matrixCompany);
        this.dataManager.setFilter('sector', cell.dataset.matrixCategory);
        this.updateAllViews();
      }
    });
  }

  filterByAnalyticsItem(filterType, value) {
    this.dataManager.resetFilters();
    this.dataManager.setFilter(filterType, value);

    const searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = '';

    const selectMap = {
      company: 'filter-company',
      startup: 'filter-startup',
      sector: 'filter-category',
      round: 'filter-round',
      year: 'filter-year'
    };

    Object.values(selectMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 'all';
    });

    const targetSelectId = selectMap[filterType];
    if (targetSelectId) {
      const selectEl = document.getElementById(targetSelectId);
      if (selectEl) selectEl.value = value;
    }

    document.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
    const allPill = document.querySelector('.status-pill[data-status="all"]');
    if (allPill) allPill.classList.add('active');

    this.tableCurrentPage = 1;
    this.switchView('table');
    this.updateAllViews();
  }

  showInvestmentModal(investmentId) {
    const inv = this.dataManager.idMap.get(investmentId) || this.dataManager.rawInvestments.find(i => i.id === investmentId);
    if (!inv) return;

    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = `${inv.startup_name} (${inv.investment_round})`;

    const setField = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || '-';
    };

    setField('modal-topic', inv.sector);
    setField('modal-company', `${inv.investor_company} (${inv.cvc_arm || 'CVC 투자'})`);
    setField('modal-university', `${inv.startup_name} • ${inv.startup_hq_city || ''}, ${inv.startup_hq_country || ''}`);
    setField('modal-professor', inv.investment_round || '-');
    setField('modal-institute', inv.cvc_arm || 'CVC 투자');
    setField('modal-funding', `${inv.investment_amount_display || '-'} (누적/라운드 규모)`);
    setField('modal-period', `${inv.investment_date || inv.investment_year}년 투자 집행`);

    const statusEl = document.getElementById('modal-status');
    if (statusEl) {
      statusEl.innerHTML = `
        <span class="badge-status ${(inv.status || 'active') === 'active' ? 'badge-active' : 'badge-completed'}">
          ${(inv.status || 'active') === 'active' ? '진행중 (Active Portfolio)' : '회수/완료 (Exited)'}
        </span>
        <span style="font-size: 12px; color: #9ca3af; margin-left: 6px;">${inv.investment_round}</span>
      `;
    }

    const evidenceEl = document.getElementById('modal-evidence');
    if (evidenceEl) {
      if (inv.source_url) {
        evidenceEl.innerHTML = `
          <strong style="color: #60a5fa;">[공시/보도자료]</strong> 
          <a href="${inv.source_url}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">
            ${inv.source_url}
          </a>
        `;
      } else {
        evidenceEl.textContent = '공식 보도자료 및 CVC 포트폴리오 공시';
      }
    }

    const summaryEl = document.getElementById('modal-summary');
    if (summaryEl) {
      summaryEl.textContent = inv.startup_description || '스타트업 상세 설명이 제공되지 않았습니다.';
    }

    const phasesContainer = document.getElementById('modal-phases-container');
    if (phasesContainer) {
      if (inv.startup_tagline || (inv.syndicate_partners && inv.syndicate_partners.length > 0) || inv.startup_tech_tag) {
        phasesContainer.style.display = 'block';
        const syndicateChips = (inv.syndicate_partners || []).map(p => `
          <span class="hud-tag" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.4); font-size: 11px;">
            ${p}
          </span>
        `).join('');

        phasesContainer.innerHTML = `
          <div class="field-label">스타트업 기술 분류 & 공동 투자 신디케이트</div>
          <div style="margin-top: 6px; background: rgba(15, 23, 42, 0.6); border-radius: 6px; padding: 10px; border-left: 3px solid #38bdf8;">
            ${inv.startup_tagline ? `
              <div style="font-size: 13px; color: #38bdf8; font-weight: 700; margin-bottom: 6px;">
                💡 ${inv.startup_tagline}
              </div>
            ` : ''}
            ${inv.startup_tech_tag ? `
              <div style="margin-bottom: 8px;">
                <span class="hud-tag" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 600;">
                  🏷️ ${inv.startup_tech_tag}
                </span>
              </div>
            ` : ''}
            ${syndicateChips ? `
              <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px; font-weight: 600;">
                🤝 주요 공동 투자 파트너 (Syndicate):
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                ${syndicateChips}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        phasesContainer.style.display = 'none';
      }
    }

    const overlay = document.getElementById('project-detail-modal-overlay');
    if (overlay) overlay.classList.add('active');
  }

  closeModal() {
    const overlay = document.getElementById('project-detail-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  exportDataJson() {
    try {
      const payload = {
        metadata: this.dataManager.metadata,
        sectors: this.dataManager.sectors,
        investments: this.dataManager.rawInvestments
      };
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const dateStr = this.tracker ? this.tracker.formatDate(new Date()) : new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `semiconductor_cvc_venture_investments_${dateStr}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export venture JSON:', err);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new VentureApp();
  window.app.init();
});
