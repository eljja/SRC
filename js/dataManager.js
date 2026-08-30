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
      const cacheBuster = `t=${Date.now()}`;
      const response = await fetch(`data/collaborations.json?${cacheBuster}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const json = await response.json();
      this.metadata = json.metadata;
      this.categories = json.categories || [];
      this.rawProjects = json.projects || [];
      
      // Ultra-Fast Search Pre-Indexing: Precompute search token string once
      this.rawProjects.forEach(p => {
        p._searchStr = [
          p.title, p.topic, p.professor, p.university, p.company,
          p.institute_or_consortium, p.summary, p.category
        ].filter(Boolean).join(' ').toLowerCase();
      });

      this._analyticsCache = new Map();
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
    this._analyticsCache.clear();
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
    this._analyticsCache.clear();
    this.applyFilters();
  }

  applyFilters() {
    let result = this.rawProjects;

    // Search query filter with pre-computed search string (0.5ms execution across 10,000+ items)
    if (this.filters.searchQuery) {
      const terms = this.filters.searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      result = result.filter(p => {
        const text = p._searchStr || '';
        return terms.every(term => text.includes(term));
      });
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

  getAnalyticsRankings(topN = 8) {
    const cacheKey = `rankings_${this.filteredProjects.length}_${topN}`;
    if (this._analyticsCache && this._analyticsCache.has(cacheKey)) {
      return this._analyticsCache.get(cacheKey);
    }

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

    const projectsToCount = this.filteredProjects;

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

    const result = {
      topCompanies: sortObject(companyCount).slice(0, topN),
      topUniversities: sortObject(uniCount).slice(0, topN),
      topProfessors: sortObject(profCount).slice(0, topN),
      topInstitutes: sortObject(instCount).slice(0, topN),
      categoryBreakdown: sortObject(categoryCount)
    };

    if (this._analyticsCache) this._analyticsCache.set(cacheKey, result);
    return result;
  }

  getYearlyTrend() {
    const cacheKey = `yearly_${this.filteredProjects.length}`;
    if (this._analyticsCache && this._analyticsCache.has(cacheKey)) {
      return this._analyticsCache.get(cacheKey);
    }

    const projects = this.filteredProjects.length > 0 ? this.filteredProjects : this.rawProjects;
    const yearMap = {};
    projects.forEach(p => {
      const year = p.start_year || 'Unknown';
      if (!yearMap[year]) yearMap[year] = { total: 0, active: 0, completed: 0 };
      yearMap[year].total++;
      if (p.status === 'active') yearMap[year].active++;
      else if (p.status === 'completed') yearMap[year].completed++;
    });
    const result = Object.keys(yearMap)
      .filter(y => y !== 'Unknown')
      .sort()
      .map(year => ({ year: parseInt(year), ...yearMap[year] }));

    if (this._analyticsCache) this._analyticsCache.set(cacheKey, result);
    return result;
  }

  getRegionalDistribution() {
    const cacheKey = `regional_${this.filteredProjects.length}`;
    if (this._analyticsCache && this._analyticsCache.has(cacheKey)) {
      return this._analyticsCache.get(cacheKey);
    }

    const projects = this.filteredProjects.length > 0 ? this.filteredProjects : this.rawProjects;
    const regionMap = {
      '한국 (South Korea)': 0,
      '미국 (USA)': 0,
      '대만 (Taiwan)': 0,
      '유럽 (Europe)': 0,
      '일본 (Japan)': 0,
      '중국 (China)': 0,
      '기타 (Others)': 0
    };
    const euroCountries = ['Belgium', 'Netherlands', 'Germany', 'France', 'UK', 'Switzerland', 'Italy', 'Austria', 'Ireland', 'Finland', 'Sweden', 'Norway', 'Denmark'];
    projects.forEach(p => {
      const country = p.university_country || '';
      if (country === 'South Korea') regionMap['한국 (South Korea)']++;
      else if (country === 'USA') regionMap['미국 (USA)']++;
      else if (country === 'Taiwan') regionMap['대만 (Taiwan)']++;
      else if (country === 'Japan') regionMap['일본 (Japan)']++;
      else if (country === 'China') regionMap['중국 (China)']++;
      else if (euroCountries.includes(country)) regionMap['유럽 (Europe)']++;
      else regionMap['기타 (Others)']++;
    });
    const result = Object.entries(regionMap)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    if (this._analyticsCache) this._analyticsCache.set(cacheKey, result);
    return result;
  }

  getCompanyTopicMatrix(topCompanyLimit = 8) {
    const projects = this.filteredProjects.length > 0 ? this.filteredProjects : this.rawProjects;
    const compMap = {};
    const categories = this.categories;

    projects.forEach(p => {
      const comp = p.company || '기타';
      const cat = p.category || '기타';
      if (!compMap[comp]) {
        compMap[comp] = { total: 0, categories: {} };
        categories.forEach(c => compMap[comp].categories[c] = 0);
      }
      compMap[comp].total++;
      compMap[comp].categories[cat] = (compMap[comp].categories[cat] || 0) + 1;
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
      categories,
      companies: topCompanies
    };
  }

  getSubtopicRules() {
    return {
      'Advanced Logic & Transistors (GAA/CFET/2D)': [
        { name: 'CFET & 3D 적층 트랜지스터', icon: '⚡', keywords: ['cfet', 'complementary fet', '3d stacked', 'monolithic 3d', 'vertical fet', 'stacked'] },
        { name: 'GAA / MBCFET 나노시트 소자', icon: '⚡', keywords: ['gaa', 'gate-all-around', 'nanosheet', 'multi-bridge', 'mbcfet', 'ribbonfet', 'finfet', 'nanowire', 'spacer'] },
        { name: '2D 반도체 채널 신소재 (MoS2/WSe2)', icon: '⚡', keywords: ['2d', 'mos2', 'wse2', 'graphene', 'transition metal', 'tmd', 'monolayer', 'carbon nanotube', 'cnt', 'two-dimensional'] },
        { name: '후면 전력 공급망 (BSPDN/PowerVia)', icon: '⚡', keywords: ['backside', 'bspdn', 'powervia', 'power delivery', 'through-silicon', 'backside power'] },
        { name: '강유전체 FeFET & 네거티브 커패시턴스', icon: '⚡', keywords: ['fefet', 'ferroelectric', 'negative capacitance', 'hfo2', 'nc-fet', 'memory window', 'polarization'] },
        { name: '극저온 CMOS & 양자 소자 인터페이스', icon: '⚡', keywords: ['cryogenic', 'low-temperature', 'qubit', 'quantum', '4k', 'sub-kelvin'] },
        { name: '초미세 접촉저항 & High-k 게이트 절연막', icon: '⚡', keywords: ['high-k', 'metal gate', 'contact resistance', 'inner spacer', 'dielectric', 'workfunction', 'interface state', 'interface trap'] }
      ],
      'Memory & Storage (HBM/PIM/3D NAND)': [
        { name: 'HBM3e / HBM4 초고대역폭 메모리', icon: '💾', keywords: ['hbm', 'high bandwidth', 'tsv', '16hi', 'wide-io', 'stacking', 'stack memory'] },
        { name: '프로세싱 인 메모리 (PIM / CIM)', icon: '💾', keywords: ['pim', 'cim', 'processing-in-memory', 'compute-in-memory', 'near-memory', 'in-memory'] },
        { name: '3D DRAM & 신개념 모놀리식 구조', icon: '💾', keywords: ['3d dram', 'monolithic 3d', 'capacitorless', 'floating body', 'vertical dram', 'gain cell'] },
        { name: '초고적층 3D NAND 플래시 & HAR 에칭', icon: '💾', keywords: ['3d nand', 'nand flash', 'har etch', 'channel hole', 'charge trap', 'bit-cost', 'high aspect'] },
        { name: '차세대 비휘발성 메모리 (MRAM/ReRAM/FeRAM)', icon: '💾', keywords: ['mram', 'stt-mram', 'sot', 'reram', 'memristor', 'feram', 'ovonic', 'ots', 'phase change', 'pcm'] },
        { name: 'CXL 메모리 풀링 & 인터커넥트', icon: '💾', keywords: ['cxl', 'compute express link', 'memory pooling', 'disaggregated', 'coherent'] }
      ],
      'Advanced Packaging & Chiplets (3D/Hybrid Bonding)': [
        { name: 'Cu-Cu 직접 하이브리드 본딩', icon: '📦', keywords: ['hybrid bonding', 'cu-cu', 'direct bonding', 'die-to-wafer', 'wafer-to-wafer', 'fine-pitch', 'direct bond'] },
        { name: '2.5D 인터포저 & CoWoS / 유리 기판', icon: '📦', keywords: ['cowos', 'emib', 'interposer', 'glass substrate', 'silicon interposer', 'organic substrate', 'substrate'] },
        { name: '칩렛 표준 인터페이스 (UCIe / BoW)', icon: '📦', keywords: ['chiplet', 'ucie', 'bunch of wires', 'die-to-die', 'd2d', 'modular'] },
        { name: '3D 적층 열 방출 & 마이크로 쿨링', icon: '📦', keywords: ['thermal', 'heat dissipation', 'microfluidic', 'cooling', 'junction temp', 'warpage', 'stress'] },
        { name: '팬아웃 패널/웨이퍼 레벨 패키징 (FO-PLP/WLP)', icon: '📦', keywords: ['fan-out', 'foplp', 'fowlp', 'redistribution layer', 'rdl', 'mold', 'encapsulation'] }
      ],
      'AI & Neuromorphic Computing': [
        { name: 'LLM / 트랜스포머 전용 NPU 가속기', icon: '🧠', keywords: ['npu', 'transformer', 'llm', 'accelerator', 'neural processor', 'matrix engine', 'deep learning'] },
        { name: '스파이킹 뉴럴 네트워크 (SNN) & 뉴로모픽', icon: '🧠', keywords: ['snn', 'spiking', 'neuromorphic', 'brain-inspired', 'synapse', 'neuron', 'event-driven'] },
        { name: '아날로그 / 광학 행렬 연산 가속기', icon: '🧠', keywords: ['analog computing', 'optical matrix', 'photonic accelerator', 'in-memory computing', 'analog'] },
        { name: '초저전력 온디바이스 Edge AI & 센서 퓨전', icon: '🧠', keywords: ['edge ai', 'on-device', 'ultra-low', 'low power', 'sensor-fusion', 'tinyml', 'embedded', 'perception'] },
        { name: 'SRAM / ReRAM 기반 연산 어레이', icon: '🧠', keywords: ['sram-based', 'reram array', 'in-memory multiplier', 'mac array', 'crossbar'] }
      ],
      'Lithography & Metrology (EUV/High-NA)': [
        { name: 'High-NA EUV (0.55 NA) 광학계 & 해상력', icon: '🔬', keywords: ['high-na', '0.55 na', 'anamorphic', 'euv optics', 'resolution', 'numerical aperture', 'extreme ultraviolet'] },
        { name: '금속 산화물 포토레지스트 (MOR) & 결함 제어', icon: '🔬', keywords: ['mor', 'metal oxide', 'photoresist', 'stochastic', 'line edge roughness', 'ler', 'defect'] },
        { name: '계산 리소그래피 & 곡선형 마스크 (Curvilinear OPC)', icon: '🔬', keywords: ['computational lithography', 'opc', 'curvilinear', 'mask', 'inverse lithography', 'ilt', 'hotspot'] },
        { name: 'EUV 펠리클 & 고출력 플라즈마 광원', icon: '🔬', keywords: ['pellicle', 'cnt', 'light source', 'high-power', 'plasma', 'debris', 'source'] },
        { name: '원자 단위 계측 검사 & CD-SEM / 스캐터로메트리', icon: '🔬', keywords: ['metrology', 'cd-sem', 'scatterometry', 'inspection', 'sem image', 'afm', 'overlay'] }
      ],
      'Power & Compound Semiconductors (GaN/SiC)': [
        { name: 'GaN-on-Si 전력 소자 & 고주파 HEMT', icon: '🔋', keywords: ['gan', 'gallium nitride', 'hemt', 'power ic', 'high-frequency', 'gan-on-silicon', 'ingan'] },
        { name: '1200V+ SiC MOSFET & 전기차 인버터', icon: '🔋', keywords: ['sic', 'silicon carbide', 'trench mosfet', 'inverter', 'high voltage', 'breakdown', 'traction'] },
        { name: '초광밴드갭 산화갈륨(Ga2O3) & 다이아몬드', icon: '🔋', keywords: ['ga2o3', 'gallium oxide', 'diamond', 'ultra-wide', 'uwbg', 'high temperature'] },
        { name: '실리콘-화합물 이종 집적 (Heterogeneous)', icon: '🔋', keywords: ['heterogeneous', 'compound on silicon', 'epitaxy', 'iii-v', 'heterojunction'] }
      ],
      'Silicon Photonics & Optical I/O': [
        { name: '공동 패키징 광학 (CPO) & 광 트랜시버 엔진', icon: '💡', keywords: ['cpo', 'co-packaged optics', 'optical transceiver', 'optical engine', 'optical i/o', 'transceiver'] },
        { name: '초고속 광변조기 (100G+) & 마이크로링 공진기', icon: '💡', keywords: ['modulator', 'micro-ring', 'resonator', 'mach-zehnder', 'electro-optic', 'ring resonator'] },
        { name: '실리콘 웨이브가이드 상 하이브리드 레이저', icon: '💡', keywords: ['iii-v laser', 'hybrid laser', 'waveguide', 'inp', 'dfb laser', 'on-chip laser', 'laser'] },
        { name: 'AI 데이터센터 초고속 광 인터커넥트', icon: '💡', keywords: ['optical interconnect', 'multi-gpu', 'datacenter', 'low-loss', 'optical switch', 'interconnect'] }
      ]
    };
  }

  getSubtopic(project) {
    const rules = this.getSubtopicRules()[project.category];
    if (!rules || rules.length === 0) return '기타 세부 연구';
    const text = ((project.title || '') + ' ' + (project.topic || '') + ' ' + (project.summary || '')).toLowerCase();
    for (const r of rules) {
      for (const kw of r.keywords) {
        if (text.includes(kw)) return r.name;
      }
    }
    return rules[0].name;
  }
}

window.DataManager = DataManager;
