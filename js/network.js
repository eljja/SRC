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
    const rawLinks = [];
    this.adjacency = new Map();

    const addNeighbor = (id1, id2) => {
      if (!this.adjacency.has(id1)) this.adjacency.set(id1, new Set());
      if (!this.adjacency.has(id2)) this.adjacency.set(id2, new Set());
      this.adjacency.get(id1).add(id2);
      this.adjacency.get(id2).add(id1);
    };

    const getNode = (id, label, type, extra = {}) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, label, type, ...extra, val: 1 });
      } else {
        nodeMap.get(id).val += 1;
      }
      return nodeMap.get(id);
    };

    projects.forEach(p => {
      // 1. Company Node
      const compId = `comp_${p.company}`;
      getNode(compId, p.company, 'company', { rawName: p.company });

      // 2. University/Professor Node
      const uniId = `uni_${p.university}`;
      const uniLabel = p.professor ? `${p.university} (${p.professor})` : p.university;
      getNode(uniId, uniLabel, 'university', { professor: p.professor, university: p.university, rawName: p.university });

      // 3. Institute / Consortium Node (optional)
      let instId = null;
      if (p.institute_or_consortium) {
        instId = `inst_${p.institute_or_consortium}`;
        getNode(instId, p.institute_or_consortium, 'institute', { rawName: p.institute_or_consortium });
      }

      // 4. Topic Node
      const topicId = `topic_${p.id}`;
      getNode(topicId, p.topic, 'topic', { projectId: p.id, category: p.category, projectObj: p, rawName: p.topic });

      // Links
      rawLinks.push({ source: compId, target: uniId, status: p.status, projectId: p.id });
      addNeighbor(compId, uniId);

      rawLinks.push({ source: uniId, target: topicId, status: p.status, projectId: p.id });
      addNeighbor(uniId, topicId);

      if (instId) {
        rawLinks.push({ source: compId, target: instId, status: p.status });
        rawLinks.push({ source: instId, target: uniId, status: p.status });
        addNeighbor(compId, instId);
        addNeighbor(instId, uniId);
      }
    });

    this.nodes = Array.from(nodeMap.values());
    this.links = rawLinks;

    // Color definitions
    const colorScale = {
      company: '#a78bfa',     // Purple
      university: '#38bdf8',  // Cyan/Blue
      institute: '#34d399',   // Emerald
      topic: '#f59e0b'        // Amber
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

    // D3 Force Simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(65))
      .force('charge', d3.forceManyBody().strength(-140))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 10 + Math.min(d.val * 2, 16)));

    // Render Links
    const link = g.append('g')
      .attr('class', 'links-group')
      .selectAll('line')
      .data(this.links)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke', d => d.status === 'active' ? '#06b6d4' : '#4b5563')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.status === 'active' ? 2 : 1)
      .attr('stroke-dasharray', d => d.status === 'active' ? '4,4' : null);

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
      .attr('r', d => Math.min(22, 7 + d.val * 1.8))
      .attr('fill', d => colorScale[d.type] || '#9ca3af')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1.8);

    // Node Labels
    node.append('text')
      .text(d => d.label.length > 22 ? d.label.slice(0, 20) + '...' : d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#f1f5f9')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
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
      topic: '🔬 연구주제'
    };

    document.getElementById('hud-name').textContent = node.label;
    document.getElementById('hud-type-desc').textContent = `${typeIcons[node.type] || '노드'} | 총 ${node.val || 1}건 연계 과제`;
    document.getElementById('hud-conn-count').textContent = neighbors.size;

    const colList = document.getElementById('hud-collaborators');
    colList.innerHTML = '';

    const neighborNodes = this.nodes.filter(n => neighbors.has(n.id));
    neighborNodes.slice(0, 15).forEach(n => {
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

    if (node.projectId) {
      const modalBtn = document.createElement('button');
      modalBtn.className = 'network-btn';
      modalBtn.style.marginTop = '6px';
      modalBtn.style.background = '#3b82f6';
      modalBtn.style.color = '#fff';
      modalBtn.textContent = '📄 과제 상세정보 보기';
      modalBtn.onclick = () => {
        if (this.onProjectSelect) this.onProjectSelect(node.projectId);
      };
      colList.appendChild(modalBtn);
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
