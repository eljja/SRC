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
      keyboard: true,
      tapHold: true
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

      // 3. Draw curved bezier connection line between University and Company
      if (p.university_lat && p.university_lng && p.company_lat && p.company_lng) {
        this.drawCurvedConnection(
          [p.company_lat, p.company_lng],
          [p.university_lat, p.university_lng],
          p
        );
      }
    });

    // Render Markers for all unique nodes
    uniqueNodes.forEach((node) => {
      this.drawNodeMarker(node);
    });
  }

  drawNodeMarker(node) {
    const isUni = node.type === 'university';
    const size = Math.min(34, 18 + node.projects.length * 1.5);
    const className = isUni ? 'custom-map-node node-university' : 'custom-map-node node-company';

    const customIcon = L.divIcon({
      className: className,
      iconSize: [size, size],
      html: `<span>${node.projects.length}</span>`
    });

    const marker = L.marker([node.lat, node.lng], { icon: customIcon });

    // Popup Content
    const projectListHtml = node.projects.slice(0, 4).map(p => `
      <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px;">
        <strong style="color: #60a5fa;">${p.topic}</strong><br/>
        <span style="color: #9ca3af;">${p.professor ? '👨‍🏫 ' + p.professor : ''} (${p.start_year}~${p.end_year})</span><br/>
        <span class="badge-status ${p.status === 'active' ? 'badge-active' : 'badge-completed'}">${p.status === 'active' ? '진행중' : '완료'}</span>
        <button onclick="window.app.showProjectModal('${p.id}')" style="background: #3b82f6; border: none; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; float: right; margin-top: 2px;">상세보기</button>
      </div>
    `).join('');

    const popupHtml = `
      <div style="min-width: 240px; font-family: inherit;">
        <div style="font-size: 13px; font-weight: 700; color: ${isUni ? '#38bdf8' : '#a78bfa'};">
          ${isUni ? '🏛️ ' : '🏢 '} ${node.name}
        </div>
        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
          📍 ${node.city || ''}, ${node.country || ''} (${node.projects.length}건 산학연 R&D 과제)
        </div>
        ${projectListHtml}
      </div>
    `;

    marker.bindPopup(popupHtml);
    this.markersLayer.addLayer(marker);
  }

  drawCurvedConnection(startLatLng, endLatLng, project) {
    const lat1 = startLatLng[0];
    const lng1 = startLatLng[1];
    const lat2 = endLatLng[0];
    const lng2 = endLatLng[1];

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

    const isActive = project.status === 'active';
    const color = isActive ? '#06b6d4' : '#6b7280';
    const opacity = isActive ? 0.75 : 0.35;
    const weight = Math.min(4, Math.max(1.8, (project.funding_amount_usd || 1000000) / 10000000));

    const polyline = L.polyline(curvePoints, {
      color: color,
      weight: weight,
      opacity: opacity,
      dashArray: isActive ? '6, 6' : null,
      lineCap: 'round'
    });

    polyline.bindTooltip(`
      <div style="font-size: 11px;">
        <strong>${project.company} ↔ ${project.university}</strong><br/>
        <span>주제: ${project.topic}</span><br/>
        <span>교수: ${project.professor || '미지정'} (${project.start_year}~${project.end_year})</span>
      </div>
    `, { sticky: true });

    polyline.on('click', () => {
      if (this.onProjectSelect) {
        this.onProjectSelect(project.id);
      }
    });

    this.linesLayer.addLayer(polyline);
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
    }
  }
}

window.MapView = MapView;
