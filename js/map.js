/**
 * MapView Module (v7.2.0)
 * Renders the global semiconductor research network on an interactive Leaflet map
 * with 2-color SVG gradient arcs, zoom-adaptive Level-of-Detail (LOD),
 * interactive laser focus highlighting, and a floating visual control toolbar.
 */

// Global Brand and Regional Color Palettes
const COMPANY_COLORS = {
  "Samsung Electronics": "#3b82f6",     // Electric Blue
  "TSMC": "#ef4444",                    // Vibrant Coral Red
  "Intel": "#06b6d4",                   // Cyan Blue
  "SK Hynix": "#f43f5e",                // Rose Crimson
  "ASML": "#38bdf8",                    // Bright Sky Cyan
  "Applied Materials (AMAT)": "#14b8a6",// Teal
  "Applied Materials": "#14b8a6",
  "Lam Research": "#0ea5e9",            // Deep Cyan
  "KLA Corporation": "#f97316",         // Vivid Orange
  "KLA": "#f97316",
  "NVIDIA": "#84cc16",                  // Neon Lime Green
  "Qualcomm": "#6366f1",                // Sapphire Indigo
  "MediaTek": "#ec4899",                // Hot Pink
  "Broadcom": "#e11d48",                // Rose Red
  "Texas Instruments": "#f59e0b",       // Amber
  "STMicroelectronics": "#8b5cf6",      // Violet
  "Infineon Technologies": "#10b981",   // Emerald Green
  "Infineon": "#10b981",
  "NXP Semiconductors": "#6366f1",      // Indigo
  "NXP": "#6366f1",
  "Sony Semiconductor": "#a855f7",      // Purple
  "Sony": "#a855f7",
  "Tokyo Electron (TEL)": "#4f46e5",    // Deep Indigo
  "Tokyo Electron": "#4f46e5",
  "GlobalFoundries": "#d946ef",         // Fuchsia
  "Micron Technology": "#eab308",       // Yellow Gold
  "Micron": "#eab308",
  "Synopsys": "#8b5cf6",                // Purple
  "Cadence": "#3b82f6",                 // Blue
  "Wolfspeed": "#f97316",               // Orange
  "Onsemi": "#10b981",                  // Green
  "Arm": "#0284c7",                     // Sky Blue
  "Renesas": "#e11d48",                 // Rose
  "Kioxia": "#d97706",                  // Amber
  "DB HiTek": "#10b981",                // Emerald
  "Rapidus": "#06b6d4"                  // Cyan
};

const REGION_COLORS = {
  "South Korea": "#10b981", // Emerald Jade
  "USA": "#f59e0b",         // Golden Amber
  "Taiwan": "#fb7185",      // Coral Pink
  "Belgium": "#818cf8",     // Indigo
  "Netherlands": "#38bdf8", // Sky Cyan
  "Germany": "#a78bfa",     // Lavender
  "France": "#60a5fa",      // Light Blue
  "UK": "#c084fc",          // Orchid
  "Switzerland": "#34d399", // Mint
  "Japan": "#c084fc",       // Purple Orchid
  "China": "#f87171",       // Red Coral
  "Singapore": "#2dd4bf",   // Mint Teal
  "Global": "#38bdf8"       // Default Cyan
};

const CATEGORY_COLORS = {
  "Advanced Logic & Transistors (GAA/CFET/2D)": "#3b82f6",
  "Memory & Storage (HBM/PIM/3D NAND)": "#8b5cf6",
  "Advanced Packaging & Chiplets (3D/Hybrid Bonding)": "#ec4899",
  "Lithography & Metrology (EUV/High-NA)": "#06b6d4",
  "AI & Neuromorphic Computing": "#10b981",
  "Power & Compound Semiconductors (GaN/SiC)": "#f59e0b",
  "Silicon Photonics & Optical I/O": "#f43f5e"
};

class MapView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.map = null;
    this.markersLayer = null;
    this.linesLayer = null;
    this.svgDefs = null;
    this.isInitialized = false;
    this.defaultCenter = [28, 20];
    this.defaultZoom = 2.4;

    // View States
    this.filterMode = 'smart';      // 'smart' | 'focused' | 'major' | 'nodes_only'
    this.colorMode = 'gradient';    // 'gradient' | 'category'
    this.focusedNodeKey = null;
    this.hoveredNodeKey = null;
    
    // Cached Data
    this.currentProjects = [];
    this.uniqueNodes = new Map();
    this.connectionPairs = new Map();
    this.nodeMarkerMap = new Map();
    this.pairPolylineMap = new Map();
  }

  init() {
    if (this.isInitialized) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Initialize Leaflet map with full gesture and drag support
    this.map = L.map(this.containerId, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      minZoom: 1.5,
      maxZoom: 16,
      worldCopyJump: true,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true
    });

    // Add Zoom Control to top right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Add Custom Reset View Control
    const ResetControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: (map) => {
        const btn = L.DomUtil.create('button', 'leaflet-control-custom-btn');
        btn.innerHTML = '🗺️ 전체 뷰 리셋';
        btn.title = '전체 지도 화면 및 하이라이트 초기화';
        btn.onclick = (e) => {
          e.stopPropagation();
          this.clearFocus();
          map.setView(this.defaultCenter, this.defaultZoom);
        };
        return btn;
      }
    });
    this.map.addControl(new ResetControl());

    // Dark Matter CartoDB Basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | SRC Observatory',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.linesLayer = L.layerGroup().addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);

    // Bind Zoom Event for Zoom-Adaptive LOD
    this.map.on('zoomend', () => {
      this.updateLOD();
    });

    // Click on empty map area resets highlight focus
    this.map.on('click', (e) => {
      if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.classList.contains('leaflet-container')) {
        this.clearFocus();
      }
    });

    this.setupToolbarEvents();
    this.isInitialized = true;
  }

  setupToolbarEvents() {
    const toolbar = document.querySelector('.map-floating-toolbar');
    if (!toolbar) return;

    // Mode Buttons
    const modeBtns = toolbar.querySelectorAll('.map-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterMode = btn.getAttribute('data-mode') || 'smart';
        this.updateLOD();
      });
    });

    // Color Mode Buttons
    const colorBtns = toolbar.querySelectorAll('.map-color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.colorMode = btn.getAttribute('data-color') || 'gradient';
        this.updateArcColors();
      });
    });
  }

  ensureSvgDefs() {
    const overlayPane = this.map.getPanes().overlayPane;
    let svg = overlayPane.querySelector('svg');
    if (!svg) return null;
    
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    this.svgDefs = defs;
    return defs;
  }

  getGradientId(company, university, country) {
    const cleanComp = (company || 'comp').replace(/[^a-zA-Z0-9]/g, '_');
    const cleanUni = (university || 'uni').replace(/[^a-zA-Z0-9]/g, '_');
    const gradId = `grad_${cleanComp}__${cleanUni}`;

    const defs = this.ensureSvgDefs();
    if (!defs) return null;

    if (!defs.querySelector(`#${gradId}`)) {
      const compColor = COMPANY_COLORS[company] || '#3b82f6';
      const uniColor = REGION_COLORS[country] || '#10b981';

      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', gradId);
      gradient.setAttribute('gradientUnits', 'userSpaceOnUse');

      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', compColor);
      stop1.setAttribute('stop-opacity', '0.88');

      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', uniColor);
      stop2.setAttribute('stop-opacity', '0.88');

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
    }

    return gradId;
  }

  render(projects) {
    if (!this.isInitialized) {
      this.init();
    }

    this.currentProjects = projects || [];
    this.markersLayer.clearLayers();
    this.linesLayer.clearLayers();
    this.nodeMarkerMap.clear();
    this.pairPolylineMap.clear();
    this.uniqueNodes.clear();
    this.connectionPairs.clear();

    if (!projects || projects.length === 0) return;

    // 1. Aggregate unique nodes & connection pairs
    projects.forEach(p => {
      // University Node
      if (p.university_lat && p.university_lng) {
        const uniKey = `uni_${p.university}`;
        if (!this.uniqueNodes.has(uniKey)) {
          this.uniqueNodes.set(uniKey, {
            key: uniKey,
            type: 'university',
            name: p.university,
            city: p.university_city,
            country: p.university_country,
            lat: p.university_lat,
            lng: p.university_lng,
            projects: [],
            connectedKeys: new Set()
          });
        }
        this.uniqueNodes.get(uniKey).projects.push(p);
        if (p.company) this.uniqueNodes.get(uniKey).connectedKeys.add(`comp_${p.company}`);
      }

      // Company Node
      if (p.company_lat && p.company_lng) {
        const compKey = `comp_${p.company}`;
        if (!this.uniqueNodes.has(compKey)) {
          this.uniqueNodes.set(compKey, {
            key: compKey,
            type: 'company',
            name: p.company,
            city: p.company_city,
            country: p.company_country,
            lat: p.company_lat,
            lng: p.company_lng,
            projects: [],
            connectedKeys: new Set()
          });
        }
        this.uniqueNodes.get(compKey).projects.push(p);
        if (p.university) this.uniqueNodes.get(compKey).connectedKeys.add(`uni_${p.university}`);
      }

      // Aggregate Connection Pair
      if (p.university_lat && p.university_lng && p.company_lat && p.company_lng) {
        const pairKey = `pair_${p.company}__${p.university}`;
        if (!this.connectionPairs.has(pairKey)) {
          this.connectionPairs.set(pairKey, {
            key: pairKey,
            company: p.company,
            university: p.university,
            country: p.university_country,
            companyKey: `comp_${p.company}`,
            uniKey: `uni_${p.university}`,
            companyCoord: [p.company_lat, p.company_lng],
            universityCoord: [p.university_lat, p.university_lng],
            projects: []
          });
        }
        this.connectionPairs.get(pairKey).projects.push(p);
      }
    });

    // 2. Draw Nodes & Lines
    this.connectionPairs.forEach(pair => {
      this.drawBundledConnection(pair);
    });

    this.uniqueNodes.forEach(node => {
      this.drawNodeMarker(node);
    });

    // 3. Apply Initial LOD filtering
    this.updateLOD();
  }

  drawNodeMarker(node) {
    const isUni = node.type === 'university';
    const count = node.projects.length;
    
    // Dynamic node size scaled logarithmically for ~8,000 items
    const size = Math.min(38, Math.max(18, 16 + Math.log2(count + 1) * 3.5));
    
    const className = isUni ? 'custom-map-node node-university' : 'custom-map-node node-company';

    const customIcon = L.divIcon({
      className: className,
      iconSize: [size, size],
      html: `<span style="font-size: ${size > 26 ? '11px' : '9.5px'}; font-weight: 700;">${count > 999 ? Math.round(count/1000)+'k' : count}</span>`
    });

    const marker = L.marker([node.lat, node.lng], { icon: customIcon });

    // Node interactions
    marker.on('mouseover', () => {
      this.hoveredNodeKey = node.key;
      this.highlightNodeNetwork(node.key);
    });

    marker.on('mouseout', () => {
      this.hoveredNodeKey = null;
      if (!this.focusedNodeKey) {
        this.clearFocus();
      } else {
        this.highlightNodeNetwork(this.focusedNodeKey);
      }
    });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (this.focusedNodeKey === node.key) {
        this.clearFocus();
      } else {
        this.focusedNodeKey = node.key;
        this.highlightNodeNetwork(node.key);
      }
    });

    // Build Node Popup
    const safeNodeName = node.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const filterType = isUni ? 'university' : 'company';

    const projectListHtml = node.projects.map((p, idx) => `
      <div class="map-popup-project-item" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; ${idx >= 4 ? 'display: none;' : ''}">
        <strong style="color: #60a5fa;">${p.topic}</strong><br/>
        <span style="color: #9ca3af;">${p.professor ? '👨‍🏫 ' + p.professor : ''} (${p.start_year}~${p.end_year})</span><br/>
        <span class="badge-status ${p.status === 'active' ? 'badge-active' : (p.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">${p.status === 'active' ? '진행중' : (p.status === 'completed' ? '완료' : '추정')}</span>
        <button onclick="window.app.showProjectModal('${p.id}')" style="background: #3b82f6; border: none; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; float: right; margin-top: 2px;">상세보기</button>
      </div>
    `).join('');

    const toggleMoreBtn = node.projects.length > 4 ? `
      <div style="margin-top: 8px; text-align: center;">
        <button onclick="window.app.toggleMapPopupMore(this)" 
                style="background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.25); color: #93c5fd; padding: 4px 8px; border-radius: 4px; font-size: 10.5px; cursor: pointer; width: 100%; font-weight: 500;">
          🔽 + 외 ${node.projects.length - 4}개 산학 과제 펼치기
        </button>
      </div>
    ` : '';

    const filterButtonHtml = `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.15); text-align: center;">
        <button onclick="window.app.filterByAnalyticsItem('${filterType}', '${safeNodeName}')" 
                style="background: rgba(59, 130, 246, 0.25); border: 1px solid #3b82f6; color: #60a5fa; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; width: 100%; transition: all 0.2s;"
                onmouseover="this.style.background='rgba(59, 130, 246, 0.45)'"
                onmouseout="this.style.background='rgba(59, 130, 246, 0.25)'">
          📋 '${node.name}' 전체 과제 (${node.projects.length}건) 목록 필터링 ➔
        </button>
      </div>
    `;

    const popupHtml = `
      <div class="map-node-popup-content" style="min-width: 260px; max-width: 320px; max-height: 380px; overflow-y: auto; font-family: inherit; padding-right: 2px;">
        <div style="font-size: 13px; font-weight: 700; color: ${isUni ? '#38bdf8' : '#a78bfa'};">
          ${isUni ? '🏛️ ' : '🏢 '} ${node.name}
        </div>
        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
          📍 ${node.city || ''}, ${node.country || ''} (총 ${node.projects.length}건 최근 산학 R&D 과제)
        </div>
        <div class="map-popup-projects-list">
          ${projectListHtml}
        </div>
        ${toggleMoreBtn}
        ${filterButtonHtml}
      </div>
    `;

    marker.bindPopup(popupHtml);
    this.markersLayer.addLayer(marker);
    this.nodeMarkerMap.set(node.key, marker);
  }

  drawBundledConnection(pair) {
    const lat1 = pair.companyCoord[0];
    const lng1 = pair.companyCoord[1];
    const lat2 = pair.universityCoord[0];
    const lng2 = pair.universityCoord[1];

    // Compute midpoint and arc curvature offset
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const dx = lng2 - lng1;
    const dy = lat2 - lat1;

    const curveFactor = 0.18;
    const offsetLat = midLat + (dx * curveFactor);
    const offsetLng = midLng - (dy * curveFactor);

    // Generate quadratic bezier points
    const curvePoints = [];
    const steps = 22;
    for (let t = 0; t <= 1; t += 1 / steps) {
      const curLat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * offsetLat + t * t * lat2;
      const curLng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * offsetLng + t * t * lng2;
      curvePoints.push([curLat, curLng]);
    }

    const count = pair.projects.length;
    const hasActive = pair.projects.some(p => p.status === 'active');
    
    // Weighted stroke-width scaled smoothly
    const weight = Math.min(5.5, Math.max(1.4, 1.2 + Math.log2(count + 1) * 0.8));
    const opacity = hasActive ? 0.72 : 0.45;

    const polyline = L.polyline(curvePoints, {
      className: 'connection-arc' + (hasActive ? ' active-flow' : ''),
      weight: weight,
      opacity: opacity,
      lineCap: 'round'
    });

    polyline.pairData = pair;

    // Apply Gradient or Category Color
    this.applyPolylineColor(polyline, pair);

    // Polyline Tooltip
    const topTopic = pair.projects[0] ? pair.projects[0].topic : '';
    const compColor = COMPANY_COLORS[pair.company] || '#3b82f6';
    const uniColor = REGION_COLORS[pair.country] || '#10b981';

    polyline.bindTooltip(`
      <div style="font-size: 11px; max-width: 270px; line-height: 1.4;">
        <div style="display: flex; align-items: center; gap: 4px; font-weight: 700; margin-bottom: 2px;">
          <span style="color: ${compColor};">🏢 ${pair.company}</span>
          <span style="color: #94a3b8;">➔</span>
          <span style="color: ${uniColor};">🏛️ ${pair.university}</span>
        </div>
        <div style="color: #38bdf8; font-weight: 600; font-size: 10.5px;">총 ${pair.projects.length}건 산학협력 과제</div>
        <div style="margin-top: 4px; color: #cbd5e1; font-size: 10px;">
          • ${topTopic}
          ${pair.projects.length > 1 ? `<br/><em>+ 외 ${pair.projects.length - 1}건 공동 과제</em>` : ''}
        </div>
      </div>
    `, { sticky: true });

    // Polyline interactions
    polyline.on('mouseover', () => {
      this.highlightSinglePair(pair.key);
    });

    polyline.on('mouseout', () => {
      if (!this.focusedNodeKey) {
        this.clearFocus();
      } else {
        this.highlightNodeNetwork(this.focusedNodeKey);
      }
    });

    polyline.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      this.focusedNodeKey = pair.companyKey;
      this.highlightNodeNetwork(pair.companyKey);
    });

    this.linesLayer.addLayer(polyline);
    this.pairPolylineMap.set(pair.key, polyline);
  }

  applyPolylineColor(polyline, pair) {
    if (this.colorMode === 'gradient') {
      const gradId = this.getGradientId(pair.company, pair.university, pair.country);
      if (gradId) {
        setTimeout(() => {
          if (polyline._path) {
            polyline._path.setAttribute('stroke', `url(#${gradId})`);
          }
        }, 10);
      } else {
        polyline.setStyle({ color: COMPANY_COLORS[pair.company] || '#3b82f6' });
      }
    } else {
      // Category mode
      const primeCat = pair.projects[0] ? pair.projects[0].category : '';
      const catColor = CATEGORY_COLORS[primeCat] || '#38bdf8';
      polyline.setStyle({ color: catColor });
      if (polyline._path) {
        polyline._path.removeAttribute('stroke');
      }
    }
  }

  updateArcColors() {
    this.pairPolylineMap.forEach((polyline, pairKey) => {
      const pair = polyline.pairData;
      if (pair) {
        this.applyPolylineColor(polyline, pair);
      }
    });
  }

  updateLOD() {
    if (!this.map) return;
    const zoom = this.map.getZoom();

    this.pairPolylineMap.forEach((polyline, pairKey) => {
      const pair = polyline.pairData;
      if (!pair) return;
      const count = pair.projects.length;

      let isVisible = true;

      if (this.filterMode === 'nodes_only') {
        isVisible = false;
      } else if (this.filterMode === 'major') {
        isVisible = count >= 3;
      } else if (this.filterMode === 'focused') {
        isVisible = (this.focusedNodeKey && (pair.companyKey === this.focusedNodeKey || pair.uniKey === this.focusedNodeKey));
      } else {
        // 'smart' Adaptive Mode
        if (zoom <= 2.8) {
          isVisible = count >= 3;
        } else if (zoom > 2.8 && zoom < 4.8) {
          isVisible = count >= 2;
        } else {
          isVisible = true;
        }
      }

      if (isVisible) {
        if (!this.linesLayer.hasLayer(polyline)) {
          this.linesLayer.addLayer(polyline);
        }
      } else {
        if (this.linesLayer.hasLayer(polyline)) {
          this.linesLayer.removeLayer(polyline);
        }
      }
    });
  }

  highlightNodeNetwork(nodeKey) {
    if (!nodeKey) return;
    const node = this.uniqueNodes.get(nodeKey);
    if (!node) return;

    const connectedKeys = node.connectedKeys;

    // Highlight / Dim Polylines
    this.pairPolylineMap.forEach((polyline, pairKey) => {
      const pair = polyline.pairData;
      if (!pair) return;

      const isConnected = (pair.companyKey === nodeKey || pair.uniKey === nodeKey);

      if (isConnected) {
        if (!this.linesLayer.hasLayer(polyline)) {
          this.linesLayer.addLayer(polyline);
        }
        if (polyline._path) {
          polyline._path.classList.remove('dimmed-arc');
          polyline._path.classList.add('highlighted-arc');
        }
        polyline.setStyle({ opacity: 1 });
      } else {
        if (polyline._path) {
          polyline._path.classList.remove('highlighted-arc');
          polyline._path.classList.add('dimmed-arc');
        }
        polyline.setStyle({ opacity: 0.06 });
      }
    });

    // Highlight / Dim Node Markers
    this.nodeMarkerMap.forEach((marker, nKey) => {
      const isTarget = (nKey === nodeKey);
      const isConnected = connectedKeys.has(nKey);
      const el = marker.getElement();

      if (el) {
        if (isTarget || isConnected) {
          el.classList.remove('dimmed-node');
          if (isTarget) el.classList.add('highlighted-node');
        } else {
          el.classList.remove('highlighted-node');
          el.classList.add('dimmed-node');
        }
      }
    });
  }

  highlightSinglePair(pairKey) {
    const targetPolyline = this.pairPolylineMap.get(pairKey);
    if (!targetPolyline) return;
    const pair = targetPolyline.pairData;

    this.pairPolylineMap.forEach((polyline, pKey) => {
      if (polyline._path) {
        if (pKey === pairKey) {
          polyline._path.classList.remove('dimmed-arc');
          polyline._path.classList.add('highlighted-arc');
          polyline.setStyle({ opacity: 1 });
        } else {
          polyline._path.classList.remove('highlighted-arc');
          polyline._path.classList.add('dimmed-arc');
          polyline.setStyle({ opacity: 0.06 });
        }
      }
    });

    if (pair) {
      this.nodeMarkerMap.forEach((marker, nKey) => {
        const el = marker.getElement();
        if (el) {
          if (nKey === pair.companyKey || nKey === pair.uniKey) {
            el.classList.remove('dimmed-node');
            el.classList.add('highlighted-node');
          } else {
            el.classList.remove('highlighted-node');
            el.classList.add('dimmed-node');
          }
        }
      });
    }
  }

  clearFocus() {
    this.focusedNodeKey = null;
    this.hoveredNodeKey = null;

    // Reset Polylines
    this.pairPolylineMap.forEach(polyline => {
      if (polyline._path) {
        polyline._path.classList.remove('highlighted-arc', 'dimmed-arc');
      }
      const count = polyline.pairData ? polyline.pairData.projects.length : 1;
      const hasActive = polyline.pairData && polyline.pairData.projects.some(p => p.status === 'active');
      polyline.setStyle({
        opacity: hasActive ? 0.72 : 0.45,
        weight: Math.min(5.5, Math.max(1.4, 1.2 + Math.log2(count + 1) * 0.8))
      });
    });

    // Reset Nodes
    this.nodeMarkerMap.forEach(marker => {
      const el = marker.getElement();
      if (el) {
        el.classList.remove('highlighted-node', 'dimmed-node');
      }
    });

    this.updateLOD();
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}

window.MapView = MapView;
