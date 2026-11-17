import pytest
import os
import sys
import json
import shutil
import tempfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from scripts.remediate_grounding import GroundingRemediator

@pytest.fixture
def temp_env():
    temp_dir = tempfile.mkdtemp()
    data_path = os.path.join(temp_dir, 'collaborations.json')
    sample_data = {
        "metadata": {"total_projects": 5, "version": "test"},
        "projects": [
            {
                "id": "SEMI-VERIFIED-0001",
                "title": "Attosecond electronic timing with rising edges of photocurrent pulses",
                "company": "Samsung Electronics",
                "university": "Stanford University",
                "professor": "Minji Hyun",
                "evidence_ref": "Nature Communications | DOI: https://doi.org/10.1038/s41467-020-17460-6",
                "summary": "Stanford University Minji Hyun 연구팀과 Samsung Electronics가 최근 공동 개발한...",
                "status": "completed",
                "verification": {"collaboration_type": "co_authorship"}
            },
            {
                "id": "SEMI-2024-CENSUS-0481",
                "title": "Prompt Learning via Meta-Regularization",
                "company": "NVIDIA",
                "university": "Korea University (고려대학교)",
                "professor": "Prof. Park",
                "evidence_ref": "CVPR | DOI: https://doi.org/10.1109/cvpr52733.2024.02544",
                "summary": "Korea University Prof. Park 연구팀과 NVIDIA가...",
                "status": "completed",
                "verification": {"collaboration_type": "co_authorship"}
            },
            {
                "id": "SEMI-2025-CENSUS-0299",
                "title": "Analysis of biomechanical passive synergistic vibration reduction in beetle hindwings",
                "company": "Micron Technology",
                "university": "Stanford University",
                "professor": "Yan",
                "evidence_ref": "Micron | DOI: https://doi.org/10.1016/j.micron.2024.103725",
                "summary": "Stanford University Yan 연구팀과 Micron Technology가...",
                "status": "completed",
                "verification": {"collaboration_type": "co_authorship"}
            },
            {
                "id": "SEMI-VERIFIED-5734",
                "title": "PIM kinase inhibition attenuates pro-tumoral macrophages in classic Hodgkin lymphoma",
                "company": "Samsung Electronics",
                "university": "Stanford University",
                "professor": "Szydlowski",
                "evidence_ref": "Cell Death Dis | DOI: https://doi.org/10.1038/s41419-025-08402-5",
                "summary": "Stanford University Szydlowski 연구팀과 Samsung Electronics가...",
                "status": "completed",
                "verification": {"collaboration_type": "co_authorship"}
            },
            {
                "id": "SEMI-VERIFIED-9999",
                "title": "Sub-1nm gate oxide 2D MoS2 nanosheet transistors",
                "company": "Samsung Electronics",
                "university": "Stanford University",
                "professor": "Kim",
                "evidence_ref": "Nature | DOI: https://doi.org/10.1038/s41586-024-9999",
                "summary": "Stanford University Kim 연구팀과 Samsung Electronics가...",
                "status": "completed",
                "verification": {"collaboration_type": "co_authorship"}
            }
        ]
    }
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(sample_data, f, indent=2, ensure_ascii=False)
        
    yield data_path, temp_dir
    shutil.rmtree(temp_dir)

class TestRemediationGrounding:
    def test_remediation_confirms_genuine_nvidia_grant(self, temp_env):
        """Verifies genuine NVIDIA grant in SEMI-2024-CENSUS-0481."""
        data_path, _ = temp_env
        remediator = GroundingRemediator(filepath=data_path, offline_test_mode=True)
        report = remediator.run(dry_run=True)
        
        remediated = report["projects"]
        p = next(x for x in remediated if x["id"] == "SEMI-2024-CENSUS-0481")
        assert p["company"] == "NVIDIA"
        assert p["verification"]["collaboration_type"] == "corporate_grant"
        assert p["status"] == "completed"

    def test_remediation_corrects_samsung_foundation_university(self, temp_env):
        """Corrects SEMI-VERIFIED-0001 university from Stanford to KAIST and confirms grant."""
        data_path, _ = temp_env
        remediator = GroundingRemediator(filepath=data_path, offline_test_mode=True)
        report = remediator.run(dry_run=True)
        
        remediated = report["projects"]
        p = next(x for x in remediated if x["id"] == "SEMI-VERIFIED-0001")
        assert p["company"] == "Samsung Electronics"
        assert p["university"] != "Stanford University"
        assert "KAIST" in p["university"] or "Korea University" in p["university"]
        assert p["verification"]["collaboration_type"] == "corporate_grant"

    def test_remediation_quarantines_micron_beetle_paper(self, temp_env):
        """SEMI-2025-CENSUS-0299 (beetle wing) must be quarantined and Micron cleared."""
        data_path, _ = temp_env
        remediator = GroundingRemediator(filepath=data_path, offline_test_mode=True)
        report = remediator.run(dry_run=True)
        
        remediated = report["projects"]
        p = next(x for x in remediated if x["id"] == "SEMI-2025-CENSUS-0299")
        assert p["status"] == "quarantined"
        assert p["company"] is None
        assert p["verification"]["is_semiconductor_relevant"] is False

    def test_remediation_quarantines_lymphoma_paper(self, temp_env):
        """SEMI-VERIFIED-5734 (Hodgkin lymphoma) must be quarantined and Samsung cleared."""
        data_path, _ = temp_env
        remediator = GroundingRemediator(filepath=data_path, offline_test_mode=True)
        report = remediator.run(dry_run=True)
        
        remediated = report["projects"]
        p = next(x for x in remediated if x["id"] == "SEMI-VERIFIED-5734")
        assert p["status"] == "quarantined"
        assert p["company"] is None

    def test_remediation_clears_company_on_pure_academic(self, temp_env):
        """Pure academic paper must clear false company attribution and become academic_only."""
        data_path, _ = temp_env
        remediator = GroundingRemediator(filepath=data_path, offline_test_mode=True)
        report = remediator.run(dry_run=True)
        
        remediated = report["projects"]
        p = next(x for x in remediated if x["id"] == "SEMI-VERIFIED-9999")
        assert p["company"] is None
        assert p["verification"]["collaboration_type"] == "academic_only"
        assert p["status"] == "completed"

    def test_remediation_idempotency_and_rollback(self, temp_env):
        """Applying remediation is idempotent and rollback fully restores original."""
        data_path, _ = temp_env
        with open(data_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

        remediator = GroundingRemediator(filepath=data_path, offline_test_mode=True)
        # Apply
        remediator.apply()
        
        # Verify applied
        with open(data_path, 'r', encoding='utf-8') as f:
            applied_content = f.read()
        assert applied_content != original_content
        
        # Idempotency check: apply again produces same projects data
        remediator.apply()
        with open(data_path, 'r', encoding='utf-8') as f:
            data_twice = json.load(f)
        data_applied = json.loads(applied_content)
        assert data_twice["projects"] == data_applied["projects"]
        
        # Rollback check
        remediator.rollback()
        with open(data_path, 'r', encoding='utf-8') as f:
            restored = f.read()
        assert restored == original_content
