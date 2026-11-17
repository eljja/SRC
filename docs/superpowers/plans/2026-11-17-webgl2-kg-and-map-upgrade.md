# WebGL2 Knowledge Graph & High-FPS World Map Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all network/connection visualizations across `index.html`, `venture.html`, and `js/map.js` to Option 3 architecture: offline pre-computed ForceAtlas2 coordinates + Louvain community clustering, off-main-thread Web Worker Barnes-Hut physics, GPU-instanced WebGL2 + 2D Canvas label overlay (`KGCanvasRenderer`), and a HiDPI Canvas gradient-arc overlay for `MapView`.

**Architecture:**
1. Python offline pipeline (`scripts/build_graph_layouts.py`) reads `data/collaborations.json` and `data/ventures.json`, builds exact graphs matching frontend node IDs, detects Louvain communities (`networkx.algorithms.community.louvain_communities`), computes vectorized ForceAtlas2 coordinates, and outputs compact `data/graph_layout_src.json` and `data/graph_layout_venture.json`.
2. Dedicated Web Worker (`js/graphWorker.js`) runs an allocation-free flat-array Barnes-Hut Quadtree simulation ($O(N \log N)$) streaming `Float32Array` coordinates via zero-copy Transferables.
3. Shared `KGCanvasRenderer` (`js/kgRenderer.js`) renders edges and nodes via WebGL2 instancing (`RG32F` `uPos` texture + analytical shader anti-aliasing, with automatic 2D Canvas fallback) and crisp collision-culled labels on a 2D overlay canvas, with community palette coloring (`0..7` vibrant hues + muted peripheral slate), zoom-progressive labeling, in-graph search, and community legend.
4. `js/network.js` and `js/ventureNetwork.js` delegate rendering/physics to `KGCanvasRenderer` while preserving 100% of existing modes, HUDs (Gap analysis, breakdowns), modals, and filters.
5. `js/map.js` replaces thousands of SVG gradient/DOM `L.divIcon` nodes with a custom Leaflet HiDPI `<canvas>` layer (`MapCanvasOverlay`) featuring native Canvas linear-gradient Bezier arcs, glowing nodes, spatial hit-testing, and preserved Popups/Tooltips/LOD toolbar controls.

**Tech Stack:** Python 3.11 (`networkx`, `numpy`, `scipy`, `pytest`), WebGL2 (`GLSL ES 3.00`), HTML5 Canvas 2D, Web Workers (`Transferable`), Leaflet 1.9.4.

## Global Constraints
- Preserve 100% of existing data integrity rules (quarantined records excluded; `isConfirmedCorporateCollab` parity between Python and JS).
- Keep all existing views, filters, search, HUD panels, popups, modals, and URL deep-linking working without regressions.
- Maintain zero external heavy graph library dependencies (custom WebGL2 + Canvas + Worker, matching strict fast-load design).
- All 31 existing `pytest` integrity tests must continue passing; add unit tests for the new layout builder.

## Review Focus
- **Quarantined & unconfirmed records parity**: `build_graph_layouts.py` must apply the exact same quarantine exclusion and `isConfirmedCorporateCollab` / `getSubtopic` logic as `js/dataManager.js`.
- **WebGL2 unavailability fallback**: Headless browsers or older GPUs lacking `WebGL2` or `EXT_color_buffer_float` / float textures must automatically fall back to the 2D Canvas renderer without errors.
- **Filter subset handling**: When user filters (`filteredProjects`) produce a subset of nodes, pre-computed coordinates for matching node IDs load immediately, while edges only link active visible nodes, and Worker handles interactive drag/reheat cleanly.
- **Disconnected / tiny components**: Singletons or degree-1 components must not fly to infinity during ForceAtlas2; place small components on a clean peripheral halo and apply central gravity.
- **Leaflet zoom/pan sync in MapView**: Canvas overlay must synchronize accurately with Leaflet pixel origin during animated zoom, pan, resize, and `worldCopyJump` without drift or ghost tooltips.

---

### Task 1: Offline ForceAtlas2 + Louvain Community Layout Pipeline (`scripts/build_graph_layouts.py`)

**Files:**
- Create: `scripts/build_graph_layouts.py`
- Create: `tests/test_graph_layouts.py`
- Output: `data/graph_layout_src.json`, `data/graph_layout_venture.json`

- [ ] **Step 1: Write failing tests in `tests/test_graph_layouts.py`** verifying:
  - `is_confirmed_corporate_collab` excludes `academic_only`, `-`, `미지정`, and matches `DataManager` rules.
  - `detect_louvain_and_layout` returns finite `(x, y)` coordinates normalized to `[-1, 1]` and valid integer community IDs `>= 0` for connected and disconnected graphs (including singletons and empty graphs).
  - Community IDs are sorted by cluster size descending (`0` is largest).
  - Generated JSON schema contains `metadata` and `modes` with `nodes` (`[x, y, group]`) and `communities`.
- [ ] **Step 2: Run `python -m pytest tests/test_graph_layouts.py -v`** to confirm failure (module does not exist yet).
- [ ] **Step 3: Implement `scripts/build_graph_layouts.py`**:
  - Port `SUBTOPIC_RULES` and `get_subtopic` + `is_confirmed_corporate_collab` faithfully from `js/dataManager.js`.
  - Implement fast NumPy vectorized `compute_forceatlas2_layout(G, communities, iterations=120, seed=42)` using degree-weighted repulsion, LinLog edge attraction, community-centroid initialization, gravity, and clean outer-ring layout for small disconnected islands.
  - Generate `data/graph_layout_src.json` (`topic`, `institution`, and all 7 `subtopic:<category>` modes) and `data/graph_layout_venture.json` (`corporate`, `sector`, `syndicate`).
- [ ] **Step 4: Run `python scripts/build_graph_layouts.py` and `python -m pytest tests/ -v`** to verify generation and all tests pass.
- [ ] **Step 5: Commit Task 1**.

### Task 2: Web Worker Barnes-Hut ForceAtlas2 Physics (`js/graphWorker.js`)

**Files:**
- Create: `js/graphWorker.js`

- [ ] **Step 1: Implement `js/graphWorker.js`**:
  - Allocation-free flat-array Barnes-Hut Quadtree (`Float64Array`, `Int32Array`, `Uint8Array`) supporting up to 16,384+ nodes smoothly.
  - Forces: Barnes-Hut $O(N \log N)$ degree-weighted repulsion (`theta^2 = 0.81`), edge spring/LinLog attraction scaled by `1 / min(deg_a, deg_b)`, central gravity (`0.035`), velocity decay (`0.42`).
  - Zero-copy `Float32Array` buffer transfer (`postMessage({ type: 'tick', xy, alpha }, [xy.buffer])`) throttled to ~60Hz.
  - Support `init`, `reheat`, `pin`, `move`, `unpin`, and `stop` commands.

### Task 3: Shared WebGL2 + 2D Canvas Overlay Graph Renderer (`js/kgRenderer.js`) & Styles (`css/style.css`)

**Files:**
- Create: `js/kgRenderer.js`
- Modify: `css/style.css`

- [ ] **Step 1: Implement `KGCanvasRenderer` in `js/kgRenderer.js`**:
  - Dual stacked canvases (`.kg-gl-canvas` for WebGL2 + `.kg-ov-canvas` for crisp DPR-scaled 2D text labels).
  - WebGL2 instanced edge & node shader programs using `RG32F` `uPos` texture + analytical signed-distance AA + two-pass focused edge highlighting + node halo rings.
  - Seamless 2D Canvas fallback (`_renderCanvas2D`) if WebGL2 or float textures are unsupported.
  - Opening 0.35x -> 1.0x radial expansion animation when pre-computed layout loads.
  - Zoom-progressive 16px spatial-grid collision-culled label renderer (hidden at overview zoom unless hovered/focused or toggled "항상 표시"; shows top hubs cleanly when zoomed in).
  - High-saturation 8-color Louvain cluster palette (`COMMUNITY_PALETTE`) + muted slate for small peripheral groups, plus toggle between **Community Color (`🎨 군집 색상`)** and **Entity/Domain Color (`🏷️ 유형/도메인 색상`)**.
  - Built-in lightweight UI overlays: bottom-right legend drawer (`≡`), in-graph search box (`🔍 노드 찾기`) with instant jump-to-node, and hover tooltip.
- [ ] **Step 2: Add CSS rules in `css/style.css`** for `.kg-stage`, `.kg-gl-canvas`, `.kg-ov-canvas`, `.kg-tooltip`, `.kg-legend-drawer`, and `.kg-search-bar`.
- [ ] **Step 3: Syntax check with `node --check js/kgRenderer.js js/graphWorker.js`**.

### Task 4: Wire `NetworkView` (`js/network.js`) & `VentureNetworkView` (`js/ventureNetwork.js`) + HTML Preloads

**Files:**
- Modify: `js/network.js`
- Modify: `js/ventureNetwork.js`
- Modify: `index.html`
- Modify: `venture.html`

- [ ] **Step 1: Refactor `js/network.js`** to use `KGCanvasRenderer` + `data/graph_layout_src.json`, removing the 500-node cap in `'all'` mode, preserving all 3 modes (`subtopic`, `topic`, `institution`), category selector, LOD toggle, zoom/fit/reset controls, and full `#network-hud` Gap Analysis & project modal triggers.
- [ ] **Step 2: Refactor `js/ventureNetwork.js`** to use `KGCanvasRenderer` + `data/graph_layout_venture.json`, preserving all 3 modes (`corporate`, `sector`, `syndicate`), LOD toggle, zoom/fit/reset controls, and startup/investor/syndicate `#network-hud` & project modal triggers.
- [ ] **Step 3: Update `index.html` and `venture.html`** to include `<link rel="preload" as="fetch" crossorigin href="data/graph_layout_*.json">` and `<script src="js/graphWorker.js">` / `<script src="js/kgRenderer.js">` cleanly before network scripts.
- [ ] **Step 4: Run `node --check`** on all JS files.

### Task 5: High-FPS Canvas Gradient-Arc World Map Upgrade (`js/map.js`)

**Files:**
- Modify: `js/map.js`
- Modify: `css/style.css` (if needed for canvas layer pointer-events / tooltip styling)

- [ ] **Step 1: Implement `MapCanvasLayer` (custom `L.Layer` extending Leaflet's overlay)** inside `js/map.js`:
  - Renders all curved Bezier connection arcs natively on HiDPI `<canvas>` using `ctx.createLinearGradient` (Company brand color → University region color) or category color, with subtle neon glow for active corridors and crisp anti-aliasing.
  - Renders animated light pulses along active / focused corridors via throttled `requestAnimationFrame`.
  - Renders all institution nodes natively on `<canvas>` with crisp halos, degree-scaled radii, and count badges—eliminating thousands of `L.divIcon` DOM nodes and SVG `<linearGradient>` defs.
  - Implements fast spatial hit-testing (`mousemove` hover highlight + sticky tooltip, `click` focus + Leaflet Popup with existing `buildPopupHtml`, `click` on arc to focus pair/company).
  - Preserves 100% of existing toolbar controls (`smart`, `focused`, `major`, `nodes_only`, `gradient`, `category`) and legend compatibility.
- [ ] **Step 2: Syntax check `node --check js/map.js`**.

### Task 6: End-to-End Browser Verification & Test Suite Validation

**Files:**
- Test: `tests/` + live local HTTP server + Playwright / Browser verification

- [ ] **Step 1: Run `python -m pytest tests/ -v`** and `node --check` on all JS files.
- [ ] **Step 2: Start local static server (`python -m http.server`) and verify both `index.html` and `venture.html` in the browser subagent**:
  - Verify World Map (`#map-view`) renders vibrant gradient arcs & Canvas nodes cleanly, supports hover/click popup, mode switching, and smooth pan/zoom with zero console errors.
  - Verify Academic Network Graph (`#network-view`) renders WebGL2 graph immediately with vibrant Louvain clusters, zoom-progressive labels, node click HUD, Gap analysis, and mode switches (`subtopic`, `topic`, `institution`, `전체 연결망`) with zero console errors.
  - Verify Venture CVC Network Graph & Map (`venture.html`) render cleanly with zero console errors.
- [ ] **Step 3: Commit all changes cleanly and present verified results**.
