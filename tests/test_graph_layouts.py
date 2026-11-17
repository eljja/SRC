import math
import networkx as nx
import pytest

from scripts.build_graph_layouts import (
    is_confirmed_corporate_collab,
    get_subtopic,
    detect_louvain_and_layout,
    build_src_layouts_from_projects,
    build_venture_layouts_from_investments,
)


class TestCollaborationParity:
    def test_confirmed_corporate_collab_parity(self):
        assert not is_confirmed_corporate_collab({"company": "-", "verification": {"collaboration_type": "corporate_grant"}})
        assert not is_confirmed_corporate_collab({"company": "미지정"})
        assert not is_confirmed_corporate_collab({"company": "Samsung Electronics", "verification": {"collaboration_type": "academic_only"}})
        assert is_confirmed_corporate_collab({"company": "Samsung Electronics", "verification": {"collaboration_type": "co_authorship"}})
        assert is_confirmed_corporate_collab({"company": "SK Hynix", "verification": {"collaboration_type": "corporate_grant"}})
        assert is_confirmed_corporate_collab({
            "company": "TSMC",
            "verification": {"corporate_involvement": {"status": "documented"}}
        })

    def test_get_subtopic_matches_keywords(self):
        p = {
            "category": "Memory & Storage (HBM/PIM/3D NAND)",
            "title": "Thermal analysis of 16hi HBM4 TSV stacking",
            "topic": "",
            "summary": ""
        }
        assert get_subtopic(p) == "HBM3e / HBM4 초고대역폭 메모리"


class TestLouvainAndForceAtlas2:
    def test_empty_graph(self):
        G = nx.Graph()
        res = detect_louvain_and_layout(G)
        assert res["nodes"] == {}
        assert res["communities"] == []

    def test_clusters_and_singletons_normalized_finite(self):
        G = nx.Graph()
        # Cluster A (4 nodes)
        for u, v in [("a1", "a2"), ("a2", "a3"), ("a3", "a4"), ("a4", "a1"), ("a1", "a3")]:
            G.add_edge(u, v, weight=3.0)
        # Cluster B (3 nodes)
        for u, v in [("b1", "b2"), ("b2", "b3"), ("b3", "b1")]:
            G.add_edge(u, v, weight=2.0)
        # Isolated tiny pair
        G.add_edge("iso1", "iso2", weight=1.0)
        # Isolated singleton
        G.add_node("single")

        for n in G.nodes():
            G.nodes[n]["label"] = n
            G.nodes[n]["type"] = "university"

        res = detect_louvain_and_layout(G, iterations=60, seed=42)
        nodes = res["nodes"]
        comms = res["communities"]

        assert set(nodes.keys()) == set(G.nodes())
        for nid, coords in nodes.items():
            x, y, grp = coords
            assert math.isfinite(x) and -1.05 <= x <= 1.05
            assert math.isfinite(y) and -1.05 <= y <= 1.05
            assert isinstance(grp, int) and grp >= 0

        # Communities must be sorted descending by count
        counts = [c["count"] for c in comms]
        assert counts == sorted(counts, reverse=True)
        assert comms[0]["id"] == 0


class TestLayoutBuilders:
    def test_src_builder_excludes_quarantined_and_builds_all_modes(self):
        projects = [
            {
                "id": "p1",
                "title": "GAA nanosheet transistor study",
                "topic": "GAA nanosheet",
                "category": "Advanced Logic & Transistors (GAA/CFET/2D)",
                "company": "Samsung Electronics",
                "university": "Seoul National University",
                "institute_or_consortium": "ISRC",
                "verification": {"status": "verified", "collaboration_type": "co_authorship"}
            },
            {
                "id": "p2",
                "title": "Pure academic CMOS paper",
                "topic": "MOSFET physics",
                "category": "Advanced Logic & Transistors (GAA/CFET/2D)",
                "company": "Samsung Electronics",
                "university": "KAIST",
                "verification": {"status": "verified", "collaboration_type": "academic_only"}
            },
            {
                "id": "p3_quarantined",
                "title": "Beetle paper",
                "topic": "Micron measurement",
                "category": "AI & Neuromorphic Computing",
                "company": "Micron",
                "university": "Bad University",
                "verification": {"status": "quarantined"}
            }
        ]
        out = build_src_layouts_from_projects(projects, iterations=30)
        assert "modes" in out
        assert "topic" in out["modes"]
        assert "institution" in out["modes"]
        assert "subtopic:Advanced Logic & Transistors (GAA/CFET/2D)" in out["modes"]

        topic_nodes = out["modes"]["topic"]["nodes"]
        assert "uni_Bad University" not in topic_nodes
        assert "comp_Samsung Electronics" in topic_nodes
        assert "uni_Seoul National University" in topic_nodes
        assert "uni_KAIST" in topic_nodes

    def test_venture_builder_modes(self):
        investments = [
            {
                "id": "v1",
                "investor_company": "NVIDIA",
                "startup_name": "Ayar Labs",
                "sector": "Optical Interconnect & Photonics",
                "syndicate_partners": ["Intel Capital"]
            },
            {
                "id": "v2",
                "investor_company": "Intel",
                "startup_name": "Ayar Labs",
                "sector": "Optical Interconnect & Photonics",
                "syndicate_partners": ["NVIDIA"]
            }
        ]
        out = build_venture_layouts_from_investments(investments, iterations=30)
        assert set(out["modes"].keys()) == {"corporate", "sector", "syndicate"}
        assert "corp_NVIDIA" in out["modes"]["corporate"]["nodes"]
        assert "start_Ayar Labs" in out["modes"]["corporate"]["nodes"]
        assert "sec_Optical Interconnect & Photonics" in out["modes"]["sector"]["nodes"]
