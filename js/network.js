/**
 * NetworkView Module (v7.3.0)
 * Renders an interactive D3.js Force-Directed Graph connecting
 * Technology Domains/Topics, Companies, and Universities.
 * Supports:
 * - 🔬 주제·기업 관심도 중심망 (Topic & Company Interest Mode): Highlights which companies and universities invest in each domain
 * - 🌐 기관 협력망 (Institution Mode): Highlights corporate-academic partnerships
 * - Interactive Node Focus with Rich Domain & Company Breakdown HUD
 * - Core Hub LOD Filtering and Instant Settled Rendering (Pre-warmed simulation)
 */
class NetworkView {
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
    this.adjacency = new Map(); // nodeId -> Set of neighbor nodeIds
    this.lodMode = 'core'; // 'core' or 'all'
    this.graphMode = 'topic'; // 'topic' (주제·기업 관심도 중심망) or 'institution' (기관 협력망)
    this.lastProjects = [];
  }

  init() {
    if (this.isInitialized) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <svg id="network-svg"></svg>
      <div class="network-controls">
        <div class="network-mode-group">
          <button class="network-btn ${this.graphMode === 'topic' ? 'active' : ''}" id="btn-net-mode-topic" title="7대 기술 도메인 중심 글로벌 기업 관심도 및 대학 연구 집중도 시각화">🔬 주제·기업 관심도 중심망</button>
          <button class="network-btn ${this.graphMode === 'institution' ? 'active' : ''}" id="btn-net-mode-inst" title="기업-대학-연구소 간의 직접 산학 협력망">🌐 기관 협력망</button>
        </div>
        <div class="network-btn-separator"></div>
        <button class="network-btn" id="btn-network-lod" title="핵심 거점망 / 전체 연결망 토글">${this.lodMode === 'core' ? '⚡ 핵심 거점망' : '🌐 전체 연결망'}</button>
        <button class="network-btn" id="btn-net-fit" title="화면 맞춤">🎯 화면 맞춤</button>
        <button class="network-btn" id="btn-net-reset" title="시뮬레이션 재정렬">🔄 재정렬</button>
        <button class="network-btn" id="btn-net-zoomin" title="확대">➕</button>
        <button class="network-btn" id="btn-net-zoomout" title="축소">➖</button>
        <button class="network-btn" id="btn-net-clear" title="선택 해제" style="display: none;">✨ 강조 해제</button>
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

    // Bind Network Controls
    document.getElementById('btn-net-mode-topic').addEventListener('click', () => {
      this.graphMode = 'topic';
      document.getElementById('btn-net-mode-topic').classList.add('active');
      document.getElementById('btn-net-mode-inst').classList.remove('active');
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-net-mode-inst').addEventListener('click', () => {
      this.graphMode = 'institution';
      document.getElementById('btn-net-mode-inst').classList.add('active');
      document.getElementById('btn-net-mode-topic').classList.remove('active');
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-network-lod').addEventListener('click', (e) => {
      this.lodMode = this.lodMode === 'core' ? 'all' : 'core';
      e.target.textContent = this.lodMode === 'core' ? '⚡ 핵심 거점망' : '🌐 전체 연결망';
      if (this.lastProjects) this.render(this.lastProjects);
    });

    document.getElementById('btn-net-zoomin').addEventListener('click', () => {
      if (this.svg && this.zoom) {
        this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
      }
    });

    document.getElementById('btn-net-zoomout').addEventListener('click', () => {
      if (this.svg && this.zoom) {
        this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.7);
      }
    });

    document.getElementById('btn-net-fit').addEventListener('click', () => {
      this.resetZoomFit();
    });

    document.getElementById('btn-net-reset').addEventListener('click', () => {
      if (this.simulation) {
        this.simulation.alpha(0.6).restart();
      }
    });

    document.getElementById('btn-net-clear').addEventListener('click', () => {
      this.clearFocus();
    });

    document.getElementById('hud-close-btn').addEventListener('click', () => {
      this.clearFocus();
    });

    this.isInitialized = true;
  }

  render(projects) {
    this.lastProjects = projects;
    this.init();
    const container = document.getElementById(this.containerId);
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 600;

    const svg = d3.select('#network-svg')
      .attr('viewBox', [0, 0, width, height]);

    svg.selectAll('*').remove();
    this.selectedNodeId = null;
    this.hideHud();

    if (!projects || projects.length === 0) return;

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
        nodeMap.set(id, { id, label, type, projects: [], val: 0, compBreakdown: {}, uniBreakdown: {}, topicBreakdown: {}, ...extra });
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
          linkType: linkType,
          projects: [project]
        });
      }
      addNeighbor(sourceId, targetId);
    };

    if (this.graphMode === 'topic') {
      // ===== Mode 1: Topic & Company Interest Network =====
      projects.forEach(p => {
        const cat = p.category || '기타';
        const catId = `cat_${cat}`;
        const catMeta = categoryInfo[cat] || { short: cat, color: '#f59e0b', icon: '🔬' };
        
        // 1. Topic Node (Focal Hub)
        const catNode = getNode(catId, catMeta.short, 'category', {
          fullLabel: cat,
          color: catMeta.color,
          icon: catMeta.icon
        });
        catNode.val += 1;
        catNode.projects.push(p);
        catNode.compBreakdown[p.company] = (catNode.compBreakdown[p.company] || 0) + 1;
        catNode.uniBreakdown[p.university] = (catNode.uniBreakdown[p.university] || 0) + 1;

        // 2. Company Node
        const compId = `comp_${p.company}`;
        const compNode = getNode(compId, p.company, 'company', { rawName: p.company });
        compNode.val += 1;
        compNode.projects.push(p);
        compNode.topicBreakdown[cat] = (compNode.topicBreakdown[cat] || 0) + 1;
        compNode.uniBreakdown[p.university] = (compNode.uniBreakdown[p.university] || 0) + 1;

        // 3. University Node
        const uniId = `uni_${p.university}`;
        const uniNode = getNode(uniId, p.university, 'university', {
          rawName: p.university,
          city: p.university_city,
          country: p.university_country
        });
        uniNode.val += 1;
        uniNode.projects.push(p);
        uniNode.topicBreakdown[cat] = (uniNode.topicBreakdown[cat] || 0) + 1;
        uniNode.compBreakdown[p.company] = (uniNode.compBreakdown[p.company] || 0) + 1;

        // Links: Company ➔ Topic (Primary Interest Link), University ➔ Topic (Research Focus Link)
        addLink(compId, catId, p, 'company-topic');
        addLink(uniId, catId, p, 'uni-topic');
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        // In core mode: keep all 7 topics, companies with >= 5 projects, and universities with >= 4 projects
        this.nodes = this.nodes.filter(n => n.type === 'category' || n.val >= 3);
      }

    } else {
      // ===== Mode 2: Classic Institution Collaboration Network =====
      projects.forEach(p => {
        const compId = `comp_${p.company}`;
        const compNode = getNode(compId, p.company, 'company', { rawName: p.company });
        compNode.val += 1;
        compNode.projects.push(p);

        const uniId = `uni_${p.university}`;
        const uniNode = getNode(uniId, p.university, 'university', { rawName: p.university, city: p.university_city, country: p.university_country });
        uniNode.val += 1;
        uniNode.projects.push(p);

        const catId = `cat_${p.category || '기타'}`;
        const catNode = getNode(catId, p.category || '기타', 'category', { rawName: p.category });
        catNode.val += 1;
        catNode.projects.push(p);

        let instId = null;
        if (p.institute_or_consortium && p.institute_or_consortium !== '-' && p.institute_or_consortium !== '해당 없음') {
          instId = `inst_${p.institute_or_consortium}`;
          const instNode = getNode(instId, p.institute_or_consortium, 'institute', { rawName: p.institute_or_consortium });
          instNode.val += 1;
          instNode.projects.push(p);
        }

        addLink(compId, uniId, p, 'industry-acad');
        addLink(uniId, catId, p, 'research-domain');
        if (instId) {
          addLink(compId, instId, p, 'consortium');
          addLink(instId, uniId, p, 'consortium');
        }
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        this.nodes = this.nodes.filter(n => n.val >= 2);
      }
    }

    const nodeIds = new Set(this.nodes.map(n => n.id));
    this.links = Array.from(linkMap.values()).filter(l => nodeIds.has(l.source) && nodeIds.has(l.target));

    // Color definitions
    const colorScale = {
      company: '#a78bfa',     // Purple
      university: '#38bdf8',  // Cyan/Blue
      institute: '#34d399',   // Emerald
      category: '#f59e0b'     // Amber/Gold for Topics
    };

    // Zoom container
    const g = svg.append('g').attr('class', 'network-main-group');
    this.g = g;
    this.svg = svg;

    this.zoom = d3.zoom()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        const z = event.transform.k;
        g.selectAll('.node-label')
          .style('display', d => (d.type === 'category' || d.val >= 8 || z > 1.6) ? 'block' : 'none');
      });

    svg.call(this.zoom);

    svg.on('click', (event) => {
      if (event.target.tagName === 'svg' || event.target.classList.contains('network-main-group')) {
        this.clearFocus();
      }
    });

    // Arrange Initial Positions in stable layout
    const centerRadius = Math.min(width, height) * 0.35;
    const catNodes = this.nodes.filter(n => n.type === 'category');
    catNodes.forEach((cn, i) => {
      const angle = (i / Math.max(1, catNodes.length)) * 2 * Math.PI - Math.PI / 2;
      cn.x = width / 2 + centerRadius * Math.cos(angle);
      cn.y = height / 2 + centerRadius * Math.sin(angle);
    });

    const nonCatNodes = this.nodes.filter(n => n.type !== 'category');
    nonCatNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, nonCatNodes.length)) * 2 * Math.PI;
      const r = centerRadius * (0.2 + 0.9 * Math.random());
      n.x = width / 2 + r * Math.cos(angle);
      n.y = height / 2 + r * Math.sin(angle);
    });

    // D3 Force Simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .alphaDecay(0.045)
      .velocityDecay(0.4)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(d => {
        if (this.graphMode === 'topic') {
          return d.linkType === 'company-topic' ? 65 : 80;
        }
        return 50 + Math.max(10, 80 - d.weight * 2);
      }))
      .force('charge', d3.forceManyBody().strength(d => d.type === 'category' ? -350 : -140))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => {
        if (d.type === 'category') return 34;
        return 10 + Math.min(d.val * 0.6, 20);
      }));

    // Pre-calculate simulation synchronously
    this.simulation.stop();
    for (let i = 0; i < 150; ++i) {
      this.simulation.tick();
    }

    // Render Links
    const link = g.append('g')
      .attr('class', 'links-group')
      .selectAll('line')
      .data(this.links)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke', d => {
        if (d.hasActive) return '#06b6d4';
        if (d.linkType === 'company-topic') return '#a78bfa';
        if (d.linkType === 'uni-topic') return '#38bdf8';
        return '#4b5563';
      })
      .attr('stroke-opacity', d => d.linkType === 'company-topic' ? 0.75 : 0.45)
      .attr('stroke-width', d => Math.min(6, Math.max(1.2, 1 + Math.sqrt(d.weight) * 0.9)))
      .attr('stroke-dasharray', d => d.hasActive ? '4,4' : null)
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    // Render Nodes Group
    const node = g.append('g')
      .attr('class', 'nodes-group')
      .selectAll('g')
      .data(this.nodes)
      .join('g')
      .attr('class', 'network-node')
      .attr('id', d => `node_${d.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) this.simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Node Circles
    node.append('circle')
      .attr('r', d => {
        if (d.type === 'category') return 24;
        return Math.min(22, 7 + Math.sqrt(d.val) * 1.8);
      })
      .attr('fill', d => d.color || colorScale[d.type] || '#9ca3af')
      .attr('stroke', d => d.type === 'category' ? '#fef08a' : '#0f172a')
      .attr('stroke-width', d => d.type === 'category' ? 3 : 2)
      .style('filter', d => d.type === 'category' ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.7))' : null);

    // Node Category Center Icons
    node.filter(d => d.type === 'category').append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '14px')
      .attr('pointer-events', 'none')
      .text(d => d.icon || '🔬');

    // Node Labels
    node.append('text')
      .attr('class', 'node-label')
      .text(d => d.label.length > 22 ? d.label.slice(0, 20) + '…' : d.label)
      .attr('x', d => (d.type === 'category' ? 28 : Math.min(22, 7 + Math.sqrt(d.val) * 1.8) + 4))
      .attr('y', 4)
      .attr('fill', d => d.type === 'category' ? '#fef08a' : '#f1f5f9')
      .attr('font-size', d => d.type === 'category' ? '12px' : '10px')
      .attr('font-weight', d => d.type === 'category' ? '800' : '600')
      .attr('font-family', 'sans-serif')
      .style('display', d => (d.type === 'category' || d.val >= 8) ? 'block' : 'none')
      .style('paint-order', 'stroke fill')
      .style('stroke', '#060910')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round')
      .attr('pointer-events', 'none');

    // Single Click
    node.on('click', (event, d) => {
      event.stopPropagation();
      this.handleNodeClick(d);
    });

    // Double Click
    node.on('dblclick', (event, d) => {
      event.stopPropagation();
      const filterType = d.type === 'university' ? 'university' : (d.type === 'company' ? 'company' : 'category');
      if (window.app && window.app.filterByAnalyticsItem) {
        window.app.filterByAnalyticsItem(filterType, d.fullLabel || d.rawName || d.label);
      }
    });

    // Tick Handler
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.simulation.alpha(0.05).restart();
  }

  handleNodeClick(d) {
    if (this.selectedNodeId === d.id) {
      this.clearFocus();
      return;
    }

    this.selectedNodeId = d.id;
    const neighbors = this.adjacency.get(d.id) || new Set();
    const connectedSet = new Set(neighbors);
    connectedSet.add(d.id);

    const clearBtn = document.getElementById('btn-net-clear');
    if (clearBtn) clearBtn.style.display = 'flex';

    d3.selectAll('.network-node')
      .classed('node-dimmed', n => !connectedSet.has(n.id))
      .classed('node-selected', n => n.id === d.id)
      .classed('node-neighbor', n => n.id !== d.id && connectedSet.has(n.id));

    d3.selectAll('.network-link')
      .classed('link-dimmed', l => !(l.source.id === d.id || l.target.id === d.id))
      .classed('link-highlighted', l => (l.source.id === d.id || l.target.id === d.id));

    this.showHud(d, neighbors);
  }

  clearFocus() {
    this.selectedNodeId = null;
    const clearBtn = document.getElementById('btn-net-clear');
    if (clearBtn) clearBtn.style.display = 'none';

    d3.selectAll('.network-node')
      .classed('node-dimmed', false)
      .classed('node-selected', false)
      .classed('node-neighbor', false);

    d3.selectAll('.network-link')
      .classed('link-dimmed', false)
      .classed('link-highlighted', false);

    this.hideHud();
  }

  showHud(node, neighbors) {
    const hud = document.getElementById('network-hud');
    if (!hud) return;

    const dynamicContent = document.getElementById('hud-dynamic-content');
    if (!dynamicContent) return;
    dynamicContent.innerHTML = '';

    const typeLabels = {
      category: '🔬 핵심 기술 도메인 / 연구 주제',
      company: '🏢 참여 / 투자 반도체 기업',
      university: '🏛️ 산학 연구 수주 대학교',
      institute: '🌐 연구소 및 컨소시엄'
    };

    document.getElementById('hud-name').textContent = node.fullLabel || node.label;
    document.getElementById('hud-type-desc').innerHTML = `
      <span style="color: #60a5fa; font-weight: 700;">${typeLabels[node.type] || '노드'}</span> | 총 <strong>${node.val || 1}건</strong> R&D 과제 연계
    `;

    // 1. Topic Node HUD: Company interest rankings + Top universities
    if (node.type === 'category') {
      const topComps = Object.entries(node.compBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const maxCompVal = Math.max(...topComps.map(c => c[1]), 1);

      let compHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #a78bfa; margin-top: 6px; margin-bottom: 4px;">🏢 최다 투자/관심 기업 TOP ${topComps.length}:</div>
      `;
      topComps.forEach(([comp, count]) => {
        const pct = ((count / node.val) * 100).toFixed(1);
        compHtml += `
          <div class="hud-interest-item" style="cursor: pointer;" title="클릭: '${comp}' 필터링" onclick="window.app.filterByAnalyticsItem('company', '${comp}')">
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
        uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" onclick="window.app.filterByAnalyticsItem('university', '${uni}')" title="${uni} (${count}건)">${uni} <strong>${count}</strong></span>`;
      });
      uniTagsHtml += `</div>`;

      dynamicContent.innerHTML = compHtml + uniTagsHtml;

    } else if (node.type === 'company') {
      // 2. Company Node HUD: Topic interest portfolio breakdown
      const topTopics = Object.entries(node.topicBreakdown || {}).sort((a, b) => b[1] - a[1]);
      const maxTopicVal = Math.max(...topTopics.map(t => t[1]), 1);

      let topicHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #f59e0b; margin-top: 6px; margin-bottom: 4px;">📊 연구 주제별 투자 포트폴리오:</div>
      `;
      topTopics.forEach(([topic, count]) => {
        const pct = ((count / node.val) * 100).toFixed(1);
        topicHtml += `
          <div class="hud-interest-item" style="cursor: pointer;" title="클릭: '${topic}' 필터링" onclick="window.app.filterByAnalyticsItem('category', '${topic}')">
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
        uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" onclick="window.app.filterByAnalyticsItem('university', '${uni}')">${uni} <strong>${count}</strong></span>`;
      });
      uniTagsHtml += `</div>`;

      dynamicContent.innerHTML = topicHtml + uniTagsHtml;

    } else {
      // 3. University Node HUD: Topics & Companies
      const topTopics = Object.entries(node.topicBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 4);
      let topicHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #f59e0b; margin-top: 6px; margin-bottom: 4px;">🔬 주요 연구 수주 분야:</div>
      `;
      topTopics.forEach(([topic, count]) => {
        topicHtml += `
          <div class="hud-interest-item">
            <span class="hud-interest-label" style="width: 130px;">${topic.split('(')[0].trim()}</span>
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
        compTagsHtml += `<span class="hud-tag" style="cursor: pointer;" onclick="window.app.filterByAnalyticsItem('company', '${comp}')">${comp} <strong>${count}</strong></span>`;
      });
      compTagsHtml += `</div>`;

      dynamicContent.innerHTML = topicHtml + compTagsHtml;
    }

    // Featured representative projects
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

    hud.classList.add('active');
  }

  hideHud() {
    const hud = document.getElementById('network-hud');
    if (hud) hud.classList.remove('active');
  }

  resetZoomFit() {
    if (this.svg && this.zoom) {
      this.svg.transition().duration(500).call(this.zoom.transform, d3.zoomIdentity);
    }
  }
}

window.NetworkView = NetworkView;
