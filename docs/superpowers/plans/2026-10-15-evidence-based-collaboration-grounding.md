# Evidence-Based Collaboration Grounding & Database Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the SRC Observatory database and harvesting pipelines so that 100% of records are strictly grounded in verifiable real evidence, eliminating all false corporate attributions (such as query-label fallbacks and journal-name collisions), non-semiconductor studies, and duplicates, while preserving a substantive database volume with clear tiering between verified industry-academia collaborations and pure academic semiconductor literature.

**Architecture:** A multi-stage grounding engine (`scripts/grounding_verifier.py`) inspects real DOI metadata (Crossref & OpenAlex), extracts genuine corporate co-authors and official grant funders, detects and quarantines non-semiconductor domain intrusions (e.g., hematology, entomology, law, surgery), deduplicates records, and assigns genuine universities and companies. Data pipelines (`auto_update.py`, `build_massive_dataset.py`) and frontend visualization components (`dataManager.js`, `map.js`, `network.js`, `app.js`) are updated to strictly respect evidence-based corporate involvement.

**Tech Stack:** Python 3.10+, Crossref API, OpenAlex API, Leaflet.js, D3.js v7, Chart.js, pytest, Vanilla JavaScript (ES6+).

**Spec:** Grounding & Evidence Integrity Protocol:
1. No corporate collaboration claim without explicit evidence (corporate author affiliation OR corporate funding grant OR joint consortium).
2. Pure academic semiconductor papers are preserved with `company: null`, `collaboration_type: "academic_only"`, and genuine university affiliation.
3. Non-semiconductor papers are quarantined (`status: "quarantined"`).
4. Full idempotency and rollback support with `_audit_history`.

## Global Constraints
- **Preserve User Additions**: Do not touch or modify `venture.html`, `js/venture*.js`, `data/ventures.json`, `scripts/*venture*.py`.
- **Zero Fabrication**: No synthetic formulas (modulo, citations) or fallback defaults to Samsung/Stanford.
- **Idempotency & Reversibility**: All database operations must be repeatable and support complete rollback via backup files.
- **TDD Requirement**: Every new feature or fix must have failing tests written first before implementation.

## Review Focus
1. **Journal name collision**: The journal *Micron* must NOT trigger corporate attribution to Micron Technology.
2. **Abbreviation collision**: *PIM kinase* in cancer biology must NOT trigger semiconductor Processing-in-Memory classification.
3. **Empty affiliation fallback**: An author with missing affiliation in Crossref must NOT default to Stanford University.
4. **Pure academic paper handling**: A high-impact university paper on GAA transistors without corporate authors must be preserved as academic semiconductor literature, NOT deleted or falsely linked to a company.
5. **Deduplication safety**: Duplicate records with identical DOIs or normalized titles must merge cleanly, preserving verified metadata without loss.

---

### Task 1: Grounding & Verification Core Engine (`scripts/grounding_verifier.py`)

**Files:**
- Create: `scripts/grounding_verifier.py`
- Test: `tests/test_grounding_verifier.py`

**Interfaces:**
- Produces: `GroundingVerifier` class with methods:
  - `classify_paper(title: str, summary: str, venue: str) -> dict`
  - `extract_corporate_involvement(authors: list, funders: list, venue: str) -> dict`
  - `resolve_academic_institution(authors: list, raw_uni: str) -> dict`
  - `deduplicate_dataset(projects: list) -> tuple[list, int]`

- [ ] **Step 1: Write failing tests in `tests/test_grounding_verifier.py`**
  - Test 1: Journal *Micron* does not attribute paper to Micron Technology.
  - Test 2: Funder containing "Samsung Research Funding" attributes company to Samsung Electronics with funder evidence.
  - Test 3: Funder containing "NVIDIA" attributes company to NVIDIA with grant evidence.
  - Test 4: Author affiliation "Intel Corporation, Hillsboro, OR" confirms co-authorship collaboration.
  - Test 5: Pure university authors with NRF/NSF funder returns `company = None` and `collaboration_type = "academic_only"`.
  - Test 6: Hematology/entomology/law paper detected as `is_semiconductor = False` and quarantined.
  - Test 7: Duplicate DOI merging retains highest-quality verified metadata.

- [ ] **Step 2: Run test to verify it fails**
  - Command: `python -m pytest tests/test_grounding_verifier.py -v`
  - Expected: FAIL (ModuleNotFoundError: No module named 'scripts.grounding_verifier')

- [ ] **Step 3: Implement `scripts/grounding_verifier.py`**
  - Implement semiconductor corporate entity patterns (preventing false matches like journal *Micron*, *Lam* in Vietnamese names, *Intel* in intelligence/intellectual).
  - Implement funder regex mapping for major semiconductor giants and consortia (Samsung, TSMC, Intel, SK Hynix, ASML, AMAT, Lam, KLA, NVIDIA, Qualcomm, Broadcom, SRC, etc.).
  - Implement comprehensive non-semiconductor domain filter (medical, surgical, dental, entomology, zoology, hematology, oncological, legal, general finance).
  - Implement academic institution resolver extracting genuine universities from author affiliation strings.
  - Implement canonical deduplicator by normalized DOI and normalized title.

- [ ] **Step 4: Run test to verify it passes**
  - Command: `python -m pytest tests/test_grounding_verifier.py -v`
  - Expected: PASS (7/7 tests passed).

- [ ] **Step 5: Commit Task 1**
  - Command: `git add scripts/grounding_verifier.py tests/test_grounding_verifier.py && git commit -m "feat(verifier): add GroundingVerifier core engine with corporate and domain checks"`

---

### Task 2: Update Harvesting & Batch Creation Pipelines

**Files:**
- Modify: `scripts/auto_update.py`
- Modify: `scripts/build_massive_dataset.py`
- Modify: `scripts/build_verified_dataset.py`
- Test: `tests/test_pipelines_grounding.py`

**Interfaces:**
- Consumes: `GroundingVerifier` from `scripts.grounding_verifier`
- Produces: Updated harvesting functions that never assign fallback companies or default to Stanford.

- [ ] **Step 1: Write failing tests in `tests/test_pipelines_grounding.py`**
  - Test 1: `convert_work_to_project` in `build_massive_dataset.py` sets `company: None` when author list has no corporate affiliation and funder is not corporate.
  - Test 2: `convert_work_to_project` does not default to `Stanford University` when affiliations are unparsed.
  - Test 3: `create_census_project` in `auto_update.py` properly marks pure academic papers as `collaboration_type: "academic_only"`.

- [ ] **Step 2: Run test to verify it fails**
  - Command: `python -m pytest tests/test_pipelines_grounding.py -v`
  - Expected: FAIL

- [ ] **Step 3: Update `scripts/build_massive_dataset.py`, `scripts/build_verified_dataset.py`, and `scripts/auto_update.py`**
  - Remove line 521-524 in `build_massive_dataset.py`: `corporate_inst = match_company(comp_label)`.
  - Use `GroundingVerifier` to validate authorships, funders, and domain relevance.
  - Set `summary` to reflect truth: "연구팀의 학술 연구 과제" for academic papers, and "연구팀과 [기업] 간의 산학 협력 연구 과제" ONLY when corporate involvement is confirmed.

- [ ] **Step 4: Run test to verify it passes**
  - Command: `python -m pytest tests/test_pipelines_grounding.py -v`
  - Expected: PASS

- [ ] **Step 5: Commit Task 2**
  - Command: `git add scripts/auto_update.py scripts/build_massive_dataset.py scripts/build_verified_dataset.py tests/test_pipelines_grounding.py && git commit -m "fix(pipelines): eliminate corporate fallback and Stanford default across harvesting scripts"`

---

### Task 3: Comprehensive Dataset Grounding & Remediation Controller (`scripts/remediate_grounding.py`)

**Files:**
- Create: `scripts/remediate_grounding.py`
- Test: `tests/test_remediation_grounding.py`

**Interfaces:**
- Produces: CLI script with `--dry-run`, `--apply`, `--rollback`, and `--report <file>` flags.
- Processes: Every record in `data/collaborations.json` through the grounding verifier.

- [ ] **Step 1: Write failing tests in `tests/test_remediation_grounding.py`**
  - Test 1: Remediation verifies genuine NVIDIA grant in `SEMI-2024-CENSUS-0481` (Korea Univ).
  - Test 2: Remediation corrects `SEMI-VERIFIED-0001` university from Stanford to KAIST / Korea Univ.
  - Test 3: Remediation clears company on pure academic paper (`company -> None`, `collaboration_type -> academic_only`).
  - Test 4: Remediation quarantines beetle wing paper (`SEMI-2025-CENSUS-0299`) and clears Micron attribution.
  - Test 5: Remediation quarantines lymphoma cancer paper (`SEMI-VERIFIED-5734`).
  - Test 6: Idempotency and rollback verification.

- [ ] **Step 2: Run test to verify it fails**
  - Command: `python -m pytest tests/test_remediation_grounding.py -v`
  - Expected: FAIL

- [ ] **Step 3: Implement `scripts/remediate_grounding.py`**
  - Build `GroundingRemediator` class with multi-threaded Crossref/OpenAlex cache-backed verification.
  - Cache metadata locally in `data/.cache_doi/` to enable fast, reproducible execution without rate-limit errors.
  - Classify records into `verified_collaboration`, `academic_semiconductor`, and `quarantined`.
  - Deduplicate dataset to eliminate identical DOIs and redundant entries.
  - Maintain complete audit history in `_audit_history`.

- [ ] **Step 4: Run test to verify it passes**
  - Command: `python -m pytest tests/test_remediation_grounding.py -v`
  - Expected: PASS

- [ ] **Step 5: Commit Task 3**
  - Command: `git add scripts/remediate_grounding.py tests/test_remediation_grounding.py && git commit -m "feat(remediation): implement GroundingRemediator with DOI cache and tier classification"`

---

### Task 4: Frontend UI Alignment for Verified Collaborations vs Academic Literature

**Files:**
- Modify: `js/dataManager.js`
- Modify: `js/map.js`
- Modify: `js/network.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `css/style.css`

**Interfaces:**
- Produces: Clear 2-tier UI where users can view:
  - "전체 유효 연구 (All Valid Research)"
  - "🏢 검증 산학협력 (Verified Industry-Academia Only)"
  - "🎓 학술 연구 문헌 (Academic Literature)"
  - "⚠️ 검토대기/격리 (Quarantined)"

- [ ] **Step 1: Update `js/dataManager.js`**
  - Add filter support for `collaboration_tier`: `'all'`, `'verified_collab'`, `'academic_only'`, `'quarantined'`.
  - In `getSummaryStats()`: count verified industry-academia collaborations and academic literature separately.
  - Ensure rankings and company matrix only aggregate confirmed corporate collaborations.

- [ ] **Step 2: Update `js/map.js` & `js/network.js`**
  - In `map.js`: Arcs are only drawn for verified corporate-academic collaborations (`p.company && p.verification?.collaboration_type !== 'academic_only'`).
  - In `network.js`: Corporate nodes and industry-academia links are strictly built from verified collaborations.

- [ ] **Step 3: Update `js/app.js`, `index.html`, `css/style.css`**
  - In `index.html`: Add filter pills for `🏢 검증 산학협력` and `🎓 학술 연구 문헌`.
  - In `app.js`: Render badges `.badge-collab-verified` and `.badge-academic-only`.
  - Update project details modal to show exact collaboration type and proof (co-authorship vs grant funder).
  - In `css/style.css`: Add styles for `.badge-collab-verified` and `.badge-academic-only`.

- [ ] **Step 4: Run Node syntax check and pytest**
  - Command: `node --check js/dataManager.js js/map.js js/network.js js/app.js`
  - Command: `python -m pytest tests/ -v`
  - Expected: Exit code 0, all tests pass.

- [ ] **Step 5: Commit Task 4**
  - Command: `git add js/dataManager.js js/map.js js/network.js js/app.js index.html css/style.css && git commit -m "feat(ui): add collaboration tier filtering and distinct badges for verified vs academic research"`

---

### Task 5: End-to-End Dataset Execution, Verification, and Audit Report

**Files:**
- Execute: `python scripts/remediate_grounding.py --dry-run --report reports/grounding_audit_report.md`
- Execute: `python scripts/remediate_grounding.py --apply`
- Test: Full regression test suite (`tests/`)

- [ ] **Step 1: Run dry-run audit and review results**
  - Command: `python scripts/remediate_grounding.py --dry-run --report reports/grounding_audit_report.md`
  - Verify statistics: Count of confirmed corporate collaborations, pure academic papers, and quarantined non-semi papers.

- [ ] **Step 2: Run apply on dataset**
  - Command: `python scripts/remediate_grounding.py --apply`
  - Verify `data/collaborations.json` backup was created and new file is valid JSON.

- [ ] **Step 3: Run full pytest suite across all test files**
  - Command: `python -m pytest tests/ -v`
  - Expected: All tests pass.

- [ ] **Step 4: Run node syntax check**
  - Command: `node --check js/dataManager.js js/map.js js/network.js js/app.js`
  - Expected: Exit code 0.

- [ ] **Step 5: Review git diff and commit**
  - Command: `git status`
  - Verify no unintended files or user venture files are touched.
  - Commit: `git add data/collaborations.json reports/ && git commit -m "fix(data): apply evidence-based grounding remediation across entire dataset"`
