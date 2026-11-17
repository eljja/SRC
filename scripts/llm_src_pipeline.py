#!/usr/bin/env python3
"""
Precision OpenAlex Harvester + Claude Sonnet 4.6 Verification Pipeline for SRC

1. Uses OpenAlex API key (`OPENALEX_API_KEY`) to query verified Corporate × Education
   co-authorships and Corporate / SRC Funder Grants (`funders.id`), pre-filtered to
   Physical Sciences (`primary_topic.domain.id:3`) and semiconductor hardware keywords.
2. Uses Anthropic's cheapest Sonnet model (`claude-sonnet-4-6`) with local disk caching
   (`data/.cache_llm/src_judgments.json`) and 15-item batching to verify semiconductor
   hardware relevance, classify into the 7 SRC categories, verify collaboration type,
   and produce crisp Korean technical summaries.
3. Deduplicates strictly by canonical DOI and normalized title so project counts (and
   benchmark funding sums) are 100% duplicate-free.
"""

from __future__ import annotations

import datetime
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.auto_update import COMPANY_MAP, INSTITUTION_MAP, create_census_project

SONNET_MODEL = "claude-sonnet-4-6"
DATA_FILE = ROOT / "data" / "collaborations.json"
CACHE_FILE = ROOT / "data" / ".cache_llm" / "src_judgments.json"

VALID_CATEGORIES = [
    "Advanced Logic & Transistors (GAA/CFET/2D)",
    "Memory & Storage (HBM/PIM/3D NAND)",
    "Advanced Packaging & Chiplets (3D/Hybrid Bonding)",
    "Lithography & Metrology (EUV/High-NA)",
    "Power & Compound Semiconductors (GaN/SiC)",
    "Silicon Photonics & Optical I/O",
    "AI & Neuromorphic Computing",
]

# Verified OpenAlex Corporate Institution IDs & Funder IDs
OPENALEX_CORP_TARGETS = [
    {"company": "Samsung Electronics", "inst_ids": ["I4405259277"], "funder_ids": ["F4320332195", "F4320328437"]},
    {"company": "SK Hynix", "inst_ids": ["I4405272917"], "funder_ids": ["F4320317879"]},
    {"company": "TSMC", "inst_ids": ["I4210120917"], "funder_ids": ["F4320322589"]},
    {"company": "Intel", "inst_ids": ["I1343180700"], "funder_ids": ["F4320307102"]},
    {"company": "NVIDIA", "inst_ids": ["I4210127875"], "funder_ids": ["F4320309480"]},
    {"company": "ASML", "inst_ids": ["I927257375"], "funder_ids": ["F4320323783"]},
    {"company": "Applied Materials (AMAT)", "inst_ids": ["I193427800"], "funder_ids": ["F4320309679"]},
    {"company": "Lam Research", "inst_ids": ["I4210139090"], "funder_ids": ["F4320309441"]},
    {"company": "KLA Corporation", "inst_ids": ["I70745867"], "funder_ids": []},
    {"company": "Micron Technology", "inst_ids": ["I11912373"], "funder_ids": ["F4320307112"]},
    {"company": "Qualcomm", "inst_ids": ["I4210087596"], "funder_ids": ["F4320308258"]},
    {"company": "Broadcom", "inst_ids": ["I4210127325"], "funder_ids": []},
    {"company": "MediaTek", "inst_ids": ["I4210148979"], "funder_ids": []},
    {"company": "Texas Instruments", "inst_ids": ["I74760111"], "funder_ids": []},
    {"company": "STMicroelectronics", "inst_ids": ["I4210104693"], "funder_ids": ["F4320322569"]},
    {"company": "Infineon Technologies", "inst_ids": ["I137594350"], "funder_ids": ["F4320330618"]},
    {"company": "NXP Semiconductors", "inst_ids": ["I4210123704"], "funder_ids": []},
    {"company": "Sony Semiconductor", "inst_ids": ["I4405263054", "I4405283536"], "funder_ids": []},
    {"company": "Tokyo Electron (TEL)", "inst_ids": ["I114132059"], "funder_ids": ["F4320315610"]},
    {"company": "GlobalFoundries", "inst_ids": ["I35662394"], "funder_ids": []},
    {"company": "Synopsys", "inst_ids": ["I4210088951"], "funder_ids": []},
    {"company": "Cadence Design Systems", "inst_ids": ["I66217453"], "funder_ids": []},
    {"company": "Kioxia", "inst_ids": ["I4405260140"], "funder_ids": []},
    {"company": "Renesas Electronics", "inst_ids": ["I4210153176"], "funder_ids": []},
    {"company": "Arm", "inst_ids": ["I2801109035"], "funder_ids": []},
    {"company": "Wolfspeed", "inst_ids": ["I4210109581"], "funder_ids": []},
    {"company": "Onsemi", "inst_ids": ["I100625452", "I4210110772"], "funder_ids": []},
]

SEMI_CANDIDATE_REGEX = re.compile(
    r"\b(semiconductor|transistor|cmos|finfet|gaa|cfet|nanosheet|dram|hbm|sram|mram|"
    r"nand|rram|fefet|euv|lithography|photoresist|etch|ald|cvd|interposer|chiplet|"
    r"hybrid bonding|cowos|ucie|photonic|silicon photonics|modulator|waveguide|cpo|"
    r"gan|sic|mosfet|hemt|npu|neuromorphic|accelerator|vlsi|ic|integrated circuit|wafer)\b",
    re.IGNORECASE,
)


def load_env_keys() -> dict[str, str]:
    """Load secrets cleanly from os.environ or .env without hardcoding."""
    keys = {
        "OPENALEX_API_KEY": os.environ.get("OPENALEX_API_KEY", ""),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
    }
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip()
                if k in keys and not keys[k]:
                    keys[k] = v
    return keys


def normalize_doi(raw: str | None) -> str:
    if not raw:
        return ""
    m = re.search(r"10\.\d{4,9}/[^\s|\"'<>]+", raw.lower())
    if m:
        return m.group(0).rstrip(".,;)")
    return ""


def normalize_title(title: str | None) -> str:
    if not title:
        return ""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9가-힣\s]", " ", title.lower())).strip()


def reconstruct_abstract(inv_idx: dict[str, list[int]] | None, max_words: int = 90) -> str:
    if not inv_idx or not isinstance(inv_idx, dict):
        return ""
    pairs = []
    for word, positions in inv_idx.items():
        if isinstance(positions, list):
            for pos in positions:
                pairs.append((pos, word))
    pairs.sort()
    return " ".join(w for _, w in pairs[:max_words])


def deduplicate_projects(projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Deduplicate projects by canonical DOI and normalized title, preserving highest-evidence entries."""
    seen_dois: set[str] = set()
    seen_titles: set[str] = set()
    # Sort so verified collaborations and documented entries come first
    def priority(p: dict[str, Any]) -> tuple[int, int]:
        ver = p.get("verification") or {}
        st = ver.get("status")
        p_rank = 3 if st == "verified" else (2 if st == "academic_verified" else (0 if st == "quarantined" else 1))
        has_corp = 1 if (ver.get("collaboration_type") in ("corporate_grant", "co_authorship")) else 0
        return (p_rank, has_corp)

    deduped: list[dict[str, Any]] = []
    for p in sorted(projects, key=priority, reverse=True):
        doi = normalize_doi(p.get("evidence_ref"))
        ntitle = normalize_title(p.get("title") or p.get("topic"))
        if doi and doi in seen_dois:
            continue
        if ntitle and len(ntitle) > 15 and ntitle in seen_titles:
            continue
        if doi:
            seen_dois.add(doi)
        if ntitle and len(ntitle) > 15:
            seen_titles.add(ntitle)
        deduped.append(p)
    return deduped


def _fetch_openalex_works(filter_str: str, api_key: str, per_page: int = 50, page: int = 1) -> list[dict[str, Any]]:
    url = (
        f"https://api.openalex.org/works?"
        f"filter={urllib.parse.quote(filter_str, safe=':,|')}"
        f"&per-page={per_page}&page={page}&sort=cited_by_count:desc"
    )
    if api_key:
        url += f"&api_key={urllib.parse.quote(api_key)}"
    req = urllib.request.Request(url, headers={"User-Agent": "SRC-Observatory/2.0 (mailto:admin@src.org)"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8")).get("results", [])


def _extract_university_and_pi(work: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    authorships = work.get("authorships") or []
    first_auth = ((authorships[0].get("author") or {}).get("display_name") if authorships else None) or "Lead PI"
    last_auth = ((authorships[-1].get("author") or {}).get("display_name") if authorships else None) or first_auth
    prof_name = f"Prof. {last_auth}" if len(authorships) > 1 else first_auth

    found_u = None
    first_edu_name = None
    first_edu_country = None

    for a in authorships:
        if not isinstance(a, dict):
            continue
        for inst in (a.get("institutions") or []):
            if not isinstance(inst, dict):
                continue
            iname = inst.get("display_name") or ""
            itype = inst.get("type") or ""
            if itype == "education" and not first_edu_name and iname:
                first_edu_name = iname
                first_edu_country = inst.get("country_code") or ""
            lower = iname.lower()
            for uk, uinfo in INSTITUTION_MAP.items():
                if uk in lower:
                    found_u = uinfo
                    break
            if found_u:
                break
        if found_u:
            break

    if not found_u and first_edu_name:
        cc_map = {
            "KR": ("South Korea", 37.5665, 126.9780),
            "US": ("USA", 37.7749, -122.4194),
            "TW": ("Taiwan", 25.0330, 121.5654),
            "JP": ("Japan", 35.6762, 139.6503),
            "DE": ("Germany", 48.1351, 11.5820),
            "NL": ("Netherlands", 52.0020, 4.3700),
            "BE": ("Belgium", 50.8798, 4.7005),
            "FR": ("France", 45.1931, 5.7064),
            "GB": ("UK", 52.2053, 0.1218),
            "CH": ("Switzerland", 47.3763, 8.5476),
            "SG": ("Singapore", 1.3521, 103.8198),
            "CN": ("China", 39.9042, 116.4074),
        }
        country_name, lat, lng = cc_map.get(first_edu_country, ("Global", 37.5, 127.0))
        found_u = {"name": first_edu_name, "city": country_name, "country": country_name, "lat": lat, "lng": lng}

    return found_u, prof_name


def harvest_openalex_candidates(
    existing_projects: list[dict[str, Any]],
    oa_api_key: str,
    max_per_company: int = 35,
    max_src_grants: int = 200,
) -> list[dict[str, Any]]:
    """Harvest high-signal corporate-university co-authorships and corporate/SRC grants."""
    existing_dois = {normalize_doi(p.get("evidence_ref")) for p in existing_projects} - {""}
    existing_titles = {normalize_title(p.get("title") or p.get("topic")) for p in existing_projects} - {""}

    candidates: list[dict[str, Any]] = []
    seen_cand_dois = set(existing_dois)
    seen_cand_titles = set(existing_titles)

    def maybe_add(w: dict[str, Any], comp_name: str | None, signal_type: str, funder_names: list[str]) -> bool:
        doi = normalize_doi(w.get("doi"))
        title = (w.get("title") or "").strip()
        ntitle = normalize_title(title)
        if not doi or len(title) < 15:
            return False
        if doi in seen_cand_dois or (ntitle and ntitle in seen_cand_titles):
            return False

        abstract = reconstruct_abstract(w.get("abstract_inverted_index"), max_words=100)
        combined = f"{title} {abstract}"
        if not SEMI_CANDIDATE_REGEX.search(combined):
            return False

        found_u, prof_name = _extract_university_and_pi(w)
        if not found_u:
            return False

        pub_year = w.get("publication_year") or 2025
        venue = "IEEE / Peer-Reviewed Journal"
        pl = w.get("primary_location") or {}
        if isinstance(pl, dict) and isinstance(pl.get("source"), dict) and pl["source"].get("display_name"):
            venue = pl["source"]["display_name"]

        affil_names = list(dict.fromkeys(
            inst.get("display_name", "")
            for a in (w.get("authorships") or [])
            for inst in (a.get("institutions") or [])
            if inst.get("display_name")
        ))[:8]

        awards_text = [
            f"{aw.get('funder_display_name', '')} ({aw.get('funder_award_id', '')})"
            for aw in (w.get("awards") or [])
            if aw.get("funder_display_name")
        ][:4]

        seen_cand_dois.add(doi)
        if ntitle:
            seen_cand_titles.add(ntitle)

        candidates.append({
            "doi": f"https://doi.org/{doi}",
            "doi_norm": doi,
            "title": title,
            "abstract": abstract,
            "pub_year": pub_year,
            "venue": venue,
            "professor": prof_name,
            "university": found_u,
            "hint_company": comp_name,
            "signal_type": signal_type,
            "affiliations": affil_names,
            "funders": list(dict.fromkeys(funder_names))[:6],
            "awards": awards_text,
        })
        return True

    # 1. Corporate × Education Co-authorship Intersection + Corporate Funder Grants
    for target in OPENALEX_CORP_TARGETS:
        comp_name = target["company"]
        added_for_comp = 0

        for iid in target["inst_ids"]:
            if added_for_comp >= max_per_company:
                break
            f_str = f"authorships.institutions.id:{iid},authorships.institutions.type:education,primary_topic.domain.id:3,publication_year:2023-2026"
            try:
                works = _fetch_openalex_works(f_str, oa_api_key, per_page=60, page=1)
                for w in works:
                    if added_for_comp >= max_per_company:
                        break
                    funders = [f.get("display_name", "") for f in (w.get("funders") or []) if f.get("display_name")]
                    if maybe_add(w, comp_name, "co_authorship", funders):
                        added_for_comp += 1
                time.sleep(0.05)
            except Exception as e:
                print(f"  [OpenAlex] {comp_name} inst {iid} warn: {e}")

        for fid in target["funder_ids"]:
            if added_for_comp >= max_per_company:
                break
            f_str = f"funders.id:{fid},authorships.institutions.type:education,primary_topic.domain.id:3,publication_year:2023-2026"
            try:
                works = _fetch_openalex_works(f_str, oa_api_key, per_page=50, page=1)
                for w in works:
                    if added_for_comp >= max_per_company:
                        break
                    funders = [f.get("display_name", "") for f in (w.get("funders") or []) if f.get("display_name")]
                    if maybe_add(w, comp_name, "corporate_grant", funders):
                        added_for_comp += 1
                time.sleep(0.05)
            except Exception as e:
                print(f"  [OpenAlex] {comp_name} funder {fid} warn: {e}")

        print(f"  [OpenAlex] {comp_name}: +{added_for_comp} candidates")

    # 2. SRC (Semiconductor Research Corporation) Funder F4320306087
    src_added = 0
    for page in range(1, 5):
        if src_added >= max_src_grants:
            break
        f_str = "funders.id:F4320306087,authorships.institutions.type:education,primary_topic.domain.id:3,publication_year:2024-2026"
        try:
            works = _fetch_openalex_works(f_str, oa_api_key, per_page=75, page=page)
            if not works:
                break
            for w in works:
                if src_added >= max_src_grants:
                    break
                funders = [f.get("display_name", "") for f in (w.get("funders") or []) if f.get("display_name")]
                # Map to corporate funder if any corporate funder also listed, else keep None (SRC consortium)
                hint_c = None
                for fn in funders:
                    fl = fn.lower()
                    if "samsung" in fl:
                        hint_c = "Samsung Electronics"
                    elif "intel" in fl:
                        hint_c = "Intel"
                    elif "nvidia" in fl:
                        hint_c = "NVIDIA"
                    elif "tsmc" in fl or "taiwan semiconductor" in fl:
                        hint_c = "TSMC"
                    elif "sk hynix" in fl:
                        hint_c = "SK Hynix"
                    elif "qualcomm" in fl:
                        hint_c = "Qualcomm"
                if maybe_add(w, hint_c, "src_consortium", funders):
                    src_added += 1
            time.sleep(0.05)
        except Exception as e:
            print(f"  [OpenAlex] SRC Funder page {page} warn: {e}")
            break
    print(f"  [OpenAlex] SRC Consortium Grants: +{src_added} candidates")

    return candidates


def call_claude_sonnet_batch(items: list[dict[str, Any]], anthropic_key: str) -> list[dict[str, Any]]:
    """Verify and classify up to 15 papers in a single Claude Sonnet 4.6 API call."""
    compact_items = []
    for it in items:
        compact_items.append({
            "key": it["key"],
            "title": it["title"][:220],
            "abstract": (it.get("abstract") or "")[:350],
            "affiliations": it.get("affiliations", [])[:6],
            "funders": it.get("funders", [])[:5],
            "awards": it.get("awards", [])[:3],
            "hint_company": it.get("hint_company"),
        })

    prompt = f"""You are a senior semiconductor R&D auditor. Classify each academic paper below strictly from the provided metadata (NO guessing or inventing facts).

Allowed categories (choose exact string):
{json.dumps(VALID_CATEGORIES, ensure_ascii=False)}

Rules:
1. "is_semi_hw": true ONLY if the work genuinely advances semiconductor devices/materials/fabrication/packaging/EDA/hardware accelerators (CMOS/GAA/CFET, DRAM/HBM/NAND/MRAM, EUV/lithography/etch/ALD, GaN/SiC power devices, silicon photonics/optical I/O, NPU/ASIC hardware, chiplet/hybrid bonding). Set false for medical/biotech, battery chemistry without semi device, display glass/LCD/OLED consumer optics, generic pure software/LLM prompt apps, or solar cells without compound semi focus.
2. "collaboration_type":
   - "corporate_grant" if a semiconductor company or Semiconductor Research Corporation (SRC) explicitly appears in funders/awards.
   - "co_authorship" if a semiconductor company appears directly in affiliations alongside an academic university.
   - "academic_only" if only universities/public institutes are involved.
3. "verified_company": canonical company name ONLY if explicitly evidenced in affiliations or funders; otherwise null.
4. "evidence_quote": 1 concise factual sentence citing the exact affiliation or funder/award evidence.
5. "summary_ko": 1 crisp Korean sentence summarizing the semiconductor R&D contribution.

Return ONLY a valid JSON array matching input "key" values, no markdown fences:
[
  {{
    "key": "...",
    "is_semi_hw": true,
    "category": "Memory & Storage (HBM/PIM/3D NAND)",
    "collaboration_type": "co_authorship",
    "verified_company": "SK Hynix",
    "evidence_quote": "...",
    "summary_ko": "..."
  }}
]

Input papers:
{json.dumps(compact_items, ensure_ascii=False)}"""

    body = json.dumps({
        "model": SONNET_MODEL,
        "max_tokens": 3500,
        "temperature": 0.0,
        "messages": [{"role": "user", "content": prompt}],
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw_text = "".join(
            block.get("text", "")
            for block in json.loads(resp.read().decode("utf-8")).get("content", [])
            if block.get("type") == "text"
        ).strip()

    # Strip accidental markdown fences if present
    raw_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
    m = re.search(r"\[.*\]", raw_text, flags=re.DOTALL)
    if not m:
        raise ValueError(f"Claude Sonnet did not return JSON array: {raw_text[:200]}")
    parsed = json.loads(m.group(0))
    return [x for x in parsed if isinstance(x, dict) and "key" in x]


def load_cache(path: Path) -> dict[str, Any]:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(path: Path, cache: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def run_sonnet_verification(
    items: list[dict[str, Any]],
    anthropic_key: str,
    cache_path: Path = CACHE_FILE,
    batch_size: int = 15,
) -> dict[str, dict[str, Any]]:
    """Judge items via cached Claude Sonnet 4.6 batches."""
    cache = load_cache(cache_path)
    to_query = [it for it in items if it["key"] not in cache]
    print(f"  [Sonnet 4.6] Total items: {len(items)} | Cached: {len(items) - len(to_query)} | To query: {len(to_query)}")

    for i in range(0, len(to_query), batch_size):
        batch = to_query[i : i + batch_size]
        try:
            results = call_claude_sonnet_batch(batch, anthropic_key)
            for res in results:
                cache[res["key"]] = res
            save_cache(cache_path, cache)
            print(f"    Processed batch {i // batch_size + 1}/{(len(to_query) + batch_size - 1) // batch_size} (+{len(results)} judgments)")
            time.sleep(0.25)
        except Exception as e:
            print(f"    Batch {i // batch_size + 1} error: {e}")
            time.sleep(1.0)

    return cache


def _resolve_company_meta(name: str | None) -> dict[str, Any] | None:
    if not name:
        return None
    lower = name.lower()
    for k, v in COMPANY_MAP.items():
        if k in lower or lower in v["name"].lower():
            return v
    return None


def main() -> None:
    keys = load_env_keys()
    oa_key = keys["OPENALEX_API_KEY"]
    ant_key = keys["ANTHROPIC_API_KEY"]
    if not oa_key or not ant_key:
        raise RuntimeError("Missing OPENALEX_API_KEY or ANTHROPIC_API_KEY in environment or .env")

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    projects = data.get("projects", [])
    print(f"Loaded {len(projects)} existing projects.")

    # 1. Deduplicate existing records first
    projects = deduplicate_projects(projects)
    print(f"After canonical deduplication: {len(projects)} unique projects.")

    # 2. Identify existing pending/unverified records to re-judge with Claude Sonnet 4.6
    pending_items = []
    pending_map: dict[str, dict[str, Any]] = {}
    for p in projects:
        ver = p.get("verification") or {}
        if p.get("category") == "기타 / 검토 대기 (Pending Review)" or ver.get("status") == "unverified_attributes":
            doi_norm = normalize_doi(p.get("evidence_ref"))
            key = doi_norm or p["id"]
            pending_map[key] = p
            pending_items.append({
                "key": key,
                "title": p.get("title") or p.get("topic") or "",
                "abstract": p.get("summary") or "",
                "affiliations": [x for x in [p.get("company"), p.get("university")] if x],
                "funders": [p.get("funding_source")] if p.get("funding_source") else [],
                "awards": [],
                "hint_company": p.get("company"),
            })

    # 3. Harvest fresh high-precision industry-academia candidates via OpenAlex API key
    print("\n--- Stage A: Harvesting OpenAlex Corporate×University & SRC Grant Candidates ---")
    candidates = harvest_openalex_candidates(projects, oa_key, max_per_company=25, max_src_grants=180)
    print(f"Collected {len(candidates)} unique semiconductor R&D candidates.")

    cand_items = [
        {
            "key": c["doi_norm"],
            "title": c["title"],
            "abstract": c["abstract"],
            "affiliations": c["affiliations"],
            "funders": c["funders"],
            "awards": c["awards"],
            "hint_company": c["hint_company"],
        }
        for c in candidates
    ]

    # 4. Run Claude Sonnet 4.6 verification on pending + new candidates
    print("\n--- Stage B: Claude Sonnet 4.6 Precision Verification ---")
    all_verify_items = pending_items + cand_items
    judgments = run_sonnet_verification(all_verify_items, ant_key, batch_size=15)

    # Apply judgments to pending existing records
    updated_pending = 0
    for key, p in pending_map.items():
        j = judgments.get(key)
        if not j:
            continue
        updated_pending += 1
        if not j.get("is_semi_hw"):
            p["status"] = "quarantined"
            p["verification"]["status"] = "quarantined"
            p["verification"]["is_semiconductor_relevant"] = False
            p["verification"]["quarantine_reason"] = "Claude Sonnet 4.6 정밀 판정: 비반도체 하드웨어 연구"
            continue

        if j.get("category") in VALID_CATEGORIES:
            p["category"] = j["category"]
        if j.get("summary_ko"):
            p["summary"] = j["summary_ko"]
        comp_meta = _resolve_company_meta(j.get("verified_company"))
        if comp_meta and j.get("collaboration_type") in ("corporate_grant", "co_authorship"):
            p["company"] = comp_meta["name"]
            p["company_city"] = comp_meta["city"]
            p["company_country"] = comp_meta["country"]
            p["company_lat"] = comp_meta["lat"]
            p["company_lng"] = comp_meta["lng"]
            p["verification"]["status"] = "verified"
            p["verification"]["collaboration_type"] = j["collaboration_type"]
            p["verification"]["corporate_involvement"] = {
                "status": "documented",
                "evidence_quote": j.get("evidence_quote"),
            }
        else:
            p["company"] = None
            p["verification"]["status"] = "academic_verified"
            p["verification"]["collaboration_type"] = "academic_only"
        p["verification"]["verifier"] = f"SRC-{SONNET_MODEL}-Verifier-v3.0"

    # Append newly verified semiconductor candidates
    existing_ids = [p.get("id", "") for p in projects]
    max_seq = 0
    for eid in existing_ids:
        if eid.startswith("SEMI-OA-LLM-"):
            try:
                max_seq = max(max_seq, int(eid.split("-")[-1]))
            except ValueError:
                pass

    added_verified_collab = 0
    added_academic = 0
    rejected_non_semi = 0

    for c in candidates:
        j = judgments.get(c["doi_norm"])
        if not j or not j.get("is_semi_hw"):
            rejected_non_semi += 1
            continue

        cat = j.get("category") if j.get("category") in VALID_CATEGORIES else "Advanced Logic & Transistors (GAA/CFET/2D)"
        ctype = j.get("collaboration_type")
        comp_meta = _resolve_company_meta(j.get("verified_company") or c.get("hint_company"))
        if ctype not in ("corporate_grant", "co_authorship") or not comp_meta:
            # Keep if SRC consortium grant even without single company
            is_src = any("semiconductor research corporation" in f.lower() for f in c.get("funders", []))
            if not is_src:
                ctype = "academic_only"
                comp_meta = None
            else:
                ctype = "corporate_grant"

        max_seq += 1
        pid = f"SEMI-OA-LLM-{max_seq:04d}"
        proj = create_census_project(
            pid_str=pid,
            title=c["title"],
            venue=c["venue"],
            doi=c["doi"],
            year=c["pub_year"],
            found_c=comp_meta,
            found_u=c["university"],
            prof_name=c["professor"],
            summary_text=j.get("summary_ko") or c["abstract"],
            category=cat,
            is_semiconductor_relevant=True,
            corporate_involvement_status="documented" if comp_meta else "unverified",
            corporate_evidence_quote=j.get("evidence_quote"),
        )
        if comp_meta:
            proj["verification"]["status"] = "verified"
            proj["verification"]["collaboration_type"] = ctype
            added_verified_collab += 1
        elif any("semiconductor research corporation" in f.lower() for f in c.get("funders", [])):
            proj["institute_or_consortium"] = "SRC (Semiconductor Research Corporation)"
            proj["verification"]["status"] = "academic_verified"
            proj["verification"]["collaboration_type"] = "academic_only"
            added_academic += 1
        else:
            proj["verification"]["status"] = "academic_verified"
            proj["verification"]["collaboration_type"] = "academic_only"
            added_academic += 1

        proj["verification"]["verifier"] = f"SRC-{SONNET_MODEL}-Verifier-v3.0"
        projects.append(proj)

    projects = deduplicate_projects(projects)
    verified_collabs = sum(
        1 for p in projects
        if (p.get("verification") or {}).get("status") != "quarantined"
        and (p.get("verification") or {}).get("collaboration_type") in ("corporate_grant", "co_authorship")
    )
    academic_cnt = sum(
        1 for p in projects
        if (p.get("verification") or {}).get("status") != "quarantined"
        and (p.get("verification") or {}).get("collaboration_type") == "academic_only"
    )
    quarantined_cnt = sum(1 for p in projects if (p.get("verification") or {}).get("status") == "quarantined")

    data["projects"] = projects
    data["metadata"]["total_projects"] = len(projects)
    data["metadata"]["verified_collaborations_count"] = verified_collabs
    data["metadata"]["academic_semiconductor_count"] = academic_cnt
    data["metadata"]["quarantined_count"] = quarantined_cnt
    data["metadata"]["last_updated"] = datetime.date.today().isoformat()
    data["metadata"]["last_grounded_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    data["metadata"]["verification_method"] = f"OpenAlex API + Claude Sonnet ({SONNET_MODEL}) Precision Verification"

    DATA_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n=== SRC Pipeline Summary ===")
    print(f"Updated pending/unverified records: {updated_pending}")
    print(f"Added verified corporate collaborations: +{added_verified_collab}")
    print(f"Added SRC/academic semiconductor works: +{added_academic}")
    print(f"Filtered out non-semiconductor candidates: {rejected_non_semi}")
    print(f"Final deduplicated total: {len(projects)} (Verified Collabs: {verified_collabs}, Academic: {academic_cnt}, Quarantined: {quarantined_cnt})")


if __name__ == "__main__":
    main()
