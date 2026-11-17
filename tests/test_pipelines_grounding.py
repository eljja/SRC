import pytest
import os
import sys

# Ensure repo root is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.build_massive_dataset import convert_work_to_project as build_convert_work
from scripts.auto_update import create_census_project

class TestPipelinesGrounding:
    def test_build_massive_dataset_no_corporate_fallback(self):
        """Pure university paper must not receive corporate assignment from query label."""
        work = {
            'title': 'High mobility 2D MoS2 transistors with sub-1nm gate oxide',
            'doi': 'https://doi.org/10.1038/s41586-024-0001',
            'publication_year': 2024,
            'authorships': [
                {
                    'author': {'display_name': 'Prof. Kim'},
                    'institutions': [{'display_name': 'Seoul National University'}]
                }
            ],
            'primary_location': {'source': {'display_name': 'Nature'}}
        }
        # In the past, passing comp_label="Samsung Electronics" caused fallback to Samsung
        proj = build_convert_work("Samsung Electronics", work, 9999)
        assert proj is not None
        assert proj["company"] is None
        assert proj["verification"]["collaboration_type"] == "academic_only"
        assert "Samsung" not in proj["summary"]

    def test_build_massive_dataset_does_not_default_to_stanford(self):
        """When institution is unknown, it must not default to Stanford University."""
        work = {
            'title': 'Sub-1nm logic gate nanosheet fabrication',
            'doi': 'https://doi.org/10.1109/iedm.2024.0002',
            'publication_year': 2024,
            'authorships': [
                {
                    'author': {'display_name': 'Dr. Chen'},
                    'institutions': [{'display_name': 'Unknown Laboratory of Microelectronics'}]
                }
            ],
            'primary_location': {'source': {'display_name': 'IEEE IEDM'}}
        }
        proj = build_convert_work("GAA Nanosheet FET", work, 9998)
        assert proj is not None
        assert proj["university"] != "Stanford University"

    def test_auto_update_census_project_collaboration_type(self):
        """auto_update.py create_census_project must assign academic_only when no corporate sponsor."""
        proj = create_census_project(
            pid=7777,
            title="Advanced cryogenic CMOS logic circuits for quantum controllers",
            year=2024,
            doi="https://doi.org/10.1109/jssc.2024.12345",
            venue="IEEE JSSC",
            author="Prof. Alice",
            company=None,
            university="KAIST (한국과학기술원)"
        )
        assert proj["company"] is None
        assert proj["verification"]["collaboration_type"] == "academic_only"
        assert proj["status"] == "completed"
        assert "KAIST" in proj["university"]
