/**
 * VentureDataManager Module
 * Handles semiconductor CVC and strategic startup investment dataset loading,
 * multi-dimensional filtering, sorting, and analytics aggregations.
 */
class VentureDataManager {
  constructor() {
    this.rawInvestments = [];
    this.filteredInvestments = [];
    this.metadata = null;
    this.sectors = [];
    this.idMap = new Map();
    this.filters = {
      searchQuery: '',
      company: 'all',
      startup: 'all',
      sector: 'all',
      round: 'all',
      year: 'all',
      status: 'all',
      sortBy: 'year_desc'
    };
    this._analyticsCache = new Map();
  }

  async loadData() {
    try {
      const response = await fetch('data/ventures.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      this.metadata = json.metadata || {};
      this.sectors = json.sectors || [];
      this.rawInvestments = json.investments || [];

      // Pre-compute fast search index string
      this.rawInvestments.forEach(inv => {
        this.idMap.set(inv.id, inv);
        inv._searchStr = [
          inv.investor_company,
          inv.cvc_arm,
          inv.startup_name,
          inv.sector,
          inv.investment_round,
          inv.investment_amount_display,
          inv.startup_description,
          inv.startup_hq_city,
          inv.startup_hq_country,
          inv.investment_year?.toString()
        ].filter(Boolean).join(' ').toLowerCase();
      });

      this.filteredInvestments = [...this.rawInvestments];
      this._analyticsCache.clear();

      return {
        metadata: this.metadata,
        sectors: this.sectors,
        investments: this.rawInvestments
      };
    } catch (err) {
      console.error('Failed to load venture investments data:', err);
      return null;
    }
  }

  setFilter(key, value) {
    this.filters[key] = value;
    this._analyticsCache.clear();
    this.applyFilters();
  }

  resetFilters() {
    this.filters = {
      searchQuery: '',
      company: 'all',
      startup: 'all',
      sector: 'all',
      round: 'all',
      year: 'all',
      status: 'all',
      sortBy: 'year_desc'
    };
    this._analyticsCache.clear();
    this.applyFilters();
  }

  _filterHash() {
    return JSON.stringify(this.filters);
  }

  applyFilters() {
    let result = this.rawInvestments;

    // Search query filter (tokenized across pre-computed search string)
    if (this.filters.searchQuery) {
      const terms = this.filters.searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      result = result.filter(inv => {
        const text = inv._searchStr || '';
        return terms.every(term => text.includes(term));
      });
    }

    // Investor company filter
    if (this.filters.company !== 'all') {
      result = result.filter(inv => inv.investor_company === this.filters.company);
    }

    // Startup filter
    if (this.filters.startup !== 'all') {
      result = result.filter(inv => inv.startup_name === this.filters.startup);
    }

    // Sector / Category filter
    if (this.filters.sector !== 'all') {
      result = result.filter(inv => inv.sector === this.filters.sector);
    }

    // Investment round filter
    if (this.filters.round !== 'all') {
      result = result.filter(inv => inv.investment_round === this.filters.round);
    }

    // Investment year filter
    if (this.filters.year !== 'all') {
      result = result.filter(inv => (inv.investment_year || '').toString() === this.filters.year.toString());
    }

    // Status filter
    if (this.filters.status !== 'all') {
      result = result.filter(inv => (inv.status || 'active') === this.filters.status);
    }

    // Sorting
    result = this.sortInvestments(result, this.filters.sortBy);

    this.filteredInvestments = result;
    return this.filteredInvestments;
  }

  sortInvestments(list, sortBy) {
    const sorted = [...list];
    switch (sortBy) {
      case 'amount_desc':
        return sorted.sort((a, b) => (b.investment_amount_usd || 0) - (a.investment_amount_usd || 0));
      case 'company':
        return sorted.sort((a, b) => (a.investor_company || '').localeCompare(b.investor_company || ''));
      case 'startup':
        return sorted.sort((a, b) => (a.startup_name || '').localeCompare(b.startup_name || ''));
      case 'year_desc':
      default:
        return sorted.sort((a, b) => {
          const ya = a.investment_year || 0;
          const yb = b.investment_year || 0;
          if (yb !== ya) return yb - ya;
          return (a.investment_date || '').localeCompare(b.investment_date || '') * -1;
        });
    }
  }

  getUniqueCompanies() {
    const set = new Set();
    this.rawInvestments.forEach(inv => {
      if (inv.investor_company) set.add(inv.investor_company.trim());
    });
    return Array.from(set).sort();
  }

  getUniqueStartups() {
    const set = new Set();
    this.rawInvestments.forEach(inv => {
      if (inv.startup_name) set.add(inv.startup_name.trim());
    });
    return Array.from(set).sort();
  }

  getUniqueSectors() {
    if (this.sectors && this.sectors.length > 0) return this.sectors;
    const set = new Set();
    this.rawInvestments.forEach(inv => {
      if (inv.sector) set.add(inv.sector.trim());
    });
    return Array.from(set).sort();
  }

  getUniqueRounds() {
    const set = new Set();
    this.rawInvestments.forEach(inv => {
      if (inv.investment_round) set.add(inv.investment_round.trim());
    });
    return Array.from(set).sort();
  }

  getUniqueYears() {
    const set = new Set();
    this.rawInvestments.forEach(inv => {
      if (inv.investment_year) set.add(inv.investment_year.toString());
    });
    return Array.from(set).sort((a, b) => parseInt(b) - parseInt(a));
  }

  getSummaryStats() {
    const total = this.filteredInvestments.length;
    const active = this.filteredInvestments.filter(inv => (inv.status || 'active') === 'active').length;
    const completed = this.filteredInvestments.filter(inv => inv.status === 'completed' || inv.status === 'acquired').length;
    const totalFunding = this.filteredInvestments.reduce((sum, inv) => sum + (inv.investment_amount_usd || 0), 0);

    let formatted = '$0';
    if (totalFunding >= 1e9) {
      formatted = '$' + (totalFunding / 1e9).toFixed(2) + 'B';
    } else if (totalFunding >= 1e6) {
      formatted = '$' + (totalFunding / 1e6).toFixed(1) + 'M';
    } else if (totalFunding > 0) {
      formatted = '$' + totalFunding.toLocaleString();
    }

    return {
      total,
      active,
      completed,
      totalFundingUsd: totalFunding,
      totalFundingFormatted: formatted
    };
  }

  getAnalyticsRankings(topN = 10) {
    const cacheKey = `rankings_${this._filterHash()}_${topN}`;
    if (this._analyticsCache.has(cacheKey)) {
      return this._analyticsCache.get(cacheKey);
    }

    const companyCount = {};
    const startupCount = {};
    const sectorCount = {};
    const roundCount = {};

    this.filteredInvestments.forEach(inv => {
      if (inv.investor_company) {
        const c = inv.investor_company.trim();
        companyCount[c] = (companyCount[c] || 0) + 1;
      }
      if (inv.startup_name) {
        const s = inv.startup_name.trim();
        startupCount[s] = (startupCount[s] || 0) + 1;
      }
      if (inv.sector) {
        const sec = inv.sector.trim();
        sectorCount[sec] = (sectorCount[sec] || 0) + 1;
      }
      if (inv.investment_round) {
        const r = inv.investment_round.trim();
        roundCount[r] = (roundCount[r] || 0) + 1;
      }
    });

    const sortObj = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

    const result = {
      topCompanies: sortObj(companyCount).slice(0, topN),
      topStartups: sortObj(startupCount).slice(0, topN),
      categoryBreakdown: sortObj(sectorCount),
      roundBreakdown: sortObj(roundCount).slice(0, topN)
    };

    this._analyticsCache.set(cacheKey, result);
    return result;
  }

  getYearlyTrend() {
    const cacheKey = `yearly_${this._filterHash()}`;
    if (this._analyticsCache.has(cacheKey)) {
      return this._analyticsCache.get(cacheKey);
    }

    const yearMap = {};
    this.filteredInvestments.forEach(inv => {
      const year = inv.investment_year || 'Unknown';
      if (!yearMap[year]) yearMap[year] = { total: 0, active: 0, completed: 0, amount: 0 };
      yearMap[year].total++;
      if ((inv.status || 'active') === 'active') yearMap[year].active++;
      else yearMap[year].completed++;
      yearMap[year].amount += (inv.investment_amount_usd || 0);
    });

    const result = Object.keys(yearMap)
      .filter(y => y !== 'Unknown')
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(year => ({ year: parseInt(year), ...yearMap[year] }));

    this._analyticsCache.set(cacheKey, result);
    return result;
  }

  getRegionalDistribution() {
    const cacheKey = `regional_${this._filterHash()}`;
    if (this._analyticsCache.has(cacheKey)) {
      return this._analyticsCache.get(cacheKey);
    }

    const regionMap = {
      '미국 (USA)': 0,
      '한국 (South Korea)': 0,
      '유럽 (Europe)': 0,
      '캐나다 (Canada)': 0,
      '이스라엘 (Israel)': 0,
      '일본 (Japan)': 0,
      '기타 (Others)': 0
    };

    const euroCountries = [
      'uk', 'united kingdom', 'germany', 'france', 'netherlands',
      'belgium', 'italy', 'spain', 'denmark', 'sweden', 'switzerland', 'austria', 'finland'
    ];

    this.filteredInvestments.forEach(inv => {
      const country = (inv.startup_hq_country || '').toLowerCase().trim();
      if (['usa', 'united states', 'us'].includes(country)) {
        regionMap['미국 (USA)']++;
      } else if (['south korea', 'korea', 'kr'].includes(country)) {
        regionMap['한국 (South Korea)']++;
      } else if (country === 'canada') {
        regionMap['캐나다 (Canada)']++;
      } else if (country === 'israel') {
        regionMap['이스라엘 (Israel)']++;
      } else if (country === 'japan') {
        regionMap['일본 (Japan)']++;
      } else if (euroCountries.includes(country)) {
        regionMap['유럽 (Europe)']++;
      } else if (country) {
        regionMap['기타 (Others)']++;
      }
    });

    const result = Object.entries(regionMap)
      .filter(([_, count]) => count > 0)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    this._analyticsCache.set(cacheKey, result);
    return result;
  }

  getCompanyTopicMatrix(topCompanyLimit = 8) {
    const investments = this.filteredInvestments;
    const compMap = {};
    const sectors = this.getUniqueSectors();

    investments.forEach(inv => {
      const comp = inv.investor_company || '기타';
      const sec = inv.sector || '기타';
      if (!compMap[comp]) {
        compMap[comp] = { total: 0, categories: {} };
        sectors.forEach(s => { compMap[comp].categories[s] = 0; });
      }
      compMap[comp].total++;
      compMap[comp].categories[sec] = (compMap[comp].categories[sec] || 0) + 1;
    });

    const topCompanies = Object.entries(compMap)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, topCompanyLimit)
      .map(([company, data]) => ({
        company,
        total: data.total,
        categories: data.categories
      }));

    return {
      categories: sectors,
      companies: topCompanies
    };
  }

  getSubtopicRules() {
    return {};
  }

  getSubtopic(inv) {
    return inv.sector || inv.topic || '기타 기술 분야';
  }
}

window.VentureDataManager = VentureDataManager;
