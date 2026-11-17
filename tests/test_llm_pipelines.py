from scripts.llm_src_pipeline import (
    SONNET_MODEL as SRC_MODEL,
    deduplicate_projects,
    normalize_doi,
    reconstruct_abstract,
)
from scripts.harvest_ventures_llm import (
    SONNET_MODEL as VENTURE_MODEL,
    validate_venture_deal,
    normalize_venture_key,
)


class TestSrcLlmPipelineHelpers:
    def test_uses_cheapest_sonnet_model(self):
        assert SRC_MODEL == "claude-sonnet-4-6"
        assert VENTURE_MODEL == "claude-sonnet-4-6"

    def test_normalize_doi_and_reconstruct_abstract(self):
        assert normalize_doi("IEEE (2025) | DOI: https://doi.org/10.1109/IEDM.2025.1234.") == "10.1109/iedm.2025.1234"
        text = reconstruct_abstract({"Silicon": [0], "GAA": [1], "transistor": [2]})
        assert text == "Silicon GAA transistor"

    def test_deduplicate_projects_prefers_verified_by_doi_and_title(self):
        p_unverified = {
            "id": "OLD-1",
            "title": "High-NA EUV Stochastic Defect Control",
            "evidence_ref": "SPIE | DOI: https://doi.org/10.1117/12.345",
            "verification": {"status": "unverified_attributes", "collaboration_type": "academic_only"},
        }
        p_verified = {
            "id": "NEW-1",
            "title": "High-NA EUV Stochastic Defect Control",
            "evidence_ref": "SPIE | DOI: https://doi.org/10.1117/12.345",
            "verification": {"status": "verified", "collaboration_type": "co_authorship"},
        }
        p_title_dup = {
            "id": "DUP-TITLE",
            "title": "High NA EUV Stochastic Defect Control",
            "evidence_ref": "No DOI",
            "verification": {"status": "academic_verified", "collaboration_type": "academic_only"},
        }
        out = deduplicate_projects([p_unverified, p_verified, p_title_dup])
        assert len(out) == 1
        assert out[0]["id"] == "NEW-1"


class TestVentureLlmValidation:
    VALID_SECTORS = [
        "AI/ML Chips & Accelerators",
        "Optical Interconnect & Photonics",
        "Chiplet & Advanced Architecture",
    ]

    def test_rejects_missing_or_fake_url(self):
        bad = {
            "investor_company": "NVIDIA",
            "startup_name": "FakeCo",
            "sector": "AI/ML Chips & Accelerators",
            "investment_year": 2025,
            "startup_description": "Test description for chip startup.",
            "source_url": "http://example.com/fake",
        }
        assert validate_venture_deal(bad, self.VALID_SECTORS) is None

    def test_accepts_grounded_deal_without_fabricating_undisclosed_amount(self):
        good = {
            "investor_company": "NVIDIA",
            "cvc_arm": "NVentures",
            "startup_name": "Scintil Photonics",
            "startup_tech_tag": "실리콘 포토닉스",
            "investment_year": 2025,
            "investment_round": "Strategic Round",
            "investment_amount_usd": None,
            "sector": "Optical Interconnect & Photonics",
            "startup_description": "AI 데이터센터용 실리콘 포토닉스 광집적회로(PIC) 개발 기업.",
            "startup_hq_city": "Grenoble",
            "startup_hq_country": "France",
            "startup_lat": 45.1885,
            "startup_lon": 5.7245,
            "source_url": "https://www.cnbc.com/2025/11/example-scintil",
        }
        cleaned = validate_venture_deal(good, self.VALID_SECTORS)
        assert cleaned is not None
        assert cleaned["investment_amount_usd"] == 0
        assert cleaned["investment_amount_display"] == "Undisclosed"
        assert normalize_venture_key("NVIDIA", "Scintil Photonics") == ("nvidia", "scintilphotonics")
