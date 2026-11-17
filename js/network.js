/**
 * NetworkView Module (v8.0.0 — WebGL2 + Pre-computed ForceAtlas2/Louvain Engine)
 * Renders an interactive WebGL2 GPU-instanced Knowledge Graph connecting
 * Technology Domains, Granular Sub-topics, Companies, and Universities.
 * Supports:
 * - 🌐 1차: 7대 기술 도메인 총괄망 (Global 7-Domain Overview Mode)
 * - 🔬 2차: 세부 주제별 심층망 (Deep-Dive Sub-Topic & Gap Analysis Mode)
 * - 🏛️ 산학 기관 협력망 (Institution Collaboration Mode)
 * - Pre-computed Louvain communities + ForceAtlas2 coordinates (0ms instant layout)
 * - Off-main-thread Web Worker Barnes-Hut physics for smooth interactive dragging/reheating
 * - Interactive Focus HUD with Gap Analysis & Direct Project Modal Links
 */
class NetworkView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.renderer = null;
    this.isInitialized = false;
    this.selectedNodeId = null;
    this.nodes = [];
    this.links = [];
    this.adjacency = new Map();
    this.lodMode = 'all'; // 'all' (full WebGL universe) or 'core'
    this.graphMode = 'topic'; // 'topic' (1차 총괄망), 'subtopic' (2차 세부 심층망), 'institution' (기관망)
    this.selectedSubtopicCategory = 'Advanced Logic & Transistors (GAA/CFET/2D)';
    this.lastProjects = [];
    this.layoutData = null;
    this._layoutPromise = null;
  }

  _loadLayoutData() {
    if (this.layoutData) return Promise.resolve(this.layoutData);
    if (this._layoutPromise) return this._layoutPromise;
    this._layoutPromise = fetch('data/graph_layout_src.json')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        this.layoutData = json;
        return json;
      })
      .catch(err => {
        console.warn('Precomputed SRC layout fetch failed, using live Worker layout:', err);
        return null;
      });
    return this._layoutPromise;
  }

  init() {
    if (this.isInitialized) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this._loadLayoutData();

    container.innerHTML = `
      <div id="network-stage" style="width: 100%; height: 100%;"></div>

      <div class="network-controls">
        <div class="network-mode-group">
          <button class="network-btn ${this.graphMode === 'topic' ? 'active' : ''}" id="btn-net-mode-topic" title="7대 기술 도메인 중심 글로벌 기업 관심도 및 대학 연구 집중도 총괄망">🌐 1차: 7대 도메인 총괄망</button>
          <button class="network-btn ${this.graphMode === 'subtopic' ? 'active' : ''}" id="btn-net-mode-subtopic" title="1개 기술 분야 선택 시 세부 기술 주제별 집중도 및 공백(Gap) 심층 분석">🔬 2차: 세부 주제별 심층망</button>
          <button class="network-btn ${this.graphMode === 'institution' ? 'active' : ''}" id="btn-net-mode-inst" title="기업-대학-연구소 간의 직접 산학 협력망">🏛️ 산학 기관망</button>
        </div>

        <div class="subtopic-selector-container" id="subtopic-selector-container" style="${this.graphMode === 'subtopic' ? 'display: flex;' : 'display: none;'}">
          <span class="subtopic-selector-label">🎯 분석 분야:</span>
          <select id="select-subtopic-category" class="subtopic-select" aria-label="세부 분석 기술 도메인 선택">
            <option value="Advanced Logic & Transistors (GAA/CFET/2D)">⚡ GAA & CFET 차세대 로직 (GAA/CFET/2D)</option>
            <option value="Memory & Storage (HBM/PIM/3D NAND)">💾 HBM & 3D 적층 메모리 (HBM/PIM/NAND)</option>
            <option value="Advanced Packaging & Chiplets (3D/Hybrid Bonding)">📦 첨단 패키징 & 칩렛 (3D 본딩/유리기판)</option>
            <option value="AI & Neuromorphic Computing">🧠 AI & NPU 뉴로모픽 (LLM/Edge AI)</option>
            <option value="Lithography & Metrology (EUV/High-NA)">🔬 EUV & High-NA 리소그래피 (0.55 NA/MOR)</option>
            <option value="Power & Compound Semiconductors (GaN/SiC)">🔋 전력·화합물 반도체 (GaN/SiC)</option>
            <option value="Silicon Photonics & Optical I/O">💡 실리콘 포토닉스 (CPO/광반도체)</option>
          </select>
        </div>

        <div class="network-btn-separator"></div>
        <input type="text" id="input-net-search" class="kg-search-input" placeholder="🔍 기관/주제 노드 찾기..." aria-label="그래프 내 노드 검색" />
        <button class="network-btn active" id="btn-net-color" title="Louvain 군집 색상 vs 기관 유형 색상 전환">🎨 군집 색상</button>
        <button class="network-btn" id="btn-net-labels" title="줌 연동 자동 라벨 vs 항상 표시 전환">🏷️ 라벨 자동</button>
        <button class="network-btn" id="btn-network-lod" title="전체 연결망 / 핵심 거점망 토글">${this.lodMode === 'core' ? '⚡ 핵심 거점망' : '🌐 전체 연결망'}</button>
        <button class="network-btn" id="btn-net-clear" title="선택 해제" style="display: none;">✨ 강조 해제</button>
      </div>

      <!-- ALDB-style Bottom-Right Vertical Utility Stack -->
      <div class="kg-bottom-controls" aria-label="그래프 제어 도구">
        <button class="kg-icon-btn" id="btn-net-zoomin" title="확대 (Zoom In)">+</button>
        <button class="kg-icon-btn" id="btn-net-zoomout" title="축소 (Zoom Out)">−</button>
        <button class="kg-icon-btn" id="btn-net-fit" title="화면 맞춤 (Fit)">⤢</button>
        <button class="kg-icon-btn" id="btn-net-reset" title="물리 시뮬레이션 재정렬">↻</button>
        <button class="kg-icon-btn" id="btn-net-legend" title="Louvain 협력 군집 범례 토글">≡</button>
      </div>

      <div class="network-hud" id="network-hud">
        <div class="network-hud-title">
          <span id="hud-name">-</span>
          <button id="hud-close-btn" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 14px;">&times;</button>
        </div>
        <div class="network-hud-desc" id="hud-type-desc">-</div>
        <div class="hud-dynamic-section" id="hud-dynamic-content"></div>
      </div>
    `;

    const stageEl = document.getElementById('network-stage');
    this.renderer = new KGCanvasRenderer(stageEl, {
      onNodeClick: (node) => this.handleNodeClick(node),
      onClearSelection: () => this.clearFocus(),
      onNodeDblClick: (node) => {
        const filterType = node.type === 'university' ? 'university' : (node.type === 'company' ? 'company' : 'category');
        if (window.app && window.app.filterByAnalyticsItem) {
          window.app.filterByAnalyticsItem(filterType, node.category || node.fullLabel || node.rawName || node.label);
        }
      }
    });

    // Mode switchers
    document.getElementById('btn-net-mode-subtopic').addEventListener('click', () => {
      this.graphMode = 'subtopic';
      this.updateModeButtons();
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-net-mode-topic').addEventListener('click', () => {
      this.graphMode = 'topic';
      this.updateModeButtons();
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-net-mode-inst').addEventListener('click', () => {
      this.graphMode = 'institution';
      this.updateModeButtons();
      if (this.lastProjects) this.render(this.lastProjects);
    });

    const categorySelect = document.getElementById('select-subtopic-category');
    if (categorySelect) {
      categorySelect.value = this.selectedSubtopicCategory;
      categorySelect.addEventListener('change', (e) => {
        this.selectedSubtopicCategory = e.target.value;
        if (this.lastProjects) this.render(this.lastProjects);
      });
    }

    // In-graph instant node search
    const netSearch = document.getElementById('input-net-search');
    if (netSearch) {
      netSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const hit = this.renderer.focusNodeByQuery(netSearch.value);
          if (hit) {
            this.handleNodeClick(hit, true);
          }
        }
      });
    }

    // Color mode toggle
    const colorBtn = document.getElementById('btn-net-color');
    if (colorBtn) {
      colorBtn.addEventListener('click', () => {
        const next = this.renderer.colorMode === 'community' ? 'type' : 'community';
        this.renderer.setColorMode(next);
        colorBtn.textContent = next === 'community' ? '🎨 군집 색상' : '🏷️ 기관 유형';
        colorBtn.classList.toggle('active', next === 'community');
      });
    }

    // Label mode toggle
    const labelBtn = document.getElementById('btn-net-labels');
    if (labelBtn) {
      labelBtn.addEventListener('click', () => {
        const next = this.renderer.labelMode === 'auto' ? 'always' : 'auto';
        this.renderer.setLabelMode(next);
        labelBtn.textContent = next === 'auto' ? '🏷️ 라벨 자동' : '🏷️ 라벨 항상';
        labelBtn.classList.toggle('active', next === 'always');
      });
    }

    // LOD toggle
    document.getElementById('btn-network-lod').addEventListener('click', (e) => {
      this.lodMode = this.lodMode === 'core' ? 'all' : 'core';
      e.target.textContent = this.lodMode === 'core' ? '⚡ 핵심 거점망' : '🌐 전체 연결망';
      if (this.lastProjects) this.render(this.lastProjects);
    });

    // Bottom-right controls
    document.getElementById('btn-net-zoomin').addEventListener('click', () => this.renderer.zoomBy(1.35));
    document.getElementById('btn-net-zoomout').addEventListener('click', () => this.renderer.zoomBy(0.74));
    document.getElementById('btn-net-fit').addEventListener('click', () => this.renderer.resetZoomFit());
    document.getElementById('btn-net-reset').addEventListener('click', () => this.renderer.reheat());
    document.getElementById('btn-net-legend').addEventListener('click', (e) => {
      const open = this.renderer.toggleLegend();
      e.target.classList.toggle('active', open);
    });

    document.getElementById('btn-net-clear').addEventListener('click', () => this.clearFocus());
    document.getElementById('hud-close-btn').addEventListener('click', () => this.clearFocus());

    this.isInitialized = true;
  }

  updateModeButtons() {
    const btnSub = document.getElementById('btn-net-mode-subtopic');
    const btnTop = document.getElementById('btn-net-mode-topic');
    const btnInst = document.getElementById('btn-net-mode-inst');
    const selContainer = document.getElementById('subtopic-selector-container');

    if (btnSub) btnSub.classList.toggle('active', this.graphMode === 'subtopic');
    if (btnTop) btnTop.classList.toggle('active', this.graphMode === 'topic');
    if (btnInst) btnInst.classList.toggle('active', this.graphMode === 'institution');
    if (selContainer) selContainer.style.display = this.graphMode === 'subtopic' ? 'flex' : 'none';
  }

  async render(projects) {
    this.lastProjects = projects;
    this.init();
    this.updateModeButtons();

    if (!this.layoutData) {
      await this._loadLayoutData();
    }

    this.selectedNodeId = null;
    this.hideHud();
    const clearBtn = document.getElementById('btn-net-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    if (!projects || projects.length === 0) {
      this.renderer.setData({ nodes: [], links: [] });
      return;
    }

    projects = projects.filter(p => !p.verification || p.verification.status !== 'quarantined');
    if (projects.length === 0) {
      this.renderer.setData({ nodes: [], links: [] });
      return;
    }

    const categoryInfo = {
      'AI & Neuromorphic Computing': { short: 'AI & NPU 뉴로모픽', color: '#3b82f6', icon: '🧠' },
      'Advanced Logic & Transistors (GAA/CFET/2D)': { short: 'GAA & CFET 차세대 로직', color: '#10b981', icon: '⚡' },
      'Power & Compound Semiconductors (GaN/SiC)': { short: '전력·화합물 (GaN/SiC)', color: '#f59e0b', icon: '🔋' },
      'Lithography & Metrology (EUV/High-NA)': { short: 'EUV & High-NA 리소그래피', color: '#8b5cf6', icon: '🔬' },
      'Memory & Storage (HBM/PIM/3D NAND)': { short: 'HBM & 3D 적층 메모리', color: '#f43f5e', icon: '💾' },
      'Advanced Packaging & Chiplets (3D/Hybrid Bonding)': { short: '첨단 패키징 & 칩렛 (3D 본딩)', color: '#06b6d4', icon: '📦' },
      'Silicon Photonics & Optical I/O': { short: '실리콘 포토닉스 (광반도체)', color: '#ec4899', icon: '💡' }
    };

    const nodeMap = new Map();
    const linkMap = new Map();
    this.adjacency = new Map();

    const addNeighbor = (id1, id2) => {
      if (!this.adjacency.has(id1)) this.adjacency.set(id1, new Set());
      if (!this.adjacency.has(id2)) this.adjacency.set(id2, new Set());
      this.adjacency.get(id1).add(id2);
      this.adjacency.get(id2).add(id1);
    };

    const getNode = (id, label, type, extra = {}) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id, label, type, projects: [], val: 0,
          compBreakdown: {}, uniBreakdown: {}, subtopicBreakdown: {}, topicBreakdown: {},
          ...extra
        });
      }
      return nodeMap.get(id);
    };

    const addLink = (sourceId, targetId, project, linkType = 'collab') => {
      if (!sourceId || !targetId || sourceId === targetId) return;
      const key1 = `${sourceId}__${targetId}`;
      const key2 = `${targetId}__${sourceId}`;
      const existingKey = linkMap.has(key1) ? key1 : (linkMap.has(key2) ? key2 : null);

      if (existingKey) {
        const l = linkMap.get(existingKey);
        l.weight += 1;
        l.projects.push(project);
        if (project.status === 'active') l.hasActive = true;
      } else {
        linkMap.set(key1, {
          source: sourceId,
          target: targetId,
          weight: 1,
          hasActive: project.status === 'active',
          linkType,
          projects: [project]
        });
      }
      addNeighbor(sourceId, targetId);
    };

    let layoutModeKey = this.graphMode;

    if (this.graphMode === 'subtopic') {
      const targetCat = this.selectedSubtopicCategory || 'Advanced Logic & Transistors (GAA/CFET/2D)';
      layoutModeKey = `subtopic:${targetCat}`;
      const catMeta = categoryInfo[targetCat] || { short: targetCat, color: '#10b981', icon: '⚡' };
      const activeProjects = projects.filter(p => p.category === targetCat);
      const subrules = (window.app && window.app.dataManager ? window.app.dataManager.getSubtopicRules()[targetCat] : []) || [];

      subrules.forEach(rule => {
        getNode(`sub_${rule.name}`, rule.name, 'subtopic', {
          fullLabel: rule.name,
          category: targetCat,
          color: catMeta.color,
          icon: rule.icon || '🔬'
        });
      });

      activeProjects.forEach(p => {
        const subName = window.app && window.app.dataManager ? window.app.dataManager.getSubtopic(p) : (p.topic || '기타 세부 연구');
        const subId = `sub_${subName}`;
        const hasConfirmedCorp = (window.app && window.app.dataManager && typeof window.app.dataManager.isConfirmedCorporateCollab === 'function')
          ? window.app.dataManager.isConfirmedCorporateCollab(p)
          : (p.company && p.company !== '-' && p.company !== '미지정' &&
             (!p.verification || (p.verification.collaboration_type !== 'academic_only' &&
              (p.verification.collaboration_type === 'co_authorship' || p.verification.collaboration_type === 'corporate_grant' || (p.verification.corporate_involvement && p.verification.corporate_involvement.status === 'documented')))));

        const subNode = getNode(subId, subName, 'subtopic', {
          fullLabel: subName,
          category: targetCat,
          color: catMeta.color,
          icon: catMeta.icon
        });
        subNode.val += 1;
        subNode.projects.push(p);
        if (hasConfirmedCorp) subNode.compBreakdown[p.company] = (subNode.compBreakdown[p.company] || 0) + 1;
        if (p.university) subNode.uniBreakdown[p.university] = (subNode.uniBreakdown[p.university] || 0) + 1;

        if (hasConfirmedCorp) {
          const compId = `comp_${p.company}`;
          const compNode = getNode(compId, p.company, 'company', { rawName: p.company, targetCategory: targetCat });
          compNode.val += 1;
          compNode.projects.push(p);
          compNode.subtopicBreakdown[subName] = (compNode.subtopicBreakdown[subName] || 0) + 1;
          if (p.university) compNode.uniBreakdown[p.university] = (compNode.uniBreakdown[p.university] || 0) + 1;
          addLink(compId, subId, p, 'company-subtopic');
        }

        if (p.university) {
          const uniId = `uni_${p.university}`;
          const uniNode = getNode(uniId, p.university, 'university', {
            rawName: p.university,
            city: p.university_city,
            country: p.university_country,
            targetCategory: targetCat
          });
          uniNode.val += 1;
          uniNode.projects.push(p);
          uniNode.subtopicBreakdown[subName] = (uniNode.subtopicBreakdown[subName] || 0) + 1;
          if (hasConfirmedCorp) uniNode.compBreakdown[p.company] = (uniNode.compBreakdown[p.company] || 0) + 1;
          addLink(uniId, subId, p, 'uni-subtopic');
        }
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        this.nodes = this.nodes.filter(n => n.type === 'subtopic' || n.val >= 2);
      }

    } else if (this.graphMode === 'topic') {
      projects.forEach(p => {
        const cat = p.category || '기타';
        const catId = `cat_${cat}`;
        const catMeta = categoryInfo[cat] || { short: cat, color: '#f59e0b', icon: '🔬' };
        const hasConfirmedCorp = (window.app && window.app.dataManager && typeof window.app.dataManager.isConfirmedCorporateCollab === 'function')
          ? window.app.dataManager.isConfirmedCorporateCollab(p)
          : (p.company && p.company !== '-' && p.company !== '미지정' &&
             (!p.verification || (p.verification.collaboration_type !== 'academic_only' &&
              (p.verification.collaboration_type === 'co_authorship' || p.verification.collaboration_type === 'corporate_grant' || (p.verification.corporate_involvement && p.verification.corporate_involvement.status === 'documented')))));

        const catNode = getNode(catId, catMeta.short, 'category', {
          fullLabel: cat,
          color: catMeta.color,
          icon: catMeta.icon
        });
        catNode.val += 1;
        catNode.projects.push(p);
        if (hasConfirmedCorp) catNode.compBreakdown[p.company] = (catNode.compBreakdown[p.company] || 0) + 1;
        if (p.university) catNode.uniBreakdown[p.university] = (catNode.uniBreakdown[p.university] || 0) + 1;

        if (hasConfirmedCorp) {
          const compId = `comp_${p.company}`;
          const compNode = getNode(compId, p.company, 'company', { rawName: p.company });
          compNode.val += 1;
          compNode.projects.push(p);
          compNode.topicBreakdown[cat] = (compNode.topicBreakdown[cat] || 0) + 1;
          if (p.university) compNode.uniBreakdown[p.university] = (compNode.uniBreakdown[p.university] || 0) + 1;
          addLink(compId, catId, p, 'company-topic');
        }

        if (p.university) {
          const uniId = `uni_${p.university}`;
          const uniNode = getNode(uniId, p.university, 'university', {
            rawName: p.university,
            city: p.university_city,
            country: p.university_country
          });
          uniNode.val += 1;
          uniNode.projects.push(p);
          uniNode.topicBreakdown[cat] = (uniNode.topicBreakdown[cat] || 0) + 1;
          if (hasConfirmedCorp) uniNode.compBreakdown[p.company] = (uniNode.compBreakdown[p.company] || 0) + 1;
          addLink(uniId, catId, p, 'uni-topic');
        }
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        this.nodes = this.nodes.filter(n => n.type === 'category' || n.val >= 3);
      }

    } else {
      // Institution mode
      projects.forEach(p => {
        const hasConfirmedCorp = (window.app && window.app.dataManager && typeof window.app.dataManager.isConfirmedCorporateCollab === 'function')
          ? window.app.dataManager.isConfirmedCorporateCollab(p)
          : (p.company && p.company !== '-' && p.company !== '미지정' &&
             (!p.verification || !p.verification.corporate_involvement || p.verification.corporate_involvement.status === 'documented'));

        let compId = null;
        if (hasConfirmedCorp) {
          compId = `comp_${p.company}`;
          const compNode = getNode(compId, p.company, 'company', { rawName: p.company });
          compNode.val += 1;
          compNode.projects.push(p);
        }

        let uniId = null;
        if (p.university) {
          uniId = `uni_${p.university}`;
          const uniNode = getNode(uniId, p.university, 'university', { rawName: p.university, city: p.university_city, country: p.university_country });
          uniNode.val += 1;
          uniNode.projects.push(p);
        }

        const catId = `cat_${p.category || '기타'}`;
        const catMeta = categoryInfo[p.category] || { short: p.category || '기타', color: '#f59e0b' };
        const catNode = getNode(catId, catMeta.short || (p.category || '기타'), 'category', { rawName: p.category, color: catMeta.color });
        catNode.val += 1;
        catNode.projects.push(p);

        let instId = null;
        if (p.institute_or_consortium && p.institute_or_consortium !== '-' && p.institute_or_consortium !== '해당 없음') {
          instId = `inst_${p.institute_or_consortium}`;
          const instNode = getNode(instId, p.institute_or_consortium, 'institute', { rawName: p.institute_or_consortium });
          instNode.val += 1;
          instNode.projects.push(p);
        }

        if (compId && uniId) addLink(compId, uniId, p, 'industry-acad');
        if (uniId) addLink(uniId, catId, p, 'research-domain');
        if (instId && uniId) addLink(instId, uniId, p, 'consortium');
        if (compId && instId) addLink(compId, instId, p, 'consortium');
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        this.nodes = this.nodes.filter(n => n.val >= 2);
      }
    }

    const nodeIds = new Set(this.nodes.map(n => n.id));
    this.links = Array.from(linkMap.values()).filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    const typeColorMap = {
      company: '#a78bfa',
      university: '#38bdf8',
      institute: '#34d399',
      category: '#f59e0b',
      subtopic: '#10b981'
    };

    const layoutModeData = this.layoutData && this.layoutData.modes ? this.layoutData.modes[layoutModeKey] : null;
    this.renderer.setData({
      nodes: this.nodes,
      links: this.links,
      layoutModeData,
      typeColorMap
    });
  }

  handleNodeClick(d, fromSearch = false) {
    if (!fromSearch && this.selectedNodeId === d.id) {
      this.clearFocus();
      return;
    }

    this.selectedNodeId = d.id;
    const neighbors = this.adjacency.get(d.id) || new Set();
    const clearBtn = document.getElementById('btn-net-clear');
    if (clearBtn) clearBtn.style.display = 'flex';

    this.showHud(d, neighbors);
  }

  clearFocus() {
    this.selectedNodeId = null;
    const clearBtn = document.getElementById('btn-net-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    if (this.renderer) this.renderer.clearSelection();
    this.hideHud();
  }

  showHud(node) {
    const hud = document.getElementById('network-hud');
    if (!hud) return;

    const dynamicContent = document.getElementById('hud-dynamic-content');
    if (!dynamicContent) return;
    dynamicContent.innerHTML = '';

    const typeLabels = {
      subtopic: '🔬 2차 세부 핵심 기술 분야 (Sub-topic)',
      category: '🌐 1차 차세대 기술 도메인 (Category)',
      company: '🏢 참여 / 투자 반도체 기업',
      university: '🏛️ 산학 연구 수주 대학교',
      institute: '🌐 연구소 및 컨소시엄'
    };

    document.getElementById('hud-name').textContent = node.fullLabel || node.label;
    document.getElementById('hud-type-desc').innerHTML = `
      <span style="color: #60a5fa; font-weight: 700;">${typeLabels[node.type] || '노드'}</span> | 총 <strong>${node.val || 1}건</strong> 과제 연계
    `;

    if (node.type === 'subtopic') {
      const topComps = Object.entries(node.compBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const maxCompVal = Math.max(...topComps.map(c => c[1]), 1);

      let compHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #a78bfa; margin-top: 6px; margin-bottom: 4px;">🏆 세부 기술 집중 기업 TOP ${topComps.length}:</div>
      `;
      topComps.forEach(([comp, count]) => {
        const pct = node.val > 0 ? ((count / node.val) * 100).toFixed(1) : 0;
        compHtml += `
          <div class="hud-interest-item" style="cursor: pointer;" title="클릭: '${comp}' 필터링" data-filter-type="company" data-filter-value="${comp.replace(/"/g, '&quot;')}">
            <span class="hud-interest-label">${comp}</span>
            <div class="hud-interest-bar-wrap">
              <div class="hud-interest-bar" style="width: ${(count / maxCompVal) * 100}%; background: linear-gradient(90deg, #a78bfa, #818cf8);"></div>
            </div>
            <span class="hud-interest-count">${count}건 (${pct}%)</span>
          </div>
        `;
      });

      const activeCompSet = new Set(Object.keys(node.compBreakdown || {}));
      const domainComps = this.nodes.filter(n => n.type === 'company').map(n => n.label);
      const gapComps = domainComps.filter(c => !activeCompSet.has(c)).slice(0, 8);

      let gapHtml = '';
      if (gapComps.length > 0) {
        gapHtml = `
          <div style="font-size: 11px; font-weight: 700; color: #f87171; margin-top: 8px; margin-bottom: 4px;">⚠️ 미참여 / 연구 공백 기업 (Gap):</div>
          <div class="network-hud-collaborators">
            ${gapComps.map(gc => `<span class="hud-tag" style="border-color: rgba(248,113,113,0.4); color: #fca5a5;" title="해당 세부 분야 연구 과제 없음">${gc} (0건)</span>`).join('')}
          </div>
        `;
      }

      const topUnis = Object.entries(node.uniBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      let uniTagsHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-top: 8px; margin-bottom: 4px;">🏛️ 연구 주도 대학교:</div>
        <div class="network-hud-collaborators">
      `;
      topUnis.forEach(([uni, count]) => {
        uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" data-filter-type="university" data-filter-value="${uni.replace(/"/g, '&quot;')}" title="${uni} (${count}건)">${uni} <strong>${count}</strong></span>`;
      });
      uniTagsHtml += `</div>`;

      dynamicContent.innerHTML = compHtml + gapHtml + uniTagsHtml;

    } else if (node.type === 'company') {
      if (this.graphMode === 'subtopic') {
        const subrules = (window.app && window.app.dataManager ? window.app.dataManager.getSubtopicRules()[this.selectedSubtopicCategory] : []) || [];
        const compSubMap = node.subtopicBreakdown || {};

        let subHtml = `
          <div style="font-size: 11px; font-weight: 700; color: #10b981; margin-top: 6px; margin-bottom: 4px;">🎯 세부 기술별 집중도 & Gap 진단:</div>
        `;
        subrules.forEach(rule => {
          const count = compSubMap[rule.name] || 0;
          const statusBadge = count >= 10 ? '<span style="color:#34d399;font-weight:700;">🟢 집중</span>' : (count >= 1 ? '<span style="color:#fbbf24;font-weight:700;">🟡 활성</span>' : '<span style="color:#9ca3af;">⚪ 공백(0)</span>');
          subHtml += `
            <div class="hud-interest-item">
              <span class="hud-interest-label" style="width: 135px;" title="${rule.name}">${rule.name}</span>
              <span class="hud-interest-count" style="color: ${count > 0 ? '#38bdf8' : '#6b7280'};">${count}건</span>
              <span style="font-size: 10px; margin-left: 6px;">${statusBadge}</span>
            </div>
          `;
        });

        const topUnis = Object.entries(node.uniBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        let uniTagsHtml = `
          <div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-top: 8px; margin-bottom: 4px;">🏛️ 주요 협력 파트너 대학:</div>
          <div class="network-hud-collaborators">
        `;
        topUnis.forEach(([uni, count]) => {
          uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" data-filter-type="university" data-filter-value="${uni.replace(/"/g, '&quot;')}">${uni} <strong>${count}</strong></span>`;
        });
        uniTagsHtml += `</div>`;

        dynamicContent.innerHTML = subHtml + uniTagsHtml;

      } else {
        const topTopics = Object.entries(node.topicBreakdown || {}).sort((a, b) => b[1] - a[1]);
        const maxTopicVal = Math.max(...topTopics.map(t => t[1]), 1);

        let topicHtml = `
          <div style="font-size: 11px; font-weight: 700; color: #f59e0b; margin-top: 6px; margin-bottom: 4px;">📊 7대 기술 도메인별 투자 포트폴리오:</div>
        `;
        topTopics.forEach(([topic, count]) => {
          const pct = node.val > 0 ? ((count / node.val) * 100).toFixed(1) : 0;
          topicHtml += `
            <div class="hud-interest-item" style="cursor: pointer;" title="클릭: '${topic}' 필터링" data-filter-type="category" data-filter-value="${topic.replace(/"/g, '&quot;')}">
              <span class="hud-interest-label" style="width: 120px;">${topic.split('(')[0].trim()}</span>
              <div class="hud-interest-bar-wrap">
                <div class="hud-interest-bar" style="width: ${(count / maxTopicVal) * 100}%; background: linear-gradient(90deg, #f59e0b, #06b6d4);"></div>
              </div>
              <span class="hud-interest-count">${count}건 (${pct}%)</span>
            </div>
          `;
        });

        const topUnis = Object.entries(node.uniBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
        let uniTagsHtml = `
          <div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-top: 8px; margin-bottom: 4px;">🏛️ 주요 협력 파트너 대학:</div>
          <div class="network-hud-collaborators">
        `;
        topUnis.forEach(([uni, count]) => {
          uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" data-filter-type="university" data-filter-value="${uni.replace(/"/g, '&quot;')}">${uni} <strong>${count}</strong></span>`;
        });
        uniTagsHtml += `</div>`;

        dynamicContent.innerHTML = topicHtml + uniTagsHtml;
      }

    } else if (node.type === 'category') {
      const topComps = Object.entries(node.compBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const maxCompVal = Math.max(...topComps.map(c => c[1]), 1);

      let compHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #a78bfa; margin-top: 6px; margin-bottom: 4px;">🏢 최다 투자/관심 기업 TOP ${topComps.length}:</div>
      `;
      topComps.forEach(([comp, count]) => {
        const pct = node.val > 0 ? ((count / node.val) * 100).toFixed(1) : 0;
        compHtml += `
          <div class="hud-interest-item" style="cursor: pointer;" title="클릭: '${comp}' 필터링" data-filter-type="company" data-filter-value="${comp.replace(/"/g, '&quot;')}">
            <span class="hud-interest-label">${comp}</span>
            <div class="hud-interest-bar-wrap">
              <div class="hud-interest-bar" style="width: ${(count / maxCompVal) * 100}%; background: linear-gradient(90deg, #a78bfa, #818cf8);"></div>
            </div>
            <span class="hud-interest-count">${count}건 (${pct}%)</span>
          </div>
        `;
      });

      const topUnis = Object.entries(node.uniBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      let uniTagsHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #38bdf8; margin-top: 8px; margin-bottom: 4px;">🏛️ 주요 연구 대학교:</div>
        <div class="network-hud-collaborators">
      `;
      topUnis.forEach(([uni, count]) => {
        uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" data-filter-type="university" data-filter-value="${uni.replace(/"/g, '&quot;')}" title="${uni} (${count}건)">${uni} <strong>${count}</strong></span>`;
      });
      uniTagsHtml += `</div>`;

      dynamicContent.innerHTML = compHtml + uniTagsHtml;

    } else {
      const subMap = node.subtopicBreakdown || node.topicBreakdown || {};
      const topSubs = Object.entries(subMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      let subHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #f59e0b; margin-top: 6px; margin-bottom: 4px;">🔬 주요 연구 수주 분야:</div>
      `;
      topSubs.forEach(([item, count]) => {
        subHtml += `
          <div class="hud-interest-item">
            <span class="hud-interest-label" style="width: 140px;">${item.split('(')[0].trim()}</span>
            <span class="hud-interest-count" style="color: #f59e0b;">${count}건</span>
          </div>
        `;
      });

      const topComps = Object.entries(node.compBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
      let compTagsHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #a78bfa; margin-top: 8px; margin-bottom: 4px;">🏢 주요 협력 기업:</div>
        <div class="network-hud-collaborators">
      `;
      topComps.forEach(([comp, count]) => {
        compTagsHtml += `<span class="hud-tag" style="cursor: pointer;" data-filter-type="company" data-filter-value="${comp.replace(/"/g, '&quot;')}">${comp} <strong>${count}</strong></span>`;
      });
      compTagsHtml += `</div>`;

      dynamicContent.innerHTML = subHtml + compTagsHtml;
    }

    if (node.projects && node.projects.length > 0) {
      const projContainer = document.createElement('div');
      projContainer.style.marginTop = '8px';
      projContainer.style.borderTop = '1px solid rgba(255,255,255,0.1)';
      projContainer.style.paddingTop = '6px';
      projContainer.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: #93c5fd; margin-bottom: 4px;">대표 연구과제 (${node.projects.length}건):</div>
      `;

      node.projects.slice(0, 3).forEach(p => {
        const item = document.createElement('div');
        item.style.fontSize = '10px';
        item.style.color = '#cbd5e1';
        item.style.marginBottom = '4px';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.innerHTML = `
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 230px;" title="${p.topic}">• ${p.topic}</span>
          <button style="background: #3b82f6; border: none; color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 9px; cursor: pointer; flex-shrink: 0;">보기</button>
        `;
        item.querySelector('button').onclick = (e) => {
          e.stopPropagation();
          if (this.onProjectSelect) this.onProjectSelect(p.id);
        };
        projContainer.appendChild(item);
      });

      dynamicContent.appendChild(projContainer);
    }

    const hudContent = document.getElementById('hud-dynamic-content');
    if (hudContent) {
      hudContent.querySelectorAll('[data-filter-type]').forEach(el => {
        el.addEventListener('click', () => {
          if (window.app) window.app.filterByAnalyticsItem(el.dataset.filterType, el.dataset.filterValue);
        });
      });
    }

    hud.classList.add('active');
  }

  hideHud() {
    const hud = document.getElementById('network-hud');
    if (hud) hud.classList.remove('active');
  }

  resetZoomFit() {
    if (this.renderer) this.renderer.resetZoomFit();
  }
}

window.NetworkView = NetworkView;
