/**
 * VentureNetworkView Module
 * Interactive D3.js Force-Directed Graph for Global Semiconductor CVC & Startup Investments.
 *
 * Visualizes:
 * - 🏢 기업-스타트업 투자망 (Corporate-Startup Direct Investment Network)
 * - 🔬 기술 섹터별 생태계망 (Technology Sector Ecosystem Hub Network)
 * - 🤝 공동투자 신디케이트망 (Multi-Corporate Co-investment Syndicate Network)
 *
 * Core Features:
 * - Startup node labels show name + tech classification tag: [광인터커넥트], [칩렛 D2D], [AI 가속기] etc.
 * - Interactive HUD with startup tagline, description, participating CVCs, syndicate partners, and direct modal trigger.
 * - LOD filtering (Core High-Impact Deals vs All 179+ Startups).
 * - Zoom-adaptive node labels and fast-settling physics simulation.
 */

class VentureNetworkView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.svg = null;
    this.zoom = null;
    this.g = null;
    this.simulation = null;
    this.isInitialized = false;
    this.selectedNodeId = null;
    this.nodes = [];
    this.links = [];
    this.adjacency = new Map();
    this.lodMode = 'all'; // 'core' (핵심 거점) or 'all' (전체)
    this.graphMode = 'corporate'; // 'corporate' (기업-스타트업), 'sector' (기술섹터 생태계), 'syndicate' (공동투자 신디케이트)
    this.lastProjects = [];

    // Sector Color Palette
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

  init() {
    if (this.isInitialized) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <svg id="network-svg"></svg>
      <div class="network-controls">
        <div class="network-mode-group">
          <button class="network-btn ${this.graphMode === 'corporate' ? 'active' : ''}" id="btn-vnet-mode-corp" title="반도체 대기업 CVC와 피투자 스타트업 간의 직접 투자 연결망">🏢 기업-스타트업 망</button>
          <button class="network-btn ${this.graphMode === 'sector' ? 'active' : ''}" id="btn-vnet-mode-sector" title="11대 기술 섹터 허브 중심 스타트업 및 투자사 생태계망">🔬 기술 섹터 생태계</button>
          <button class="network-btn ${this.graphMode === 'syndicate' ? 'active' : ''}" id="btn-vnet-mode-syndicate" title="2개 이상의 반도체 대기업이 동시 투자한 핵심 신디케이트망">🤝 공동투자 신디케이트</button>
        </div>

        <div class="network-btn-separator"></div>
        <button class="network-btn" id="btn-vnet-lod" title="핵심 거점 / 전체 스타트업 토글">${this.lodMode === 'core' ? '⚡ 핵심 투자망' : '🌐 전체 스타트업 (179개사)'}</button>
        <button class="network-btn" id="btn-vnet-fit" title="화면 맞춤">🎯 화면 맞춤</button>
        <button class="network-btn" id="btn-vnet-reset" title="시뮬레이션 재정렬">🔄 재정렬</button>
        <button class="network-btn" id="btn-vnet-zoomin" title="확대">➕</button>
        <button class="network-btn" id="btn-vnet-zoomout" title="축소">➖</button>
        <button class="network-btn" id="btn-vnet-clear" title="선택 해제" style="display: none;">✨ 강조 해제</button>
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

    // Bind Controls
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

    document.getElementById('btn-vnet-lod').addEventListener('click', (e) => {
      this.lodMode = this.lodMode === 'core' ? 'all' : 'core';
      e.target.textContent = this.lodMode === 'core' ? '⚡ 핵심 투자망' : '🌐 전체 스타트업 (179개사)';
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-vnet-zoomin').addEventListener('click', () => {
      if (this.svg && this.zoom) {
        this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.35);
      }
    });

    document.getElementById('btn-vnet-zoomout').addEventListener('click', () => {
      if (this.svg && this.zoom) {
        this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.72);
      }
    });

    document.getElementById('btn-vnet-fit').addEventListener('click', () => {
      this.resetZoomFit();
    });

    document.getElementById('btn-vnet-reset').addEventListener('click', () => {
      if (this.simulation) {
        this.simulation.alpha(0.6).restart();
      }
    });

    document.getElementById('btn-vnet-clear').addEventListener('click', () => {
      this.clearFocus();
    });

    document.getElementById('hud-close-btn').addEventListener('click', () => {
      this.clearFocus();
    });

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

  render(projects) {
    this.lastProjects = projects;

    // Stop previous simulation to prevent CPU/memory leak
    if (this.simulation) {
      this.simulation.stop();
      this.simulation.on('tick', null);
      this.simulation = null;
    }

    if (!this.isInitialized) {
      this.init();
    }

    const container = document.getElementById(this.containerId);
    if (!container) return;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    const svgEl = d3.select('#network-svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    svgEl.selectAll('*').remove();
    this.svg = svgEl;

    // Background click clears focus
    svgEl.on('click', (event) => {
      if (event.target.tagName === 'svg' || event.target.id === 'network-svg') {
        this.clearFocus();
      }
    });

    // Create defs for glow and gradients
    const defs = svgEl.append('defs');

    // Corporate Node Glow Filter
    const filter = defs.append('filter')
      .attr('id', 'corp-glow')
      .attr('x', '-30%').attr('y', '-30%')
      .attr('width', '160%').attr('height', '160%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    filter.append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over');

    const g = svgEl.append('g').attr('class', 'network-root');
    this.g = g;

    // Zoom & Pan setup
    this.zoom = d3.zoom()
      .scaleExtent([0.15, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        this._updateLabelVisibility(event.transform.k);
      });

    svgEl.call(this.zoom);

    // Build Graph Nodes & Links based on current mode
    const graphData = this._buildGraphData(projects);
    this.nodes = graphData.nodes;
    this.links = graphData.links;
    this.adjacency = graphData.adjacency;

    if (this.nodes.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#9ca3af')
        .attr('font-size', '15px')
        .text('선택한 조건에 해당하는 투자 데이터가 없습니다.');
      return;
    }

    // Physics Force Simulation
    const linkDistance = this.graphMode === 'sector' ? 85 : 95;
    const chargeStrength = this.nodes.length > 150 ? -120 : -180;

    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(d => d.distance || linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength).distanceMax(500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 6))
      .alphaDecay(0.035)
      .velocityDecay(0.38);

    // Draw Links
    const link = g.append('g')
      .attr('class', 'network-links')
      .selectAll('line')
      .data(this.links)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke', d => d.color || 'rgba(148, 163, 184, 0.22)')
      .attr('stroke-width', d => Math.max(1, Math.min(d.width || 1.2, 4)))
      .attr('stroke-opacity', 0.45);

    // Draw Nodes
    const node = g.append('g')
      .attr('class', 'network-nodes')
      .selectAll('g')
      .data(this.nodes)
      .join('g')
      .attr('class', d => `network-node node-${d.type}`)
      .attr('data-id', d => d.id)
      .call(this._drag(this.simulation));

    // Node Circle
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => d.color)
      .attr('stroke', d => d.strokeColor || '#ffffff')
      .attr('stroke-width', d => d.strokeWidth || 1.8)
      .attr('stroke-opacity', 0.85)
      .style('filter', d => d.type === 'corporate' ? 'url(#corp-glow)' : 'none')
      .style('cursor', 'pointer');

    // Node Text Label
    node.append('text')
      .attr('dx', d => d.radius + 5)
      .attr('dy', '0.35em')
      .attr('font-size', d => d.type === 'corporate' ? '12px' : (d.type === 'sector' ? '12px' : '10.5px'))
      .attr('font-weight', d => (d.type === 'corporate' || d.type === 'sector') ? '800' : '600')
      .attr('fill', d => d.type === 'corporate' ? '#93c5fd' : (d.type === 'sector' ? '#d8b4fe' : '#e2e8f0'))
      .style('pointer-events', 'none')
      .text(d => d.label);

    // Node Hover & Click Interactions
    node
      .on('click', (event, d) => {
        event.stopPropagation();
        this.focusNode(d.id);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        if (d.type === 'startup' && d.deals && d.deals.length > 0) {
          if (this.onProjectSelect) {
            this.onProjectSelect(d.deals[0].id);
          }
        } else if (d.type === 'corporate') {
          if (window.app && window.app.filterByAnalyticsItem) {
            window.app.filterByAnalyticsItem('company', d.name);
          }
        }
      });

    // Simulation Tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Fit view after initial simulation run
    setTimeout(() => {
      this.resetZoomFit();
    }, 450);
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

    // 1. Collect Corporate Investors, Startups, and Sectors
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
      const fundingDisplay = p.funding_display || raw.investment_amount_display || '';
      const round = raw.investment_round || p.status_detail || '';
      const cvcArm = p.cvc_arm || raw.cvc_arm || '';

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
            tagline: tagline,
            techTag: techTag,
            sector: sector,
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

    // Mode-specific filtering and construction
    if (this.graphMode === 'corporate') {
      // Direct Corporate to Startup mode
      // LOD filtering: in 'core' mode, keep top corporate investors & startups with 2+ deals or $25M+ funding
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

      // Add Corporate Nodes
      corpMap.forEach(cObj => {
        // Only include corporate node if it connects to at least one visible startup
        const connectedVisible = Array.from(cObj.startups).filter(s => visibleStartups.has(s));
        if (connectedVisible.length === 0) return;

        const count = connectedVisible.length;
        const radius = Math.min(26, Math.max(15, 12 + count * 0.8));
        const node = {
          id: cObj.id,
          name: cObj.name,
          type: 'corporate',
          radius: radius,
          color: '#2563eb', // Royal Blue
          strokeColor: '#60a5fa',
          strokeWidth: 2.5,
          label: `🏢 ${cObj.name}`,
          deals: cObj.deals,
          startups: cObj.startups,
          val: count
        };
        nodes.push(node);
        nodeSet.add(node.id);
      });

      // Add Startup Nodes
      visibleStartups.forEach(sName => {
        const sObj = startupMap.get(sName);
        const secColor = this.sectorColors[sObj.sector] || '#10b981';
        const invCount = sObj.investors.size;
        const radius = Math.min(22, Math.max(10, 8 + invCount * 2.5));

        const node = {
          id: sObj.id,
          name: sObj.name,
          type: 'startup',
          radius: radius,
          color: secColor,
          strokeColor: invCount >= 2 ? '#fbbf24' : '#e2e8f0', // Gold border for multi-backed startups
          strokeWidth: invCount >= 2 ? 2.8 : 1.5,
          // CRITICAL: Format label as [name] [tech_tag]
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
        };
        nodes.push(node);
        nodeSet.add(node.id);
      });

      // Add Links: Corporate -> Startup
      rawList.forEach(p => {
        const corpName = p.company || (p.rawInvestment && p.rawInvestment.investor_company);
        const startupName = p.startup_name || p.topic || (p.rawInvestment && p.rawInvestment.startup_name);
        const cId = `corp_${corpName}`;
        const sId = `start_${startupName}`;

        if (nodeSet.has(cId) && nodeSet.has(sId)) {
          links.push({
            id: `${cId}__${sId}__${p.id}`,
            source: cId,
            target: sId,
            color: 'rgba(96, 165, 250, 0.35)',
            width: 1.5,
            deal: p
          });
          addAdj(cId, sId);
        }
      });

    } else if (this.graphMode === 'sector') {
      // Sector Hub Ecosystem Mode
      // Add Sector Hubs
      sectorMap.forEach(secObj => {
        const secColor = this.sectorColors[secObj.name] || '#8b5cf6';
        const node = {
          id: secObj.id,
          name: secObj.name,
          type: 'sector',
          radius: 24,
          color: secColor,
          strokeColor: '#ffffff',
          strokeWidth: 3,
          label: `🔬 ${secObj.name}`,
          startups: secObj.startups,
          investors: secObj.investors,
          val: secObj.startups.size
        };
        nodes.push(node);
        nodeSet.add(node.id);
      });

      // Add Startups connected to their sector
      startupMap.forEach((sObj, sName) => {
        if (this.lodMode === 'core' && sObj.totalFunding < 20000000 && sObj.investors.size < 2) return;

        const secNodeId = `sec_${sObj.sector}`;
        if (!nodeSet.has(secNodeId)) return;

        const secColor = this.sectorColors[sObj.sector] || '#10b981';
        const node = {
          id: sObj.id,
          name: sObj.name,
          type: 'startup',
          radius: 11,
          color: secColor,
          strokeColor: '#cbd5e1',
          strokeWidth: 1.5,
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
        };
        nodes.push(node);
        nodeSet.add(node.id);

        links.push({
          id: `${secNodeId}__${sObj.id}`,
          source: secNodeId,
          target: sObj.id,
          color: secColor,
          width: 1.3
        });
        addAdj(secNodeId, sObj.id);
      });

      // Add Top Corporate Investors connected to sectors they invest in
      corpMap.forEach(cObj => {
        if (cObj.startups.size < 2 && this.lodMode === 'core') return;

        const node = {
          id: cObj.id,
          name: cObj.name,
          type: 'corporate',
          radius: 18,
          color: '#2563eb',
          strokeColor: '#60a5fa',
          strokeWidth: 2,
          label: `🏢 ${cObj.name}`,
          deals: cObj.deals,
          startups: cObj.startups,
          val: cObj.startups.size
        };
        nodes.push(node);
        nodeSet.add(node.id);

        cObj.sectors.forEach(secName => {
          const secNodeId = `sec_${secName}`;
          if (nodeSet.has(secNodeId)) {
            links.push({
              id: `${cObj.id}__${secNodeId}`,
              source: cObj.id,
              target: secNodeId,
              color: 'rgba(96, 165, 250, 0.4)',
              width: 2.2,
              distance: 120
            });
            addAdj(cObj.id, secNodeId);
          }
        });
      });

    } else if (this.graphMode === 'syndicate') {
      // Syndicate Mode: Focus on Startups with 2+ Corporate Investors or Multi-CVC co-investments
      const syndicateStartups = new Map();
      startupMap.forEach((sObj, sName) => {
        if (sObj.investors.size >= 2 || (sObj.syndicate && sObj.syndicate.size >= 2)) {
          syndicateStartups.set(sName, sObj);
        }
      });

      // Add Participating Corporate Investors
      const participatingCorps = new Set();
      syndicateStartups.forEach(sObj => {
        sObj.investors.forEach(corp => participatingCorps.add(corp));
      });

      participatingCorps.forEach(corpName => {
        const cObj = corpMap.get(corpName);
        if (!cObj) return;
        const node = {
          id: cObj.id,
          name: cObj.name,
          type: 'corporate',
          radius: 20,
          color: '#2563eb',
          strokeColor: '#60a5fa',
          strokeWidth: 2.5,
          label: `🏢 ${cObj.name}`,
          deals: cObj.deals,
          startups: cObj.startups,
          val: cObj.startups.size
        };
        nodes.push(node);
        nodeSet.add(node.id);
      });

      // Add Syndicate Startups
      syndicateStartups.forEach((sObj, sName) => {
        const secColor = this.sectorColors[sObj.sector] || '#10b981';
        const invCount = sObj.investors.size;
        const node = {
          id: sObj.id,
          name: sObj.name,
          type: 'startup',
          radius: 14 + invCount * 2,
          color: secColor,
          strokeColor: '#f59e0b', // Glowing gold ring for syndicate
          strokeWidth: 3,
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
        };
        nodes.push(node);
        nodeSet.add(node.id);

        // Connect Corporate -> Startup
        sObj.investors.forEach(corpName => {
          const cId = `corp_${corpName}`;
          if (nodeSet.has(cId)) {
            links.push({
              id: `${cId}__${sObj.id}`,
              source: cId,
              target: sObj.id,
              color: 'rgba(245, 158, 11, 0.65)',
              width: 2.4,
              distance: 85
            });
            addAdj(cId, sObj.id);
          }
        });
      });
    }

    return { nodes, links, adjacency };
  }

  focusNode(nodeId) {
    this.selectedNodeId = nodeId;
    const targetNode = this.nodes.find(n => n.id === nodeId);
    if (!targetNode) return;

    const neighbors = this.adjacency.get(nodeId) || new Set();

    // Visual Highlighting & Dimming
    this.g.selectAll('.network-node')
      .classed('node-selected', d => d.id === nodeId)
      .classed('node-neighbor', d => neighbors.has(d.id))
      .classed('node-dimmed', d => d.id !== nodeId && !neighbors.has(d.id));

    this.g.selectAll('.network-link')
      .classed('link-highlighted', d => (d.source.id === nodeId && neighbors.has(d.target.id)) || (d.target.id === nodeId && neighbors.has(d.source.id)))
      .classed('link-dimmed', d => d.source.id !== nodeId && d.target.id !== nodeId);

    // Show Clear Button
    const clearBtn = document.getElementById('btn-vnet-clear');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    // Populate HUD
    this._renderHud(targetNode, neighbors);
  }

  clearFocus() {
    this.selectedNodeId = null;

    if (this.g) {
      this.g.selectAll('.network-node')
        .classed('node-selected', false)
        .classed('node-neighbor', false)
        .classed('node-dimmed', false);

      this.g.selectAll('.network-link')
        .classed('link-highlighted', false)
        .classed('link-dimmed', false);
    }

    const clearBtn = document.getElementById('btn-vnet-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    const hud = document.getElementById('network-hud');
    if (hud) hud.classList.remove('active');
  }

  _renderHud(node, neighbors) {
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

      // Bind HUD Buttons
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

      // List of portfolio startups with tech tag
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

    // Dynamic delegation for chips inside HUD
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

  _updateLabelVisibility(scale) {
    if (!this.g) return;
    this.g.selectAll('.network-node text')
      .style('opacity', d => {
        if (d.type === 'corporate' || d.type === 'sector') return 1;
        if (this.selectedNodeId) return 1;
        if (scale > 1.3) return 1;
        if (scale > 0.8 && (d.val >= 2 || (d.radius && d.radius >= 13))) return 1;
        return 0;
      });
  }

  resetZoomFit() {
    if (!this.svg || !this.zoom || this.nodes.length === 0) return;

    const container = document.getElementById(this.containerId);
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    this.nodes.forEach(d => {
      if (d.x < x0) x0 = d.x;
      if (d.x > x1) x1 = d.x;
      if (d.y < y0) y0 = d.y;
      if (d.y > y1) y1 = d.y;
    });

    if (x0 === Infinity) return;

    const dx = x1 - x0 || 1;
    const dy = y1 - y0 || 1;
    const padding = 65;

    const scale = Math.min(2.5, Math.max(0.25, 0.85 / Math.max(dx / (width - padding * 2), dy / (height - padding * 2))));
    const translate = [
      width / 2 - scale * ((x0 + x1) / 2),
      height / 2 - scale * ((y0 + y1) / 2)
    ];

    this.svg.transition()
      .duration(650)
      .call(this.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }

  _drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
}

// Global Aliases for Compatibility
window.VentureNetworkView = VentureNetworkView;
window.NetworkView = VentureNetworkView;
