"""
Tests for Data Integrity and Evidence Verification Principles.
Verifies that:
1. Title length / record order / count do NOT generate synthetic funding or sponsor companies.
2. 'No funding evidence' (unverified) vs explicit 'source of support: nil/none' (none_stated) are distinct.
3. Author affiliation alone does NOT create corporate sponsorship or formal consortia.
4. Non-semiconductor papers (medical/orthopedic) are quarantined.
5. Genuine semiconductor papers are preserved.
6. Auto-update and census creation helpers enforce evidence schemas without fallback guessing.
"""

import sys
import os
import pytest

# Ensure scripts directory is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.auto_update import (
    create_census_project,
    is_semiconductor_relevant,
    infer_category,
    match_comp,
    match_inst
)


class TestDataGenerationPrinciples:
    """Requirement 2 & 6: Data Generation Principles and Regression Tests."""

    def test_title_length_and_order_do_not_generate_funding(self):
        """Test that title length, order, and count do not produce synthetic funding."""
        # Previous bug: funding = 500000 + (len(title) % 5) * 250000
        titles = [
            "A",                                    # len 1 -> previously 500k
            "Short title",                          # len 11 -> previously 750k
            "A medium length title for research",   # len 34 -> previously 1.5M
            "A very long paper title analyzing gate-all-around nanosheet field-effect transistors",
            "An extremely long title " * 10
        ]

        for i, title in enumerate(titles):
            project = create_census_project(
                pid=f"TEST-PROJ-{i}",
                title=title,
                pub_year=2024,
                doi=f"10.1000/test-{i}",
                summary="Study of gate-all-around field-effect transistors"
            )

            # Funding must NOT be generated from title length
            assert project["funding_amount_usd"] is None, f"Funding should be None for title length {len(title)}"
            assert project["funding_display"] == "미확인 (Unknown)"
            assert project["verification"]["funding"]["status"] == "unverified"
            assert project["verification"]["funding"]["amount_usd"] is None

    def test_no_funding_vs_none_stated_distinction(self):
        """Test that missing funding and explicit 'None/Nil stated' are stored in distinct states."""
        # Case A: Missing funding (unverified)
        proj_unverified = create_census_project(
            pid="TEST-UNVERIFIED",
            title="Gate-All-Around Transistor Research",
            pub_year=2024,
            doi="10.1000/unverified",
            funding_status="unverified"
        )
        assert proj_unverified["funding_amount_usd"] is None
        assert proj_unverified["funding_display"] == "미확인 (Unknown)"
        assert proj_unverified["verification"]["funding"]["status"] == "unverified"

        # Case B: Explicit 'Support: Nil' stated in source (none_stated)
        proj_none_stated = create_census_project(
            pid="TEST-NONE-STATED",
            title="Use of Navigable Ablation Decompression Treatment for Cervical Disc Herniation",
            pub_year=2024,
            doi="10.13107/jocr.2024.v14.i01.4190",
            funding_amount=0,
            funding_display="지원 없음 (Nil)",
            funding_status="none_stated",
            funding_evidence_quote="Conflict of Interest: Nil, Source of Support: Nil"
        )
        assert proj_none_stated["funding_amount_usd"] == 0
        assert proj_none_stated["funding_display"] == "지원 없음 (Nil)"
        assert proj_none_stated["verification"]["funding"]["status"] == "none_stated"
        assert proj_none_stated["verification"]["funding"]["evidence_quote"] == "Conflict of Interest: Nil, Source of Support: Nil"

        # The two states must be completely distinct
        assert proj_unverified["verification"]["funding"]["status"] != proj_none_stated["verification"]["funding"]["status"]
        assert proj_unverified["funding_display"] != proj_none_stated["funding_display"]

    def test_author_affiliation_is_not_corporate_funding_evidence(self):
        """Test that company author affiliation alone does not generate corporate funding or formal consortium."""
        # Samsung author on a paper with no funding info
        project = create_census_project(
            pid="TEST-AFFIL-ONLY",
            title="Advanced Logic Transistor Scaling with Gate-All-Around",
            pub_year=2024,
            doi="10.1000/affil-only",
            company="Samsung Electronics",
            corporate_involvement_status="unverified",
            corporate_evidence_quote="Author affiliation mentions Samsung Electronics Co., Ltd."
        )

        assert project["company"] == "Samsung Electronics"
        assert project["verification"]["corporate_involvement"]["status"] == "unverified"
        assert project["verification"]["funding"]["status"] == "unverified"
        assert project["funding_amount_usd"] is None

    def test_no_default_fallback_to_samsung_or_stanford(self):
        """Test that match_comp and match_inst return None instead of defaulting to Samsung/SNU."""
        # Text with no company mention
        assert match_comp("University research on silicon photonics without industry partner") is None
        # Text with no institute mention
        assert match_inst("Independent laboratory investigation") is None

    def test_publication_year_does_not_infer_duration_or_active_status(self):
        """Test that publication year does not create a synthetic 3-year active project."""
        project = create_census_project(
            pid="TEST-PUB-STATUS",
            title="High-NA EUV Stochastic Defect Analysis",
            pub_year=2025,
            doi="10.1000/euv-2025"
        )

        # Standard publication defaults to single publication year and completed
        assert project["start_year"] == 2025
        assert project["end_year"] == 2025
        assert project["duration_years"] == 1
        assert project["status"] == "completed"
        assert project["verification"]["period"]["status"] == "single_year_publication"

    def test_medical_and_orthopedic_papers_are_quarantined(self):
        """Test that non-semiconductor papers (e.g. cervical disc herniation) are identified and quarantined."""
        medical_titles = [
            "Use of Navigable Ablation Decompression Treatment (L-DISQ) for Contained Cervical Disc Herniation: A Case Report",
            "Comparative Study of Dental Implant Stability Using Resonance Frequency Analysis",
            "Surgical Management of Knee Osteoarthritis in Elderly Patients",
            "Efficacy of Chemotherapy Regimens in Colorectal Cancer Treatment"
        ]

        for title in medical_titles:
            assert is_semiconductor_relevant(title, "") is False, f"Paper should not be semiconductor-relevant: {title}"

            project = create_census_project(
                pid="TEST-MED",
                title=title,
                pub_year=2024,
                doi="10.13107/test",
                is_semiconductor_relevant=False,
                quarantine_reason="비반도체 분야 (정형외과/의학/치과 등)"
            )
            assert project["verification"]["status"] == "quarantined"
            assert project["status"] == "quarantined"
            assert "비반도체" in project["verification"]["quarantine_reason"]

    def test_genuine_semiconductor_papers_are_preserved(self):
        """Test that genuine semiconductor hardware papers are recognized and assigned properly."""
        semi_titles = [
            ("Complementary FET (CFET) Architecture for Sub-1nm Logic Nodes", "Advanced Logic & Transistors (GAA/CFET/2D)"),
            ("High Bandwidth Memory (HBM3e) Thermal Dissipation with Microfluidic Cooling", "Memory & Storage (HBM/PIM/3D NAND)"),
            ("Cu-Cu Hybrid Bonding Fine Pitch Interconnects for 3D Chiplet Stacking", "Advanced Packaging & Chiplets (3D/Hybrid Bonding)"),
            ("High-NA EUV Stochastic Defect Mitigation using Metal Oxide Photoresist", "Lithography & Metrology (EUV/High-NA)"),
            ("Ultra-wide Bandgap Gallium Oxide (Ga2O3) Power MOSFETs for Electric Vehicles", "Power & Compound Semiconductors (GaN/SiC)"),
            ("Co-Packaged Optics (CPO) Silicon Photonic Transceiver Engine", "Silicon Photonics & Optical I/O")
        ]

        for title, expected_cat in semi_titles:
            assert is_semiconductor_relevant(title, "") is True, f"Paper should be semiconductor-relevant: {title}"
            cat = infer_category(title, "")
            assert cat == expected_cat, f"Expected {expected_cat}, got {cat} for title: {title}"

    def test_unclassified_does_not_default_to_ai_neuromorphic(self):
        """Test that unclassified items fallback to Pending Review, NOT AI & Neuromorphic Computing."""
        unknown_text = "General overview of mathematical principles in topological spaces"
        cat = infer_category(unknown_text, "")
        assert cat == "기타 / 검토 대기 (Pending Review)"
        assert cat != "AI & Neuromorphic Computing"
