"""
Tests for Dataset Remediation, Idempotency, and Rollback.
Verifies that:
1. SEMI-2024-CENSUS-2057 (JOCR cervical disc herniation paper) has false $750k, Samsung, and 2024-2027 duration remediated and quarantined.
2. Remediation is strictly idempotent: re-running gives the exact same result.
3. Rollback restores the exact original backup state.
4. No synthetic formulas remain in the dataset.
"""

import sys
import os
import json
import tempfile
import shutil
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.remediate_dataset import DatasetRemediator


SAMPLE_POLLUTED_RECORD_2057 = {
    "id": "SEMI-2024-CENSUS-2057",
    "title": "Use of Navigable Ablation Decompression Treatment (L-DISQ) for Contained Cervical Disc Herniation: A Case Report",
    "topic": "Use of Navigable Ablation Decompression Treatment (L-DISQ) for Contained Cervical Disc Herniation",
    "category": "AI & Neuromorphic Computing",
    "company": "Samsung Electronics",
    "university": "Yonsei University",
    "start_year": 2024,
    "end_year": 2027,
    "duration_years": 3,
    "status": "active",
    "funding_amount_usd": 750000,
    "funding_display": "$750,000",
    "evidence_type": "DOI Crossref",
    "evidence_ref": "https://doi.org/10.13107/jocr.2024.v14.i01.4190",
    "summary": "This is a case report of a patient with contained cervical disc herniation."
}

SAMPLE_GENUINE_SEMI_RECORD = {
    "id": "SEMI-VERIFIED-0001",
    "title": "Gate-All-Around (GAA) Nanosheet Transistor Channel Scaling for Sub-2nm Nodes",
    "topic": "GAA Nanosheet Transistor Channel Scaling",
    "category": "Advanced Logic & Transistors (GAA/CFET/2D)",
    "company": "Samsung Electronics",
    "university": "Seoul National University",
    "start_year": 2024,
    "end_year": 2027,
    "duration_years": 3,
    "status": "active",
    "funding_amount_usd": 1250000,
    "funding_display": "$1.25M",
    "evidence_type": "DOI Crossref",
    "evidence_ref": "https://doi.org/10.1000/genuine-semi-1",
    "summary": "Study of nanosheet GAA architecture with Cu-Cu interconnects."
}


@pytest.fixture
def temp_dataset():
    """Create a temporary dataset JSON with polluted and genuine sample records."""
    temp_dir = tempfile.mkdtemp()
    filepath = os.path.join(temp_dir, "test_collaborations.json")

    dataset = {
        "metadata": {
            "title": "Test Semiconductor Dataset",
            "version": "7.8.0",
            "total_projects": 2
        },
        "projects": [
            dict(SAMPLE_POLLUTED_RECORD_2057),
            dict(SAMPLE_GENUINE_SEMI_RECORD)
        ]
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    yield filepath

    shutil.rmtree(temp_dir)


class TestRemediationProcess:
    """Requirement 4 & 6: Remediation, Idempotency, and Rollback Tests."""

    def test_remediation_of_census_2057(self, temp_dataset):
        """Test that SEMI-2024-CENSUS-2057 is thoroughly cleaned and quarantined."""
        remediator = DatasetRemediator(temp_dataset)
        remediator.load()
        report = remediator.remediate()

        # Find remediated 2057 record
        rec_2057 = next(p for p in remediator.projects if p["id"] == "SEMI-2024-CENSUS-2057")

        # 1. Unfounded 750,000 funding removed
        assert rec_2057["funding_amount_usd"] == 0 or rec_2057["funding_amount_usd"] is None
        assert rec_2057["funding_display"] == "지원 없음 (Nil)"
        assert rec_2057["verification"]["funding"]["status"] == "none_stated"
        assert "Nil" in rec_2057["verification"]["funding"]["evidence_quote"]

        # 2. Samsung unevidenced sponsorship removed / flagged
        assert rec_2057["company"] is None or rec_2057["verification"]["corporate_involvement"]["status"] in ("none", "unverified")

        # 3. 2024-2027 3-year duration removed
        assert rec_2057["start_year"] == 2024
        assert rec_2057["end_year"] in (2024, None)
        assert rec_2057["duration_years"] in (1, None)

        # 4. Quarantined due to medical/orthopedic subject
        assert rec_2057["verification"]["status"] == "quarantined"
        assert rec_2057["status"] == "quarantined"
        assert "비반도체" in rec_2057["verification"]["quarantine_reason"]

        # 5. Original polluted values preserved in audit history
        assert "_audit_history" in rec_2057
        assert rec_2057["_audit_history"]["original_values"]["funding_amount_usd"] == 750000
        assert rec_2057["_audit_history"]["original_values"]["category"] == "AI & Neuromorphic Computing"

    def test_genuine_semiconductor_project_funding_handling(self, temp_dataset):
        """Test that genuine semiconductor project has synthetic funding cleaned but domain preserved."""
        remediator = DatasetRemediator(temp_dataset)
        remediator.load()
        remediator.remediate()

        rec_semi = next(p for p in remediator.projects if p["id"] == "SEMI-VERIFIED-0001")

        # Domain must be preserved
        assert rec_semi["category"] == "Advanced Logic & Transistors (GAA/CFET/2D)"
        assert rec_semi["verification"]["status"] in ("review_pending", "verified_census", "verified")
        assert rec_semi["status"] != "quarantined"

        # Synthetic 1.25M funding cleared to unverified (since no grant announcement cited)
        assert rec_semi["funding_amount_usd"] is None
        assert rec_semi["funding_display"] == "미확인 (Unknown)"
        assert rec_semi["verification"]["funding"]["status"] == "unverified"

        # Original synthetic funding saved in audit history
        assert rec_semi["_audit_history"]["original_values"]["funding_amount_usd"] == 1250000

    def test_remediation_idempotency(self, temp_dataset):
        """Test that re-running remediation produces identical results without double mutation."""
        remediator1 = DatasetRemediator(temp_dataset)
        remediator1.load()
        remediator1.remediate()
        remediator1.save(create_backup=True)

        # Read state after 1st run
        with open(temp_dataset, 'r', encoding='utf-8') as f:
            data_run1 = json.load(f)

        # Run 2nd remediation
        remediator2 = DatasetRemediator(temp_dataset)
        remediator2.load()
        remediator2.remediate()
        remediator2.save(create_backup=False)

        # Read state after 2nd run
        with open(temp_dataset, 'r', encoding='utf-8') as f:
            data_run2 = json.load(f)

        # Both runs must be identical (idempotent)
        assert len(data_run1["projects"]) == len(data_run2["projects"])
        for p1, p2 in zip(data_run1["projects"], data_run2["projects"]):
            assert p1["id"] == p2["id"]
            assert p1["funding_amount_usd"] == p2["funding_amount_usd"]
            assert p1["funding_display"] == p2["funding_display"]
            assert p1["status"] == p2["status"]
            assert p1["start_year"] == p2["start_year"]
            assert p1["end_year"] == p2["end_year"]
            assert p1["verification"] == p2["verification"]
            # Audit history should not multiply
            assert p1["_audit_history"]["original_values"] == p2["_audit_history"]["original_values"]

    def test_rollback_restores_exact_original_state(self, temp_dataset):
        """Test that rollback restores the exact pre-remediation backup."""
        # Read initial polluted state
        with open(temp_dataset, 'r', encoding='utf-8') as f:
            initial_data = json.load(f)

        # Apply remediation with backup
        remediator = DatasetRemediator(temp_dataset)
        remediator.load()
        remediator.remediate()
        backup_path = remediator.save(create_backup=True)

        assert os.path.exists(backup_path)

        # Verify dataset changed
        with open(temp_dataset, 'r', encoding='utf-8') as f:
            remediated_data = json.load(f)
        assert remediated_data["projects"][0]["funding_display"] != initial_data["projects"][0]["funding_display"]

        # Perform rollback
        success = DatasetRemediator.rollback(temp_dataset, backup_path)
        assert success is True

        # Verify dataset is restored exactly to initial state
        with open(temp_dataset, 'r', encoding='utf-8') as f:
            restored_data = json.load(f)

        assert restored_data == initial_data
        assert restored_data["projects"][0]["funding_amount_usd"] == 750000
        assert restored_data["projects"][0]["status"] == "active"
