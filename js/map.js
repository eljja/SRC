/**
 * MapView Module (v8.0.0 — High-FPS HiDPI Canvas Overlay Engine)
 * Renders the global semiconductor research/venture network on an interactive Leaflet map
 * with a GPU-accelerated HiDPI Canvas overlay:
 * - Native Canvas 2-color linear gradient Bezier arcs (zero SVG gradient DOM overhead)
 * - Subtle animated data-flow pulses along active & focused corridors
 * - Vibrant Canvas hub markers with spatial O(1) hover/click hit-testing
 * - Preserves full Leaflet Popups, Tooltips, Zoom-Adaptive LOD, and Toolbar Controls
 */

const COMPANY_COLORS = {
  "Samsung Electronics": "#3b82f6",
  "TSMC": "#ef4444",
  "Intel": "#06b6d4",
  "SK Hynix": "#f43f5e",
  "ASML": "#38bdf8",
  "Applied Materials (AMAT)": "#14b8a6",
  "Applied Materials": "#14b8a6",
  "Lam Research": "#0ea5e9",
  "KLA Corporation": "#f97316",
  "KLA": "#f97316",
  "NVIDIA": "#84cc16",
  "Qualcomm": "#6366f1",
  "MediaTek": "#ec4899",
  "Broadcom": "#e11d48",
  "Texas Instruments": "#f59e0b",
  "STMicroelectronics": "#8b5cf6",
  "Infineon Technologies": "#10b981",
  "Infineon": "#10b981",
  "NXP Semiconductors": "#6366f1",
  "NXP": "#6366f1",
  "Sony Semiconductor": "#a855f7",
  "Sony": "#a855f7",
  "Tokyo Electron (TEL)": "#4f46e5",
  "Tokyo Electron": "#4f46e5",
  "GlobalFoundries": "#d946ef",
  "Micron Technology": "#eab308",
  "Micron": "#eab308",
  "Synopsys": "#8b5cf6",
  "Cadence": "#3b82f6",
  "Wolfspeed": "#f97316",
  "Onsemi": "#10b981",
  "Arm": "#0284c7",
  "Renesas": "#e11d48",
  "Kioxia": "#d97706",
  "DB HiTek": "#10b981",
  "Rapidus": "#06b6d4"
};

const REGION_COLORS = {
  "South Korea": "#10b981",
  "USA": "#f59e0b",
  "Taiwan": "#fb7185",
  "Belgium": "#818cf8",
  "Netherlands": "#38bdf8",
  "Germany": "#a78bfa",
  "France": "#60a5fa",
  "UK": "#c084fc",
  "Switzerland": "#34d399",
  "Japan": "#c084fc",
  "China": "#f87171",
  "Singapore": "#2dd4bf",
  "Global": "#38bdf8"
};

const CATEGORY_COLORS = {
  "Advanced Logic & Transistors (GAA/CFET/2D)": "#3b82f6",
  "Memory & Storage (HBM/PIM/3D NAND)": "#f43f5e",
  "Advanced Packaging & Chiplets (3D/Hybrid Bonding)": "#06b6d4",
  "Lithography & Metrology (EUV/High-NA)": "#8b5cf6",
  "AI & Neuromorphic Computing": "#10b981",
  "Power & Compound Semiconductors (GaN/SiC)": "#f59e0b",
  "Silicon Photonics & Optical I/O": "#ec4899"
};

class MapCanvasOverlay extends L.Layer {
  constructor(mapView) {
    super();
    this.mapView = mapView;
    this._canvas = null;
    this._ctx = null;
    this._dpr = 1;
    this._animPhase = 0;
    this._animRaf = null;
    this._lastAnimTs = 0;
    this._zooming = false;
    this._drawnZoom = null;
    this._drawnTopLeftLatLng = null;
    this._projectedNodes = [];
    this._projectedArcs = [];
  }

  onAdd(map) {
    this._map = map;
    this._canvas = L.DomUtil.create('canvas', 'leaflet-zoom-animated map-network-canvas');
    this._canvas.style.pointerEvents = 'none';
    this._canvas.style.position = 'absolute';
    this._canvas.style.transformOrigin = '0 0';
    this._ctx = this._canvas.getContext('2d');

    map.getPanes().overlayPane.appendChild(this._canvas);

    map.on('zoomstart', this._onZoomStart, this);
    map.on('zoomend', this._onZoomEnd, this);
    map.on('move', this._onMove, this);
    map.on('moveend viewreset resize', this._onMoveEnd, this);
    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this);
    }

    this._reset();
    this._startAnimation();
    return this;
  }

  onRemove(map) {
    this._stopAnimation();
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    map.off('zoomstart', this._onZoomStart, this);
    map.off('zoomend', this._onZoomEnd, this);
    map.off('move', this._onMove, this);
    map.off('moveend viewreset resize', this._onMoveEnd, this);
    map.off('zoomanim', this._animateZoom, this);
  }

  _onZoomStart() {
    this._zooming = true;
  }

  _onZoomEnd() {
    this._zooming = false;
    this._reset();
  }

  _onMove() {
    if (this._zooming) return;
    this._reset();
  }

  _onMoveEnd() {
    this._zooming = false;
    this._reset();
  }

  _animateZoom(e) {
    const map = this._map;
    if (!map || !this._canvas || !this._drawnTopLeftLatLng || this._drawnZoom === null) return;
    this._zooming = true;
    const scale = map.getZoomScale(e.zoom, this._drawnZoom);
    const offset = map._latLngToNewLayerPoint(this._drawnTopLeftLatLng, e.zoom, e.center);
    L.DomUtil.setTransform(this._canvas, offset, scale);
  }

  _startAnimation() {
    if (this._animRaf) return;
    const tick = (ts) => {
      this._animRaf = requestAnimationFrame(tick);
      if (document.hidden || this._zooming) return;
      const mapEl = document.getElementById(this.mapView.containerId);
      if (!mapEl || mapEl.offsetParent === null) return; // pause when tab inactive
      if (ts - this._lastAnimTs < 33) return; // ~30fps smooth pulse
      this._lastAnimTs = ts;
      this._animPhase = (this._animPhase + 0.012) % 1.0;
      this.draw();
    };
    this._animRaf = requestAnimationFrame(tick);
  }

  _stopAnimation() {
    if (this._animRaf) {
      cancelAnimationFrame(this._animRaf);
      this._animRaf = null;
    }
  }

  _reset() {
    if (!this._map || !this._canvas || this._zooming) return;
    const size = this._map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._drawnZoom = this._map.getZoom();
    this._drawnTopLeftLatLng = this._map.containerPointToLatLng([0, 0]);
    const topLeft = this._map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setTransform(this._canvas, topLeft, 1);

    const bw = Math.round(size.x * this._dpr);
    const bh = Math.round(size.y * this._dpr);
    if (this._canvas.width !== bw || this._canvas.height !== bh) {
      this._canvas.width = bw;
      this._canvas.height = bh;
      this._canvas.style.width = `${size.x}px`;
      this._canvas.style.height = `${size.y}px`;
    }
    this.draw();
  }

  draw() {
    if (!this._map || !this._ctx) return;
    const map = this._map;
    const ctx = this._ctx;
    const size = map.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    ctx.save();
    ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    const mv = this.mapView;
    const zoom = map.getZoom();
    const activeNodeKey = mv.hoveredNodeKey || mv.focusedNodeKey;
    const activePairKey = mv.hoveredPairKey;
    const hasFocus = Boolean(activeNodeKey || activePairKey);

    this._projectedArcs = [];
    this._projectedNodes = [];

    // Helper: wrap lng near map center for clean worldCopy rendering
    const centerLng = map.getCenter().lng;
    const projectLatLng = (lat, lng) => {
      let adjLng = lng;
      while (adjLng - centerLng > 180) adjLng -= 360;
      while (adjLng - centerLng < -180) adjLng += 360;
      return map.latLngToContainerPoint([lat, adjLng]);
    };

    // Adaptive LOD thresholds so sparse/filtered or Venture datasets always show arcs
    const totalPairs = mv.connectionPairs.size;
    const totalNodes = mv.uniqueNodes.size;
    const isCompactDataset = totalPairs <= 300;

    // 1. Draw Connection Bezier Arcs
    if (mv.filterMode !== 'nodes_only') {
      const normalArcs = [];
      const focusArcs = [];

      mv.connectionPairs.forEach(pair => {
        const count = pair.projects.length;
        const isPairFocused = (activePairKey === pair.key) ||
          (activeNodeKey && (pair.companyKey === activeNodeKey || pair.uniKey === activeNodeKey));

        let visible = true;
        if (mv.filterMode === 'major') {
          if (isCompactDataset) {
            const maxDealUsd = pair.projects.reduce((m, p) => Math.max(m, p.funding_amount_usd || 0), 0);
            visible = count >= 2 || maxDealUsd >= 100000000;
          } else {
            visible = count >= 3;
          }
        } else if (mv.filterMode === 'focused') {
          visible = isPairFocused;
        } else {
          // Smart mode: show all in compact/filtered datasets; zoom-adaptive in massive datasets
          if (!isPairFocused && !isCompactDataset) {
            if (zoom <= 2.8) visible = count >= 3;
            else if (zoom < 4.8) visible = count >= 2;
          }
        }
        if (!visible) return;

        const p1 = projectLatLng(pair.companyCoord[0], pair.companyCoord[1]);
        const p2 = projectLatLng(pair.universityCoord[0], pair.universityCoord[1]);

        // Skip arcs far outside screen
        if (Math.max(p1.x, p2.x) < -120 || Math.min(p1.x, p2.x) > size.x + 120 ||
            Math.max(p1.y, p2.y) < -120 || Math.min(p1.y, p2.y) > size.y + 120) {
          return;
        }

        // Compute quadratic bezier control point cleanly in screen pixel space
        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const ctrlX = midX + dy * 0.18;
        const ctrlY = midY - dx * 0.18;

        const item = { pair, p1, p2, ctrlX, ctrlY, isFocused: isPairFocused };
        this._projectedArcs.push(item);

        if (isPairFocused) focusArcs.push(item);
        else normalArcs.push(item);
      });

      const drawArcItem = (item, dim) => {
        const { pair, p1, p2, ctrlX, ctrlY, isFocused } = item;
        const count = pair.projects.length;
        const hasActive = pair.projects.some(p => p.status === 'active');

        const baseW = Math.min(4.8, Math.max(1.2, 1.0 + Math.log2(count + 1) * 0.72));
        const compColor = COMPANY_COLORS[pair.company] || '#3b82f6';
        const uniColor = REGION_COLORS[pair.country] || '#10b981';
        const primeCat = pair.projects[0] ? pair.projects[0].category : '';
        const catColor = CATEGORY_COLORS[primeCat] || '#38bdf8';

        let strokeStyle;
        if (mv.colorMode === 'category') {
          strokeStyle = catColor;
        } else {
          const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
          grad.addColorStop(0, compColor);
          grad.addColorStop(1, uniColor);
          strokeStyle = grad;
        }

        ctx.save();
        ctx.lineCap = 'round';
        ctx.globalAlpha = dim ? 0.06 : (isFocused ? 0.96 : (hasActive ? 0.68 : 0.36));
        ctx.lineWidth = isFocused ? baseW + 1.4 : baseW;

        if (isFocused || (hasActive && !dim && count >= 3)) {
          ctx.shadowColor = mv.colorMode === 'category' ? catColor : compColor;
          ctx.shadowBlur = isFocused ? 12 : 6;
        }

        ctx.strokeStyle = strokeStyle;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(ctrlX, ctrlY, p2.x, p2.y);
        ctx.stroke();

        // Subtle animated flow pulse dot along active or focused corridors
        if (!dim && (isFocused || hasActive)) {
          const t = (this._animPhase + ((count % 7) * 0.14)) % 1.0;
          const inv = 1 - t;
          const px = inv * inv * p1.x + 2 * inv * t * ctrlX + t * t * p2.x;
          const py = inv * inv * p1.y + 2 * inv * t * ctrlY + t * t * p2.y;
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = isFocused ? 0.95 : 0.75;
          ctx.beginPath();
          ctx.arc(px, py, isFocused ? 2.6 : 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      for (let i = 0; i < normalArcs.length; i++) {
        drawArcItem(normalArcs[i], hasFocus);
      }
      for (let i = 0; i < focusArcs.length; i++) {
        drawArcItem(focusArcs[i], false);
      }
    }

    // 2. Draw Institution Nodes
    const activeNodeObj = activeNodeKey ? mv.uniqueNodes.get(activeNodeKey) : null;
    const focusedPairObj = activePairKey ? mv.connectionPairs.get(activePairKey) : null;

    const normalNodes = [];
    const focusNodes = [];

    mv.uniqueNodes.forEach(node => {
      const count = node.projects.length;
      const isCompany = node.type === 'company';

      const isFocused = (node.key === activeNodeKey) ||
        (activeNodeObj && activeNodeObj.connectedKeys && activeNodeObj.connectedKeys.has(node.key)) ||
        (focusedPairObj && (focusedPairObj.companyKey === node.key || focusedPairObj.uniKey === node.key));

      let visible = true;
      if (mv.filterMode === 'focused') {
        visible = !hasFocus || isFocused;
      } else if (mv.filterMode === 'major') {
        visible = isCompany || count >= (totalNodes <= 300 ? 2 : 3) || isFocused;
      } else {
        if (!isFocused && totalNodes > 300) {
          if (zoom <= 2.8) visible = isCompany || count >= 3;
          else if (zoom < 4.5) visible = isCompany || count >= 2;
        }
      }
      if (!visible) return;

      const pt = projectLatLng(node.lat, node.lng);
      if (pt.x < -50 || pt.x > size.x + 50 || pt.y < -50 || pt.y > size.y + 50) return;

      const r = Math.min(18, Math.max(5.5, 4.5 + Math.log2(count + 1) * 2.1));
      const item = { node, pt, r, isFocused, isPrimary: node.key === activeNodeKey };
      this._projectedNodes.push(item);

      if (isFocused) focusNodes.push(item);
      else normalNodes.push(item);
    });

    const drawNodeItem = (item, dim) => {
      const { node, pt, r, isFocused, isPrimary } = item;
      const isUni = node.type === 'university';
      const fillCol = isUni ? (REGION_COLORS[node.country] || '#10b981') : (COMPANY_COLORS[node.name] || '#3b82f6');
      const drawR = isPrimary ? r + 3 : (isFocused ? r + 1.5 : r);

      ctx.save();
      ctx.globalAlpha = dim ? 0.16 : 0.96;

      if (!dim && (isFocused || !isUni || node.projects.length >= 15)) {
        ctx.shadowColor = fillCol;
        ctx.shadowBlur = isPrimary ? 16 : 9;
      }

      // Outer luminous ring
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = fillCol;
      ctx.fill();

      ctx.lineWidth = isPrimary ? 2.8 : (isFocused ? 2.2 : 1.4);
      ctx.strokeStyle = isPrimary ? '#ffffff' : (isUni ? '#e0f2fe' : '#f8fafc');
      ctx.stroke();

      // Count text inside large hubs or focused nodes
      if (!dim && (drawR >= 10 || isFocused)) {
        const count = node.projects.length;
        const txt = count > 999 ? `${Math.round(count / 1000)}k` : String(count);
        ctx.shadowBlur = 0;
        ctx.font = `700 ${drawR >= 13 ? 10 : 8.5}px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#060910';
        ctx.fillText(txt, pt.x + 0.5, pt.y + 0.8);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(txt, pt.x, pt.y + 0.3);
      }

      // Label above primary hovered/focused node
      if (isPrimary) {
        ctx.shadowBlur = 0;
        ctx.font = '700 11px "Inter", "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(6, 9, 16, 0.92)';
        ctx.strokeText(node.name, pt.x, pt.y - drawR - 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(node.name, pt.x, pt.y - drawR - 7);
      }
      ctx.restore();
    };

    for (let i = 0; i < normalNodes.length; i++) {
      drawNodeItem(normalNodes[i], hasFocus);
    }
    for (let i = 0; i < focusNodes.length; i++) {
      drawNodeItem(focusNodes[i], false);
    }

    ctx.restore();
  }

  hitTestNode(px, py) {
    let best = null;
    let bestD2 = Infinity;
    for (let i = this._projectedNodes.length - 1; i >= 0; i--) {
      const item = this._projectedNodes[i];
      const dx = px - item.pt.x;
      const dy = py - item.pt.y;
      const hitR = item.r + 6;
      const d2 = dx * dx + dy * dy;
      if (d2 <= hitR * hitR && d2 < bestD2) {
        bestD2 = d2;
        best = item.node;
      }
    }
    return best;
  }

  hitTestArc(px, py) {
    let best = null;
    let bestD2 = 64; // 8px threshold squared
    for (let i = this._projectedArcs.length - 1; i >= 0; i--) {
      const arc = this._projectedArcs[i];
      const { p1, p2, ctrlX, ctrlY } = arc;
      // Quick bounding box cull
      const minX = Math.min(p1.x, p2.x, ctrlX) - 10;
      const maxX = Math.max(p1.x, p2.x, ctrlX) + 10;
      const minY = Math.min(p1.y, p2.y, ctrlY) - 10;
      const maxY = Math.max(p1.y, p2.y, ctrlY) + 10;
      if (px < minX || px > maxX || py < minY || py > maxY) continue;

      // Sample 10 points along quadratic bezier
      for (let s = 1; s <= 9; s++) {
        const t = s * 0.1;
        const inv = 1 - t;
        const bx = inv * inv * p1.x + 2 * inv * t * ctrlX + t * t * p2.x;
        const by = inv * inv * p1.y + 2 * inv * t * ctrlY + t * t * p2.y;
        const d2 = (px - bx) * (px - bx) + (py - by) * (py - by);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = arc.pair;
        }
      }
    }
    return best;
  }
}

class MapView {
  constructor(containerId, onProjectSelect) {
    this.containerId = containerId;
    this.onProjectSelect = onProjectSelect;
    this.map = null;
    this.canvasLayer = null;
    this.tooltipEl = null;
    this.isInitialized = false;
    this.defaultCenter = [28, 20];
    this.defaultZoom = 2.4;

    // View States
    this.filterMode = 'smart';      // 'smart' | 'focused' | 'major' | 'nodes_only'
    this.colorMode = 'gradient';    // 'gradient' | 'category'
    this.focusedNodeKey = null;
    this.hoveredNodeKey = null;
    this.hoveredPairKey = null;

    // Cached Data
    this.currentProjects = [];
    this.uniqueNodes = new Map();
    this.connectionPairs = new Map();
  }

  init() {
    if (this.isInitialized) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.map = L.map(this.containerId, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      minZoom: 1.5,
      maxZoom: 16,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelDebounceTime: 40,
      wheelPxPerZoomLevel: 80,
      worldCopyJump: true,
      preferCanvas: true,
      zoomControl: false,
      dragging: true,
      scrollWheelZoom: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=cb1_4fx7_1_90b4020701de4739f2fa31c5', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a> | SRC Observatory',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    this.canvasLayer = new MapCanvasOverlay(this).addTo(this.map);

    // Floating canvas tooltip element
    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'map-canvas-tooltip';
    this.tooltipEl.style.display = 'none';
    container.appendChild(this.tooltipEl);

    this._bindCanvasInteractions();
    this.setupToolbarEvents();
    this.isInitialized = true;
  }

  _bindCanvasInteractions() {
    const map = this.map;
    const mapEl = map.getContainer();

    map.on('mousemove', (e) => {
      if (!this.canvasLayer || !e.containerPoint) return;
      const px = e.containerPoint.x;
      const py = e.containerPoint.y;

      const hitNode = this.canvasLayer.hitTestNode(px, py);
      if (hitNode) {
        mapEl.style.cursor = 'pointer';
        if (this.hoveredNodeKey !== hitNode.key || this.hoveredPairKey !== null) {
          this.hoveredNodeKey = hitNode.key;
          this.hoveredPairKey = null;
          this.canvasLayer.draw();
        }
        this._showNodeTooltip(hitNode, px, py);
        return;
      }

      const hitPair = this.canvasLayer.hitTestArc(px, py);
      if (hitPair) {
        mapEl.style.cursor = 'pointer';
        if (this.hoveredPairKey !== hitPair.key || this.hoveredNodeKey !== null) {
          this.hoveredPairKey = hitPair.key;
          this.hoveredNodeKey = null;
          this.canvasLayer.draw();
        }
        this._showPairTooltip(hitPair, px, py);
        return;
      }

      mapEl.style.cursor = '';
      this.tooltipEl.style.display = 'none';
      if (this.hoveredNodeKey !== null || this.hoveredPairKey !== null) {
        this.hoveredNodeKey = null;
        this.hoveredPairKey = null;
        this.canvasLayer.draw();
      }
    });

    map.on('mouseout', () => {
      this.tooltipEl.style.display = 'none';
      if (this.hoveredNodeKey !== null || this.hoveredPairKey !== null) {
        this.hoveredNodeKey = null;
        this.hoveredPairKey = null;
        if (this.canvasLayer) this.canvasLayer.draw();
      }
    });

    map.on('click', (e) => {
      if (!this.canvasLayer || !e.containerPoint) return;
      const px = e.containerPoint.x;
      const py = e.containerPoint.y;

      const hitNode = this.canvasLayer.hitTestNode(px, py);
      if (hitNode) {
        this.focusedNodeKey = hitNode.key;
        this.canvasLayer.draw();
        L.popup({ maxWidth: 350, maxHeight: 300 })
          .setLatLng([hitNode.lat, hitNode.lng])
          .setContent(this.buildPopupHtml(hitNode, hitNode.projects))
          .openOn(map);
        return;
      }

      const hitPair = this.canvasLayer.hitTestArc(px, py);
      if (hitPair) {
        this.focusedNodeKey = hitPair.companyKey;
        this.canvasLayer.draw();
        return;
      }

      this.clearFocus();
    });
  }

  _showNodeTooltip(node, px, py) {
    const isUni = node.type === 'university';
    const col = isUni ? (REGION_COLORS[node.country] || '#10b981') : (COMPANY_COLORS[node.name] || '#3b82f6');
    this.tooltipEl.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:${col};">
        ${isUni ? '🏛️' : '🏢'} ${node.name}
      </div>
      <div style="font-size:10.5px;color:#cbd5e1;margin-top:2px;">
        📍 ${node.city || ''}${node.country ? `, ${node.country}` : ''} · <strong>${node.projects.length}건</strong> 과제 (클릭하여 상세 보기)
      </div>
    `;
    const w = this.map.getSize().x;
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.left = `${Math.min(w - 250, px + 14)}px`;
    this.tooltipEl.style.top = `${Math.max(12, py - 18)}px`;
  }

  _showPairTooltip(pair, px, py) {
    const topTopic = pair.projects[0] ? pair.projects[0].topic : '';
    const compColor = COMPANY_COLORS[pair.company] || '#3b82f6';
    const uniColor = REGION_COLORS[pair.country] || '#10b981';
    this.tooltipEl.innerHTML = `
      <div style="font-size: 11px; max-width: 270px; line-height: 1.4;">
        <div style="display: flex; align-items: center; gap: 4px; font-weight: 700; margin-bottom: 2px;">
          <span style="color: ${compColor};">🏢 ${pair.company}</span>
          <span style="color: #94a3b8;">➔</span>
          <span style="color: ${uniColor};">🏛️ ${pair.university}</span>
        </div>
        <div style="color: #38bdf8; font-weight: 600; font-size: 10.5px;">총 ${pair.projects.length}건 공동 연구/투자</div>
        <div style="margin-top: 3px; color: #cbd5e1; font-size: 10px;">
          • ${topTopic}
          ${pair.projects.length > 1 ? `<br/><em>+ 외 ${pair.projects.length - 1}건</em>` : ''}
        </div>
      </div>
    `;
    const w = this.map.getSize().x;
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.left = `${Math.min(w - 280, px + 14)}px`;
    this.tooltipEl.style.top = `${Math.max(12, py - 24)}px`;
  }

  setupToolbarEvents() {
    const toolbar = document.querySelector('.map-floating-toolbar');
    if (!toolbar) return;

    const modeBtns = toolbar.querySelectorAll('.map-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterMode = btn.getAttribute('data-mode') || 'smart';
        if (this.canvasLayer) this.canvasLayer.draw();
      });
    });

    const colorBtns = toolbar.querySelectorAll('.map-color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.colorMode = btn.getAttribute('data-color') || 'gradient';
        if (this.canvasLayer) this.canvasLayer.draw();
      });
    });

    // Collapsible Map Legend Toggle
    const legendToggle = document.querySelector('.map-legend-toggle');
    const mapLegend = document.querySelector('.map-legend');
    if (legendToggle && mapLegend) {
      legendToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const collapsed = mapLegend.classList.toggle('collapsed');
        legendToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        const chevron = legendToggle.querySelector('.legend-chevron');
        if (chevron) chevron.textContent = collapsed ? '▴' : '▾';
      });
    }
  }

  render(projects) {
    if (!this.isInitialized) {
      this.init();
    }

    this.currentProjects = projects || [];
    this.uniqueNodes.clear();
    this.connectionPairs.clear();

    if (!projects || projects.length === 0) {
      if (this.canvasLayer) this.canvasLayer.draw();
      return;
    }

    projects.forEach(p => {
      if (p.verification && p.verification.status === 'quarantined') return;

      const hasConfirmedCorp = (window.app && window.app.dataManager && typeof window.app.dataManager.isConfirmedCorporateCollab === 'function')
        ? window.app.dataManager.isConfirmedCorporateCollab(p)
        : (p.company && p.company !== '-' && p.company !== '미지정' &&
           (!p.verification || (p.verification.collaboration_type !== 'academic_only' &&
            (p.verification.collaboration_type === 'co_authorship' || p.verification.collaboration_type === 'corporate_grant' || (p.verification.corporate_involvement && p.verification.corporate_involvement.status === 'documented')))));

      if (p.university && p.university_lat && p.university_lng) {
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
            connectedKeys: new Set(),
            pairKeys: new Set()
          });
        }
        this.uniqueNodes.get(uniKey).projects.push(p);
        if (hasConfirmedCorp) {
          this.uniqueNodes.get(uniKey).connectedKeys.add(`comp_${p.company}`);
          this.uniqueNodes.get(uniKey).pairKeys.add(`pair_${p.company}__${p.university}`);
        }
      }

      if (hasConfirmedCorp && p.company_lat && p.company_lng) {
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
            connectedKeys: new Set(),
            pairKeys: new Set()
          });
        }
        this.uniqueNodes.get(compKey).projects.push(p);
        if (p.university) {
          this.uniqueNodes.get(compKey).connectedKeys.add(`uni_${p.university}`);
          this.uniqueNodes.get(compKey).pairKeys.add(`pair_${p.company}__${p.university}`);
        }
      }

      if (hasConfirmedCorp && p.university_lat && p.university_lng && p.company_lat && p.company_lng) {
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

    if (this.canvasLayer) {
      this.canvasLayer._reset();
    }
  }

  buildPopupHtml(node, projects) {
    const isUni = node.type === 'university';
    const safeNodeName = node.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const filterType = isUni ? 'university' : 'company';

    const projectListHtml = projects.map((p, idx) => `
      <div class="map-popup-project-item" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 11px; ${idx >= 4 ? 'display: none;' : ''}">
        <strong style="color: #60a5fa;">${p.topic}</strong><br/>
        <span style="color: #9ca3af;">${p.professor ? '👨‍🏫 ' + p.professor : ''} (${p.start_year}~${p.end_year})</span><br/>
        <span class="badge-status ${p.status === 'active' ? 'badge-active' : (p.status === 'completed' ? 'badge-completed' : 'badge-uncertain')}">${p.status === 'active' ? '진행중' : (p.status === 'completed' ? '완료' : '추정')}</span>
        <button onclick="window.app.showProjectModal('${p.id}')" style="background: #3b82f6; border: none; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; float: right; margin-top: 2px;">상세보기</button>
      </div>
    `).join('');

    const toggleMoreBtn = projects.length > 4 ? `
      <div style="margin-top: 8px; text-align: center;">
        <button onclick="window.app.toggleMapPopupMore(this)" 
                style="background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.25); color: #93c5fd; padding: 4px 8px; border-radius: 4px; font-size: 10.5px; cursor: pointer; width: 100%; font-weight: 500;">
          🔽 + 외 ${projects.length - 4}개 산학 과제 펼치기
        </button>
      </div>
    ` : '';

    const filterButtonHtml = `
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.15); text-align: center;">
        <button onclick="window.app.filterByAnalyticsItem('${filterType}', '${safeNodeName}')" 
                style="background: rgba(59, 130, 246, 0.25); border: 1px solid #3b82f6; color: #60a5fa; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; width: 100%; transition: all 0.2s;"
                onmouseover="this.style.background='rgba(59, 130, 246, 0.45)'"
                onmouseout="this.style.background='rgba(59, 130, 246, 0.25)'">
          📋 '${node.name}' 전체 과제 (${projects.length}건) 목록 필터링 ➔
        </button>
      </div>
    `;

    return `
      <div class="map-node-popup-content" style="min-width: 260px; max-width: 320px; max-height: 380px; overflow-y: auto; font-family: inherit; padding-right: 2px;">
        <div style="font-size: 13px; font-weight: 700; color: ${isUni ? '#38bdf8' : '#a78bfa'};">
          ${isUni ? '🏛️ ' : '🏢 '} ${node.name}
        </div>
        <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
          📍 ${node.city || ''}, ${node.country || ''} (총 ${projects.length}건 최근 산학 R&D 과제)
        </div>
        <div class="map-popup-projects-list">
          ${projectListHtml}
        </div>
        ${toggleMoreBtn}
        ${filterButtonHtml}
      </div>
    `;
  }

  updateLOD() {
    if (this.canvasLayer) this.canvasLayer.draw();
  }

  clearFocus() {
    this.focusedNodeKey = null;
    this.hoveredNodeKey = null;
    this.hoveredPairKey = null;
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
    if (this.canvasLayer) this.canvasLayer.draw();
  }

  resize() {
    if (this.map) {
      this.map.invalidateSize();
      if (this.canvasLayer) this.canvasLayer._reset();
    }
  }
}

window.MapView = MapView;
