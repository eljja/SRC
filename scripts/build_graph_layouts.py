"""
Offline ForceAtlas2 Layout & Louvain Community Builder

Generates pre-computed cluster assignments and 2D ForceAtlas2 layout coordinates
for both the Global Semiconductor R&D Observatory (`data/collaborations.json`)
and the Venture & CVC Observatory (`data/ventures.json`).

Output files:
- `data/graph_layout_src.json`
- `data/graph_layout_venture.json`
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import networkx as nx
import numpy as np

# High-saturation 8-hue palette for the largest Louvain communities (matches frontend)
COMMUNITY_PALETTE = [
    "#3b82f6",  # 0: Electric Blue
    "#f97316",  # 1: Coral Orange
    "#10b981",  # 2: Emerald Green
    "#f59e0b",  # 3: Amber Gold
    "#ec4899",  # 4: Neon Pink
    "#8b5cf6",  # 5: Deep Indigo/Violet
    "#06b6d4",  # 6: Sky Cyan
    "#f43f5e",  # 7: Crimson Rose
]
MUTED_COMMUNITY_COLOR = "#64748b"

SUBTOPIC_RULES: dict[str, list[dict[str, Any]]] = {
    "Advanced Logic & Transistors (GAA/CFET/2D)": [
        {"name": "CFET & 3D 적층 트랜지스터", "keywords": ["cfet", "complementary fet", "3d stacked", "monolithic 3d", "vertical fet", "stacked"]},
        {"name": "GAA / MBCFET 나노시트 소자", "keywords": ["gaa", "gate-all-around", "nanosheet", "multi-bridge", "mbcfet", "ribbonfet", "finfet", "nanowire", "spacer"]},
        {"name": "2D 반도체 채널 신소재 (MoS2/WSe2)", "keywords": ["2d", "mos2", "wse2", "graphene", "transition metal", "tmd", "monolayer", "carbon nanotube", "cnt", "two-dimensional"]},
        {"name": "후면 전력 공급망 (BSPDN/PowerVia)", "keywords": ["backside", "bspdn", "powervia", "power delivery", "through-silicon", "backside power"]},
        {"name": "강유전체 FeFET & 네거티브 커패시턴스", "keywords": ["fefet", "ferroelectric", "negative capacitance", "hfo2", "nc-fet", "memory window", "polarization"]},
        {"name": "극저온 CMOS & 양자 소자 인터페이스", "keywords": ["cryogenic", "low-temperature", "qubit", "quantum", "4k", "sub-kelvin"]},
        {"name": "초미세 접촉저항 & High-k 게이트 절연막", "keywords": ["high-k", "metal gate", "contact resistance", "inner spacer", "dielectric", "workfunction", "interface state", "interface trap"]},
    ],
    "Memory & Storage (HBM/PIM/3D NAND)": [
        {"name": "HBM3e / HBM4 초고대역폭 메모리", "keywords": ["hbm", "high bandwidth", "tsv", "16hi", "wide-io", "stacking", "stack memory"]},
        {"name": "프로세싱 인 메모리 (PIM / CIM)", "keywords": ["pim", "cim", "processing-in-memory", "compute-in-memory", "near-memory", "in-memory"]},
        {"name": "3D DRAM & 신개념 모놀리식 구조", "keywords": ["3d dram", "monolithic 3d", "capacitorless", "floating body", "vertical dram", "gain cell"]},
        {"name": "초고적층 3D NAND 플래시 & HAR 에칭", "keywords": ["3d nand", "nand flash", "har etch", "channel hole", "charge trap", "bit-cost", "high aspect"]},
        {"name": "차세대 비휘발성 메모리 (MRAM/ReRAM/FeRAM)", "keywords": ["mram", "stt-mram", "sot", "reram", "memristor", "feram", "ovonic", "ots", "phase change", "pcm"]},
        {"name": "CXL 메모리 풀링 & 인터커넥트", "keywords": ["cxl", "compute express link", "memory pooling", "disaggregated", "coherent"]},
    ],
    "Advanced Packaging & Chiplets (3D/Hybrid Bonding)": [
        {"name": "Cu-Cu 직접 하이브리드 본딩", "keywords": ["hybrid bonding", "cu-cu", "direct bonding", "die-to-wafer", "wafer-to-wafer", "fine-pitch", "direct bond"]},
        {"name": "2.5D 인터포저 & CoWoS / 유리 기판", "keywords": ["cowos", "emib", "interposer", "glass substrate", "silicon interposer", "organic substrate", "substrate"]},
        {"name": "칩렛 표준 인터페이스 (UCIe / BoW)", "keywords": ["chiplet", "ucie", "bunch of wires", "die-to-die", "d2d", "modular"]},
        {"name": "3D 적층 열 방출 & 마이크로 쿨링", "keywords": ["thermal", "heat dissipation", "microfluidic", "cooling", "junction temp", "warpage", "stress"]},
        {"name": "팬아웃 패널/웨이퍼 레벨 패키징 (FO-PLP/WLP)", "keywords": ["fan-out", "foplp", "fowlp", "redistribution layer", "rdl", "mold", "encapsulation"]},
    ],
    "AI & Neuromorphic Computing": [
        {"name": "LLM / 트랜스포머 전용 NPU 가속기", "keywords": ["npu", "transformer", "llm", "accelerator", "neural processor", "matrix engine", "deep learning"]},
        {"name": "스파이킹 뉴럴 네트워크 (SNN) & 뉴로모픽", "keywords": ["snn", "spiking", "neuromorphic", "brain-inspired", "synapse", "neuron", "event-driven"]},
        {"name": "아날로그 / 광학 행렬 연산 가속기", "keywords": ["analog computing", "optical matrix", "photonic accelerator", "in-memory computing", "analog"]},
        {"name": "초저전력 온디바이스 Edge AI & 센서 퓨전", "keywords": ["edge ai", "on-device", "ultra-low", "low power", "sensor-fusion", "tinyml", "embedded", "perception"]},
        {"name": "SRAM / ReRAM 기반 연산 어레이", "keywords": ["sram-based", "reram array", "in-memory multiplier", "mac array", "crossbar"]},
    ],
    "Lithography & Metrology (EUV/High-NA)": [
        {"name": "High-NA EUV (0.55 NA) 광학계 & 해상력", "keywords": ["high-na", "0.55 na", "anamorphic", "euv optics", "resolution", "numerical aperture", "extreme ultraviolet"]},
        {"name": "금속 산화물 포토레지스트 (MOR) & 결함 제어", "keywords": ["mor", "metal oxide", "photoresist", "stochastic", "line edge roughness", "ler", "defect"]},
        {"name": "계산 리소그래피 & 곡선형 마스크 (Curvilinear OPC)", "keywords": ["computational lithography", "opc", "curvilinear", "mask", "inverse lithography", "ilt", "hotspot"]},
        {"name": "EUV 펠리클 & 고출력 플라즈마 광원", "keywords": ["pellicle", "cnt", "light source", "high-power", "plasma", "debris", "source"]},
        {"name": "원자 단위 계측 검사 & CD-SEM / 스캐터로메트리", "keywords": ["metrology", "cd-sem", "scatterometry", "inspection", "sem image", "afm", "overlay"]},
    ],
    "Power & Compound Semiconductors (GaN/SiC)": [
        {"name": "GaN-on-Si 전력 소자 & 고주파 HEMT", "keywords": ["gan", "gallium nitride", "hemt", "power ic", "high-frequency", "gan-on-silicon", "ingan"]},
        {"name": "1200V+ SiC MOSFET & 전기차 인버터", "keywords": ["sic", "silicon carbide", "trench mosfet", "inverter", "high voltage", "breakdown", "traction"]},
        {"name": "초광밴드갭 산화갈륨(Ga2O3) & 다이아몬드", "keywords": ["ga2o3", "gallium oxide", "diamond", "ultra-wide", "uwbg", "high temperature"]},
        {"name": "실리콘-화합물 이종 집적 (Heterogeneous)", "keywords": ["heterogeneous", "compound on silicon", "epitaxy", "iii-v", "heterojunction"]},
    ],
    "Silicon Photonics & Optical I/O": [
        {"name": "공동 패키징 광학 (CPO) & 광 트랜시버 엔진", "keywords": ["cpo", "co-packaged optics", "optical transceiver", "optical engine", "optical i/o", "transceiver"]},
        {"name": "초고속 광변조기 (100G+) & 마이크로링 공진기", "keywords": ["modulator", "micro-ring", "resonator", "mach-zehnder", "electro-optic", "ring resonator"]},
        {"name": "실리콘 웨이브가이드 상 하이브리드 레이저", "keywords": ["iii-v laser", "hybrid laser", "waveguide", "inp", "dfb laser", "on-chip laser", "laser"]},
        {"name": "AI 데이터센터 초고속 광 인터커넥트", "keywords": ["optical interconnect", "multi-gpu", "datacenter", "low-loss", "optical switch", "interconnect"]},
    ],
}


def is_confirmed_corporate_collab(project: dict[str, Any]) -> bool:
    """Match frontend DataManager.isConfirmedCorporateCollab rules."""
    comp = project.get("company")
    if not comp or comp in ("-", "미지정"):
        return False
    ver = project.get("verification")
    if not ver:
        return True
    collab_type = ver.get("collaboration_type")
    if collab_type == "academic_only":
        return False
    if collab_type in ("co_authorship", "corporate_grant"):
        return True
    corp_inv = ver.get("corporate_involvement") or {}
    return corp_inv.get("status") == "documented"


def get_subtopic(project: dict[str, Any]) -> str:
    """Match frontend DataManager.getSubtopic keyword matching rules."""
    cat = project.get("category") or ""
    rules = SUBTOPIC_RULES.get(cat)
    if not rules:
        return "기타 세부 연구"
    text = f"{project.get('title', '')} {project.get('topic', '')} {project.get('summary', '')}".lower()
    for rule in rules:
        for kw in rule["keywords"]:
            if kw in text:
                return rule["name"]
    return rules[0]["name"]


def _forceatlas2_core(
    node_ids: list[str],
    edges: list[tuple[int, int, float]],
    group_map: dict[str, int],
    degrees: np.ndarray,
    iterations: int = 120,
    seed: int = 42,
) -> np.ndarray:
    """Run vectorized ForceAtlas2 (degree-weighted repulsion + LinLog attraction + gravity)."""
    n = len(node_ids)
    if n == 0:
        return np.zeros((0, 2), dtype=np.float64)
    if n == 1:
        return np.zeros((1, 2), dtype=np.float64)

    rng = np.random.default_rng(seed)
    pos = np.zeros((n, 2), dtype=np.float64)

    # Seed nodes organically around community centroids so clusters separate crisply
    num_groups = max(1, max((group_map.get(nid, 0) for nid in node_ids), default=0) + 1)
    for idx, nid in enumerate(node_ids):
        g = group_map.get(nid, 0)
        angle = (2.0 * math.pi * (g % max(8, num_groups))) / max(8, num_groups)
        deg_val = degrees[idx]
        # High-degree hubs start closer to their cluster core; leaves fan organically around them
        base_r = (85.0 if deg_val > 15 else 135.0) if g < 8 else 195.0
        jitter_r = rng.normal(0.0, 42.0)
        jitter_a = rng.normal(0.0, 0.45)
        pos[idx, 0] = base_r * math.cos(angle) + jitter_r * math.cos(angle + jitter_a)
        pos[idx, 1] = base_r * math.sin(angle) + jitter_r * math.sin(angle + jitter_a)

    # Sublinear degree mass prevents mega-hubs (deg 1000+) from blasting leaves into a stiff outer ring
    mass = np.sqrt(degrees.astype(np.float64)) * 1.4 + 1.0
    if edges:
        src_arr = np.array([e[0] for e in edges], dtype=np.int32)
        dst_arr = np.array([e[1] for e in edges], dtype=np.int32)
        w_arr = np.power(np.array([e[2] for e in edges], dtype=np.float64), 0.5)
    else:
        src_arr = np.empty(0, dtype=np.int32)
        dst_arr = np.empty(0, dtype=np.int32)
        w_arr = np.empty(0, dtype=np.float64)

    kr = 62.0 / max(1.0, math.sqrt(n) / 10.0)
    ka = 2.35
    kg = 0.045
    batch_size = 512

    for it in range(iterations):
        progress = it / max(1, iterations - 1)
        speed = 0.80 * (1.0 - 0.75 * progress)
        max_step = 38.0 * (1.0 - 0.65 * progress)

        forces = np.zeros((n, 2), dtype=np.float64)

        # 1. Batched vectorized degree-weighted repulsion (keeps memory < 25MB)
        pos32 = pos.astype(np.float32)
        mass32 = mass.astype(np.float32)
        for start in range(0, n, batch_size):
            end = min(n, start + batch_size)
            dx = pos32[start:end, 0:1] - pos32[None, :, 0]
            dy = pos32[start:end, 1:2] - pos32[None, :, 1]
            dist2 = dx * dx + dy * dy + np.float32(25.0)
            factor = np.float32(kr) * (mass32[start:end, None] * mass32[None, :]) / dist2
            forces[start:end, 0] += np.sum(factor * dx, axis=1)
            forces[start:end, 1] += np.sum(factor * dy, axis=1)

        # 2. LinLog attraction along edges: pulls community clusters into tight nebulae
        if len(src_arr) > 0:
            ex = pos[dst_arr, 0] - pos[src_arr, 0]
            ey = pos[dst_arr, 1] - pos[src_arr, 1]
            dist = np.sqrt(ex * ex + ey * ey) + 1e-6
            att = ka * w_arr * np.log1p(dist) / dist
            fx = att * ex
            fy = att * ey
            np.add.at(forces[:, 0], src_arr, fx)
            np.add.at(forces[:, 1], src_arr, fy)
            np.add.at(forces[:, 0], dst_arr, -fx)
            np.add.at(forces[:, 1], dst_arr, -fy)

        # 3. Linear central gravity (prevents rigid outer shell compression)
        forces[:, 0] -= kg * mass * pos[:, 0] * 0.22
        forces[:, 1] -= kg * mass * pos[:, 1] * 0.22

        # 4. Step with displacement clamping
        step = forces * speed
        step_mag = np.sqrt(step[:, 0] ** 2 + step[:, 1] ** 2)
        over = step_mag > max_step
        if np.any(over):
            scale = max_step / (step_mag[over] + 1e-9)
            step[over, 0] *= scale
            step[over, 1] *= scale

        pos += step

    return pos


def detect_louvain_and_layout(
    G: nx.Graph,
    iterations: int = 120,
    seed: int = 42,
) -> dict[str, Any]:
    """Detect Louvain communities and compute normalized ForceAtlas2 coordinates."""
    if G.number_of_nodes() == 0:
        return {"nodes": {}, "communities": []}

    # 1. Louvain community detection
    if G.number_of_edges() > 0:
        raw_comms = nx.algorithms.community.louvain_communities(
            G, weight="weight", resolution=1.15, seed=seed
        )
    else:
        raw_comms = [{n} for n in G.nodes()]

    sorted_comms = sorted(raw_comms, key=len, reverse=True)
    node_to_group: dict[str, int] = {}
    communities_meta: list[dict[str, Any]] = []

    for gid, members in enumerate(sorted_comms):
        # Identify highest-degree member as representative label for legend
        rep_node = max(members, key=lambda nid: G.degree(nid, weight="weight"))
        rep_label = G.nodes[rep_node].get("label") or str(rep_node)
        color = COMMUNITY_PALETTE[gid] if gid < len(COMMUNITY_PALETTE) else MUTED_COMMUNITY_COLOR
        communities_meta.append({
            "id": gid,
            "color": color,
            "label": rep_label,
            "count": len(members),
        })
        for nid in members:
            node_to_group[nid] = gid

    # 2. Separate core (>=3 nodes in connected component) vs tiny peripheral islands
    components = sorted(nx.connected_components(G), key=len, reverse=True)
    core_nodes: list[str] = []
    outer_nodes: list[str] = []

    if len(components) == 1 or len(components[0]) == G.number_of_nodes():
        core_nodes = list(G.nodes())
    else:
        for comp in components:
            if len(comp) >= 3:
                core_nodes.extend(comp)
            else:
                outer_nodes.extend(comp)
        if not core_nodes:
            core_nodes = list(G.nodes())
            outer_nodes = []

    core_index = {nid: idx for idx, nid in enumerate(core_nodes)}
    core_edges: list[tuple[int, int, float]] = []
    for u, v, data in G.edges(data=True):
        if u in core_index and v in core_index:
            core_edges.append((core_index[u], core_index[v], float(data.get("weight", 1.0))))

    core_degrees = np.array([G.degree(nid) for nid in core_nodes], dtype=np.float64)
    core_pos = _forceatlas2_core(
        core_nodes,
        core_edges,
        node_to_group,
        core_degrees,
        iterations=iterations,
        seed=seed,
    )

    # 3. Normalize core positions proportionally without artificial wall clipping
    nodes_out: dict[str, list[Any]] = {}
    if len(core_pos) > 0:
        center = np.mean(core_pos, axis=0)
        core_pos -= center
        max_r = float(np.max(np.sqrt(core_pos[:, 0] ** 2 + core_pos[:, 1] ** 2)))
        if max_r < 1e-6:
            max_r = 1.0
        target_radius = 0.80 if outer_nodes else 0.94
        core_pos = (core_pos / max_r) * target_radius

        for idx, nid in enumerate(core_nodes):
            nodes_out[nid] = [
                round(float(core_pos[idx, 0]), 4),
                round(float(core_pos[idx, 1]), 4),
                int(node_to_group.get(nid, 0)),
            ]

    # 4. Place disconnected tiny islands onto a clean outer halo ring (0.86..0.95)
    if outer_nodes:
        total_outer = len(outer_nodes)
        for i, nid in enumerate(outer_nodes):
            angle = (2.0 * math.pi * i) / max(1, total_outer)
            r = 0.88 + 0.05 * ((i % 3) - 1) * 0.5
            nodes_out[nid] = [
                round(float(r * math.cos(angle)), 4),
                round(float(r * math.sin(angle)), 4),
                int(node_to_group.get(nid, 0)),
            ]

    return {
        "nodes": nodes_out,
        "communities": communities_meta[:12],  # Top 12 communities for clean legend UI
    }


def _add_weighted_edge(G: nx.Graph, u: str, v: str, weight: float = 1.0) -> None:
    if not u or not v or u == v:
        return
    if G.has_edge(u, v):
        G[u][v]["weight"] += weight
    else:
        G.add_edge(u, v, weight=weight)


def build_src_layouts_from_projects(
    projects: list[dict[str, Any]],
    iterations: int = 120,
) -> dict[str, Any]:
    """Build pre-computed Louvain + ForceAtlas2 layouts for SRC modes."""
    valid = [p for p in projects if (p.get("verification") or {}).get("status") != "quarantined"]
    modes: dict[str, Any] = {}

    # 1. Mode: topic (7-domain overview)
    G_topic = nx.Graph()
    for p in valid:
        cat = p.get("category") or "기타"
        cat_id = f"cat_{cat}"
        G_topic.add_node(cat_id, label=cat, type="category")

        has_corp = is_confirmed_corporate_collab(p)
        if has_corp:
            comp_id = f"comp_{p['company']}"
            G_topic.add_node(comp_id, label=p["company"], type="company")
            _add_weighted_edge(G_topic, comp_id, cat_id, 1.5)

        if p.get("university"):
            uni_id = f"uni_{p['university']}"
            G_topic.add_node(uni_id, label=p["university"], type="university")
            _add_weighted_edge(G_topic, uni_id, cat_id, 1.0)

    modes["topic"] = detect_louvain_and_layout(G_topic, iterations=iterations)

    # 2. Mode: institution (Company-University-Category-Institute network)
    G_inst = nx.Graph()
    for p in valid:
        has_corp = is_confirmed_corporate_collab(p)
        comp_id = f"comp_{p['company']}" if has_corp else None
        if comp_id:
            G_inst.add_node(comp_id, label=p["company"], type="company")

        uni_id = f"uni_{p['university']}" if p.get("university") else None
        if uni_id:
            G_inst.add_node(uni_id, label=p["university"], type="university")

        cat = p.get("category") or "기타"
        cat_id = f"cat_{cat}"
        G_inst.add_node(cat_id, label=cat, type="category")

        inst = p.get("institute_or_consortium")
        inst_id = f"inst_{inst}" if (inst and inst not in ("-", "해당 없음")) else None
        if inst_id:
            G_inst.add_node(inst_id, label=inst, type="institute")

        if comp_id and uni_id:
            _add_weighted_edge(G_inst, comp_id, uni_id, 2.0)
        if uni_id:
            _add_weighted_edge(G_inst, uni_id, cat_id, 1.0)
        if inst_id and uni_id:
            _add_weighted_edge(G_inst, inst_id, uni_id, 1.2)
        if comp_id and inst_id:
            _add_weighted_edge(G_inst, comp_id, inst_id, 1.2)

    modes["institution"] = detect_louvain_and_layout(G_inst, iterations=iterations)

    # 3. Mode: subtopic per category
    categories_in_data = sorted({p.get("category") for p in valid if p.get("category") in SUBTOPIC_RULES})
    for cat in categories_in_data:
        G_sub = nx.Graph()
        for rule in SUBTOPIC_RULES[cat]:
            G_sub.add_node(f"sub_{rule['name']}", label=rule["name"], type="subtopic")

        for p in valid:
            if p.get("category") != cat:
                continue
            sub_name = get_subtopic(p)
            sub_id = f"sub_{sub_name}"
            G_sub.add_node(sub_id, label=sub_name, type="subtopic")

            if is_confirmed_corporate_collab(p):
                comp_id = f"comp_{p['company']}"
                G_sub.add_node(comp_id, label=p["company"], type="company")
                _add_weighted_edge(G_sub, comp_id, sub_id, 1.5)

            if p.get("university"):
                uni_id = f"uni_{p['university']}"
                G_sub.add_node(uni_id, label=p["university"], type="university")
                _add_weighted_edge(G_sub, uni_id, sub_id, 1.0)

        modes[f"subtopic:{cat}"] = detect_louvain_and_layout(G_sub, iterations=iterations)

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_projects": len(valid),
            "version": "1.0.0",
        },
        "modes": modes,
    }


def build_venture_layouts_from_investments(
    investments: list[dict[str, Any]],
    iterations: int = 120,
) -> dict[str, Any]:
    """Build pre-computed Louvain + ForceAtlas2 layouts for Venture CVC modes."""
    modes: dict[str, Any] = {}

    # 1. corporate mode: Corporate -> Startup
    G_corp = nx.Graph()
    for inv in investments:
        corp = inv.get("investor_company")
        startup = inv.get("startup_name")
        if corp:
            G_corp.add_node(f"corp_{corp}", label=corp, type="corporate")
        if startup:
            G_corp.add_node(f"start_{startup}", label=startup, type="startup")
        if corp and startup:
            _add_weighted_edge(G_corp, f"corp_{corp}", f"start_{startup}", 1.5)
    modes["corporate"] = detect_louvain_and_layout(G_corp, iterations=iterations)

    # 2. sector mode: Sector <-> Startup & Corporate <-> Sector
    G_sec = nx.Graph()
    for inv in investments:
        corp = inv.get("investor_company")
        startup = inv.get("startup_name")
        sector = inv.get("sector") or "Other"
        sec_id = f"sec_{sector}"
        G_sec.add_node(sec_id, label=sector, type="sector")
        if startup:
            s_id = f"start_{startup}"
            G_sec.add_node(s_id, label=startup, type="startup")
            _add_weighted_edge(G_sec, sec_id, s_id, 1.2)
        if corp:
            c_id = f"corp_{corp}"
            G_sec.add_node(c_id, label=corp, type="corporate")
            _add_weighted_edge(G_sec, c_id, sec_id, 1.5)
    modes["sector"] = detect_louvain_and_layout(G_sec, iterations=iterations)

    # 3. syndicate mode: multi-investor startups
    startup_investors: dict[str, set[str]] = {}
    startup_syndicates: dict[str, set[str]] = {}
    for inv in investments:
        s_name = inv.get("startup_name")
        corp = inv.get("investor_company")
        if not s_name:
            continue
        startup_investors.setdefault(s_name, set())
        startup_syndicates.setdefault(s_name, set())
        if corp:
            startup_investors[s_name].add(corp)
        for p in inv.get("syndicate_partners") or []:
            startup_syndicates[s_name].add(p)

    G_syn = nx.Graph()
    for s_name, inv_set in startup_investors.items():
        if len(inv_set) >= 2 or len(startup_syndicates.get(s_name, set())) >= 2:
            s_id = f"start_{s_name}"
            G_syn.add_node(s_id, label=s_name, type="startup")
            for corp in inv_set:
                c_id = f"corp_{corp}"
                G_syn.add_node(c_id, label=corp, type="corporate")
                _add_weighted_edge(G_syn, c_id, s_id, 1.8)
    modes["syndicate"] = detect_louvain_and_layout(G_syn, iterations=iterations)

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_investments": len(investments),
            "version": "1.0.0",
        },
        "modes": modes,
    }


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    collab_path = root / "data" / "collaborations.json"
    venture_path = root / "data" / "ventures.json"

    if collab_path.exists():
        print(f"Loading {collab_path}...")
        raw = json.loads(collab_path.read_text(encoding="utf-8"))
        projects = raw.get("projects", raw) if isinstance(raw, dict) else raw
        src_layouts = build_src_layouts_from_projects(projects, iterations=120)
        out_src = root / "data" / "graph_layout_src.json"
        out_src.write_text(json.dumps(src_layouts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Wrote {out_src} ({out_src.stat().st_size:,} bytes) with modes: {list(src_layouts['modes'].keys())}")

    if venture_path.exists():
        print(f"Loading {venture_path}...")
        raw_v = json.loads(venture_path.read_text(encoding="utf-8"))
        investments = raw_v.get("investments", raw_v) if isinstance(raw_v, dict) else raw_v
        v_layouts = build_venture_layouts_from_investments(investments, iterations=120)
        out_v = root / "data" / "graph_layout_venture.json"
        out_v.write_text(json.dumps(v_layouts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Wrote {out_v} ({out_v.stat().st_size:,} bytes) with modes: {list(v_layouts['modes'].keys())}")


if __name__ == "__main__":
    main()
