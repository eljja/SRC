/**
 * NetworkView Module (v3.0)
 * Renders an interactive D3.js Force-Directed Graph connecting
 * Companies, Consortia/Institutes, Universities/Professors, and Research Topics.
 * Supports:
 * - Canvas Drag & Multi-touch / Wheel Zooming
 * - Interactive Node Focus: Clicking a node highlights its direct neighbors/links and dims (tones down) other unrelated elements
 * - Canvas click to reset focus
 * - Zoom controls (+ / - / Reset / Focus Clear)
 * - Selected Node HUD Information Box
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
    this.linkIncidentMap = new Map(); // linkIndex -> [sourceId, targetId]
  }

  init() {
    if (this.isInitialized) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <svg id="network-svg"></svg>
      <div class="network-controls">
        <button class="network-btn" id="btn-net-zoomin" title="확대">➕ 확대</button>
        <button class="network-btn" id="btn-net-zoomout" title="축소">➖ 축소</button>
        <button class="network-btn" id="btn-net-fit" title="화면 맞춤">🎯 화면 맞춤</button>
        <button class="network-btn" id="btn-net-reset" title="시뮬레이션 재정렬">🔄 재정렬</button>
        <button class="network-btn" id="btn-net-clear" title="선택 해제" style="display: none;">✨ 강조 해제</button>
      </div>
      <div class="network-hud" id="network-hud">
        <div class="network-hud-title">
          <span id="hud-name">-</span>
          <button id="hud-close-btn" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 14px;">&times;</button>
        </div>
        <div class="network-hud-desc" id="hud-type-desc">-</div>
        <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-top: 4px;">🔗 연결된 산학 파트너 (<span id="hud-conn-count">0</span>):</div>
        <div class="network-hud-collaborators" id="hud-collaborators"></div>
      </div>
    `;

    // Bind Network Controls
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
        this.simulation.alpha(1).restart();
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

    // Build Graph Nodes and Links from projects
    const nodeMap = new Map();
    const linkMap = new Map(); // "source__target" -> link object
    this.adjacency = new Map();

    const addNeighbor = (id1, id2) => {
      if (!this.adjacency.has(id1)) this.adjacency.set(id1, new Set());
      if (!this.adjacency.has(id2)) this.adjacency.set(id2, new Set());
      this.adjacency.get(id1).add(id2);
      this.adjacency.get(id2).add(id1);
    };

    const getNode = (id, label, type, extra = {}) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, label, type, projects: [], professors: new Set(), ...extra, val: 0 });
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

    projects.forEach(p => {
      // 1. Company Node
      const compId = `comp_${p.company}`;
      const compNode = getNode(compId, p.company, 'company', { rawName: p.company });
      compNode.val += 1;
      compNode.projects.push(p);

      // 2. University Node
      const uniId = `uni_${p.university}`;
      const uniNode = getNode(uniId, p.university, 'university', { rawName: p.university, city: p.university_city, country: p.university_country });
      uniNode.val += 1;
      uniNode.projects.push(p);
      if (p.professor && p.professor !== '-' && p.professor !== '미지정') {
        uniNode.professors.add(p.professor);
      }

      // 3. Category / Domain Node
      const catId = `cat_${p.category || '기타'}`;
      const catNode = getNode(catId, p.category || '기타', 'category', { rawName: p.category });
      catNode.val += 1;
      catNode.projects.push(p);

      // 4. Institute / Consortium Node (optional)
      let instId = null;
      if (p.institute_or_consortium && p.institute_or_consortium !== '-' && p.institute_or_consortium !== '해당 없음') {
        instId = `inst_${p.institute_or_consortium}`;
        const instNode = getNode(instId, p.institute_or_consortium, 'institute', { rawName: p.institute_or_consortium });
        instNode.val += 1;
        instNode.projects.push(p);
      }

      // Add Links
      addLink(compId, uniId, p, 'industry-acad');
      addLink(uniId, catId, p, 'research-domain');

      if (instId) {
        addLink(compId, instId, p, 'consortium');
        addLink(instId, uniId, p, 'consortium');
      }
    });

    this.nodes = Array.from(nodeMap.values());
    this.links = Array.from(linkMap.values());

    // Color definitions
    const colorScale = {
      company: '#a78bfa',     // Purple
      university: '#38bdf8',  // Cyan/Blue
      institute: '#34d399',   // Emerald
      category: '#f59e0b'     // Amber
    };

    // Zoom container
    const g = svg.append('g').attr('class', 'network-main-group');
    this.g = g;
    this.svg = svg;

    this.zoom = d3.zoom()
      .scaleExtent([0.15, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(this.zoom);

    // Canvas click resets focus to normal
    svg.on('click', (event) => {
      if (event.target.tagName === 'svg' || event.target.classList.contains('network-main-group')) {
        this.clearFocus();
      }
    });

    // D3 Force Simulation (Smooth & performant for ~100 nodes)
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(d => 50 + Math.max(10, 80 - d.weight * 2)))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 12 + Math.min(d.val * 0.8, 22)));

    // Render Links
    const link = g.append('g')
      .attr('class', 'links-group')
      .selectAll('line')
      .data(this.links)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke', d => d.hasActive ? '#06b6d4' : '#4b5563')
      .attr('stroke-opacity', 0.65)
      .attr('stroke-width', d => Math.min(5, Math.max(1.2, 1 + Math.sqrt(d.weight) * 0.8)))
      .attr('stroke-dasharray', d => d.hasActive ? '4,4' : null);

    // Render Nodes Group
    const node = g.append('g')
      .attr('class', 'nodes-group')
      .selectAll('g')
      .data(this.nodes)
      .join('g')
      .attr('class', 'network-node')
      .attr('id', d => `node_${d.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`)
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
      .attr('r', d => Math.min(26, 8 + Math.sqrt(d.val) * 2.2))
      .attr('fill', d => colorScale[d.type] || '#9ca3af')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 2);

    // Node Labels
    node.append('text')
      .text(d => d.label.length > 20 ? d.label.slice(0, 18) + '...' : d.label)
      .attr('x', d => Math.min(26, 8 + Math.sqrt(d.val) * 2.2) + 4)
      .attr('y', 4)
      .attr('fill', '#f1f5f9')
      .attr('font-size', '10px')
      .attr('font-weight', '600')
      .attr('font-family', 'sans-serif')
      .style('paint-order', 'stroke fill')
      .style('stroke', '#060910')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round')
      .attr('pointer-events', 'none');

    // Single Click: Focus & Highlight Connected Nodes / Tone Down Others
    node.on('click', (event, d) => {
      event.stopPropagation();
      this.handleNodeClick(d);
    });

    // Double Click: Open Project Modal if available
    node.on('dblclick', (event, d) => {
      event.stopPropagation();
      if (d.projectId && this.onProjectSelect) {
        this.onProjectSelect(d.projectId);
      }
    });

    // Simulation Tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });
  }

  handleNodeClick(d) {
    if (this.selectedNodeId === d.id) {
      // Toggle off if clicking the already selected node
      this.clearFocus();
      return;
    }

    this.selectedNodeId = d.id;
    const neighbors = this.adjacency.get(d.id) || new Set();
    const connectedSet = new Set(neighbors);
    connectedSet.add(d.id);

    // Show highlight clear button
    const clearBtn = document.getElementById('btn-net-clear');
    if (clearBtn) clearBtn.style.display = 'flex';

    // 1. Update Nodes Style (Highlight selected & neighbors, dim others)
    d3.selectAll('.network-node')
      .classed('node-dimmed', n => !connectedSet.has(n.id))
      .classed('node-selected', n => n.id === d.id)
      .classed('node-neighbor', n => n.id !== d.id && connectedSet.has(n.id));

    // 2. Update Links Style (Highlight incident links, dim others)
    d3.selectAll('.network-link')
      .classed('link-dimmed', l => !(l.source.id === d.id || l.target.id === d.id))
      .classed('link-highlighted', l => (l.source.id === d.id || l.target.id === d.id));

    // 3. Show Floating HUD Information Box
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

    const typeIcons = {
      company: '🏢 기업',
      university: '🏛️ 대학교',
      institute: '🌐 연구소/컨소시엄',
      category: '🔬 핵심 연구분야'
    };

    document.getElementById('hud-name').textContent = node.label;
    
    let extraDesc = `${typeIcons[node.type] || '노드'} | 총 ${node.val || 1}건 연계 과제`;
    if (node.professors && node.professors.size > 0) {
      const profArr = Array.from(node.professors);
      extraDesc += `<br/><span style="color: #fbbf24; font-size: 11px;">👨‍🏫 참여 교수: ${profArr.slice(0, 3).join(', ')}${profArr.length > 3 ? ` 외 ${profArr.length - 3}명` : ''}</span>`;
    }
    document.getElementById('hud-type-desc').innerHTML = extraDesc;
    document.getElementById('hud-conn-count').textContent = neighbors.size;

    const colList = document.getElementById('hud-collaborators');
    colList.innerHTML = '';

    const neighborNodes = this.nodes.filter(n => neighbors.has(n.id));
    neighborNodes.slice(0, 12).forEach(n => {
      const tag = document.createElement('span');
      tag.className = 'hud-tag';
      tag.textContent = n.label;
      tag.style.cursor = 'pointer';
      tag.title = '클릭하여 해당 노드로 이동';
      tag.onclick = (e) => {
        e.stopPropagation();
        this.handleNodeClick(n);
      };
      colList.appendChild(tag);
    });

    if (neighborNodes.length > 12) {
      const moreTag = document.createElement('span');
      moreTag.className = 'hud-tag';
      moreTag.style.opacity = '0.6';
      moreTag.textContent = `+ 외 ${neighborNodes.length - 12}개 파트너`;
      colList.appendChild(moreTag);
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
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 210px;" title="${p.topic}">• ${p.topic}</span>
          <button style="background: #3b82f6; border: none; color: #fff; padding: 1px 5px; border-radius: 3px; font-size: 9px; cursor: pointer; flex-shrink: 0;">보기</button>
        `;
        item.querySelector('button').onclick = (e) => {
          e.stopPropagation();
          if (this.onProjectSelect) this.onProjectSelect(p.id);
        };
        projContainer.appendChild(item);
      });

      colList.appendChild(projContainer);
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
