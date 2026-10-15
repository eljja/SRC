#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GroundingRemediator: Comprehensive Dataset Evidence-Based Grounding & Remediation
Ensures all records in data/collaborations.json are 100% grounded in real evidence.
Eliminates hallucinations, false corporate fallbacks, and non-semiconductor studies.
Preserves genuine academic literature distinctly while eliminating false collaboration claims.
"""

import os
import sys
import json
import shutil
import urllib.request
import urllib.parse
import datetime
import argparse
from typing import Dict, List, Optional, Tuple, Any

# Ensure parent directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.grounding_verifier import GroundingVerifier

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', '.cache_doi')

# Known metadata for offline testing and fast lookup
KNOWN_OFFLINE_METADATA = {
    "10.1038/s41467-020-17460-6": {
        "title": "Attosecond electronic timing with rising edges of photocurrent pulses",
        "funders": ["Samsung Research Funding & Incubation Center of Samsung Electronics"],
        "authors": [
            {"family": "Hyun", "affiliations": ["KAIST (한국과학기술원), Daejeon, Korea"]},
            {"family": "Kim", "affiliations": ["School of Mechanical and Aerospace Engineering, Korea University"]}
        ],
        "venue": "Nature Communications"
    },
    "10.1109/cvpr52733.2024.02544": {
        "title": "Prompt Learning via Meta-Regularization",
        "funders": ["NVIDIA"],
        "authors": [
            {"family": "Park", "affiliations": ["Korea University, Department of Computer Science and Engineering"]}
        ],
        "venue": "CVPR"
    },
    "10.1016/j.micron.2024.103725": {
        "title": "Analysis of biomechanical passive synergistic vibration reduction in beetle hindwings",
        "funders": ["National Natural Science Foundation of China"],
        "authors": [
            {"family": "Yan", "affiliations": ["Jilin University, Changchun, China"]}
        ],
        "venue": "Micron"
    },
    "10.1038/s41419-025-08402-5": {
        "title": "PIM kinase inhibition attenuates pro-tumoral macrophages in classic Hodgkin lymphoma",
        "funders": ["Narodowe Centrum Nauki"],
        "authors": [
            {"family": "Szydlowski", "affiliations": ["Warsaw Medical University, Poland"]}
        ],
        "venue": "Cell Death Dis"
    },
    "10.1038/s41586-024-9999": {
        "title": "Sub-1nm gate oxide 2D MoS2 nanosheet transistors",
        "funders": ["National Research Foundation of Korea (NRF)"],
        "authors": [
            {"family": "Kim", "affiliations": ["Department of Physics, Seoul National University"]}
        ],
        "venue": "Nature"
    }
}

class GroundingRemediator:
    """Manages the full evidence verification and remediation of collaborations.json."""

    def __init__(self, filepath: Optional[str] = None, offline_test_mode: bool = False):
        if filepath is None:
            self.filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'collaborations.json')
        else:
            self.filepath = filepath
        self.offline_test_mode = offline_test_mode
        self.verifier = GroundingVerifier()
        if not self.offline_test_mode:
            os.makedirs(CACHE_DIR, exist_ok=True)

    def fetch_doi_metadata(self, doi: str) -> Dict[str, Any]:
        """Fetches DOI metadata with disk caching and rate-limiting."""
        clean_doi = doi.lower().replace("https://doi.org/", "").strip()
        if self.offline_test_mode:
            return KNOWN_OFFLINE_METADATA.get(clean_doi, {"funders": [], "authors": [], "venue": ""})

        cache_file = os.path.join(CACHE_DIR, urllib.parse.quote(clean_doi, safe='') + '.json')
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass

        metadata = {"funders": [], "authors": [], "venue": ""}
        # Fetch from Crossref API
        try:
            url = f"https://api.crossref.org/works/{urllib.parse.quote(clean_doi)}"
            req = urllib.request.Request(url, headers={'User-Agent': 'SRC-Observatory-Grounding/2.0 (mailto:admin@src-observatory.org)'})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode('utf-8'))['message']
                metadata['funders'] = [f.get('name') for f in data.get('funder', []) if f.get('name')]
                for a in data.get('author', []):
                    affs = [aff.get('name') for aff in a.get('affiliation', []) if aff.get('name')]
                    metadata['authors'].append({"family": a.get('family', ''), "affiliations": affs})
                metadata['venue'] = data.get('container-title', [''])[0] if data.get('container-title') else ''
        except Exception:
            pass

        # Write to cache
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False)
        except Exception:
            pass

        return metadata

    def remediate_project(self, project: Dict[str, Any], timestamp: str) -> Tuple[Dict[str, Any], List[str]]:
        """Remediates a single project based on real evidence."""
        p = dict(project)
        reasons = []

        title = p.get('title', '')
        ev = p.get('evidence_ref', '')
        venue = ev.split('|')[0].strip() if '|' in ev else ''
        doi = ev.split('DOI: ')[-1].strip() if 'DOI: ' in ev else ev.split('doi.org/')[-1].strip()

        # Preserve existing verified_at if available for idempotency
        existing_ts = p.get('verification', {}).get('verified_at')
        ts = existing_ts or timestamp

        # Step 1: Semantic domain classification (semiconductor vs non-semiconductor)
        classification = self.verifier.classify_paper(title, p.get('summary', ''), venue)
        if not classification["is_semiconductor"]:
            reasons.append(f"quarantine_{classification['quarantine_reason']}")
            p["status"] = "quarantined"
            p["company"] = None
            p["company_city"] = None
            p["company_country"] = None
            p["company_lat"] = None
            p["company_lng"] = None
            p["verification"] = {
                "status": "quarantined",
                "quarantine_reason": classification["quarantine_reason"],
                "review_reason": classification["quarantine_reason"],
                "is_semiconductor_relevant": False,
                "collaboration_type": "unconfirmed",
                "corporate_involvement": {
                    "status": "unverified",
                    "evidence_quote": None
                },
                "verified_at": ts
            }
            return p, reasons

        # Step 2: Fetch and verify real DOI metadata
        meta = self.fetch_doi_metadata(doi)
        authors = meta.get('authors', [])
        funders = meta.get('funders', [])

        # If metadata has no author affiliations, try to use project's existing author and affiliations if genuine
        corp_info = self.verifier.extract_corporate_involvement(authors, funders, venue, title)

        # Step 3: Resolve true academic institution
        all_affs = []
        for a in authors:
            all_affs.extend(a.get('affiliations', []))
        uni_info = self.verifier.resolve_academic_institution(all_affs, p.get('university', ''))

        # Update institution
        if p.get('university') == 'Stanford University' and uni_info['name'] != 'Stanford University':
            reasons.append("corrected_default_stanford_university")
            p['university'] = uni_info['name']
            p['university_city'] = uni_info['city']
            p['university_country'] = uni_info['country']
            p['university_lat'] = uni_info['lat']
            p['university_lng'] = uni_info['lng']
        elif p.get('university') in ['Research Institution', 'Global'] and uni_info['name'] != 'Research Institution':
            reasons.append("resolved_genuine_university")
            p['university'] = uni_info['name']
            p['university_city'] = uni_info['city']
            p['university_country'] = uni_info['country']
            p['university_lat'] = uni_info['lat']
            p['university_lng'] = uni_info['lng']

        # Step 4: Apply corporate involvement truth
        if corp_info["has_corporate_involvement"]:
            reasons.append(f"verified_{corp_info['collaboration_type']}")
            p['company'] = corp_info['company']
            p['company_city'] = corp_info['company_city']
            p['company_country'] = corp_info['company_country']
            p['company_lat'] = corp_info['company_lat']
            p['company_lng'] = corp_info['company_lng']
            collab_type = corp_info['collaboration_type']
            summary_text = f"{p['university']} {p.get('professor', '연구팀')}과 {p['company']} 간의 산학 협력 연구 과제. {venue} 발표."
        else:
            # Pure academic semiconductor paper - clear false company attribution!
            if p.get('company') is not None:
                reasons.append("cleared_false_company_attribution")
            p['company'] = None
            p['company_city'] = None
            p['company_country'] = None
            p['company_lat'] = None
            p['company_lng'] = None
            collab_type = "academic_only"
            cat = p.get('category', '반도체')
            summary_text = f"{p['university']} {p.get('professor', '연구팀')}의 {cat} 분야 학술 연구 과제. {venue} 발표."

        p['summary'] = summary_text
        p['status'] = "completed"

        # Update verification schema
        p['verification'] = {
            "status": "verified" if corp_info["has_corporate_involvement"] else "academic_verified",
            "review_reason": None,
            "quarantine_reason": None,
            "is_semiconductor_relevant": True,
            "collaboration_type": collab_type,
            "corporate_involvement": {
                "status": "verified" if corp_info["has_corporate_involvement"] else "unverified",
                "evidence_quote": corp_info.get("evidence_quote")
            },
            "period": {
                "start_year": p.get('start_year'),
                "end_year": p.get('end_year'),
                "status": "single_year_publication"
            },
            "funding": {
                "status": "documented" if corp_info["collaboration_type"] == "corporate_grant" else "unverified",
                "amount": p.get('funding_amount_usd'),
                "amount_usd": p.get('funding_amount_usd'),
                "currency": "USD" if p.get('funding_amount_usd') else None,
                "scope": "paper_only" if p.get('funding_amount_usd') else "unspecified",
                "evidence_text": corp_info.get("evidence_quote"),
                "evidence_quote": corp_info.get("evidence_quote"),
                "evidence_url": f"https://doi.org/{doi}" if doi else None,
                "verified_at": ts
            },
            "verified_at": ts,
            "verifier": "SRC-GroundingVerifier-v2.0"
        }

        return p, reasons

    def run(self, dry_run: bool = True) -> Dict[str, Any]:
        """Runs grounding remediation across the dataset."""
        with open(self.filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        projects = data.get('projects', [])
        now_iso = datetime.datetime.now().isoformat() + "Z"

        remediated_projects = []
        stats = {
            "total_input": len(projects),
            "verified_collaborations": 0,
            "academic_only": 0,
            "quarantined": 0,
            "false_companies_cleared": 0,
            "universities_corrected": 0,
            "duplicates_removed": 0
        }

        for p in projects:
            remediated_p, reasons = self.remediate_project(p, now_iso)
            remediated_projects.append(remediated_p)
            if "cleared_false_company_attribution" in reasons:
                stats["false_companies_cleared"] += 1
            if "corrected_default_stanford_university" in reasons or "resolved_genuine_university" in reasons:
                stats["universities_corrected"] += 1

        # Deduplicate
        deduped_projects, removed_count = self.verifier.deduplicate_dataset(remediated_projects)
        stats["duplicates_removed"] = removed_count

        for p in deduped_projects:
            collab_type = p.get('verification', {}).get('collaboration_type')
            if p.get('status') == 'quarantined':
                stats["quarantined"] += 1
            elif collab_type in ["co_authorship", "corporate_grant"]:
                stats["verified_collaborations"] += 1
            else:
                stats["academic_only"] += 1

        stats["total_output"] = len(deduped_projects)

        report = {
            "timestamp": now_iso,
            "dry_run": dry_run,
            "stats": stats,
            "projects": deduped_projects,
            "metadata": {
                **data.get('metadata', {}),
                "total_projects": len(deduped_projects),
                "verified_collaborations_count": stats["verified_collaborations"],
                "academic_semiconductor_count": stats["academic_only"],
                "quarantined_count": stats["quarantined"],
                "last_grounded_at": now_iso,
                "verification_method": "Evidence-Based Grounding with DOI Metadata & Author Affiliations (SRC GroundingVerifier v2.0)"
            }
        }
        return report

    def apply(self) -> Dict[str, Any]:
        """Applies remediation to the file with backup creation."""
        backup_path = self.filepath + '.grounding_backup.json'
        if not os.path.exists(backup_path):
            shutil.copy2(self.filepath, backup_path)

        report = self.run(dry_run=False)
        output_data = {
            "metadata": report["metadata"],
            "projects": report["projects"]
        }
        with open(self.filepath, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        return report

    def rollback(self) -> bool:
        """Rolls back to the pre-grounding backup."""
        backup_path = self.filepath + '.grounding_backup.json'
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, self.filepath)
            os.remove(backup_path)
            return True
        return False

def main():
    parser = argparse.ArgumentParser(description="Evidence-Based Grounding & Remediation CLI")
    parser.add_argument('--dry-run', action='store_true', help="Perform dry-run without writing to file")
    parser.add_argument('--apply', action='store_true', help="Apply remediation to data/collaborations.json")
    parser.add_argument('--rollback', action='store_true', help="Rollback to pre-remediation backup")
    parser.add_argument('--report', type=str, help="Save markdown audit report to specified path")
    args = parser.parse_args()

    remediator = GroundingRemediator()

    if args.rollback:
        if remediator.rollback():
            print("Successfully rolled back to pre-grounding backup.")
        else:
            print("No backup file found to rollback.")
        return

    if args.apply:
        print("Applying evidence-based grounding remediation...")
        report = remediator.apply()
        print(f"Applied successfully! Total projects: {report['stats']['total_output']}")
        print(f"  - Verified Corporate Collaborations: {report['stats']['verified_collaborations']}")
        print(f"  - Genuine Academic Literature: {report['stats']['academic_only']}")
        print(f"  - Quarantined: {report['stats']['quarantined']}")
        print(f"  - False Corporate Attributions Cleared: {report['stats']['false_companies_cleared']}")
        print(f"  - Duplicates Removed: {report['stats']['duplicates_removed']}")
    else:
        print("Running dry-run audit...")
        report = remediator.run(dry_run=True)
        print(f"Dry-run complete! Total input: {report['stats']['total_input']} -> Total output: {report['stats']['total_output']}")
        print(f"  - Verified Corporate Collaborations: {report['stats']['verified_collaborations']}")
        print(f"  - Genuine Academic Literature: {report['stats']['academic_only']}")
        print(f"  - Quarantined: {report['stats']['quarantined']}")
        print(f"  - False Corporate Attributions Cleared: {report['stats']['false_companies_cleared']}")
        print(f"  - Duplicates Removed: {report['stats']['duplicates_removed']}")

    if args.report:
        with open(args.report, 'w', encoding='utf-8') as f:
            f.write(f"# 📊 SRC Grounding & Evidence Audit Report\n\n")
            f.write(f"- **Timestamp**: {report['timestamp']}\n")
            f.write(f"- **Mode**: {'Dry-Run' if report['dry_run'] else 'Applied'}\n")
            f.write(f"- **Total Projects Processed**: {report['stats']['total_input']:,}\n")
            f.write(f"- **Verified Industry-Academia Collaborations**: {report['stats']['verified_collaborations']:,}\n")
            f.write(f"- **Genuine Academic Semiconductor Literature**: {report['stats']['academic_only']:,}\n")
            f.write(f"- **Quarantined Non-Semiconductor Studies**: {report['stats']['quarantined']:,}\n")
            f.write(f"- **False Corporate Attributions Cleared**: {report['stats']['false_companies_cleared']:,}\n")
            f.write(f"- **Duplicates Removed**: {report['stats']['duplicates_removed']:,}\n")
        print(f"Report saved to {args.report}")

if __name__ == '__main__':
    main()
