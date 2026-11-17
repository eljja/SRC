/**
 * KGCanvasRenderer — High-FPS WebGL2 GPU-Instanced Graph Engine + 2D Canvas Label Overlay
 * (with automatic 2D Canvas fallback when WebGL2 float textures are unavailable).
 *
 * Features:
 * - GPU-instanced edges & nodes via RG32F position texture (zero buffer rebuilds per frame)
 * - Analytical pixel-space shader anti-aliasing for razor-sharp zoom at any scale
 * - Off-main-thread Web Worker Barnes-Hut physics (js/graphWorker.js)
 * - Louvain 8-color vibrant cluster palette + entity/type color toggle
 * - Collision-culled progressive zoom labels on HiDPI 2D overlay canvas
 * - Opening radial expansion animation for pre-computed layouts
 */

const KG_COMMUNITY_PALETTE = [
  '#3b82f6', // 0: Electric Blue
  '#f97316', // 1: Coral Orange
  '#10b981', // 2: Emerald Green
  '#f59e0b', // 3: Amber Gold
  '#ec4899', // 4: Neon Pink
  '#8b5cf6', // 5: Deep Indigo/Violet
  '#06b6d4', // 6: Sky Cyan
  '#f43f5e'  // 7: Crimson Rose
];
const KG_MUTED_COLOR = '#64748b';

function kgHexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0.58, 0.64, 0.72];
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [0.58, 0.64, 0.72];
  const num = parseInt(clean, 16);
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255
  ];
}

class KGCanvasRenderer {
  constructor(stageEl, callbacks = {}) {
    this.stageEl = stageEl;
    this.callbacks = callbacks; // { onNodeClick, onNodeDblClick, onHoverChange }

    this.glCanvas = null;
    this.ovCanvas = null;
    this.tooltipEl = null;
    this.legendEl = null;

    this.gl = null;
    this.useWebGL = false;
    this.ovCtx = null;

    this.width = 900;
    this.height = 600;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Graph data
    this.nodes = [];
    this.links = [];
    this.nodeIndexById = new Map();
    this.adjacency = new Map();
    this.communities = [];

    // Typed buffers synced with Worker
    this.xy = new Float32Array(0); // normalized [-1, 1] * openExpand
    this.rawXy = new Float32Array(0);
    this.openExpand = 1.0;
    this.openAnimId = null;

    // Visual & Interaction states
    this.cam = { x: 0, y: 0, scale: 1.0 };
    this.colorMode = 'community'; // 'community' | 'type'
    this.labelMode = 'auto';      // 'auto' | 'always'
    this.selectedIdx = -1;
    this.hoveredIdx = -1;
    this.neighborSet = new Set();
    this.hiddenGroups = new Set();

    // Drag/Pan state
    this.dragState = null;
    this.rafPending = false;
    this.worker = null;

    // WebGL resources
    this.edgeProg = null;
    this.nodeProg = null;
    this.posTex = null;
    this.texW = 128;
    this.texH = 1;
    this.texBuf = new Float32Array(0);
    this.quadVbo = null;
    this.edgeInstVbo = null;
    this.edgeInstData = new Float32Array(0);
    this.nodeInstVbo = null;
    this.nodeInstData = new Float32Array(0);

    this._initStage();
    this._initWorker();
  }

  _initStage() {
    this.stageEl.innerHTML = '';
    this.stageEl.classList.add('kg-stage');

    this.glCanvas = document.createElement('canvas');
    this.glCanvas.className = 'kg-gl-canvas';

    this.ovCanvas = document.createElement('canvas');
    this.ovCanvas.className = 'kg-ov-canvas';

    this.tooltipEl = document.createElement('div');
    this.tooltipEl.className = 'kg-tooltip';
    this.tooltipEl.style.display = 'none';

    this.legendEl = document.createElement('div');
    this.legendEl.className = 'kg-legend-drawer';
    this.legendEl.style.display = 'none';

    this.stageEl.appendChild(this.glCanvas);
    this.stageEl.appendChild(this.ovCanvas);
    this.stageEl.appendChild(this.tooltipEl);
    this.stageEl.appendChild(this.legendEl);

    this.ovCtx = this.ovCanvas.getContext('2d');
    this._initWebGL2();
    this.resize();
    this._bindEvents();

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => {
        if (this.stageEl.clientWidth > 0 && this.stageEl.clientHeight > 0) {
          this.resize();
        }
      });
      this._resizeObserver.observe(this.stageEl);
    }
  }

  _initWebGL2() {
    try {
      const gl = this.glCanvas.getContext('webgl2', {
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      if (!gl) return;

      // Test RG32F texture creation
      const testTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, testTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 2, 2, 0, gl.RG, gl.FLOAT, new Float32Array(8));
      const err = gl.getError();
      gl.deleteTexture(testTex);
      if (err !== gl.NO_ERROR) return;

      this.gl = gl;
      this._buildShaders(gl);
      this.useWebGL = true;
    } catch (e) {
      console.warn('WebGL2 unavailable, using 2D Canvas fallback:', e);
      this.useWebGL = false;
    }
  }

  _compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile failed');
    }
    return sh;
  }

  _linkProgram(gl, vsSrc, fsSrc) {
    const prog = gl.createProgram();
    gl.attachShader(prog, this._compileShader(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, this._compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'Program link failed');
    }
    return prog;
  }

  _buildShaders(gl) {
    // Shared quad VBO (triangle strip: 4 vertices)
    this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, -1,
      0,  1,
      1, -1,
      1,  1
    ]), gl.STATIC_DRAW);

    // Node unit quad VBO
    this.nodeQuadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeQuadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      -1,  1,
       1, -1,
       1,  1
    ]), gl.STATIC_DRAW);

    const edgeVS = `#version 300 es
      precision highp float;
      layout(location = 0) in vec2 aCorner;
      layout(location = 1) in float aSrc;
      layout(location = 2) in float aDst;
      layout(location = 3) in float aWidth;
      layout(location = 4) in vec4 aCol;

      uniform sampler2D uPos;
      uniform int uTexW;
      uniform vec2 uRes;
      uniform vec2 uCam;
      uniform float uWorldPx;
      uniform float uScale;

      out float vHW;
      out float vPerp;
      out vec4 vCol;

      vec2 fetchPos(float idx) {
        int i = int(idx + 0.5);
        int y = i / uTexW;
        int x = i - y * uTexW;
        return texelFetch(uPos, ivec2(x, y), 0).rg;
      }

      void main() {
        vec2 w0 = fetchPos(aSrc);
        vec2 w1 = fetchPos(aDst);
        vec2 p0 = (w0 - uCam) * (uWorldPx * uScale);
        vec2 p1 = (w1 - uCam) * (uWorldPx * uScale);
        vec2 dir = p1 - p0;
        float len = max(length(dir), 0.0001);
        vec2 u = dir / len;
        vec2 n = vec2(-u.y, u.x);

        float hw = aWidth * 0.5;
        float ext = hw + 0.75;
        vec2 posPx = p0 + u * (aCorner.x * len) + n * (aCorner.y * ext);

        vHW = hw;
        vPerp = aCorner.y * ext;
        vCol = aCol;
        gl_Position = vec4(posPx.x * 2.0 / uRes.x, -posPx.y * 2.0 / uRes.y, 0.0, 1.0);
      }
    `;

    const edgeFS = `#version 300 es
      precision highp float;
      in float vHW;
      in float vPerp;
      in vec4 vCol;
      out vec4 outColor;
      void main() {
        float aa = clamp(vHW + 0.5 - abs(vPerp), 0.0, 1.0);
        float a = aa * vCol.a;
        if (a < 0.004) discard;
        outColor = vec4(vCol.rgb, a);
      }
    `;

    const nodeVS = `#version 300 es
      precision highp float;
      layout(location = 0) in vec2 aCorner;
      layout(location = 1) in float aIdx;
      layout(location = 2) in float aRadius;
      layout(location = 3) in vec4 aCol;
      layout(location = 4) in float aState; // bitmask/level: 0=dim, 1=normal, 2=hub/neighbor, 3=selected

      uniform sampler2D uPos;
      uniform int uTexW;
      uniform vec2 uRes;
      uniform vec2 uCam;
      uniform float uWorldPx;
      uniform float uScale;

      out vec2 vLocal;
      out float vR;
      out vec4 vCol;
      out float vState;

      void main() {
        int i = int(aIdx + 0.5);
        int y = i / uTexW;
        int x = i - y * uTexW;
        vec2 w = texelFetch(uPos, ivec2(x, y), 0).rg;

        vec2 centerPx = (w - uCam) * (uWorldPx * uScale);
        float zMul = clamp(pow(uScale, 0.58), 0.55, 2.35);
        float r = aRadius * zMul;
        float pad = r + (aState > 2.5 ? 4.5 : 2.0);
        vec2 posPx = centerPx + aCorner * pad;

        vLocal = aCorner * pad;
        vR = r;
        vCol = aCol;
        vState = aState;
        gl_Position = vec4(posPx.x * 2.0 / uRes.x, -posPx.y * 2.0 / uRes.y, 0.0, 1.0);
      }
    `;

    const nodeFS = `#version 300 es
      precision highp float;
      in vec2 vLocal;
      in float vR;
      in vec4 vCol;
      in float vState;
      out vec4 outColor;

      void main() {
        float d = length(vLocal);
        if (vState > 2.5) {
          // Selected / Hovered outer crisp ring + glow
          float disc = clamp(vR - d + 0.6, 0.0, 1.0);
          float ring = clamp(1.4 - abs(d - (vR + 2.6)), 0.0, 1.0);
          vec3 rgb = mix(vCol.rgb, vec3(1.0, 1.0, 1.0), ring * 0.92);
          float a = max(disc * vCol.a, ring * 0.95);
          if (a < 0.005) discard;
          outColor = vec4(rgb, a);
        } else {
          float disc = clamp(vR - d + 0.6, 0.0, 1.0);
          if (disc < 0.005) discard;
          // Crisp dark outline rim for separation
          float rim = smoothstep(vR - 1.5, vR - 0.3, d);
          vec3 rimCol = vState > 1.5 ? vec3(0.95, 0.98, 1.0) : vec3(0.03, 0.05, 0.09);
          float rimMix = vState > 1.5 ? 0.55 : 0.45;
          vec3 rgb = mix(vCol.rgb, rimCol, rim * rimMix);
          outColor = vec4(rgb, disc * vCol.a);
        }
      }
    `;

    this.edgeProg = this._linkProgram(gl, edgeVS, edgeFS);
    this.nodeProg = this._linkProgram(gl, nodeVS, nodeFS);

    this.posTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.posTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.edgeInstVbo = gl.createBuffer();
    this.nodeInstVbo = gl.createBuffer();
  }

  _initWorker() {
    try {
      this.worker = new Worker('js/graphWorker.js?v=8.0.0');
      this.worker.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg) return;
        if (msg.type === 'tick' && msg.xy) {
          const incoming = new Float32Array(msg.xy);
          if (incoming.length === this.rawXy.length) {
            this.rawXy.set(incoming);
            this._applyExpandAndSync();
            this.requestDraw();
          }
        }
      };
    } catch (e) {
      console.warn('Graph Web Worker unavailable:', e);
      this.worker = null;
    }
  }

  resize() {
    if (!this.stageEl) return;
    const w = this.stageEl.clientWidth || 900;
    const h = this.stageEl.clientHeight || 600;
    this.width = w;
    this.height = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    const bw = Math.round(w * this.dpr);
    const bh = Math.round(h * this.dpr);

    this.glCanvas.width = bw;
    this.glCanvas.height = bh;
    this.ovCanvas.width = bw;
    this.ovCanvas.height = bh;

    if (this.gl) {
      this.gl.viewport(0, 0, bw, bh);
    }
    this.requestDraw();
  }

  setData({ nodes, links, layoutModeData = null, typeColorMap = null }) {
    if (this.openAnimId) {
      cancelAnimationFrame(this.openAnimId);
      this.openAnimId = null;
    }

    this.nodes = nodes || [];
    this.links = links || [];
    this._sortedIndices = null;
    this.typeColorMap = typeColorMap || {};
    this.selectedIdx = -1;
    this.hoveredIdx = -1;
    this.neighborSet.clear();
    this.hiddenGroups.clear();

    this.nodeIndexById.clear();
    this.adjacency.clear();

    const N = this.nodes.length;
    this.rawXy = new Float32Array(N * 2);
    this.xy = new Float32Array(N * 2);

    const preNodes = (layoutModeData && layoutModeData.nodes) || {};
    this.communities = (layoutModeData && layoutModeData.communities) || [];

    // 1. Index nodes and assign pre-computed coordinates + Louvain group
    let missingCount = 0;
    const degArr = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const n = this.nodes[i];
      n._idx = i;
      this.nodeIndexById.set(n.id, i);
      this.adjacency.set(i, new Set());
      degArr[i] = Math.max(1, n.val || 1);

      const pre = preNodes[n.id];
      if (pre && pre.length >= 3) {
        this.rawXy[i * 2] = pre[0];
        this.rawXy[i * 2 + 1] = pre[1];
        n.community = pre[2];
        n._hasPre = true;
      } else {
        missingCount++;
        const angle = (i / Math.max(1, N)) * Math.PI * 2;
        const r = 0.25 + 0.5 * ((i * 37) % 100) / 100;
        this.rawXy[i * 2] = Math.cos(angle) * r;
        this.rawXy[i * 2 + 1] = Math.sin(angle) * r;
        n.community = typeof n.community === 'number' ? n.community : 8;
        n._hasPre = false;
      }
    }

    // 2. Build indexed edges
    const validEdges = [];
    for (let i = 0; i < this.links.length; i++) {
      const l = this.links[i];
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      const s = this.nodeIndexById.get(sId);
      const t = this.nodeIndexById.get(tId);
      if (s === undefined || t === undefined || s === t) continue;
      validEdges.push({ s, t, weight: l.weight || 1, raw: l });
      this.adjacency.get(s).add(t);
      this.adjacency.get(t).add(s);
    }
    this.indexedEdges = validEdges;

    // Seed any missing node positions near first neighbor if available
    if (missingCount > 0 && missingCount < N) {
      for (let i = 0; i < N; i++) {
        if (!this.nodes[i]._hasPre) {
          const nb = this.adjacency.get(i);
          if (nb && nb.size > 0) {
            const firstNb = nb.values().next().value;
            this.rawXy[i * 2] = this.rawXy[firstNb * 2] + (Math.random() - 0.5) * 0.08;
            this.rawXy[i * 2 + 1] = this.rawXy[firstNb * 2 + 1] + (Math.random() - 0.5) * 0.08;
            this.nodes[i].community = this.nodes[firstNb].community;
          }
        }
      }
    }

    // Build fallback communities metadata if layoutModeData absent
    if (this.communities.length === 0 && N > 0) {
      const counts = new Map();
      for (const n of this.nodes) {
        counts.set(n.community, (counts.get(n.community) || 0) + 1);
      }
      this.communities = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count], idx) => ({
          id,
          color: idx < KG_COMMUNITY_PALETTE.length ? KG_COMMUNITY_PALETTE[idx] : KG_MUTED_COLOR,
          label: `클러스터 #${idx + 1}`,
          count
        }));
    }

    // 3. Allocate GPU texture & buffers
    if (this.useWebGL && this.gl) {
      const gl = this.gl;
      this.texH = Math.max(1, Math.ceil(N / this.texW));
      this.texBuf = new Float32Array(this.texW * this.texH * 2);
      gl.bindTexture(gl.TEXTURE_2D, this.posTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, this.texW, this.texH, 0, gl.RG, gl.FLOAT, this.texBuf);
    }

    // 4. Send to Worker (if mostly missing coords, warm physics; if pre-computed, stay settled)
    if (this.worker && N > 0) {
      const E = validEdges.length;
      const xyCopy = new Float32Array(this.rawXy);
      const srcArr = new Int32Array(E);
      const dstArr = new Int32Array(E);
      const wArr = new Float32Array(E);
      for (let e = 0; e < E; e++) {
        srcArr[e] = validEdges[e].s;
        dstArr[e] = validEdges[e].t;
        wArr[e] = validEdges[e].weight;
      }
      const needsPhysics = missingCount > N * 0.25;
      this.worker.postMessage({
        type: 'init',
        count: N,
        xy: xyCopy.buffer,
        deg: degArr.buffer,
        edgeSrc: srcArr.buffer,
        edgeDst: dstArr.buffer,
        edgeWeight: wArr.buffer,
        alpha: needsPhysics ? 0.65 : 0.0
      }, [xyCopy.buffer, degArr.buffer, srcArr.buffer, dstArr.buffer, wArr.buffer]);
    }

    // 5. Render legend & trigger ALDB-style opening expansion animation
    this._renderLegend();
    this._rebuildInstanceVisuals();

    if (missingCount <= N * 0.25 && N > 0) {
      this.openExpand = 0.34;
      const start = performance.now();
      const duration = 520;
      const animateOpen = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        this.openExpand = 0.34 + 0.66 * eased;
        this._applyExpandAndSync();
        this.requestDraw();
        if (t < 1) {
          this.openAnimId = requestAnimationFrame(animateOpen);
        } else {
          this.openExpand = 1.0;
          this.openAnimId = null;
        }
      };
      this.openAnimId = requestAnimationFrame(animateOpen);
    } else {
      this.openExpand = 1.0;
      this._applyExpandAndSync();
      this.requestDraw();
    }
  }

  _applyExpandAndSync() {
    const N = this.nodes.length;
    const f = this.openExpand;
    for (let i = 0; i < N * 2; i++) {
      this.xy[i] = this.rawXy[i] * f;
    }
    if (this.useWebGL && this.gl && N > 0) {
      this.texBuf.set(this.xy);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.posTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.texW, this.texH, gl.RG, gl.FLOAT, this.texBuf);
    }
  }

  _getNodeColorHex(n) {
    if (this.colorMode === 'type') {
      if (n.color) return n.color;
      return this.typeColorMap[n.type] || '#94a3b8';
    }
    const g = typeof n.community === 'number' ? n.community : 8;
    return g < KG_COMMUNITY_PALETTE.length ? KG_COMMUNITY_PALETTE[g] : KG_MUTED_COLOR;
  }

  _rebuildInstanceVisuals() {
    const N = this.nodes.length;
    const E = this.indexedEdges ? this.indexedEdges.length : 0;
    const activeIdx = this.hoveredIdx >= 0 ? this.hoveredIdx : this.selectedIdx;
    const hasFocus = activeIdx >= 0;

    // Adaptive edge opacity so dense 15,000-edge views stay transparent & crisp
    const baseEdgeAlpha = E > 4000 ? 0.055 : (E > 1000 ? 0.11 : (E > 250 ? 0.18 : 0.30));
    const focusRgb = hasFocus ? kgHexToRgb(this._getNodeColorHex(this.nodes[activeIdx])) : [0.22, 0.74, 0.97];

    // Edge instance array (7 floats per edge: src, dst, w, r, g, b, a)
    // We sort highlighted edges to the end so they draw on top cleanly
    if (!this.edgeInstData || this.edgeInstData.length < E * 7) {
      this.edgeInstData = new Float32Array(Math.max(1, E) * 7);
    }
    let writePtr = 0;
    const hiEdges = [];

    for (let e = 0; e < E; e++) {
      const edge = this.indexedEdges[e];
      const isHi = hasFocus && (edge.s === activeIdx || edge.t === activeIdx);
      if (isHi) {
        hiEdges.push(edge);
        continue;
      }
      const hidden = this.hiddenGroups.has(this.nodes[edge.s].community) ||
                     this.hiddenGroups.has(this.nodes[edge.t].community);
      const alpha = hidden ? 0.01 : (hasFocus ? 0.025 : baseEdgeAlpha);
      const w = Math.min(3.5, 0.75 + Math.log1p(edge.weight) * 0.45);
      this.edgeInstData[writePtr++] = edge.s;
      this.edgeInstData[writePtr++] = edge.t;
      this.edgeInstData[writePtr++] = w;
      this.edgeInstData[writePtr++] = 0.58; // Crisp cool slate edge
      this.edgeInstData[writePtr++] = 0.64;
      this.edgeInstData[writePtr++] = 0.74;
      this.edgeInstData[writePtr++] = alpha;
    }

    for (let i = 0; i < hiEdges.length; i++) {
      const edge = hiEdges[i];
      const w = Math.min(4.8, 1.5 + Math.log1p(edge.weight) * 0.65);
      this.edgeInstData[writePtr++] = edge.s;
      this.edgeInstData[writePtr++] = edge.t;
      this.edgeInstData[writePtr++] = w;
      this.edgeInstData[writePtr++] = focusRgb[0];
      this.edgeInstData[writePtr++] = focusRgb[1];
      this.edgeInstData[writePtr++] = focusRgb[2];
      this.edgeInstData[writePtr++] = 0.92;
    }

    // Node instance array (7 floats per node: idx, radius, r, g, b, a, state)
    if (!this.nodeInstData || this.nodeInstData.length < N * 7) {
      this.nodeInstData = new Float32Array(Math.max(1, N) * 7);
    }

    const densityMul = N > 1500 ? 0.56 : (N > 600 ? 0.74 : 1.0);
    for (let i = 0; i < N; i++) {
      const n = this.nodes[i];
      const isHub = n.type === 'category' || n.type === 'subtopic' || n.type === 'sector';
      const baseR = isHub
        ? (N > 1500 ? 9.5 : 12.0)
        : Math.min(12.5, (2.2 + Math.sqrt(n.val || 1) * 1.15) * densityMul);
      const [r, g, b] = kgHexToRgb(this._getNodeColorHex(n));

      const isSelected = i === activeIdx;
      const isNeighbor = hasFocus && this.neighborSet.has(i);
      const isHidden = this.hiddenGroups.has(n.community);

      let alpha = isHidden ? 0.08 : 0.94;
      let state = isHub ? 2.0 : 1.0;

      if (hasFocus) {
        if (isSelected) {
          alpha = 1.0;
          state = 3.0;
        } else if (isNeighbor) {
          alpha = 1.0;
          state = 2.0;
        } else {
          alpha = 0.11;
          state = 0.0;
        }
      }

      const off = i * 7;
      this.nodeInstData[off] = i;
      this.nodeInstData[off + 1] = baseR;
      this.nodeInstData[off + 2] = r;
      this.nodeInstData[off + 3] = g;
      this.nodeInstData[off + 4] = b;
      this.nodeInstData[off + 5] = alpha;
      this.nodeInstData[off + 6] = state;
    }

    if (this.useWebGL && this.gl) {
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeInstVbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.edgeInstData.subarray(0, E * 7), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeInstVbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.nodeInstData.subarray(0, N * 7), gl.DYNAMIC_DRAW);
    }
  }

  requestDraw() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.draw();
    });
  }

  draw() {
    if (this.useWebGL && this.gl) {
      this._drawWebGL();
    } else {
      this._drawCanvas2DFallback();
    }
    this._drawOverlayLabels();
  }

  _drawWebGL() {
    const gl = this.gl;
    const N = this.nodes.length;
    const E = this.indexedEdges ? this.indexedEdges.length : 0;

    gl.clearColor(0.024, 0.035, 0.063, 1.0); // #060910
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (N === 0) return;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const worldPx = Math.min(this.width, this.height) * 0.44;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posTex);

    // 1. Draw Edges
    if (E > 0) {
      gl.useProgram(this.edgeProg);
      gl.uniform1i(gl.getUniformLocation(this.edgeProg, 'uPos'), 0);
      gl.uniform1i(gl.getUniformLocation(this.edgeProg, 'uTexW'), this.texW);
      gl.uniform2f(gl.getUniformLocation(this.edgeProg, 'uRes'), this.width, this.height);
      gl.uniform2f(gl.getUniformLocation(this.edgeProg, 'uCam'), this.cam.x, this.cam.y);
      gl.uniform1f(gl.getUniformLocation(this.edgeProg, 'uWorldPx'), worldPx);
      gl.uniform1f(gl.getUniformLocation(this.edgeProg, 'uScale'), this.cam.scale);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.edgeInstVbo);
      const stride = 7 * 4;
      for (let loc = 1; loc <= 3; loc++) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, stride, (loc - 1) * 4);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, stride, 3 * 4);
      gl.vertexAttribDivisor(4, 1);

      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, E);
    }

    // 2. Draw Nodes
    gl.useProgram(this.nodeProg);
    gl.uniform1i(gl.getUniformLocation(this.nodeProg, 'uPos'), 0);
    gl.uniform1i(gl.getUniformLocation(this.nodeProg, 'uTexW'), this.texW);
    gl.uniform2f(gl.getUniformLocation(this.nodeProg, 'uRes'), this.width, this.height);
    gl.uniform2f(gl.getUniformLocation(this.nodeProg, 'uCam'), this.cam.x, this.cam.y);
    gl.uniform1f(gl.getUniformLocation(this.nodeProg, 'uWorldPx'), worldPx);
    gl.uniform1f(gl.getUniformLocation(this.nodeProg, 'uScale'), this.cam.scale);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeQuadVbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeInstVbo);
    const nStride = 7 * 4;
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, nStride, 0);
    gl.vertexAttribDivisor(1, 1);

    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, nStride, 4);
    gl.vertexAttribDivisor(2, 1);

    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, nStride, 8);
    gl.vertexAttribDivisor(3, 1);

    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, nStride, 24);
    gl.vertexAttribDivisor(4, 1);

    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, N);
  }

  _drawCanvas2DFallback() {
    const ctx = this.glCanvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.fillStyle = '#060910';
    ctx.fillRect(0, 0, this.width, this.height);

    const worldPx = Math.min(this.width, this.height) * 0.44 * this.cam.scale;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const E = this.indexedEdges ? this.indexedEdges.length : 0;

    for (let e = 0; e < E; e++) {
      const off = e * 7;
      const s = this.edgeInstData[off] | 0;
      const t = this.edgeInstData[off + 1] | 0;
      const x1 = cx + (this.xy[s * 2] - this.cam.x) * worldPx;
      const y1 = cy + (this.xy[s * 2 + 1] - this.cam.y) * worldPx;
      const x2 = cx + (this.xy[t * 2] - this.cam.x) * worldPx;
      const y2 = cy + (this.xy[t * 2 + 1] - this.cam.y) * worldPx;
      ctx.strokeStyle = `rgba(${Math.round(this.edgeInstData[off + 3] * 255)},${Math.round(this.edgeInstData[off + 4] * 255)},${Math.round(this.edgeInstData[off + 5] * 255)},${this.edgeInstData[off + 6]})`;
      ctx.lineWidth = this.edgeInstData[off + 2];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const zMul = Math.max(0.55, Math.min(2.35, Math.pow(this.cam.scale, 0.58)));
    for (let i = 0; i < this.nodes.length; i++) {
      const off = i * 7;
      const sx = cx + (this.xy[i * 2] - this.cam.x) * worldPx;
      const sy = cy + (this.xy[i * 2 + 1] - this.cam.y) * worldPx;
      const r = this.nodeInstData[off + 1] * zMul;
      ctx.fillStyle = `rgba(${Math.round(this.nodeInstData[off + 2] * 255)},${Math.round(this.nodeInstData[off + 3] * 255)},${Math.round(this.nodeInstData[off + 4] * 255)},${this.nodeInstData[off + 5]})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawOverlayLabels() {
    const ctx = this.ovCtx;
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    const N = this.nodes.length;
    if (N === 0) {
      ctx.restore();
      return;
    }

    const worldPx = Math.min(this.width, this.height) * 0.44 * this.cam.scale;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const zMul = Math.max(0.55, Math.min(2.35, Math.pow(this.cam.scale, 0.58)));
    const activeIdx = this.hoveredIdx >= 0 ? this.hoveredIdx : this.selectedIdx;
    const hasFocus = activeIdx >= 0;

    // 16px spatial grid for overlap-free labels
    const cellPx = 16;
    const cols = Math.ceil(this.width / cellPx) + 1;
    const rows = Math.ceil(this.height / cellPx) + 1;
    const grid = new Uint8Array(cols * rows);

    const canPlace = (x, y, w, h) => {
      const c0 = Math.max(0, Math.floor(x / cellPx));
      const c1 = Math.min(cols - 1, Math.floor((x + w) / cellPx));
      const r0 = Math.max(0, Math.floor(y / cellPx));
      const r1 = Math.min(rows - 1, Math.floor((y + h) / cellPx));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (grid[r * cols + c]) return false;
        }
      }
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          grid[r * cols + c] = 1;
        }
      }
      return true;
    };

    const drawLabel = (idx, priority = false) => {
      const n = this.nodes[idx];
      const sx = cx + (this.xy[idx * 2] - this.cam.x) * worldPx;
      const sy = cy + (this.xy[idx * 2 + 1] - this.cam.y) * worldPx;
      if (sx < -60 || sx > this.width + 60 || sy < -30 || sy > this.height + 30) return false;

      const isHub = n.type === 'category' || n.type === 'subtopic' || n.type === 'sector';
      const off = idx * 7;
      const r = (this.nodeInstData[off + 1] || 5) * zMul;
      const text = n.label && n.label.length > 26 ? n.label.slice(0, 24) + '…' : (n.label || '');
      if (!text) return false;

      const fontSize = idx === activeIdx ? 12.5 : (isHub ? 11.5 : 10.5);
      ctx.font = `${(isHub || idx === activeIdx) ? '700' : '600'} ${fontSize}px "Inter", "Noto Sans KR", sans-serif`;
      const tw = ctx.measureText(text).width;
      const tx = sx + r + 5;
      const ty = sy + fontSize * 0.35;

      if (!priority && !canPlace(tx - 2, sy - fontSize * 0.6, tw + 6, fontSize + 4)) {
        return false;
      }

      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(6, 9, 16, 0.92)';
      ctx.strokeText(text, tx, ty);

      ctx.fillStyle = idx === activeIdx ? '#38bdf8' : (isHub ? '#fef08a' : '#f1f5f9');
      ctx.fillText(text, tx, ty);
      return true;
    };

    // Priority 1: Focused / Hovered node + neighbors
    if (hasFocus) {
      drawLabel(activeIdx, true);
      let drawnNb = 0;
      const nbSorted = Array.from(this.neighborSet).sort((a, b) => (this.nodes[b].val || 0) - (this.nodes[a].val || 0));
      for (const nbIdx of nbSorted) {
        if (drawnNb >= 45) break;
        if (drawLabel(nbIdx, false)) drawnNb++;
      }
      ctx.restore();
      return;
    }

    // Priority 2: Overview vs Progressive Zoom labels
    // At overview (scale < 1.25) in 'auto' mode, keep canvas uncluttered just like ALDB!
    const showOverviewHubs = this.labelMode === 'always' || this.cam.scale >= 1.18 || N <= 80;
    if (!showOverviewHubs) {
      ctx.restore();
      return;
    }

    // Sort candidates by hub status & project volume descending
    if (!this._sortedIndices || this._sortedIndices.length !== N) {
      this._sortedIndices = Array.from({ length: N }, (_, i) => i).sort((a, b) => {
        const ha = (this.nodes[a].type === 'category' || this.nodes[a].type === 'subtopic' || this.nodes[a].type === 'sector') ? 1 : 0;
        const hb = (this.nodes[b].type === 'category' || this.nodes[b].type === 'subtopic' || this.nodes[b].type === 'sector') ? 1 : 0;
        if (ha !== hb) return hb - ha;
        return (this.nodes[b].val || 0) - (this.nodes[a].val || 0);
      });
    }

    const maxLabels = this.cam.scale >= 2.2 ? 220 : (this.cam.scale >= 1.4 ? 110 : 45);
    let drawn = 0;
    for (let k = 0; k < this._sortedIndices.length && drawn < maxLabels; k++) {
      const idx = this._sortedIndices[k];
      if (this.hiddenGroups.has(this.nodes[idx].community)) continue;
      if (drawLabel(idx, false)) drawn++;
    }

    ctx.restore();
  }

  _hitTest(sx, sy) {
    const N = this.nodes.length;
    if (N === 0) return -1;
    const worldPx = Math.min(this.width, this.height) * 0.44 * this.cam.scale;
    const cx = this.width * 0.5;
    const cy = this.height * 0.5;
    const zMul = Math.max(0.55, Math.min(2.35, Math.pow(this.cam.scale, 0.58)));

    let bestIdx = -1;
    let bestDist2 = Infinity;

    for (let i = N - 1; i >= 0; i--) {
      const nx = cx + (this.xy[i * 2] - this.cam.x) * worldPx;
      const ny = cy + (this.xy[i * 2 + 1] - this.cam.y) * worldPx;
      const dx = sx - nx;
      const dy = sy - ny;
      const r = (this.nodeInstData[i * 7 + 1] || 5) * zMul + 5;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestDist2) {
        bestDist2 = d2;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  _screenToWorld(sx, sy) {
    const worldPx = Math.min(this.width, this.height) * 0.44 * this.cam.scale;
    return {
      wx: (sx - this.width * 0.5) / worldPx + this.cam.x,
      wy: (sy - this.height * 0.5) / worldPx + this.cam.y
    };
  }

  _bindEvents() {
    const canvas = this.glCanvas;

    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = this._hitTest(sx, sy);

      this.dragState = {
        mode: hit >= 0 ? 'node' : 'pan',
        nodeIdx: hit,
        startX: sx,
        startY: sy,
        lastX: sx,
        lastY: sy,
        moved: false
      };

      if (hit >= 0 && this.worker) {
        const w = this._screenToWorld(sx, sy);
        this.worker.postMessage({ type: 'pin', idx: hit, x: w.wx, y: w.wy });
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.dragState) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dx = sx - this.dragState.lastX;
      const dy = sy - this.dragState.lastY;

      if (Math.hypot(sx - this.dragState.startX, sy - this.dragState.startY) > 3) {
        this.dragState.moved = true;
      }

      if (this.dragState.mode === 'pan') {
        const worldPx = Math.min(this.width, this.height) * 0.44 * this.cam.scale;
        this.cam.x -= dx / worldPx;
        this.cam.y -= dy / worldPx;
        this.requestDraw();
      } else if (this.dragState.mode === 'node' && this.dragState.nodeIdx >= 0) {
        const w = this._screenToWorld(sx, sy);
        const idx = this.dragState.nodeIdx;
        this.rawXy[idx * 2] = w.wx;
        this.rawXy[idx * 2 + 1] = w.wy;
        this._applyExpandAndSync();
        if (this.worker) {
          this.worker.postMessage({ type: 'move', idx, x: w.wx, y: w.wy });
        }
        this.requestDraw();
      }

      this.dragState.lastX = sx;
      this.dragState.lastY = sy;
    });

    window.addEventListener('mouseup', () => {
      if (!this.dragState) return;
      this._lastDragMoved = this.dragState.moved;
      if (this.dragState.mode === 'node' && this.dragState.nodeIdx >= 0 && this.worker) {
        this.worker.postMessage({ type: 'unpin', idx: this.dragState.nodeIdx });
      }
      this.dragState = null;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.dragState) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = this._hitTest(sx, sy);

      if (hit !== this.hoveredIdx) {
        this.hoveredIdx = hit;
        if (hit >= 0) {
          this.neighborSet = this.adjacency.get(hit) || new Set();
        } else if (this.selectedIdx >= 0) {
          this.neighborSet = this.adjacency.get(this.selectedIdx) || new Set();
        } else {
          this.neighborSet.clear();
        }
        this._rebuildInstanceVisuals();
        this.requestDraw();
      }

      if (hit >= 0) {
        canvas.style.cursor = 'pointer';
        this._showTooltip(this.nodes[hit], sx, sy);
      } else {
        canvas.style.cursor = 'grab';
        this.tooltipEl.style.display = 'none';
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.tooltipEl.style.display = 'none';
      if (this.hoveredIdx >= 0) {
        this.hoveredIdx = -1;
        this.neighborSet = this.selectedIdx >= 0 ? (this.adjacency.get(this.selectedIdx) || new Set()) : new Set();
        this._rebuildInstanceVisuals();
        this.requestDraw();
      }
    });

    canvas.addEventListener('click', (e) => {
      if (this._lastDragMoved) {
        this._lastDragMoved = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const hit = this._hitTest(sx, sy);

      if (hit >= 0) {
        const isSelected = this.selectNodeByIndex(hit);
        if (isSelected) {
          if (this.callbacks.onNodeClick) {
            this.callbacks.onNodeClick(this.nodes[hit]);
          }
        } else {
          if (this.callbacks.onClearSelection) {
            this.callbacks.onClearSelection();
          }
        }
      } else {
        this.clearSelection();
        if (this.callbacks.onClearSelection) {
          this.callbacks.onClearSelection();
        }
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      const rect = canvas.getBoundingClientRect();
      const hit = this._hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (hit >= 0 && this.callbacks.onNodeDblClick) {
        this.callbacks.onNodeDblClick(this.nodes[hit]);
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const before = this._screenToWorld(sx, sy);
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.cam.scale = Math.max(0.25, Math.min(12.0, this.cam.scale * factor));
      const after = this._screenToWorld(sx, sy);
      this.cam.x += before.wx - after.wx;
      this.cam.y += before.wy - after.wy;
      this._rebuildInstanceVisuals();
      this.requestDraw();
    }, { passive: false });
  }

  _showTooltip(node, sx, sy) {
    if (!node) return;
    const color = this._getNodeColorHex(node);
    this.tooltipEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#f8fafc;">
        <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
        <span>${node.label}</span>
      </div>
      <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">
        연계 과제 <strong>${node.val || 1}건</strong> · 클러스터 #${(node.community || 0) + 1}
      </div>
    `;
    this.tooltipEl.style.display = 'block';
    this.tooltipEl.style.left = `${Math.min(this.width - 210, sx + 14)}px`;
    this.tooltipEl.style.top = `${Math.max(12, sy - 16)}px`;
  }

  _renderLegend() {
    if (!this.legendEl) return;
    if (!this.communities || this.communities.length === 0) {
      this.legendEl.innerHTML = '';
      return;
    }

    const itemsHtml = this.communities.slice(0, 8).map(c => {
      const hidden = this.hiddenGroups.has(c.id);
      return `
        <button type="button" class="kg-legend-item ${hidden ? 'muted' : ''}" data-gid="${c.id}">
          <span class="kg-legend-dot" style="background:${c.color};"></span>
          <span class="kg-legend-label" title="${c.label}">${c.label}</span>
          <span class="kg-legend-count">${c.count}</span>
        </button>
      `;
    }).join('');

    this.legendEl.innerHTML = `
      <div class="kg-legend-header">
        <span>🎨 Louvain 협력 군집 TOP ${Math.min(8, this.communities.length)}</span>
        <span style="font-size:10px;color:#64748b;">(${this.nodes.length.toLocaleString()} 노드 · ${this.indexedEdges ? this.indexedEdges.length.toLocaleString() : 0} 엣지)</span>
      </div>
      <div class="kg-legend-list">${itemsHtml}</div>
    `;

    this.legendEl.querySelectorAll('.kg-legend-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = parseInt(btn.getAttribute('data-gid'), 10);
        if (this.hiddenGroups.has(gid)) {
          this.hiddenGroups.delete(gid);
        } else {
          this.hiddenGroups.add(gid);
        }
        this._renderLegend();
        this._rebuildInstanceVisuals();
        this.requestDraw();
      });
    });
  }

  toggleLegend() {
    if (!this.legendEl) return false;
    const isHidden = this.legendEl.style.display === 'none' || !this.legendEl.style.display;
    this.legendEl.style.display = isHidden ? 'block' : 'none';
    return isHidden;
  }

  setColorMode(mode) {
    this.colorMode = mode;
    this._rebuildInstanceVisuals();
    this.requestDraw();
  }

  setLabelMode(mode) {
    this.labelMode = mode;
    this.requestDraw();
  }

  selectNodeByIndex(idx) {
    if (this.selectedIdx === idx) {
      this.clearSelection();
      return false;
    }
    this.selectedIdx = idx;
    this.neighborSet = this.adjacency.get(idx) || new Set();
    this._rebuildInstanceVisuals();
    this.requestDraw();
    return true;
  }

  focusNodeById(id) {
    const idx = this.nodeIndexById.get(id);
    if (idx === undefined) return null;
    this.selectedIdx = idx;
    this.neighborSet = this.adjacency.get(idx) || new Set();
    this._rebuildInstanceVisuals();
    this.requestDraw();
    return this.nodes[idx];
  }

  focusNodeByQuery(query) {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    const hit = this.nodes.find(n => (n.label || '').toLowerCase().includes(q) || (n.name || '').toLowerCase().includes(q));
    if (!hit) return null;
    const idx = hit._idx;
    this.selectedIdx = idx;
    this.neighborSet = this.adjacency.get(idx) || new Set();
    this.cam.x = this.xy[idx * 2];
    this.cam.y = this.xy[idx * 2 + 1];
    this.cam.scale = Math.max(this.cam.scale, 2.1);
    this._rebuildInstanceVisuals();
    this.requestDraw();
    return hit;
  }

  clearSelection() {
    this.selectedIdx = -1;
    this.neighborSet.clear();
    this._rebuildInstanceVisuals();
    this.requestDraw();
  }

  zoomBy(factor) {
    this.cam.scale = Math.max(0.25, Math.min(12.0, this.cam.scale * factor));
    this.requestDraw();
  }

  resetZoomFit() {
    this.cam = { x: 0, y: 0, scale: 1.0 };
    this.requestDraw();
  }

  reheat() {
    if (this.worker) {
      this.worker.postMessage({ type: 'reheat', alpha: 0.75 });
    }
  }

  destroy() {
    if (this.openAnimId) cancelAnimationFrame(this.openAnimId);
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
      this.worker.terminate();
      this.worker = null;
    }
  }
}

window.KGCanvasRenderer = KGCanvasRenderer;
window.KG_COMMUNITY_PALETTE = KG_COMMUNITY_PALETTE;
