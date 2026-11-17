/**
 * VentureNetworkView Module (v8.0.0 — WebGL2 + Pre-computed ForceAtlas2/Louvain Engine)
 * Interactive WebGL2 Graph for Global Semiconductor CVC & Startup Investments.
 *
 * Visualizes:
 * - 🏢 기업-스타트업 투자망 (Corporate-Startup Direct Investment Network)
 * - 🔬 기술 섹터별 생태계망 (Technology Sector Ecosystem Hub Network)
 * - 🤝 공동투자 신디케이트망 (Multi-Corporate Co-investment Syndicate Network)
 */

class VentureNetworkView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.renderer = null;
    this.isInitialized = false;
    this.selectedNodeId = null;
    this.nodes = [];
    this.links = [];
    this.adjacency = new Map();
    this.lodMode = 'all'; // 'core' or 'all'
    this.graphMode = 'corporate'; // 'corporate', 'sector', 'syndicate'
    this.lastProjects = [];
    this.layoutData = null;
    this._layoutPromise = null;

    this.sectorColors = {
      'AI/ML Chips & Accelerators': '#f59e0b',
      'Optical Interconnect & Photonics': '#06b6d4',
      'Chiplet & Advanced Architecture': '#8b5cf6',
      'Memory & Interconnect IP': '#ec4899',
      'Power Semiconductors & SiC': '#10b981',
      'Quantum Computing': '#6366f1',
      'Edge AI & IoT': '#14b8a6',
      'Advanced Manufacturing': '#f97316',
      'Automotive & Sensors': '#eab308',
      'Software & EDA': '#3b82f6',
      'Robotics & AI Applications': '#ef4444'
    };
  }

  _loadLayoutData() {
    if (this.layoutData) return Promise.resolve(this.layoutData);
    if (this._layoutPromise) return this._layoutPromise;
    this._layoutPromise = fetch('data/graph_layout_venture.json')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        this.layoutData = json;
        return json;
      })
      .catch(err => {
        console.warn('Precomputed Venture layout fetch failed:', err);
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
          <button class="network-btn ${this.graphMode === 'corporate' ? 'active' : ''}" id="btn-vnet-mode-corp" title="반도체 대기업 CVC와 피투자 스타트업 간의 직접 투자 연결망">🏢 기업-스타트업 망</button>
          <button class="network-btn ${this.graphMode === 'sector' ? 'active' : ''}" id="btn-vnet-mode-sector" title="11대 기술 섹터 허브 중심 스타트업 및 투자사 생태계망">🔬 기술 섹터 생태계</button>
          <button class="network-btn ${this.graphMode === 'syndicate' ? 'active' : ''}" id="btn-vnet-mode-syndicate" title="2개 이상의 반도체 대기업이 동시 투자한 핵심 신디케이트망">🤝 공동투자 신디케이트</button>
        </div>

        <div class="network-btn-separator"></div>
        <input type="text" id="input-vnet-search" class="kg-search-input" placeholder="🔍 기업/스타트업 찾기..." aria-label="벤처 그래프 노드 검색" />
        <button class="network-btn active" id="btn-vnet-color" title="Louvain 군집 색상 vs 섹터/유형 색상 전환">🎨 군집 색상</button>
        <button class="network-btn" id="btn-vnet-labels" title="줌 연동 자동 라벨 vs 항상 표시 전환">🏷️ 라벨 자동</button>
        <button class="network-btn" id="btn-vnet-lod" title="핵심 거점 / 전체 스타트업 토글">${this.lodMode === 'core' ? '⚡ 핵심 투자망' : '🌐 전체 스타트업 (179개사)'}</button>
        <button class="network-btn" id="btn-vnet-clear" title="선택 해제" style="display: none;">✨ 강조 해제</button>
      </div>

      <!-- ALDB-style Bottom-Right Vertical Utility Stack -->
      <div class="kg-bottom-controls" aria-label="그래프 제어 도구">
        <button class="kg-icon-btn" id="btn-vnet-zoomin" title="확대 (Zoom In)">+</button>
        <button class="kg-icon-btn" id="btn-vnet-zoomout" title="축소 (Zoom Out)">−</button>
        <button class="kg-icon-btn" id="btn-vnet-fit" title="화면 맞춤 (Fit)">⤢</button>
        <button class="kg-icon-btn" id="btn-vnet-reset" title="물리 시뮬레이션 재정렬">↻</button>
        <button class="kg-icon-btn" id="btn-vnet-legend" title="Louvain 투자 군집 범례 토글">≡</button>
      </div>

      <div class="network-hud" id="network-hud">
        <div class="network-hud-title">
          <span id="hud-name">-</span>
          <button id="hud-close-btn" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 0 4px;">&times;</button>
        </div>
        <div class="network-hud-desc" id="hud-type-desc">-</div>
        <div class="hud-dynamic-section" id="hud-dynamic-content"></div>
      </div>
    `;

    const stageEl = document.getElementById('network-stage');
    this.renderer = new KGCanvasRenderer(stageEl, {
      onNodeClick: (node) => this.focusNode(node.id, true),
      onClearSelection: () => this.clearFocus(),
      onNodeDblClick: (d) => {
        if (d.type === 'startup' && d.deals && d.deals.length > 0) {
          if (this.onProjectSelect) this.onProjectSelect(d.deals[0].id);
        } else if (d.type === 'corporate') {
          if (window.app && window.app.filterByAnalyticsItem) {
            window.app.filterByAnalyticsItem('company', d.name);
          }
        }
      }
    });

    document.getElementById('btn-vnet-mode-corp').addEventListener('click', () => {
      this.graphMode = 'corporate';
      this.updateModeButtons();
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-vnet-mode-sector').addEventListener('click', () => {
      this.graphMode = 'sector';
      this.updateModeButtons();
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-vnet-mode-syndicate').addEventListener('click', () => {
      this.graphMode = 'syndicate';
      this.updateModeButtons();
      if (this.lastProjects) this.render(this.lastProjects);
    });

    const vSearch = document.getElementById('input-vnet-search');
    if (vSearch) {
      vSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const hit = this.renderer.focusNodeByQuery(vSearch.value);
          if (hit) this.focusNode(hit.id, true);
        }
      });
    }

    const vColorBtn = document.getElementById('btn-vnet-color');
    if (vColorBtn) {
      vColorBtn.addEventListener('click', () => {
        const next = this.renderer.colorMode === 'community' ? 'type' : 'community';
        this.renderer.setColorMode(next);
        vColorBtn.textContent = next === 'community' ? '🎨 군집 색상' : '🏷️ 섹터 색상';
        vColorBtn.classList.toggle('active', next === 'community');
      });
    }

    const vLabelBtn = document.getElementById('btn-vnet-labels');
    if (vLabelBtn) {
      vLabelBtn.addEventListener('click', () => {
        const next = this.renderer.labelMode === 'auto' ? 'always' : 'auto';
        this.renderer.setLabelMode(next);
        vLabelBtn.textContent = next === 'auto' ? '🏷️ 라벨 자동' : '🏷️ 라벨 항상';
        vLabelBtn.classList.toggle('active', next === 'always');
      });
    }

    document.getElementById('btn-vnet-lod').addEventListener('click', (e) => {
      this.lodMode = this.lodMode === 'core' ? 'all' : 'core';
      e.target.textContent = this.lodMode === 'core' ? '⚡ 핵심 투자망' : '🌐 전체 스타트업 (179개사)';
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-vnet-zoomin').addEventListener('click', () => this.renderer.zoomBy(1.35));
    document.getElementById('btn-vnet-zoomout').addEventListener('click', () => this.renderer.zoomBy(0.72));
    document.getElementById('btn-vnet-fit').addEventListener('click', () => this.renderer.resetZoomFit());
    document.getElementById('btn-vnet-reset').addEventListener('click', () => this.renderer.reheat());
    document.getElementById('btn-vnet-legend').addEventListener('click', (e) => {
      const open = this.renderer.toggleLegend();
      e.target.classList.toggle('active', open);
    });

    document.getElementById('btn-vnet-clear').addEventListener('click', () => this.clearFocus());
    document.getElementById('hud-close-btn').addEventListener('click', () => this.clearFocus());

    this.isInitialized = true;
  }

  updateModeButtons() {
    const btnCorp = document.getElementById('btn-vnet-mode-corp');
    const btnSec = document.getElementById('btn-vnet-mode-sector');
    const btnSyn = document.getElementById('btn-vnet-mode-syndicate');

    if (btnCorp) btnCorp.classList.toggle('active', this.graphMode === 'corporate');
    if (btnSec) btnSec.classList.toggle('active', this.graphMode === 'sector');
    if (btnSyn) btnSyn.classList.toggle('active', this.graphMode === 'syndicate');
  }

  async render(projects) {
    this.lastProjects = projects;
    this.init();
    this.updateModeButtons();

    if (!this.layoutData) {
      await this._loadLayoutData();
    }

    this.selectedNodeId = null;
    const clearBtn = document.getElementById('btn-vnet-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    const hud = document.getElementById('network-hud');
    if (hud) hud.classList.remove('active');

    const graphData = this._buildGraphData(projects);
    this.nodes = graphData.nodes;
    this.links = graphData.links;
    this.adjacency = graphData.adjacency;

    const layoutModeData = this.layoutData && this.layoutData.modes ? this.layoutData.modes[this.graphMode] : null;
    const typeColorMap = {
      corporate: '#2563eb',
      sector: '#8b5cf6',
      startup: '#10b981'
    };

    this.renderer.setData({
      nodes: this.nodes,
      links: this.links,
      layoutModeData,
      typeColorMap,
      nodeScale: 2.0
    });
  }

  _buildGraphData(projects) {
    const rawList = projects || [];
    const adjacency = new Map();

    const addAdj = (u, v) => {
      if (!adjacency.has(u)) adjacency.set(u, new Set());
      if (!adjacency.has(v)) adjacency.set(v, new Set());
      adjacency.get(u).add(v);
      adjacency.get(v).add(u);
    };

    const corpMap = new Map();
    const startupMap = new Map();
    const sectorMap = new Map();

    rawList.forEach(p => {
      const raw = p.rawInvestment || {};
      const corpName = p.company || raw.investor_company;
      const startupName = p.startup_name || p.topic || raw.startup_name;
      const sector = p.category || p.sector || raw.sector || 'Other';
      const tagline = p.startup_tagline || raw.startup_tagline || '';
      const techTag = p.startup_tech_tag || raw.startup_tech_tag || '딥테크';
      const syndicate = p.syndicate_partners || raw.syndicate_partners || [];
      const funding = p.funding_amount_usd || raw.investment_amount_usd || 0;

      if (corpName) {
        if (!corpMap.has(corpName)) {
          corpMap.set(corpName, {
            id: `corp_${corpName}`,
            name: corpName,
            type: 'corporate',
            deals: [],
            startups: new Set(),
            sectors: new Set()
          });
        }
        const cObj = corpMap.get(corpName);
        cObj.deals.push(p);
        if (startupName) cObj.startups.add(startupName);
        if (sector) cObj.sectors.add(sector);
      }

      if (startupName) {
        if (!startupMap.has(startupName)) {
          startupMap.set(startupName, {
            id: `start_${startupName}`,
            name: startupName,
            type: 'startup',
            tagline,
            techTag,
            sector,
            city: p.university_city || raw.startup_hq_city || '',
            country: p.university_country || raw.startup_hq_country || '',
            deals: [],
            investors: new Set(),
            syndicate: new Set(syndicate),
            totalFunding: 0,
            summary: p.summary || raw.startup_description || ''
          });
        }
        const sObj = startupMap.get(startupName);
        sObj.deals.push(p);
        if (corpName) sObj.investors.add(corpName);
        if (tagline && !sObj.tagline) sObj.tagline = tagline;
        if (techTag && (!sObj.techTag || sObj.techTag === '딥테크')) sObj.techTag = techTag;
        sObj.totalFunding += funding;
      }

      if (sector) {
        if (!sectorMap.has(sector)) {
          sectorMap.set(sector, {
            id: `sec_${sector}`,
            name: sector,
            type: 'sector',
            startups: new Set(),
            investors: new Set()
          });
        }
        const secObj = sectorMap.get(sector);
        if (startupName) secObj.startups.add(startupName);
        if (corpName) secObj.investors.add(corpName);
      }
    });

    const nodes = [];
    const links = [];
    const nodeSet = new Set();

    if (this.graphMode === 'corporate') {
      const visibleStartups = new Set();
      startupMap.forEach((sObj, sName) => {
        if (this.lodMode === 'core') {
          if (sObj.investors.size >= 2 || sObj.totalFunding >= 25000000 || sObj.deals.length >= 2) {
            visibleStartups.add(sName);
          }
        } else {
          visibleStartups.add(sName);
        }
      });

      corpMap.forEach(cObj => {
        const connectedVisible = Array.from(cObj.startups).filter(s => visibleStartups.has(s));
        if (connectedVisible.length === 0) return;

        const count = connectedVisible.length;
        nodes.push({
          id: cObj.id,
          name: cObj.name,
          type: 'corporate',
          color: '#2563eb',
          label: `🏢 ${cObj.name}`,
          deals: cObj.deals,
          startups: cObj.startups,
          val: count
        });
        nodeSet.add(cObj.id);
      });

      visibleStartups.forEach(sName => {
        const sObj = startupMap.get(sName);
        const secColor = this.sectorColors[sObj.sector] || '#10b981';
        const invCount = sObj.investors.size;
        nodes.push({
          id: sObj.id,
          name: sObj.name,
          type: 'startup',
          color: secColor,
          label: `${sObj.name} [${sObj.techTag}]`,
          tagline: sObj.tagline,
          techTag: sObj.techTag,
          sector: sObj.sector,
          city: sObj.city,
          country: sObj.country,
          deals: sObj.deals,
          investors: sObj.investors,
          syndicate: sObj.syndicate,
          summary: sObj.summary,
          val: invCount
        });
        nodeSet.add(sObj.id);
      });

      rawList.forEach(p => {
        const corpName = p.company || (p.rawInvestment && p.rawInvestment.investor_company);
        const startupName = p.startup_name || p.topic || (p.rawInvestment && p.rawInvestment.startup_name);
        const cId = `corp_${corpName}`;
        const sId = `start_${startupName}`;
        if (nodeSet.has(cId) && nodeSet.has(sId)) {
          links.push({ id: `${cId}__${sId}__${p.id}`, source: cId, target: sId, weight: 1.5, deal: p });
          addAdj(cId, sId);
        }
      });

    } else if (this.graphMode === 'sector') {
      sectorMap.forEach(secObj => {
        const secColor = this.sectorColors[secObj.name] || '#8b5cf6';
        nodes.push({
          id: secObj.id,
          name: secObj.name,
          type: 'sector',
          color: secColor,
          label: `🔬 ${secObj.name}`,
          startups: secObj.startups,
          investors: secObj.investors,
          val: secObj.startups.size
        });
        nodeSet.add(secObj.id);
      });

      startupMap.forEach((sObj) => {
        if (this.lodMode === 'core' && sObj.totalFunding < 20000000 && sObj.investors.size < 2) return;
        const secNodeId = `sec_${sObj.sector}`;
        if (!nodeSet.has(secNodeId)) return;

        const secColor = this.sectorColors[sObj.sector] || '#10b981';
        nodes.push({
          id: sObj.id,
          name: sObj.name,
          type: 'startup',
          color: secColor,
          label: `${sObj.name} [${sObj.techTag}]`,
          tagline: sObj.tagline,
          techTag: sObj.techTag,
          sector: sObj.sector,
          city: sObj.city,
          country: sObj.country,
          deals: sObj.deals,
          investors: sObj.investors,
          syndicate: sObj.syndicate,
          summary: sObj.summary,
          val: sObj.investors.size
        });
        nodeSet.add(sObj.id);

        links.push({ id: `${secNodeId}__${sObj.id}`, source: secNodeId, target: sObj.id, weight: 1.2 });
        addAdj(secNodeId, sObj.id);
      });

      corpMap.forEach(cObj => {
        if (cObj.startups.size < 2 && this.lodMode === 'core') return;
        nodes.push({
          id: cObj.id,
          name: cObj.name,
          type: 'corporate',
          color: '#2563eb',
          label: `🏢 ${cObj.name}`,
          deals: cObj.deals,
          startups: cObj.startups,
          val: cObj.startups.size
        });
        nodeSet.add(cObj.id);

        cObj.sectors.forEach(secName => {
          const secNodeId = `sec_${secName}`;
          if (nodeSet.has(secNodeId)) {
            links.push({ id: `${cObj.id}__${secNodeId}`, source: cObj.id, target: secNodeId, weight: 2.0 });
            addAdj(cObj.id, secNodeId);
          }
        });
      });

    } else {
      const syndicateStartups = new Map();
      startupMap.forEach((sObj, sName) => {
        if (sObj.investors.size >= 2 || (sObj.syndicate && sObj.syndicate.size >= 2)) {
          syndicateStartups.set(sName, sObj);
        }
      });

      const participatingCorps = new Set();
      syndicateStartups.forEach(sObj => {
        sObj.investors.forEach(corp => participatingCorps.add(corp));
      });

      participatingCorps.forEach(corpName => {
        const cObj = corpMap.get(corpName);
        if (!cObj) return;
        nodes.push({
          id: cObj.id,
          name: cObj.name,
          type: 'corporate',
          color: '#2563eb',
          label: `🏢 ${cObj.name}`,
          deals: cObj.deals,
          startups: cObj.startups,
          val: cObj.startups.size
        });
        nodeSet.add(cObj.id);
      });

      syndicateStartups.forEach((sObj) => {
        const secColor = this.sectorColors[sObj.sector] || '#10b981';
        const invCount = sObj.investors.size;
        nodes.push({
          id: sObj.id,
          name: sObj.name,
          type: 'startup',
          color: secColor,
          label: `🤝 ${sObj.name} [${sObj.techTag}]`,
          tagline: sObj.tagline,
          techTag: sObj.techTag,
          sector: sObj.sector,
          city: sObj.city,
          country: sObj.country,
          deals: sObj.deals,
          investors: sObj.investors,
          syndicate: sObj.syndicate,
          summary: sObj.summary,
          val: invCount
        });
        nodeSet.add(sObj.id);

        sObj.investors.forEach(corpName => {
          const cId = `corp_${corpName}`;
          if (nodeSet.has(cId)) {
            links.push({ id: `${cId}__${sObj.id}`, source: cId, target: sObj.id, weight: 2.2 });
            addAdj(cId, sObj.id);
          }
        });
      });
    }

    return { nodes, links, adjacency };
  }

  focusNode(nodeId, alreadySelectedInRenderer = false) {
    this.selectedNodeId = nodeId;
    const targetNode = this.nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    if (!alreadySelectedInRenderer && this.renderer) {
      this.renderer.focusNodeById(nodeId);
    }

    const neighbors = this.adjacency.get(nodeId) || new Set();
    const clearBtn = document.getElementById('btn-vnet-clear');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    this._renderHud(targetNode, neighbors);
  }

  clearFocus() {
    this.selectedNodeId = null;
    if (this.renderer) this.renderer.clearSelection();

    const clearBtn = document.getElementById('btn-vnet-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    const hud = document.getElementById('network-hud');
    if (hud) hud.classList.remove('active');
  }

  _renderHud(node) {
    const hud = document.getElementById('network-hud');
    const nameEl = document.getElementById('hud-name');
    const descEl = document.getElementById('hud-type-desc');
    const contentEl = document.getElementById('hud-dynamic-content');

    if (!hud || !nameEl || !descEl || !contentEl) return;

    hud.classList.add('active');

    if (node.type === 'startup') {
      nameEl.innerHTML = `🚀 ${node.name}`;
      descEl.innerHTML = `
        <span class="hud-tag" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);">${node.sector}</span>
        <span style="color: #9ca3af; margin-left: 4px;">📍 ${node.city ? `${node.city}, ` : ''}${node.country}</span>
      `;

      const investorsHtml = Array.from(node.investors).map(invName => `
        <span class="hud-tag" style="background: rgba(37, 99, 235, 0.25); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.5); cursor: pointer;" data-action="filter-company" data-val="${invName}">
          🏢 ${invName}
        </span>
      `).join('');

      const syndicateList = Array.from(node.syndicate || []).filter(s => !node.investors.has(s));
      const syndicateHtml = syndicateList.length > 0 ? `
        <div style="margin-top: 6px;">
          <div style="font-size: 11px; color: #a78bfa; font-weight: 700; margin-bottom: 2px;">🤝 주요 공동투자자 (Syndicate Partners):</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${syndicateList.map(syn => `<span class="hud-tag" style="background: rgba(139, 92, 246, 0.2); color: #c4b5fd; border: 1px solid rgba(139, 92, 246, 0.4);">${syn}</span>`).join('')}
          </div>
        </div>
      ` : '';

      const firstDealId = (node.deals && node.deals.length > 0) ? node.deals[0].id : null;

      contentEl.innerHTML = `
        <div style="background: rgba(30, 41, 59, 0.7); border-radius: 6px; padding: 8px; margin-bottom: 8px; border-left: 3px solid #38bdf8;">
          <div style="font-size: 12px; font-weight: 700; color: #38bdf8; margin-bottom: 4px;">
            💡 ${node.tagline || `[${node.techTag}] ${node.sector} 스타트업`}
          </div>
          <div style="font-size: 11px; color: #cbd5e1; line-height: 1.4;">
            ${node.summary || '스타트업 개요가 제공되지 않았습니다.'}
          </div>
        </div>

        <div style="margin-bottom: 6px;">
          <div style="font-size: 11px; color: #9ca3af; font-weight: 700; margin-bottom: 4px;">
            🏢 투자 참여 반도체 기업 (${node.investors.size}개사):
          </div>
          <div class="network-hud-collaborators">
            ${investorsHtml}
          </div>
        </div>

        ${syndicateHtml}

        <div style="display: flex; gap: 6px; margin-top: 10px;">
          ${firstDealId ? `
            <button class="network-btn active" id="btn-hud-modal" style="flex: 1; justify-content: center; font-size: 11px; padding: 5px 8px;">
              🔍 투자 상세 모달
            </button>
          ` : ''}
          <button class="network-btn" id="btn-hud-filter-startup" style="flex: 1; justify-content: center; font-size: 11px; padding: 5px 8px;">
            📋 목록에서 보기
          </button>
        </div>
      `;

      const modalBtn = document.getElementById('btn-hud-modal');
      if (modalBtn && firstDealId) {
        modalBtn.addEventListener('click', () => {
          if (this.onProjectSelect) this.onProjectSelect(firstDealId);
        });
      }

      const filterBtn = document.getElementById('btn-hud-filter-startup');
      if (filterBtn) {
        filterBtn.addEventListener('click', () => {
          if (window.app && window.app.filterByAnalyticsItem) {
            window.app.filterByAnalyticsItem('startup', node.name);
          }
        });
      }

    } else if (node.type === 'corporate') {
      nameEl.innerHTML = `🏢 ${node.name}`;
      descEl.innerHTML = `
        <span style="color: #60a5fa; font-weight: 700;">반도체 대기업 CVC / 직접 투자</span>
        <span style="color: #9ca3af; margin-left: 4px;">• 포트폴리오 ${node.startups.size}개사 (${node.deals.length}건 투자)</span>
      `;

      const startupChipsHtml = Array.from(node.startups).map(sName => {
        const sNode = this.nodes.find(n => n.type === 'startup' && n.name === sName);
        const tag = sNode ? sNode.techTag : '딥테크';
        return `
          <span class="hud-tag" style="cursor: pointer;" data-action="focus-startup" data-target="start_${sName}">
            🚀 ${sName} <strong style="color: #38bdf8; font-size: 10px;">[${tag}]</strong>
          </span>
        `;
      }).join('');

      contentEl.innerHTML = `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; color: #9ca3af; font-weight: 700; margin-bottom: 4px;">
            🚀 주요 투자 포트폴리오 (${node.startups.size}개 스타트업):
          </div>
          <div class="network-hud-collaborators" style="max-height: 140px;">
            ${startupChipsHtml}
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 10px;">
          <button class="network-btn active" id="btn-hud-filter-corp" style="width: 100%; justify-content: center; font-size: 11px; padding: 6px 8px;">
            📋 '${node.name}' 투자 전체 목록 보기 (${node.deals.length}건)
          </button>
        </div>
      `;

      const filterCorpBtn = document.getElementById('btn-hud-filter-corp');
      if (filterCorpBtn) {
        filterCorpBtn.addEventListener('click', () => {
          if (window.app && window.app.filterByAnalyticsItem) {
            window.app.filterByAnalyticsItem('company', node.name);
          }
        });
      }

    } else if (node.type === 'sector') {
      nameEl.innerHTML = `🔬 ${node.name}`;
      descEl.innerHTML = `
        <span style="color: #c084fc; font-weight: 700;">11대 핵심 기술 섹터 허브</span>
        <span style="color: #9ca3af; margin-left: 4px;">• 스타트업 ${node.startups.size}개사</span>
      `;

      const startupsListHtml = Array.from(node.startups).slice(0, 15).map(sName => `
        <span class="hud-tag" style="cursor: pointer;" data-action="focus-startup" data-target="start_${sName}">
          🚀 ${sName}
        </span>
      `).join('');

      contentEl.innerHTML = `
        <div style="margin-bottom: 8px;">
          <div style="font-size: 11px; color: #9ca3af; font-weight: 700; margin-bottom: 4px;">
            🚀 소속 딥테크 스타트업 (${node.startups.size}개사):
          </div>
          <div class="network-hud-collaborators">
            ${startupsListHtml}
          </div>
        </div>

        <div style="display: flex; gap: 6px; margin-top: 10px;">
          <button class="network-btn active" id="btn-hud-filter-sec" style="width: 100%; justify-content: center; font-size: 11px; padding: 6px 8px;">
            📋 '${node.name}' 투자 목록 필터링
          </button>
        </div>
      `;

      const filterSecBtn = document.getElementById('btn-hud-filter-sec');
      if (filterSecBtn) {
        filterSecBtn.addEventListener('click', () => {
          if (window.app && window.app.filterByAnalyticsItem) {
            window.app.filterByAnalyticsItem('sector', node.name);
          }
        });
      }
    }

    contentEl.querySelectorAll('[data-action="focus-startup"]').forEach(el => {
      el.addEventListener('click', () => {
        const targetId = el.getAttribute('data-target');
        if (targetId) this.focusNode(targetId);
      });
    });

    contentEl.querySelectorAll('[data-action="filter-company"]').forEach(el => {
      el.addEventListener('click', () => {
        const val = el.getAttribute('data-val');
        if (val && window.app && window.app.filterByAnalyticsItem) {
          window.app.filterByAnalyticsItem('company', val);
        }
      });
    });
  }

  resetZoomFit() {
    if (this.renderer) this.renderer.resetZoomFit();
  }
}

window.VentureNetworkView = VentureNetworkView;
window.NetworkView = VentureNetworkView;
