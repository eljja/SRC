/**
 * NetworkView Module
 * Renders an interactive D3.js Force-Directed Graph connecting
 * Companies, Consortia/Institutes, Universities/Professors, and Research Topics.
 */
class NetworkView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.svg = null;
    this.simulation = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <svg id="network-svg"></svg>
      <div class="network-controls">
        <button class="header-action-btn" id="btn-network-reset">🔄 그래프 리셋</button>
      </div>
    `;

    document.getElementById('btn-network-reset').addEventListener('click', () => {
      if (this.simulation) {
        this.simulation.alpha(1).restart();
      }
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

    if (!projects || projects.length === 0) return;

    // Build Graph Nodes and Links from projects
    const nodeMap = new Map();
    const links = [];

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
      getNode(compId, p.company, 'company');

      // 2. University/Professor Node
      const uniId = `uni_${p.university}`;
      const uniLabel = p.professor ? `${p.university} (${p.professor})` : p.university;
      getNode(uniId, uniLabel, 'university', { professor: p.professor, university: p.university });

      // 3. Institute / Consortium Node (optional)
      let instId = null;
      if (p.institute_or_consortium) {
        instId = `inst_${p.institute_or_consortium}`;
        getNode(instId, p.institute_or_consortium, 'institute');
      }

      // 4. Topic Node
      const topicId = `topic_${p.topic}`;
      getNode(topicId, p.topic, 'topic', { projectId: p.id, category: p.category });

      // Links
      links.push({ source: compId, target: uniId, status: p.status, projectId: p.id });
      links.push({ source: uniId, target: topicId, status: p.status, projectId: p.id });
      if (instId) {
        links.push({ source: compId, target: instId, status: p.status });
        links.push({ source: instId, target: uniId, status: p.status });
      }
    });

    const nodes = Array.from(nodeMap.values());

    // Color definitions
    const colorScale = {
      company: '#a78bfa',     // Purple
      university: '#38bdf8',  // Cyan/Blue
      institute: '#34d399',   // Emerald
      topic: '#f59e0b'        // Amber
    };

    // Zoom container
    const g = svg.append('g');
    svg.call(d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      }));

    // D3 Force Simulation
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(75))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => 12 + Math.min(d.val * 3, 20)));

    // Render Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.status === 'active' ? '#06b6d4' : '#4b5563')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.status === 'active' ? 2 : 1)
      .attr('stroke-dasharray', d => d.status === 'active' ? '4,4' : null);

    // Render Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
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
      .attr('r', d => Math.min(22, 7 + d.val * 2.5))
      .attr('fill', d => colorScale[d.type] || '#9ca3af')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.projectId && this.onProjectSelect) {
          this.onProjectSelect(d.projectId);
        }
      });

    // Node Labels
    node.append('text')
      .text(d => d.label.length > 20 ? d.label.slice(0, 18) + '...' : d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#e5e7eb')
      .attr('font-size', '10px')
      .attr('font-family', 'sans-serif')
      .attr('pointer-events', 'none');

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
}

window.NetworkView = NetworkView;
