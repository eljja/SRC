/**
 * DataManager Module
 * Handles dataset loading, multi-dimensional filtering, sorting, and statistical aggregations.
 */
class DataManager {
  constructor() {
    this.rawProjects = [];
    this.filteredProjects = [];
    this.metadata = null;
    this.categories = [];
    this.filters = {
      searchQuery: '',
      company: 'all',
      university: 'all',
      professor: 'all',
      institute: 'all',
      category: 'all',
      status: 'all',
      sortBy: 'start_year_desc'
    };
  }

  async loadData() {
    try {
      const response = await fetch('data/collaborations.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      this.metadata = json.metadata;
      this.categories = json.categories || [];
      this.rawProjects = json.projects || [];
      this.filteredProjects = [...this.rawProjects];
      return {
        metadata: this.metadata,
        categories: this.categories,
        projects: this.rawProjects
      };
    } catch (err) {
      console.error('Failed to load collaborations data:', err);
      return null;
    }
  }

  setFilter(key, value) {
    this.filters[key] = value;
    this.applyFilters();
  }

  resetFilters() {
    this.filters = {
      searchQuery: '',
      company: 'all',
      university: 'all',
      professor: 'all',
      institute: 'all',
      category: 'all',
      status: 'all',
      sortBy: 'start_year_desc'
    };
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.rawProjects];

    // Search query filter (title, topic, professor, university, company, summary)
    if (this.filters.searchQuery && this.filters.searchQuery.trim() !== '') {
      const q = this.filters.searchQuery.toLowerCase().trim();
      result = result.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.topic && p.topic.toLowerCase().includes(q)) ||
        (p.professor && p.professor.toLowerCase().includes(q)) ||
        (p.university && p.university.toLowerCase().includes(q)) ||
        (p.company && p.company.toLowerCase().includes(q)) ||
        (p.institute_or_consortium && p.institute_or_consortium.toLowerCase().includes(q)) ||
        (p.summary && p.summary.toLowerCase().includes(q))
      );
    }

    // Company filter
    if (this.filters.company !== 'all') {
      result = result.filter(p => p.company && p.company.includes(this.filters.company));
    }

    // University filter
    if (this.filters.university !== 'all') {
      result = result.filter(p => p.university && p.university.includes(this.filters.university));
    }

    // Professor filter
    if (this.filters.professor !== 'all') {
      result = result.filter(p => p.professor && p.professor.includes(this.filters.professor));
    }

    // Institute / Consortium filter
    if (this.filters.institute !== 'all') {
      result = result.filter(p => p.institute_or_consortium && p.institute_or_consortium.includes(this.filters.institute));
    }

    // Category / Domain filter
    if (this.filters.category !== 'all') {
      result = result.filter(p => p.category === this.filters.category);
    }

    // Status filter
    if (this.filters.status !== 'all') {
      result = result.filter(p => p.status === this.filters.status);
    }

    // Sorting
    result = this.sortProjects(result, this.filters.sortBy);

    this.filteredProjects = result;
    return this.filteredProjects;
  }

  sortProjects(list, sortBy) {
    const sorted = [...list];
    switch (sortBy) {
      case 'company':
        return sorted.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
      case 'university':
        return sorted.sort((a, b) => (a.university || '').localeCompare(b.university || ''));
      case 'professor':
        return sorted.sort((a, b) => (a.professor || '').localeCompare(b.professor || ''));
      case 'institute':
        return sorted.sort((a, b) => (a.institute_or_consortium || '').localeCompare(b.institute_or_consortium || ''));
      case 'funding_desc':
        return sorted.sort((a, b) => (b.funding_amount_usd || 0) - (a.funding_amount_usd || 0));
      case 'start_year_desc':
      default:
        return sorted.sort((a, b) => (b.start_year || 0) - (a.start_year || 0));
    }
  }

  getUniqueCompanies() {
    const set = new Set();
    this.rawProjects.forEach(p => {
      if (p.company) {
        // handle slash separated
        p.company.split('/').forEach(c => set.add(c.trim()));
      }
    });
    return Array.from(set).sort();
  }

  getUniqueUniversities() {
    const set = new Set();
    this.rawProjects.forEach(p => {
      if (p.university) {
        p.university.split('/').forEach(u => set.add(u.trim()));
      }
    });
    return Array.from(set).sort();
  }

  getUniqueProfessors() {
    const set = new Set();
    this.rawProjects.forEach(p => {
      if (p.professor && p.professor !== '-' && p.professor !== '미지정') {
        set.add(p.professor.trim());
      }
    });
    return Array.from(set).sort();
  }

  getUniqueInstitutes() {
    const set = new Set();
    this.rawProjects.forEach(p => {
      if (p.institute_or_consortium && p.institute_or_consortium !== '-' && p.institute_or_consortium !== '해당 없음') {
        set.add(p.institute_or_consortium.trim());
      }
    });
    return Array.from(set).sort();
  }

  getSummaryStats() {
    const total = this.filteredProjects.length;
    const active = this.filteredProjects.filter(p => p.status === 'active').length;
    const completed = this.filteredProjects.filter(p => p.status === 'completed').length;
    const totalFunding = this.filteredProjects.reduce((sum, p) => sum + (p.funding_amount_usd || 0), 0);

    return {
      total,
      active,
      completed,
      totalFundingUsd: totalFunding,
      totalFundingFormatted: '$' + (totalFunding / 1000000).toFixed(1) + 'M'
    };
  }

  getAnalyticsRankings() {
    // Top Companies
    const companyCount = {};
    // Top Universities
    const uniCount = {};
    // Top Professors / PIs
    const profCount = {};
    // Top Institutes
    const instCount = {};
    // Domain breakdown
    const categoryCount = {};

    const projectsToCount = this.filteredProjects.length > 0 ? this.filteredProjects : this.rawProjects;

    projectsToCount.forEach(p => {
      if (p.company) {
        p.company.split('/').forEach(c => {
          const item = c.trim();
          if (item) companyCount[item] = (companyCount[item] || 0) + 1;
        });
      }
      if (p.university) {
        p.university.split('/').forEach(u => {
          const item = u.trim();
          if (item) uniCount[item] = (uniCount[item] || 0) + 1;
        });
      }
      if (p.professor && p.professor !== '-' && p.professor !== '미지정') {
        const item = p.professor.trim();
        profCount[item] = (profCount[item] || 0) + 1;
      }
      if (p.institute_or_consortium && p.institute_or_consortium !== '-' && p.institute_or_consortium !== '해당 없음') {
        const item = p.institute_or_consortium.trim();
        instCount[item] = (instCount[item] || 0) + 1;
      }
      if (p.category) {
        categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
      }
    });

    const sortObject = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    return {
      topCompanies: sortObject(companyCount).slice(0, 8),
      topUniversities: sortObject(uniCount).slice(0, 8),
      topProfessors: sortObject(profCount).slice(0, 8),
      topInstitutes: sortObject(instCount).slice(0, 8),
      categoryBreakdown: sortObject(categoryCount)
    };
  }
}

window.DataManager = DataManager;
