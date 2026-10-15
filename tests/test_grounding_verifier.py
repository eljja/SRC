import pytest
from scripts.grounding_verifier import GroundingVerifier

@pytest.fixture
def verifier():
    return GroundingVerifier()

class TestGroundingVerifier:
    def test_journal_name_does_not_trigger_corporate_attribution(self, verifier):
        """Journal 'Micron' must not cause attribution to Micron Technology."""
        authors = [{"family": "Yan", "affiliations": ["Jilin University, Changchun, China"]}]
        funders = ["National Natural Science Foundation of China"]
        venue = "Micron (Elsevier)"
        title = "Analysis of biomechanical passive synergistic vibration reduction in beetle hindwings"
        
        corp_info = verifier.extract_corporate_involvement(authors, funders, venue, title)
        assert corp_info["company"] is None
        assert corp_info["collaboration_type"] == "academic_only"
        assert corp_info["has_corporate_involvement"] is False

    def test_funder_corporate_attribution(self, verifier):
        """Official corporate funder must verify corporate sponsorship."""
        authors = [{"family": "Hyun", "affiliations": ["KAIST, Daejeon, Korea"]}]
        funders = ["Samsung Research Funding & Incubation Center of Samsung Electronics"]
        venue = "Nature Communications"
        title = "Attosecond electronic timing with rising edges of photocurrent pulses"
        
        corp_info = verifier.extract_corporate_involvement(authors, funders, venue, title)
        assert corp_info["company"] == "Samsung Electronics"
        assert corp_info["collaboration_type"] == "corporate_grant"
        assert corp_info["has_corporate_involvement"] is True
        assert "Samsung Research Funding" in corp_info["evidence_quote"]

    def test_nvidia_funder_attribution(self, verifier):
        """NVIDIA funder must be attributed as corporate grant."""
        authors = [{"family": "Park", "affiliations": ["Korea University, Seoul, Korea"]}]
        funders = ["NVIDIA", "National Research Foundation of Korea"]
        venue = "CVPR"
        title = "Prompt Learning via Meta-Regularization"
        
        corp_info = verifier.extract_corporate_involvement(authors, funders, venue, title)
        assert corp_info["company"] == "NVIDIA"
        assert corp_info["collaboration_type"] == "corporate_grant"
        assert corp_info["has_corporate_involvement"] is True

    def test_co_authorship_attribution(self, verifier):
        """Corporate author affiliation confirms co-authorship collaboration."""
        authors = [
            {"family": "Smith", "affiliations": ["Intel Corporation, Hillsboro, OR, USA"]},
            {"family": "Johnson", "affiliations": ["Stanford University, Stanford, CA, USA"]}
        ]
        funders = []
        venue = "IEDM"
        title = "RibbonFET GAA architecture at 18A process node"
        
        corp_info = verifier.extract_corporate_involvement(authors, funders, venue, title)
        assert corp_info["company"] == "Intel"
        assert corp_info["collaboration_type"] == "co_authorship"
        assert corp_info["has_corporate_involvement"] is True

    def test_pure_academic_paper(self, verifier):
        """Pure university research with no corporate affiliation or funder is academic_only."""
        authors = [{"family": "Lee", "affiliations": ["Department of Physics, Seoul National University"]}]
        funders = ["National Research Foundation of Korea (NRF)"]
        venue = "Nano Letters"
        title = "Two-dimensional MoS2 field-effect transistors with sub-1nm gate oxide"
        
        corp_info = verifier.extract_corporate_involvement(authors, funders, venue, title)
        assert corp_info["company"] is None
        assert corp_info["collaboration_type"] == "academic_only"
        assert corp_info["has_corporate_involvement"] is False

    def test_non_semiconductor_quarantine(self, verifier):
        """Medical, biological, legal, and entomological papers are flagged for quarantine."""
        non_semi_cases = [
            ("PIM kinase inhibition attenuates pro-tumoral macrophages in classic Hodgkin lymphoma", "Cell Death Dis"),
            ("Analysis of biomechanical passive synergistic vibration reduction in beetle hindwings", "Micron"),
            ("Digital Dram Shops and Intoxicating Algorithms", "SSRN"),
            ("Alpha-thalassaemia early eluting peak carrier screening: a multicentre diagnostic comparison", "Annals of Hematology"),
            ("Unilateral biportal endoscopy for lumbar spine surgery", "Journal of Orthopaedic Case Reports")
        ]
        for title, venue in non_semi_cases:
            res = verifier.classify_paper(title, venue=venue)
            assert res["is_semiconductor"] is False, f"Failed to identify non-semiconductor: {title}"
            assert res["quarantine_reason"] is not None

    def test_real_semiconductor_paper_preservation(self, verifier):
        """Genuine semiconductor papers are preserved."""
        semi_cases = [
            "Gate-all-around nanosheet FETs with multi-channel vertical stacking",
            "High-NA EUV lithography stochastic defect mitigation using novel photoresists",
            "A 1.2V 3D stacked HBM3E memory interface with 9.6 Gbps per pin data rate",
            "Breakdown voltage enhancement in 1200V 4H-SiC trench MOSFETs"
        ]
        for title in semi_cases:
            res = verifier.classify_paper(title)
            assert res["is_semiconductor"] is True, f"Failed to identify semiconductor paper: {title}"
            assert res["quarantine_reason"] is None

    def test_academic_institution_resolution(self, verifier):
        """Extracts genuine universities from affiliations without defaulting to Stanford."""
        affs_postech = ["Department of Electrical Engineering, Pohang University of Science and Technology (POSTECH), Pohang, Korea"]
        inst = verifier.resolve_academic_institution(affs_postech)
        assert "POSTECH" in inst["name"]
        assert inst["country"] == "South Korea"

        affs_kaist = ["School of Electrical Engineering, KAIST, Daejeon, Korea"]
        inst_kaist = verifier.resolve_academic_institution(affs_kaist)
        assert "KAIST" in inst_kaist["name"]

        # When affiliations cannot be resolved to known curated list, raw affiliation is kept, never faked Stanford
        raw_aff = ["Department of Applied Science, Delft University of Technology, Netherlands"]
        inst_delft = verifier.resolve_academic_institution(raw_aff)
        assert "Delft" in inst_delft["name"]

    def test_canonical_deduplication(self, verifier):
        """Deduplication merges duplicate DOIs and cleans dataset."""
        projects = [
            {"id": "P1", "title": "GAA Nanosheet FET", "evidence_ref": "DOI: 10.1109/iedm.2024.123", "verification": {"collaboration_type": "co_authorship"}},
            {"id": "P2", "title": "GAA Nanosheet FET", "evidence_ref": "DOI: 10.1109/IEDM.2024.123", "verification": {"collaboration_type": "academic_only"}},
            {"id": "P3", "title": "Unique Distinct Project", "evidence_ref": "DOI: 10.1109/iedm.2024.456", "verification": {"collaboration_type": "academic_only"}}
        ]
        deduped, removed_count = verifier.deduplicate_dataset(projects)
        assert len(deduped) == 2
        assert removed_count == 1
        # Highest quality (co_authorship) retained
        merged = next(p for p in deduped if "123" in p["evidence_ref"])
        assert merged["verification"]["collaboration_type"] == "co_authorship"
