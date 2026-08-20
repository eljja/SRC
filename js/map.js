/**
 * MapView Module (v3.0)
 * Renders the global semiconductor research network on an interactive Leaflet map
 * with custom nodes, curved connection flow lines, and popup details.
 * Supports smooth dragging, multi-touch zooming, scroll wheel zooming, and view reset.
 */
class MapView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.map = null;
    this.markersLayer = null;
    this.linesLayer = null;
    this.isInitialized = false;
    this.defaultCenter = [28, 20];
    this.defaultZoom = 2.5;
  }

  init() {
    if (this.isInitialized) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Initialize Leaflet map centered globally with full gesture and drag support enabled
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
        btn.innerHTML = '🗺️ 전체 뷰';
        btn.title = '전체 지도 화면으로 리셋';
        btn.onclick = (e) => {
          e.stopPropagation();
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
    this.isInitialized = true;
  }

  render(projects) {
    if (!this.isInitialized) {
      this.init();
    }

    this.markersLayer.clearLayers();
    this.linesLayer.clearLayers();

    if (!projects || projects.length === 0) return;

    const uniqueNodes = new Map();
    const connectionPairs = new Map();

    projects.forEach(p => {
      // 1. University Node
      if (p.university_lat && p.university_lng) {
        const uniKey = `uni_${p.university}`;
        if (!uniqueNodes.has(uniKey)) {
          uniqueNodes.set(uniKey, {
            type: 'university',
            name: p.university,
            city: p.university_city,
            country: p.university_country,
            lat: p.university_lat,
            lng: p.university_lng,
            projects: []
          });
        }
        uniqueNodes.get(uniKey).projects.push(p);
      }

      // 2. Company Node
      if (p.company_lat && p.company_lng) {
        const compKey = `comp_${p.company}`;
        if (!uniqueNodes.has(compKey)) {
          uniqueNodes.set(compKey, {
            type: 'company',
            name: p.company,
            city: p.company_city,
            country: p.company_country,
            lat: p.company_lat,
            lng: p.company_lng,
            projects: []
          });
        }
        uniqueNodes.get(compKey).projects.push(p);
      }

      // 3. Aggregate Connection Pairs between Company and University
      if (p.university_lat && p.university_lng && p.company_lat && p.company_lng) {
        const pairKey = `${p.company}__${p.university}`;
        if (!connectionPairs.has(pairKey)) {
          connectionPairs.set(pairKey, {
            company: p.company,
            university: p.university,
            companyCoord: [p.company_lat, p.company_lng],
            universityCoord: [p.university_lat, p.university_lng],
            projects: []
          });
        }
        connectionPairs.get(pairKey).projects.push(p);
      }
    });

    // Render bundled curved connection lines
    connectionPairs.forEach(pair => {
      this.drawBundledConnection(pair);
    });

    // Render Markers for all unique nodes
    uniqueNodes.forEach((node) => {
      this.drawNodeMarker(node);
    });
  }

  drawNodeMarker(node) {
    const isUni = node.type === 'university';
    const size = Math.min(36, 18 + Math.sqrt(node.projects.length) * 3);
    const className = isUni ? 'custom-map-node node-university' : 'custom-map-node node-company';

    const customIcon = L.divIcon({
      className: className,
      iconSize: [size, size],
      html: `<span>${node.projects.length}</span>`
    });

    const marker = L.marker([node.lat, node.lng], { icon: customIcon });

    const safeNodeName = node.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const filterType = isUni ? 'university' : 'company';

    // Projects list (first 4 visible, remaining collapsible)
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
          🔽 + 외 ${node.projects.length - 4}개 산학 과제 팝업에서 펼치기
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
          📍 ${node.city || ''}, ${node.country || ''} (총 ${node.projects.length}건 산학연 R&D 과제)
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

    // Arc curvature scale
    const curveFactor = 0.2;
    const offsetLat = midLat + (dx * curveFactor);
    const offsetLng = midLng - (dy * curveFactor);

    // Generate quadratic bezier points
    const curvePoints = [];
    const steps = 24;
    for (let t = 0; t <= 1; t += 1 / steps) {
      const curLat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * offsetLat + t * t * lat2;
      const curLng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * offsetLng + t * t * lng2;
      curvePoints.push([curLat, curLng]);
    }

    const hasActive = pair.projects.some(p => p.status === 'active');
    const color = hasActive ? '#06b6d4' : '#6b7280';
    const opacity = hasActive ? 0.75 : 0.4;
    const weight = Math.min(5, Math.max(1.8, 1.5 + Math.sqrt(pair.projects.length) * 0.8));

    const polyline = L.polyline(curvePoints, {
      color: color,
      weight: weight,
      opacity: opacity,
      dashArray: hasActive ? '6, 6' : null,
      lineCap: 'round'
    });

    const projectSamples = pair.projects.slice(0, 3).map(p => `• ${p.topic} (${p.professor || '미지정'})`).join('<br/>');
    const extraCount = pair.projects.length > 3 ? `<br/><em>+ 외 ${pair.projects.length - 3}건 (클릭 시 전체 목록)</em>` : '';

    polyline.bindTooltip(`
      <div style="font-size: 11px; max-width: 260px;">
        <strong style="color: #60a5fa;">${pair.company} ↔ ${pair.university}</strong>
        <span style="color: #cbd5e1;">(${pair.projects.length}개 과제)</span><br/>
        <div style="margin-top: 4px; color: #9ca3af; font-size: 10px;">
          ${projectSamples}
          ${extraCount}
        </div>
      </div>
    `, { sticky: true });

    const safeComp = pair.company.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const safeUni = pair.university.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    const lineProjectsHtml = pair.projects.map((p, idx) => `
      <div class="map-popup-project-item" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; ${idx >= 3 ? 'display: none;' : ''}">
        <strong style="color: #38bdf8;">${p.topic}</strong><br/>
        <span style="color: #9ca3af;">${p.professor ? '👨‍🏫 ' + p.professor : ''} (${p.start_year}~${p.end_year})</span><br/>
        <span class="badge-status ${p.status === 'active' ? 'badge-active' : (p.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">${p.status === 'active' ? '진행중' : (p.status === 'completed' ? '완료' : '추정')}</span>
        <button onclick="window.app.showProjectModal('${p.id}')" style="background: #3b82f6; border: none; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; float: right; margin-top: 2px;">상세보기</button>
      </div>
    `).join('');

    const toggleLineMoreBtn = pair.projects.length > 3 ? `
      <div style="margin-top: 8px; text-align: center;">
        <button onclick="window.app.toggleMapPopupMore(this)" 
                style="background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.25); color: #93c5fd; padding: 4px 8px; border-radius: 4px; font-size: 10.5px; cursor: pointer; width: 100%; font-weight: 500;">
          🔽 + 외 ${pair.projects.length - 3}개 산학 과제 펼치기
        </button>
      </div>
    ` : '';

    const linePopupHtml = `
      <div class="map-node-popup-content" style="min-width: 260px; max-width: 320px; max-height: 380px; overflow-y: auto; font-family: inherit; padding-right: 2px;">
        <div style="font-size: 13px; font-weight: 700; color: #60a5fa;">
          🏢 ${pair.company} ↔ 🏛️ ${pair.university}
        </div>
        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
          총 ${pair.projects.length}건의 공동 연구개발 과제
        </div>
        <div class="map-popup-projects-list">
          ${lineProjectsHtml}
        </div>
        ${toggleLineMoreBtn}
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; gap: 4px;">
          <button onclick="window.app.filterByAnalyticsItem('company', '${safeComp}')" style="flex: 1; background: rgba(167, 139, 250, 0.25); border: 1px solid #a78bfa; color: #c4b5fd; padding: 5px 6px; border-radius: 5px; font-size: 10px; font-weight: 600; cursor: pointer;">🏢 ${pair.company} 목록</button>
          <button onclick="window.app.filterByAnalyticsItem('university', '${safeUni}')" style="flex: 1; background: rgba(56, 189, 248, 0.25); border: 1px solid #38bdf8; color: #7dd3fc; padding: 5px 6px; border-radius: 5px; font-size: 10px; font-weight: 600; cursor: pointer;">🏛️ ${pair.university} 목록</button>
        </div>
      </div>
    `;

    polyline.bindPopup(linePopupHtml);

    this.linesLayer.addLayer(polyline);
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}

window.MapView = MapView;
