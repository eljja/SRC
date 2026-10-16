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
