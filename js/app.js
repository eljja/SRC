/**
 * Main Application Coordinator (App.js)
 * Initializes all views, manages filter bindings, view tabs, details modals, and exports.
 */
class App {
  constructor() {
    this.dataManager = new DataManager();
    this.tracker = null;
    this.mapView = null;
    this.networkView = null;
    this.currentView = 'map'; // 'map' | 'network' | 'table' | 'analytics'
    this.tableCurrentPage = 1;
    this.tablePageSize = 40;
    this.analyticsTopN = 10;
    this.analyticsSortBy = 'count'; // 'count' | 'funding'
    this._searchDebounceTimer = null;
  }

  async init() {
    console.log('Initializing SRC Global Semiconductor Observatory...');
    const data = await this.dataManager.loadData();
    if (!data) {
      alert('데이터를 불러오는데 실패했습니다.');
      return;
    }

    // Initialize Tracker
    this.tracker = new Tracker(data.metadata);
    this.tracker.renderHeaderBadge('header-freshness-badge-container');

    // Initialize Views
    this.mapView = new MapView('map-container', (id) => this.showProjectModal(id));
    this.networkView = new NetworkView('network-container', (id) => this.showProjectModal(id));

    // Populate Sidebar Dropdowns
    this.populateDropdowns();

    // Bind UI Event Listeners
    this.bindEventListeners();

    // Initial Render
    this.updateAllViews();
  }

  populateDropdowns() {
    // Companies
    const compSelect = document.getElementById('filter-company');
    const companies = this.dataManager.getUniqueCompanies();
    companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      compSelect.appendChild(opt);
    });

    // Universities
    const uniSelect = document.getElementById('filter-university');
    const universities = this.dataManager.getUniqueUniversities();
    universities.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      uniSelect.appendChild(opt);
    });

    // Professors
    const profSelect = document.getElementById('filter-professor');
    const professors = this.dataManager.getUniqueProfessors();
    professors.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      profSelect.appendChild(opt);
    });

    // Institutes
    const instSelect = document.getElementById('filter-institute');
    const institutes = this.dataManager.getUniqueInstitutes();
    institutes.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      instSelect.appendChild(opt);
    });

    // Categories
    const catSelect = document.getElementById('filter-category');
    this.dataManager.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
  }

  bindEventListeners() {
    // Search input with 250ms debounce
    const searchInput = document.getElementById('global-search-input');
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

    // Search clear button
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        this.dataManager.setFilter('searchQuery', '');
        this.tableCurrentPage = 1;
        this.updateAllViews();
      });
    }

    // Filters
    document.getElementById('filter-company').addEventListener('change', (e) => {
      this.tableCurrentPage = 1;
      this.dataManager.setFilter('company', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-university').addEventListener('change', (e) => {
      this.tableCurrentPage = 1;
      this.dataManager.setFilter('university', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-professor').addEventListener('change', (e) => {
      this.tableCurrentPage = 1;
      this.dataManager.setFilter('professor', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-institute').addEventListener('change', (e) => {
      this.tableCurrentPage = 1;
      this.dataManager.setFilter('institute', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-category').addEventListener('change', (e) => {
      this.tableCurrentPage = 1;
      this.dataManager.setFilter('category', e.target.value);
      this.updateAllViews();
    });

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
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      this.tableCurrentPage = 1;
      this.dataManager.resetFilters();
      searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
      document.getElementById('filter-company').value = 'all';
      document.getElementById('filter-university').value = 'all';
      document.getElementById('filter-professor').value = 'all';
      document.getElementById('filter-institute').value = 'all';
      document.getElementById('filter-category').value = 'all';
      statusPills.forEach(p => p.classList.remove('active'));
      document.querySelector('.status-pill[data-status="all"]').classList.add('active');
      this.updateAllViews();
    });

    // View tab switching
    const viewTabs = document.querySelectorAll('.view-tab-btn');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetView = tab.getAttribute('data-view');
        this.switchView(targetView);
      });
    });

    // Modal close (button, overlay, and Escape key)
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      this.closeModal();
    });
    document.getElementById('project-detail-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'project-detail-modal-overlay') {
        this.closeModal();
      }
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    // Mobile sidebar drawer toggle
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
    document.getElementById('btn-export-json').addEventListener('click', () => {
      this.exportDataJson();
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.view-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));
    document.getElementById(`${viewName}-view`).classList.add('active');

    if (viewName === 'map') {
      setTimeout(() => this.mapView.resize(), 100);
      this.mapView.render(this.dataManager.filteredProjects);
    } else if (viewName === 'network') {
      this.networkView.render(this.dataManager.filteredProjects);
    } else if (viewName === 'table') {
      this.renderTableDirectory();
    } else if (viewName === 'analytics') {
      this.renderAnalytics();
    }
  }

  updateAllViews() {
    const stats = this.dataManager.getSummaryStats();
    document.getElementById('stat-total-count').textContent = stats.total;
    document.getElementById('stat-active-count').textContent = stats.active;
    document.getElementById('stat-funding-total').textContent = stats.totalFundingFormatted;

    if (this.currentView === 'map') {
      this.mapView.render(this.dataManager.filteredProjects);
    } else if (this.currentView === 'network') {
      this.networkView.render(this.dataManager.filteredProjects);
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

    const list = this.dataManager.filteredProjects;
    if (countSummary) {
      countSummary.textContent = `총 ${list.length}개 과제`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">검색 결과가 없습니다.</td></tr>`;
      if (paginationBar) paginationBar.innerHTML = '';
      return;
    }

    const pageSize = this.tablePageSize;
    const totalPages = Math.ceil(list.length / pageSize);
    if (!this.tableCurrentPage || this.tableCurrentPage < 1) this.tableCurrentPage = 1;
    if (this.tableCurrentPage > totalPages) this.tableCurrentPage = totalPages;

    const startIndex = (this.tableCurrentPage - 1) * pageSize;
    const pageItems = list.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageItems.map(p => `
      <tr class="table-row-clickable" data-project-id="${p.id}">
        <td>
          <strong class="table-topic-text">${p.topic}</strong><br/>
          <span class="table-title-sub">${p.title}</span>
          ${p.phases && p.phases.length > 1 ? `<span class="hud-tag phase-tag">${p.phases.length}단계 연계</span>` : ''}
        </td>
        <td><span class="table-company-text">${p.company}</span></td>
        <td><strong class="table-uni-text">${p.university}</strong></td>
        <td><span class="table-prof-text">${p.professor || '-'}</span></td>
        <td><span class="table-inst-text">${p.institute_or_consortium || '-'}</span></td>
        <td><span class="table-funding-text">${p.funding_display || '-'}</span></td>
        <td>
          <span class="badge-status ${p.status === 'active' ? 'badge-active' : (p.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">
            ${p.status === 'active' ? '진행중' : (p.status === 'completed' ? '완료' : '추정')}
          </span>
          <span class="table-period-text">(${p.start_year}~${p.end_year})</span>
        </td>
      </tr>
    `).join('');

    // Event delegation for table rows
    tbody.querySelectorAll('.table-row-clickable').forEach(row => {
      row.addEventListener('click', () => {
        this.showProjectModal(row.getAttribute('data-project-id'));
      });
    });

    // Enhanced Pagination Bar with page numbers
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
            <option value="20" ${pageSize === 20 ? 'selected' : ''}>20건</option>
            <option value="40" ${pageSize === 40 ? 'selected' : ''}>40건</option>
            <option value="100" ${pageSize === 100 ? 'selected' : ''}>100건</option>
          </select>
        </div>
      `;

      // Bind page buttons via event delegation
      paginationBar.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const page = parseInt(btn.getAttribute('data-page'));
          if (!isNaN(page) && page >= 1 && page <= totalPages) this.setTablePage(page);
        });
      });

      // Bind page size selector
      const pageSizeSelect = paginationBar.querySelector('.page-size-select');
      if (pageSizeSelect) {
        pageSizeSelect.addEventListener('change', (e) => {
          this.tablePageSize = parseInt(e.target.value);
          this.tableCurrentPage = 1;
          this.renderTableDirectory();
        });
      }
    }
  }

  setTablePage(page) {
    this.tableCurrentPage = page;
    this.renderTableDirectory();
  }

  renderAnalytics() {
    const rankings = this.dataManager.getAnalyticsRankings(this.analyticsTopN);

    // Render ranking bar lists
    const renderBarList = (containerId, items, filterType) => {
      const container = document.getElementById(containerId);
      if (!container || !items || items.length === 0) {
        if (container) container.innerHTML = '<div class="analytics-empty">데이터 없음</div>';
        return;
      }
      const maxVal = Math.max(...items.map(i => i[1]), 1);

      container.innerHTML = items.map(([name, count]) => {
        const safeName = name.replace(/'/g, "\\'").replace(/"/g, "&quot;");
        return `
          <div class="ranking-item" tabindex="0" role="button" data-filter-type="${filterType}" data-filter-value="${safeName}" title="클릭: '${name}' 과제 전체 목록">
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

      // Event delegation for ranking items
      container.querySelectorAll('.ranking-item').forEach(item => {
        item.addEventListener('click', () => {
          this.filterByAnalyticsItem(item.dataset.filterType, item.dataset.filterValue);
        });
      });
    };

    renderBarList('analytics-companies-list', rankings.topCompanies, 'company');
    renderBarList('analytics-unis-list', rankings.topUniversities, 'university');
    renderBarList('analytics-professors-list', rankings.topProfessors, 'professor');
    renderBarList('analytics-institutes-list', rankings.topInstitutes, 'institute');
    renderBarList('analytics-categories-list', rankings.categoryBreakdown, 'category');

    // Render D3 Charts
    this.renderYearlyTrendChart();
    this.renderDomainDonutChart(rankings.categoryBreakdown);
    this.renderRegionalChart();

    // Bind Top-N toggle if present
    const topNBtns = document.querySelectorAll('.analytics-topn-btn');
    topNBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.topn) === this.analyticsTopN || (btn.dataset.topn === 'all' && this.analyticsTopN >= 999));
      btn.addEventListener('click', () => {
        topNBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.analyticsTopN = btn.dataset.topn === 'all' ? 999 : parseInt(btn.dataset.topn);
        this.renderAnalytics();
      });
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
    const maxTotal = d3.max(trendData, d => d.total);
    const y = d3.scaleLinear().domain([0, maxTotal * 1.1]).range([height, 0]);

    // Grid lines
    svg.append('g').attr('class', 'chart-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
      .selectAll('line').attr('stroke', 'rgba(255,255,255,0.06)');

    // Stacked bars
    trendData.forEach(d => {
      const barWidth = x.bandwidth();
      // Completed (bottom)
      svg.append('rect')
        .attr('x', x(d.year)).attr('y', y(d.completed))
        .attr('width', barWidth).attr('height', height - y(d.completed))
        .attr('fill', '#6b7280').attr('rx', 3).attr('opacity', 0.85);
      // Active (stacked on top)
      svg.append('rect')
        .attr('x', x(d.year)).attr('y', y(d.completed + d.active))
        .attr('width', barWidth).attr('height', y(d.completed) - y(d.completed + d.active))
        .attr('fill', '#10b981').attr('rx', 3).attr('opacity', 0.9);
      // Total label
      svg.append('text')
        .attr('x', x(d.year) + barWidth / 2).attr('y', y(d.total) - 5)
        .attr('text-anchor', 'middle').attr('fill', '#e5e7eb')
        .attr('font-size', '11px').attr('font-weight', '600')
        .text(d.total);
    });

    // Axes
    svg.append('g').attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => d))
      .selectAll('text').attr('fill', '#9ca3af').attr('font-size', '11px');
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format('d')))
      .selectAll('text').attr('fill', '#9ca3af').attr('font-size', '11px');

    // Remove domain lines
    svg.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.1)');

    // Legend
    const legend = d3.select(container).append('div').attr('class', 'chart-legend-inline');
    legend.html(`
      <span class="chart-legend-dot" style="background:#10b981"></span> 진행중
      <span class="chart-legend-dot" style="background:#6b7280;margin-left:12px"></span> 완료
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

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899'];
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
        centerLabel.text('기술 도메인');
        centerCount.text(`${total}건`);
      })
      .on('click', (event, d) => {
        this.filterByAnalyticsItem('category', d.data[0]);
      });

    // Center text
    const centerLabel = svg.append('text')
      .attr('text-anchor', 'middle').attr('y', -6)
      .attr('fill', '#9ca3af').attr('font-size', '11px')
      .text('기술 도메인');
    const centerCount = svg.append('text')
      .attr('text-anchor', 'middle').attr('y', 14)
      .attr('fill', '#f9fafb').attr('font-size', '16px').attr('font-weight', '700')
      .text(`${total}건`);

    // Color legend below
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
      '한국 (South Korea)': '#3b82f6',
      '미국 (USA)': '#f59e0b',
      '대만 (Taiwan)': '#10b981',
      '유럽 (Europe)': '#8b5cf6',
      '일본 (Japan)': '#f43f5e',
      '중국 (China)': '#ec4899',
      '기타 (Others)': '#6b7280'
    };

    const svg = d3.select(container).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxCount = d3.max(regionData, d => d.count);
    const x = d3.scaleLinear().domain([0, maxCount * 1.15]).range([0, width]);
    const y = d3.scaleBand().domain(regionData.map(d => d.region)).range([0, height - margin.top - margin.bottom]).padding(0.25);

    regionData.forEach(d => {
      svg.append('rect')
        .attr('x', 0).attr('y', y(d.region))
        .attr('width', x(d.count)).attr('height', y.bandwidth())
        .attr('fill', regionColors[d.region] || '#6b7280')
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

  filterByAnalyticsItem(filterType, value) {
    // 1. Reset all filters and set the selected filter
    this.dataManager.resetFilters();
    this.dataManager.setFilter(filterType, value);

    // 2. Sync sidebar form inputs
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) searchInput.value = '';

    const selectMap = {
      company: 'filter-company',
      university: 'filter-university',
      professor: 'filter-professor',
      institute: 'filter-institute',
      category: 'filter-category'
    };

    // Reset all dropdowns to 'all'
    Object.values(selectMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = 'all';
    });

    // Select the target dropdown option
    const targetSelectId = selectMap[filterType];
    if (targetSelectId) {
      const selectEl = document.getElementById(targetSelectId);
      if (selectEl) {
        let found = false;
        for (let i = 0; i < selectEl.options.length; i++) {
          if (selectEl.options[i].value === value) {
            selectEl.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (!found) {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = value;
          selectEl.appendChild(opt);
          selectEl.value = value;
        }
      }
    }

    // Reset status pills to 'all'
    document.querySelectorAll('.status-pill').forEach(p => p.classList.remove('active'));
    const allPill = document.querySelector('.status-pill[data-status="all"]');
    if (allPill) allPill.classList.add('active');

    // 3. Reset table pagination to page 1
    this.tableCurrentPage = 1;

    // 4. Switch view to Table Directory (전체 목록) and render filtered results
    this.switchView('table');
    this.updateAllViews();
  }

  showProjectModal(projectId) {
    const project = this.dataManager.rawProjects.find(p => p.id === projectId);
    if (!project) return;

    document.getElementById('modal-title').textContent = project.title || '과제 상세';
    document.getElementById('modal-topic').textContent = project.topic || '-';
    document.getElementById('modal-company').textContent = project.company || '-';
    document.getElementById('modal-university').textContent = `${project.university || '-'} (${project.university_city || ''}, ${project.university_country || ''})`;
    document.getElementById('modal-professor').textContent = project.professor || '미지정';
    document.getElementById('modal-institute').textContent = project.institute_or_consortium || '해당 없음';
    document.getElementById('modal-funding').textContent = `${project.funding_display || '-'} (지원처: ${project.funding_source || '-'})`;
    document.getElementById('modal-period').textContent = `${project.start_year || '-'}년 ~ ${project.end_year || '-'}년 (${project.duration_years || 3}개년)`;
    document.getElementById('modal-status').innerHTML = `
      <span class="badge-status ${project.status === 'active' ? 'badge-active' : (project.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">
        ${project.status === 'active' ? '진행중 (Active)' : (project.status === 'completed' ? '완료 (Completed)' : '불확실/추정 (Uncertain)')}
      </span>
      <span style="font-size: 12px; color: #9ca3af; margin-left: 6px;">${project.status_detail || ''}</span>
    `;
    document.getElementById('modal-evidence').innerHTML = `
      <strong style="color: #60a5fa;">[${project.evidence_type || '참고문헌'}]</strong> ${project.evidence_ref || '-'}
    `;
    document.getElementById('modal-summary').textContent = project.summary || '프로젝트 상세 정보가 없습니다.';

    // Render Phases if available
    const phasesContainer = document.getElementById('modal-phases-container');
    const phasesList = document.getElementById('modal-phases-list');
    if (project.phases && project.phases.length > 0) {
      phasesList.innerHTML = project.phases.map(ph => `
        <div class="modal-phase-item">
          <div class="phase-dot"></div>
          <div class="phase-text">${ph}</div>
        </div>
      `).join('');
      phasesContainer.style.display = 'block';
    } else {
      phasesContainer.style.display = 'none';
    }

    document.getElementById('project-detail-modal-overlay').classList.add('active');
  }

  closeModal() {
    document.getElementById('project-detail-modal-overlay').classList.remove('active');
  }

  exportDataJson() {
    try {
      const exportPayload = {
        metadata: this.dataManager.metadata,
        projects: this.dataManager.rawProjects
      };
      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const dateStr = this.tracker ? this.tracker.formatDate(new Date()) : new Date().toISOString().split('T')[0];
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `semiconductor_rd_network_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export JSON:', err);
    }
  }

  toggleMapPopupMore(btn) {
    const container = btn.closest('.map-node-popup-content');
    if (!container) return;
    const hiddenItems = container.querySelectorAll('.map-popup-project-item');
    const isExpanded = btn.getAttribute('data-expanded') === 'true';

    if (isExpanded) {
      hiddenItems.forEach((item, idx) => {
        if (idx >= 4) item.style.display = 'none';
      });
      btn.setAttribute('data-expanded', 'false');
      btn.innerHTML = `🔽 + 외 ${hiddenItems.length - 4}개 산학 과제 팝업에서 펼치기`;
    } else {
      hiddenItems.forEach(item => {
        item.style.display = 'block';
      });
      btn.setAttribute('data-expanded', 'true');
      btn.innerHTML = `🔼 목록 접기`;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
