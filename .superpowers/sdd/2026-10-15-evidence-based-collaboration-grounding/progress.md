# SDD ledger — plan: docs/superpowers/plans/2026-10-15-evidence-based-collaboration-grounding.md

Pre-flight: scan interfaces
- Task 1 produces: GroundingVerifier (classify_paper, extract_corporate_involvement, resolve_academic_institution, deduplicate_dataset)
- Task 2 consumes: GroundingVerifier from Task 1
- Task 3 consumes: GroundingVerifier from Task 1, updates data/collaborations.json
- Task 4 consumes: updated schema fields (collaboration_type: verified_collab vs academic_only) in frontend
- Task 5 executes: end-to-end audit report and full dataset execution
Pre-flight check: Clean, no interface conflicts.

## Task Status
- Task 1: complete
- Task 2: complete
- Task 3: complete
- Task 4: complete (node --check js/dataManager.js js/map.js js/network.js js/app.js && pytest tests/ -> 30/30 pass)
- Task 5: complete (remediate_grounding.py applied, 13746 projects, pytest 30/30 pass)

## Final Review Fix Pass
- Reviewer: Senior Code Reviewer (`b3b7e634-cd72-4849-a63f-c52aed2a8142`)
- Final: fixed legacy Stanford shadowing in resolve_academic_institution — test_academic_institution_resolution_not_shadowed_by_legacy_stanford RED→GREEN, suite 31/31
- Re-applied dataset remediation: false Stanford count dropped from 6,215 to 621, genuine universities resolved, empty affiliations set to 'Research Institution'
- All tests passing: 31/31 GREEN. All JS files node --check clean.
