/**
 * Web Worker: Off-main-thread Barnes-Hut ForceAtlas2 Physics Engine
 * Uses flat TypedArrays (zero GC pressure per tick) and zero-copy Transferables.
 * Coordinates are exchanged in normalized [-1, 1] world space (internally scaled by WORLD_SCALE = 500).
 */

const WORLD_SCALE = 500.0;
const THETA2 = 0.81; // Barnes-Hut approximation threshold squared (theta = 0.9)

let N = 0;
let E = 0;
let posX = new Float64Array(0);
let posY = new Float64Array(0);
let velX = new Float64Array(0);
let velY = new Float64Array(0);
let forceX = new Float64Array(0);
let forceY = new Float64Array(0);
let deg = new Float64Array(0);
let pinned = new Uint8Array(0);

let edgeSrc = new Int32Array(0);
let edgeDst = new Int32Array(0);
let edgeWeight = new Float32Array(0);

// Flat-array Barnes-Hut Quadtree buffers
let maxCells = 0;
let qCx = new Float64Array(0);
let qCy = new Float64Array(0);
let qHalf = new Float64Array(0);
let qMass = new Float64Array(0);
let qComX = new Float64Array(0);
let qComY = new Float64Array(0);
let qBody = new Int32Array(0);
let qChild = new Int32Array(0);
let qNext = new Int32Array(0);
const travStack = new Int32Array(256);

let alpha = 0;
let running = false;
let timerId = null;

function ensureQuadBuffers(nodeCount) {
  const needed = Math.max(512, nodeCount * 6 + 64);
  if (needed > maxCells) {
    maxCells = needed;
    qCx = new Float64Array(maxCells);
    qCy = new Float64Array(maxCells);
    qHalf = new Float64Array(maxCells);
    qMass = new Float64Array(maxCells);
    qComX = new Float64Array(maxCells);
    qComY = new Float64Array(maxCells);
    qBody = new Int32Array(maxCells);
    qChild = new Int32Array(maxCells * 4);
  }
  if (qNext.length < nodeCount) {
    qNext = new Int32Array(nodeCount);
  }
}

function allocCell(cx, cy, half, cellCountRef) {
  const idx = cellCountRef.count;
  if (idx >= maxCells) return -1;
  cellCountRef.count += 1;
  qCx[idx] = cx;
  qCy[idx] = cy;
  qHalf[idx] = half;
  qMass[idx] = 0;
  qComX[idx] = 0;
  qComY[idx] = 0;
  qBody[idx] = -1;
  const base = idx * 4;
  qChild[base] = -1;
  qChild[base + 1] = -1;
  qChild[base + 2] = -1;
  qChild[base + 3] = -1;
  return idx;
}

function insertBody(root, bodyIdx, cellCountRef) {
  let cell = root;
  let depth = 0;
  const bx = posX[bodyIdx];
  const by = posY[bodyIdx];

  while (depth < 24) {
    const existing = qBody[cell];
    if (existing === -1 && qChild[cell * 4] === -1 && qChild[cell * 4 + 1] === -1 &&
        qChild[cell * 4 + 2] === -1 && qChild[cell * 4 + 3] === -1) {
      // Empty leaf
      qBody[cell] = bodyIdx;
      return;
    }

    if (existing >= 0) {
      // Occupied leaf: check if practically coincident
      const ex = posX[existing];
      const ey = posY[existing];
      if (Math.abs(bx - ex) < 1e-4 && Math.abs(by - ey) < 1e-4) {
        qNext[bodyIdx] = qNext[existing];
        qNext[existing] = bodyIdx;
        return;
      }

      // Split leaf into quadrants and re-insert existing body
      qBody[cell] = -2; // internal
      const subHalf = qHalf[cell] * 0.5;
      const quadExisting = (ex >= qCx[cell] ? 1 : 0) + (ey >= qCy[cell] ? 2 : 0);
      const cIdxEx = cell * 4 + quadExisting;
      if (qChild[cIdxEx] === -1) {
        const nx = qCx[cell] + (quadExisting & 1 ? subHalf : -subHalf);
        const ny = qCy[cell] + (quadExisting & 2 ? subHalf : -subHalf);
        const child = allocCell(nx, ny, subHalf, cellCountRef);
        if (child === -1) return;
        qChild[cIdxEx] = child;
      }
      // Move linked list head cleanly
      qBody[qChild[cIdxEx]] = existing;
    }

    // Descend for new body
    qBody[cell] = -2;
    const subHalf = qHalf[cell] * 0.5;
    const quad = (bx >= qCx[cell] ? 1 : 0) + (by >= qCy[cell] ? 2 : 0);
    const cIdx = cell * 4 + quad;
    if (qChild[cIdx] === -1) {
      const nx = qCx[cell] + (quad & 1 ? subHalf : -subHalf);
      const ny = qCy[cell] + (quad & 2 ? subHalf : -subHalf);
      const child = allocCell(nx, ny, subHalf, cellCountRef);
      if (child === -1) return;
      qChild[cIdx] = child;
      qBody[child] = bodyIdx;
      return;
    }
    cell = qChild[cIdx];
    depth += 1;
  }
}

function buildQuadtree() {
  if (N === 0) return 0;
  ensureQuadBuffers(N);
  qNext.fill(-1);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) {
    const x = posX[i];
    const y = posY[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const half = Math.max((maxX - minX) * 0.5, (maxY - minY) * 0.5, 10.0) + 1.0;
  const cellCountRef = { count: 0 };
  const root = allocCell(cx, cy, half, cellCountRef);

  for (let i = 0; i < N; i++) {
    insertBody(root, i, cellCountRef);
  }

  // Bottom-up mass & center-of-mass aggregation (cells allocated parent-before-child)
  for (let c = cellCountRef.count - 1; c >= 0; c--) {
    if (qBody[c] >= 0) {
      let mSum = 0, xSum = 0, ySum = 0;
      let cur = qBody[c];
      while (cur !== -1) {
        const m = deg[cur] + 1.0;
        mSum += m;
        xSum += posX[cur] * m;
        ySum += posY[cur] * m;
        cur = qNext[cur];
      }
      qMass[c] = mSum;
      qComX[c] = xSum / mSum;
      qComY[c] = ySum / mSum;
    } else if (qBody[c] === -2) {
      let mSum = 0, xSum = 0, ySum = 0;
      const base = c * 4;
      for (let k = 0; k < 4; k++) {
        const ch = qChild[base + k];
        if (ch !== -1 && qMass[ch] > 0) {
          const cm = qMass[ch];
          mSum += cm;
          xSum += qComX[ch] * cm;
          ySum += qComY[ch] * cm;
        }
      }
      qMass[c] = mSum;
      if (mSum > 0) {
        qComX[c] = xSum / mSum;
        qComY[c] = ySum / mSum;
      }
    }
  }

  return cellCountRef.count;
}

function stepPhysics() {
  if (N === 0) return;

  forceX.fill(0);
  forceY.fill(0);

  const cellCount = buildQuadtree();
  const kr = (48.0 / Math.max(1.0, Math.sqrt(N) / 10.0)) * alpha;
  const ka = 0.24 * alpha;
  const kg = 0.035 * alpha;

  // 1. Barnes-Hut O(N log N) degree-weighted repulsion
  if (cellCount > 0) {
    for (let i = 0; i < N; i++) {
      if (pinned[i]) continue;
      const px = posX[i];
      const py = posY[i];
      const mi = deg[i] + 1.0;

      let sp = 0;
      travStack[sp++] = 0; // root

      while (sp > 0) {
        const c = travStack[--sp];
        const mCell = qMass[c];
        if (mCell <= 0) continue;

        const dx = px - qComX[c];
        const dy = py - qComY[c];
        const d2 = dx * dx + dy * dy + 16.0;
        const size = qHalf[c] * 2.0;

        if (qBody[c] >= 0) {
          if (qBody[c] === i && qNext[i] === -1) continue;
          const f = kr * (mi * mCell) / d2;
          forceX[i] += f * dx;
          forceY[i] += f * dy;
        } else if ((size * size) < THETA2 * d2) {
          const f = kr * (mi * mCell) / d2;
          forceX[i] += f * dx;
          forceY[i] += f * dy;
        } else {
          const base = c * 4;
          for (let k = 0; k < 4; k++) {
            const ch = qChild[base + k];
            if (ch !== -1 && sp < travStack.length) {
              travStack[sp++] = ch;
            }
          }
        }
      }
    }
  }

  // 2. Degree-biased LinLog edge attraction
  for (let e = 0; e < E; e++) {
    const s = edgeSrc[e];
    const t = edgeDst[e];
    const dx = posX[t] - posX[s];
    const dy = posY[t] - posY[s];
    const dist = Math.sqrt(dx * dx + dy * dy) + 1e-6;
    const minDeg = Math.max(1.0, Math.min(deg[s], deg[t]));
    const w = edgeWeight[e];
    const att = ka * (Math.sqrt(w) / Math.sqrt(minDeg)) * Math.log1p(dist) / dist;
    const fx = att * dx;
    const fy = att * dy;
    forceX[s] += fx;
    forceY[s] += fy;
    forceX[t] -= fx;
    forceY[t] -= fy;
  }

  // 3. Central gravity & integration with velocity decay (0.42)
  const damp = 0.58;
  for (let i = 0; i < N; i++) {
    if (pinned[i]) {
      velX[i] = 0;
      velY[i] = 0;
      continue;
    }
    const mi = deg[i] + 1.0;
    const gx = -kg * mi * posX[i];
    const gy = -kg * mi * posY[i];

    velX[i] = (velX[i] + forceX[i] + gx) * damp;
    velY[i] = (velY[i] + forceY[i] + gy) * damp;

    // Speed clamp to prevent jitter
    const vMag = Math.sqrt(velX[i] * velX[i] + velY[i] * velY[i]);
    if (vMag > 25.0) {
      const s = 25.0 / vMag;
      velX[i] *= s;
      velY[i] *= s;
    }

    posX[i] += velX[i];
    posY[i] += velY[i];
  }

  alpha *= 0.978;
}

function emitPositions() {
  const out = new Float32Array(N * 2);
  const invScale = 1.0 / WORLD_SCALE;
  for (let i = 0; i < N; i++) {
    out[i * 2] = posX[i] * invScale;
    out[i * 2 + 1] = posY[i] * invScale;
  }
  self.postMessage({ type: 'tick', xy: out.buffer, alpha }, [out.buffer]);
}

function loop() {
  if (!running) return;
  stepPhysics();
  emitPositions();

  let anyPinned = false;
  for (let i = 0; i < N; i++) {
    if (pinned[i]) {
      anyPinned = true;
      break;
    }
  }

  if (alpha > 0.008 || anyPinned) {
    timerId = setTimeout(loop, 16);
  } else {
    running = false;
    timerId = null;
    self.postMessage({ type: 'settled' });
  }
}

self.onmessage = function (ev) {
  const msg = ev.data;
  if (!msg) return;

  if (msg.type === 'init') {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    N = msg.count | 0;
    const xyIn = new Float32Array(msg.xy);
    const degIn = new Float32Array(msg.deg);
    edgeSrc = new Int32Array(msg.edgeSrc);
    edgeDst = new Int32Array(msg.edgeDst);
    edgeWeight = new Float32Array(msg.edgeWeight);
    E = edgeSrc.length;

    posX = new Float64Array(N);
    posY = new Float64Array(N);
    velX = new Float64Array(N);
    velY = new Float64Array(N);
    forceX = new Float64Array(N);
    forceY = new Float64Array(N);
    deg = new Float64Array(N);
    pinned = new Uint8Array(N);

    for (let i = 0; i < N; i++) {
      posX[i] = xyIn[i * 2] * WORLD_SCALE;
      posY[i] = xyIn[i * 2 + 1] * WORLD_SCALE;
      deg[i] = degIn[i];
    }

    alpha = typeof msg.alpha === 'number' ? msg.alpha : 0.0;
    if (alpha > 0.008) {
      running = true;
      loop();
    } else {
      running = false;
    }
  } else if (msg.type === 'reheat') {
    alpha = typeof msg.alpha === 'number' ? msg.alpha : 0.75;
    if (!running && N > 0) {
      running = true;
      loop();
    }
  } else if (msg.type === 'pin') {
    const idx = msg.idx | 0;
    if (idx >= 0 && idx < N) {
      pinned[idx] = 1;
      posX[idx] = msg.x * WORLD_SCALE;
      posY[idx] = msg.y * WORLD_SCALE;
      alpha = Math.max(alpha, 0.25);
      if (!running) {
        running = true;
        loop();
      }
    }
  } else if (msg.type === 'move') {
    const idx = msg.idx | 0;
    if (idx >= 0 && idx < N) {
      posX[idx] = msg.x * WORLD_SCALE;
      posY[idx] = msg.y * WORLD_SCALE;
      alpha = Math.max(alpha, 0.22);
      if (!running) {
        running = true;
        loop();
      }
    }
  } else if (msg.type === 'unpin') {
    const idx = msg.idx | 0;
    if (idx >= 0 && idx < N) {
      pinned[idx] = 0;
      alpha = Math.max(alpha, 0.15);
    }
  } else if (msg.type === 'stop') {
    running = false;
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }
};
