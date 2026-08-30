/**
 * NetworkView Module (v7.4.0)
 * Renders an interactive D3.js Force-Directed Graph connecting
 * Technology Domains, Granular Sub-topics, Companies, and Universities.
 * Supports:
 * - 🌐 1차: 7대 기술 도메인 총괄망 (Global 7-Domain Overview Mode)
 * - 🔬 2차: 세부 주제별 심층망 (Deep-Dive Sub-Topic & Gap Analysis Mode)
 * - 🏛️ 산학 기관 협력망 (Institution Collaboration Mode)
 * - Interactive Focus with Focus vs Gap Analysis HUD
 * - Core Hub LOD Filtering and Pre-warmed Instant Layout
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
    this.adjacency = new Map();
    this.lodMode = 'core'; // 'core' or 'all'
    this.graphMode = 'subtopic'; // 'topic' (1차 총괄망), 'subtopic' (2차 세부 심층망), 'institution' (기관망)
    this.selectedSubtopicCategory = 'Advanced Logic & Transistors (GAA/CFET/2D)';
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
          <button class="network-btn ${this.graphMode === 'subtopic' ? 'active' : ''}" id="btn-net-mode-subtopic" title="1개 기술 분야 선택 시 세부 기술 주제별 집중도 및 공백(Gap) 심층 분석">🔬 2차: 세부 주제별 심층망</button>
          <button class="network-btn ${this.graphMode === 'topic' ? 'active' : ''}" id="btn-net-mode-topic" title="7대 기술 도메인 중심 글로벌 기업 관심도 및 대학 연구 집중도 총괄망">🌐 1차: 7대 도메인 총괄망</button>
          <button class="network-btn ${this.graphMode === 'institution' ? 'active' : ''}" id="btn-net-mode-inst" title="기업-대학-연구소 간의 직접 산학 협력망">🏛️ 산학 기관망</button>
        </div>
        
        <!-- Domain selector for Sub-topic deep-dive mode -->
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

  render(projects) {
    this.lastProjects = projects;
    this.init();
    this.updateModeButtons();

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
          linkType: linkType,
          projects: [project]
        });
      }
      addNeighbor(sourceId, targetId);
    };

    if (this.graphMode === 'subtopic') {
      // ===== Mode 2: 2차 세부 주제별 심층망 (Deep-Dive Sub-Topic Mode) =====
      const targetCat = this.selectedSubtopicCategory || 'Advanced Logic & Transistors (GAA/CFET/2D)';
      const catMeta = categoryInfo[targetCat] || { short: targetCat, color: '#10b981', icon: '⚡' };
      
      const catProjects = projects.filter(p => p.category === targetCat);
      const activeProjects = catProjects.length > 0 ? catProjects : (window.app && window.app.dataManager ? window.app.dataManager.rawProjects.filter(p => p.category === targetCat) : []);

      const subrules = (window.app && window.app.dataManager ? window.app.dataManager.getSubtopicRules()[targetCat] : []) || [];
      
      // 1. Initialize Sub-topic Hub Nodes
      subrules.forEach(rule => {
        const subId = `sub_${rule.name}`;
        getNode(subId, rule.name, 'subtopic', {
          fullLabel: rule.name,
          category: targetCat,
          color: catMeta.color,
          icon: rule.icon || '🔬'
        });
      });

      // 2. Map Projects to Subtopics, Companies, and Universities
      const allCompaniesInCat = new Set();
      activeProjects.forEach(p => {
        const subName = window.app && window.app.dataManager ? window.app.dataManager.getSubtopic(p) : (p.topic || '기타 세부 연구');
        const subId = `sub_${subName}`;
        allCompaniesInCat.add(p.company);

        // Subtopic node update
        const subNode = getNode(subId, subName, 'subtopic', {
          fullLabel: subName,
          category: targetCat,
          color: catMeta.color,
          icon: catMeta.icon
        });
        subNode.val += 1;
        subNode.projects.push(p);
        subNode.compBreakdown[p.company] = (subNode.compBreakdown[p.company] || 0) + 1;
        subNode.uniBreakdown[p.university] = (subNode.uniBreakdown[p.university] || 0) + 1;

        // Company node
        const compId = `comp_${p.company}`;
        const compNode = getNode(compId, p.company, 'company', { rawName: p.company, targetCategory: targetCat });
        compNode.val += 1;
        compNode.projects.push(p);
        compNode.subtopicBreakdown[subName] = (compNode.subtopicBreakdown[subName] || 0) + 1;
        compNode.uniBreakdown[p.university] = (compNode.uniBreakdown[p.university] || 0) + 1;

        // University node
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
        uniNode.compBreakdown[p.company] = (uniNode.compBreakdown[p.company] || 0) + 1;

        // Links
        addLink(compId, subId, p, 'company-subtopic');
        addLink(uniId, subId, p, 'uni-subtopic');
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        this.nodes = this.nodes.filter(n => n.type === 'subtopic' || n.val >= 2);
      }

    } else if (this.graphMode === 'topic') {
      // ===== Mode 1: 1차 7대 기술 도메인 총괄망 =====
      projects.forEach(p => {
        const cat = p.category || '기타';
        const catId = `cat_${cat}`;
        const catMeta = categoryInfo[cat] || { short: cat, color: '#f59e0b', icon: '🔬' };
        
        const catNode = getNode(catId, catMeta.short, 'category', {
          fullLabel: cat,
          color: catMeta.color,
          icon: catMeta.icon
        });
        catNode.val += 1;
        catNode.projects.push(p);
        catNode.compBreakdown[p.company] = (catNode.compBreakdown[p.company] || 0) + 1;
        catNode.uniBreakdown[p.university] = (catNode.uniBreakdown[p.university] || 0) + 1;

        const compId = `comp_${p.company}`;
        const compNode = getNode(compId, p.company, 'company', { rawName: p.company });
        compNode.val += 1;
        compNode.projects.push(p);
        compNode.topicBreakdown[cat] = (compNode.topicBreakdown[cat] || 0) + 1;
        compNode.uniBreakdown[p.university] = (compNode.uniBreakdown[p.university] || 0) + 1;

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

        addLink(compId, catId, p, 'company-topic');
        addLink(uniId, catId, p, 'uni-topic');
      });

      this.nodes = Array.from(nodeMap.values());
      if (this.lodMode === 'core') {
        this.nodes = this.nodes.filter(n => n.type === 'category' || n.val >= 3);
      }

    } else {
      // ===== Mode 3: 산학 기관망 =====
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
      category: '#f59e0b',    // Amber for Category
      subtopic: '#10b981'     // Emerald/Green for Subtopic
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
          .style('display', d => (d.type === 'category' || d.type === 'subtopic' || d.val >= 8 || z > 1.6) ? 'block' : 'none');
      });

    svg.call(this.zoom);

    svg.on('click', (event) => {
      if (event.target.tagName === 'svg' || event.target.classList.contains('network-main-group')) {
        this.clearFocus();
      }
    });

    // Arrange Initial Positions
    const centerRadius = Math.min(width, height) * 0.35;
    const hubNodes = this.nodes.filter(n => n.type === 'category' || n.type === 'subtopic');
    hubNodes.forEach((cn, i) => {
      const angle = (i / Math.max(1, hubNodes.length)) * 2 * Math.PI - Math.PI / 2;
      cn.x = width / 2 + centerRadius * Math.cos(angle);
      cn.y = height / 2 + centerRadius * Math.sin(angle);
    });

    const nonHubNodes = this.nodes.filter(n => n.type !== 'category' && n.type !== 'subtopic');
    nonHubNodes.forEach((n, i) => {
      const angle = (i / Math.max(1, nonHubNodes.length)) * 2 * Math.PI;
      const r = centerRadius * (0.25 + 0.85 * Math.random());
      n.x = width / 2 + r * Math.cos(angle);
      n.y = height / 2 + r * Math.sin(angle);
    });

    // D3 Force Simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .alphaDecay(0.045)
      .velocityDecay(0.4)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(d => {
        if (this.graphMode === 'subtopic') {
          return d.linkType === 'company-subtopic' ? 60 : 75;
        }
        if (this.graphMode === 'topic') {
          return d.linkType === 'company-topic' ? 65 : 80;
        }
        return 50 + Math.max(10, 80 - d.weight * 2);
      }))
      .force('charge', d3.forceManyBody().strength(d => (d.type === 'category' || d.type === 'subtopic') ? -320 : -140))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => {
        if (d.type === 'category' || d.type === 'subtopic') return 30;
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
        if (d.linkType === 'company-topic' || d.linkType === 'company-subtopic') return '#a78bfa';
        if (d.linkType === 'uni-topic' || d.linkType === 'uni-subtopic') return '#38bdf8';
        return '#4b5563';
      })
      .attr('stroke-opacity', d => (d.linkType === 'company-topic' || d.linkType === 'company-subtopic') ? 0.75 : 0.45)
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
        if (d.type === 'category' || d.type === 'subtopic') return 22;
        return Math.min(20, 7 + Math.sqrt(d.val) * 1.8);
      })
      .attr('fill', d => d.color || colorScale[d.type] || '#9ca3af')
      .attr('stroke', d => (d.type === 'category' || d.type === 'subtopic') ? '#fef08a' : '#0f172a')
      .attr('stroke-width', d => (d.type === 'category' || d.type === 'subtopic') ? 3 : 2)
      .style('filter', d => (d.type === 'category' || d.type === 'subtopic') ? 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.7))' : null);

    // Node Category/Subtopic Center Icons
    node.filter(d => d.type === 'category' || d.type === 'subtopic').append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '13px')
      .attr('pointer-events', 'none')
      .text(d => d.icon || '🔬');

    // Node Labels
    node.append('text')
      .attr('class', 'node-label')
      .text(d => d.label.length > 24 ? d.label.slice(0, 22) + '…' : d.label)
      .attr('x', d => ((d.type === 'category' || d.type === 'subtopic') ? 26 : Math.min(20, 7 + Math.sqrt(d.val) * 1.8) + 4))
      .attr('y', 4)
      .attr('fill', d => (d.type === 'category' || d.type === 'subtopic') ? '#fef08a' : '#f1f5f9')
      .attr('font-size', d => (d.type === 'category' || d.type === 'subtopic') ? '11.5px' : '10px')
      .attr('font-weight', d => (d.type === 'category' || d.type === 'subtopic') ? '800' : '600')
      .attr('font-family', 'sans-serif')
      .style('display', d => (d.type === 'category' || d.type === 'subtopic' || d.val >= 8) ? 'block' : 'none')
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
        window.app.filterByAnalyticsItem(filterType, d.category || d.fullLabel || d.rawName || d.label);
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

    // 1. Sub-topic Node HUD (세부 기술 분야 클릭 시: 집중 기업 TOP + Gap 공백 기업 분석)
    if (node.type === 'subtopic') {
      const topComps = Object.entries(node.compBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const maxCompVal = Math.max(...topComps.map(c => c[1]), 1);

      let compHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #a78bfa; margin-top: 6px; margin-bottom: 4px;">🏆 세부 기술 집중 기업 TOP ${topComps.length}:</div>
      `;
      topComps.forEach(([comp, count]) => {
        const pct = node.val > 0 ? ((count / node.val) * 100).toFixed(1) : 0;
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

      // Gap Analysis: Companies in this domain with 0 projects in this subtopic
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
        uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" onclick="window.app.filterByAnalyticsItem('university', '${uni}')" title="${uni} (${count}건)">${uni} <strong>${count}</strong></span>`;
      });
      uniTagsHtml += `</div>`;

      dynamicContent.innerHTML = compHtml + gapHtml + uniTagsHtml;

    } else if (node.type === 'company') {
      // 2. Company Node HUD in Subtopic or Topic Mode
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
          uniTagsHtml += `<span class="hud-tag" style="cursor: pointer;" onclick="window.app.filterByAnalyticsItem('university', '${uni}')">${uni} <strong>${count}</strong></span>`;
        });
        uniTagsHtml += `</div>`;

        dynamicContent.innerHTML = subHtml + uniTagsHtml;

      } else {
        // Topic Mode Company HUD
        const topTopics = Object.entries(node.topicBreakdown || {}).sort((a, b) => b[1] - a[1]);
        const maxTopicVal = Math.max(...topTopics.map(t => t[1]), 1);

        let topicHtml = `
          <div style="font-size: 11px; font-weight: 700; color: #f59e0b; margin-top: 6px; margin-bottom: 4px;">📊 7대 기술 도메인별 투자 포트폴리오:</div>
        `;
        topTopics.forEach(([topic, count]) => {
          const pct = node.val > 0 ? ((count / node.val) * 100).toFixed(1) : 0;
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
      }

    } else if (node.type === 'category') {
      // 3. Category Mode Node HUD
      const topComps = Object.entries(node.compBreakdown || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const maxCompVal = Math.max(...topComps.map(c => c[1]), 1);

      let compHtml = `
        <div style="font-size: 11px; font-weight: 700; color: #a78bfa; margin-top: 6px; margin-bottom: 4px;">🏢 최다 투자/관심 기업 TOP ${topComps.length}:</div>
      `;
      topComps.forEach(([comp, count]) => {
        const pct = node.val > 0 ? ((count / node.val) * 100).toFixed(1) : 0;
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

    } else {
      // 4. University Node HUD
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
        compTagsHtml += `<span class="hud-tag" style="cursor: pointer;" onclick="window.app.filterByAnalyticsItem('company', '${comp}')">${comp} <strong>${count}</strong></span>`;
      });
      compTagsHtml += `</div>`;

      dynamicContent.innerHTML = subHtml + compTagsHtml;
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
