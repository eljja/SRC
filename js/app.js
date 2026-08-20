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
    // Search input
    const searchInput = document.getElementById('global-search-input');
    searchInput.addEventListener('input', (e) => {
      this.dataManager.setFilter('searchQuery', e.target.value);
      this.updateAllViews();
    });

    // Filters
    document.getElementById('filter-company').addEventListener('change', (e) => {
      this.dataManager.setFilter('company', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-university').addEventListener('change', (e) => {
      this.dataManager.setFilter('university', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-professor').addEventListener('change', (e) => {
      this.dataManager.setFilter('professor', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-institute').addEventListener('change', (e) => {
      this.dataManager.setFilter('institute', e.target.value);
      this.updateAllViews();
    });
    document.getElementById('filter-category').addEventListener('change', (e) => {
      this.dataManager.setFilter('category', e.target.value);
      this.updateAllViews();
    });

    // Status Pills
    const statusPills = document.querySelectorAll('.status-pill');
    statusPills.forEach(pill => {
      pill.addEventListener('click', () => {
        statusPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
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
        this.dataManager.setFilter('sortBy', btn.getAttribute('data-sort'));
        this.updateAllViews();
      });
    });

    // Reset button
    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      this.dataManager.resetFilters();
      searchInput.value = '';
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

    // Modal close
    document.getElementById('modal-close-btn').addEventListener('click', () => {
      this.closeModal();
    });
    document.getElementById('project-detail-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'project-detail-modal-overlay') {
        this.closeModal();
      }
    });

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
    if (!tbody) return;

    const list = this.dataManager.filteredProjects;
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #9ca3af; padding: 2rem;">검색 결과가 없습니다.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(p => `
      <tr style="cursor: pointer;" onclick="window.app.showProjectModal('${p.id}')">
        <td><strong style="color: #60a5fa;">${p.topic}</strong><br/><span style="font-size: 11px; color: #9ca3af;">${p.title}</span></td>
        <td><span style="color: #a78bfa; font-weight: 600;">${p.company}</span></td>
        <td><strong style="color: #38bdf8;">${p.university}</strong></td>
        <td><span style="color: #fbbf24;">${p.professor || '-'}</span></td>
        <td><span style="font-size: 11px; color: #34d399;">${p.institute_or_consortium || '-'}</span></td>
        <td><span>${p.funding_display || '-'}</span></td>
        <td>
          <span class="badge-status ${p.status === 'active' ? 'badge-active' : (p.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">
            ${p.status === 'active' ? '진행중' : (p.status === 'completed' ? '완료' : '추정')}
          </span>
          <span style="font-size: 11px; color: #6b7280; margin-left: 4px;">(${p.start_year}~${p.end_year})</span>
        </td>
      </tr>
    `).join('');
  }

  renderAnalytics() {
    const rankings = this.dataManager.getAnalyticsRankings();

    const renderBarList = (containerId, items) => {
      const container = document.getElementById(containerId);
      if (!container || !items || items.length === 0) return;
      const maxVal = Math.max(...items.map(i => i[1]), 1);

      container.innerHTML = items.map(([name, count]) => `
        <div class="ranking-item">
          <span style="width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
          <div class="ranking-bar-wrapper">
            <div class="ranking-bar" style="width: ${(count / maxVal) * 100}%;"></div>
          </div>
          <strong style="color: #06b6d4;">${count}건</strong>
        </div>
      `).join('');
    };

    renderBarList('analytics-companies-list', rankings.topCompanies);
    renderBarList('analytics-unis-list', rankings.topUniversities);
    renderBarList('analytics-institutes-list', rankings.topInstitutes);
    renderBarList('analytics-categories-list', rankings.categoryBreakdown);
  }

  showProjectModal(projectId) {
    const project = this.dataManager.rawProjects.find(p => p.id === projectId);
    if (!project) return;

    document.getElementById('modal-title').textContent = project.title;
    document.getElementById('modal-topic').textContent = project.topic;
    document.getElementById('modal-company').textContent = project.company;
    document.getElementById('modal-university').textContent = `${project.university} (${project.university_city || ''}, ${project.university_country || ''})`;
    document.getElementById('modal-professor').textContent = project.professor || '미지정';
    document.getElementById('modal-institute').textContent = project.institute_or_consortium || '해당 없음';
    document.getElementById('modal-funding').textContent = `${project.funding_display} (지원처: ${project.funding_source || '-'})`;
    document.getElementById('modal-period').textContent = `${project.start_year}년 ~ ${project.end_year}년 (${project.duration_years || 3}개년)`;
    document.getElementById('modal-status').innerHTML = `
      <span class="badge-status ${project.status === 'active' ? 'badge-active' : (project.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">
        ${project.status === 'active' ? '진행중 (Active)' : (project.status === 'completed' ? '완료 (Completed)' : '불확실/추정 (Uncertain)')}
      </span>
      <span style="font-size: 12px; color: #9ca3af; margin-left: 6px;">${project.status_detail || ''}</span>
    `;
    document.getElementById('modal-evidence').innerHTML = `
      <strong style="color: #60a5fa;">[${project.evidence_type}]</strong> ${project.evidence_ref}
    `;
    document.getElementById('modal-summary').textContent = project.summary || '프로젝트 상세 정보가 없습니다.';

    document.getElementById('project-detail-modal-overlay').classList.add('active');
  }

  closeModal() {
    document.getElementById('project-detail-modal-overlay').classList.remove('active');
  }

  exportDataJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      metadata: this.dataManager.metadata,
      projects: this.dataManager.rawProjects
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `semiconductor_rd_network_${this.tracker.formatDate(new Date())}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
