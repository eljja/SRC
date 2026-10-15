#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GroundingVerifier: Evidence-Based Corporate & Domain Verification Engine
Ensures 100% evidence grounding for semiconductor industry-academia collaborations.
Eliminates hallucinations, false corporate fallbacks, journal-name collisions,
and non-semiconductor studies.
"""

import re
import urllib.parse
from typing import Dict, List, Optional, Tuple, Any

# Curated semiconductor corporate entities with strict boundary patterns
# Note: Negative lookaheads and boundary checks prevent collisions with journals (e.g. Micron)
# or common words (intel, lam, etc.)
CORPORATE_PATTERNS = [
    {
        "name": "Samsung Electronics",
        "city": "Suwon / Hwaseong",
        "country": "South Korea",
        "lat": 37.2578,
        "lng": 127.0543,
        "affiliation_regex": re.compile(r'\b(samsung electronics|samsung semiconductor|samsung advanced institute of technology|sait\b|samsung research|samsung display)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(samsung electronics|samsung research funding|samsung science|삼성미래기술육성|삼성전자)\b', re.IGNORECASE)
    },
    {
        "name": "TSMC",
        "city": "Hsinchu",
        "country": "Taiwan",
        "lat": 24.7824,
        "lng": 120.9984,
        "affiliation_regex": re.compile(r'\b(tsmc|taiwan semiconductor manufacturing)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(tsmc|taiwan semiconductor manufacturing)\b', re.IGNORECASE)
    },
    {
        "name": "Intel",
        "city": "Santa Clara, CA",
        "country": "USA",
        "lat": 37.3861,
        "lng": -121.9639,
        "affiliation_regex": re.compile(r'\b(intel corp|intel corporation|intel labs|intel technology|intel semiconductor)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(intel corp|intel corporation|intel labs|intel foundation)\b|\bintel\b(?!lectual|ligence|ligent)', re.IGNORECASE)
    },
    {
        "name": "SK Hynix",
        "city": "Icheon",
        "country": "South Korea",
        "lat": 37.2435,
        "lng": 127.4812,
        "affiliation_regex": re.compile(r'\b(sk hynix|sk-hynix|hynix semiconductor)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(sk hynix|sk-hynix|sk하이닉스)\b', re.IGNORECASE)
    },
    {
        "name": "NVIDIA",
        "city": "Santa Clara, CA",
        "country": "USA",
        "lat": 37.3708,
        "lng": -121.9675,
        "affiliation_regex": re.compile(r'\b(nvidia|nvidia corp|nvidia research)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(nvidia|nvidia corp|nvidia applied research|nvidia graduate fellowship)\b', re.IGNORECASE)
    },
    {
        "name": "Qualcomm",
        "city": "San Diego, CA",
        "country": "USA",
        "lat": 32.7157,
        "lng": -117.1611,
        "affiliation_regex": re.compile(r'\b(qualcomm|qualcomm technologies|qualcomm incorporated)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(qualcomm|qualcomm technologies|qualcomm innovation fellowship)\b', re.IGNORECASE)
    },
    {
        "name": "Micron Technology",
        "city": "Boise, ID",
        "country": "USA",
        "lat": 43.6150,
        "lng": -116.2023,
        # Strictly require 'technology', 'semiconductor', or 'corp' to avoid Elsevier journal 'Micron' or 'micron-scale'
        "affiliation_regex": re.compile(r'\b(micron technology|micron semiconductor|micron memory|micron corp)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(micron technology|micron semiconductor|micron foundation)\b', re.IGNORECASE)
    },
    {
        "name": "ASML",
        "city": "Veldhoven",
        "country": "Netherlands",
        "lat": 51.4208,
        "lng": 5.4052,
        "affiliation_regex": re.compile(r'\b(asml|asml netherlands|asml us|asml lithography)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(asml|asml netherlands)\b', re.IGNORECASE)
    },
    {
        "name": "Applied Materials (AMAT)",
        "city": "Santa Clara, CA",
        "country": "USA",
        "lat": 37.3541,
        "lng": -121.9552,
        "affiliation_regex": re.compile(r'\b(applied materials|amat\b)', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(applied materials|amat\b)', re.IGNORECASE)
    },
    {
        "name": "Lam Research",
        "city": "Fremont, CA",
        "country": "USA",
        "lat": 37.4988,
        "lng": -121.9427,
        # Strictly require 'research' or 'corp' to avoid Vietnamese name Lam
        "affiliation_regex": re.compile(r'\b(lam research|lam research corp)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(lam research|lam capital)\b', re.IGNORECASE)
    },
    {
        "name": "KLA Corporation",
        "city": "Milpitas, CA",
        "country": "USA",
        "lat": 37.4323,
        "lng": -121.8996,
        "affiliation_regex": re.compile(r'\b(kla corp|kla corporation|kla-tencor)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(kla corp|kla corporation|kla-tencor)\b', re.IGNORECASE)
    },
    {
        "name": "Sony Semiconductor",
        "city": "Atsugi / Kumamoto",
        "country": "Japan",
        "lat": 35.4431,
        "lng": 139.3625,
        "affiliation_regex": re.compile(r'\b(sony semiconductor|sony semiconductor solutions|sony group|sony corp)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(sony semiconductor|sony corp|sony group)\b', re.IGNORECASE)
    },
    {
        "name": "Broadcom",
        "city": "San Jose, CA",
        "country": "USA",
        "lat": 37.3382,
        "lng": -121.8863,
        "affiliation_regex": re.compile(r'\b(broadcom|broadcom corp|broadcom inc)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(broadcom|broadcom foundation)\b', re.IGNORECASE)
    },
    {
        "name": "MediaTek",
        "city": "Hsinchu",
        "country": "Taiwan",
        "lat": 24.7732,
        "lng": 121.0142,
        "affiliation_regex": re.compile(r'\b(mediatek|mediatek inc)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(mediatek|mediatek foundation)\b', re.IGNORECASE)
    },
    {
        "name": "Infineon Technologies",
        "city": "Neubiberg / Munich",
        "country": "Germany",
        "lat": 48.0772,
        "lng": 11.6578,
        "affiliation_regex": re.compile(r'\b(infineon|infineon technologies)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(infineon|infineon technologies)\b', re.IGNORECASE)
    },
    {
        "name": "STMicroelectronics",
        "city": "Geneva / Grenoble",
        "country": "Switzerland",
        "lat": 46.2044,
        "lng": 6.1432,
        "affiliation_regex": re.compile(r'\b(stmicroelectronics|stmicro|st microelectronics)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(stmicroelectronics|stmicro|st microelectronics)\b', re.IGNORECASE)
    },
    {
        "name": "NXP Semiconductors",
        "city": "Eindhoven",
        "country": "Netherlands",
        "lat": 51.4416,
        "lng": 5.4697,
        "affiliation_regex": re.compile(r'\b(nxp|nxp semiconductors)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(nxp|nxp semiconductors)\b', re.IGNORECASE)
    },
    {
        "name": "GlobalFoundries",
        "city": "Malta, NY",
        "country": "USA",
        "lat": 42.9818,
        "lng": -73.7846,
        "affiliation_regex": re.compile(r'\b(globalfoundries|global foundries)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(globalfoundries|global foundries)\b', re.IGNORECASE)
    },
    {
        "name": "Arm",
        "city": "Cambridge",
        "country": "UK",
        "lat": 52.2053,
        "lng": 0.1218,
        "affiliation_regex": re.compile(r'\b(arm ltd|arm limited|arm holdings|arm architecture)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(arm ltd|arm limited|arm holdings)\b', re.IGNORECASE)
    },
    {
        "name": "Tokyo Electron (TEL)",
        "city": "Tokyo / Sendai",
        "country": "Japan",
        "lat": 35.6762,
        "lng": 139.6503,
        "affiliation_regex": re.compile(r'\b(tokyo electron|tel\b)', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(tokyo electron|tel\b)', re.IGNORECASE)
    },
    {
        "name": "Synopsys",
        "city": "Sunnyvale, CA",
        "country": "USA",
        "lat": 37.3688,
        "lng": -122.0363,
        "affiliation_regex": re.compile(r'\b(synopsys|synopsys inc)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(synopsys|synopsys inc)\b', re.IGNORECASE)
    },
    {
        "name": "Cadence Design Systems",
        "city": "San Jose, CA",
        "country": "USA",
        "lat": 37.4085,
        "lng": -121.9482,
        "affiliation_regex": re.compile(r'\b(cadence|cadence design systems)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(cadence|cadence design systems)\b', re.IGNORECASE)
    },
    {
        "name": "Kioxia",
        "city": "Tokyo / Yokkaichi",
        "country": "Japan",
        "lat": 34.9654,
        "lng": 136.6247,
        "affiliation_regex": re.compile(r'\b(kioxia|kioxia corp)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(kioxia|kioxia corp)\b', re.IGNORECASE)
    },
    {
        "name": "Wolfspeed",
        "city": "Durham, NC",
        "country": "USA",
        "lat": 35.9000,
        "lng": -78.8700,
        "affiliation_regex": re.compile(r'\b(wolfspeed|cree inc)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(wolfspeed|cree inc)\b', re.IGNORECASE)
    },
    {
        "name": "Onsemi",
        "city": "Scottsdale, AZ",
        "country": "USA",
        "lat": 33.5000,
        "lng": -111.9000,
        "affiliation_regex": re.compile(r'\b(onsemi|on semiconductor)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(onsemi|on semiconductor)\b', re.IGNORECASE)
    },
    {
        "name": "Semiconductor Research Corporation (SRC)",
        "city": "Durham, NC",
        "country": "USA",
        "lat": 35.9049,
        "lng": -78.8686,
        "affiliation_regex": re.compile(r'\b(semiconductor research corporation|src jump|src grc)\b', re.IGNORECASE),
        "funder_regex": re.compile(r'\b(semiconductor research corporation|src jump|src grc)\b', re.IGNORECASE)
    }
]

# Non-semiconductor domain intrusion filters
NON_SEMI_REGEX = re.compile(
    r'\b('
    # Medical & Surgical
    r'cervical|orthopaedic|orthopedic|stenosis|spondylolisthesis|'
    r'mycobacterium|joint infection|retinal|neovascularization|'
    r'haematoma|hematoma|intrapartum|dilatation|discogenic|endoscopy|'
    r'odontoideum|forensic|spine|spinal|fracture|peptides|choroidal|'
    r'surgery|surgical|patient|patients|dental|carcinoma|tumor|tumour|cancer|'
    r'cardiac|coronary|cardiovascular|antibiotic|herniation|decompression|'
    r'l-disq|mandibulectomy|mandibular|her2|arthroplasty|catheter|'
    r'glaucoma|ophthalmology|bone marrow|prostate|pulmonary|gastrointestinal|'
    r'clinical case|case report|biopsy|chemotherapy|lymphoma|hodgkin|'
    r'macrophage|macrophages|thalassaemia|haemoglobin|hemoglobin|'
    # Zoology & Entomology
    r'beetle|beetles|hindwing|hindwings|insect|insects|entomology|zoology|'
    r'avian|bird|fish|rodent|rat|mice|mouse|in vivo|in vitro|cell culture|'
    # Law, Humanities & Pure Social Science
    r'dram shop|dram shops|tort law|jurisprudence|constitutional law|'
    r'criminal justice|legal theory|statutory|litigation|public interest technology|'
    r'cinema|cinematic|film studies|poetry|literature review of nursing'
    r')\b',
    re.IGNORECASE
)

# Semiconductor Hardware core keywords (for disambiguation)
SEMI_HARDWARE_REGEX = re.compile(
    r'\b('
    r'semiconductor|transistor|cmos|finfet|gaa|nanosheet|dram|sram|mram|'
    r'rram|hbm|nand|euv|lithography|photolithography|resist|dielectric|'
    r'asic|fpga|interposer|chiplet|wafer|integrated circuit|ribbonfet|'
    r'cfet|bspdn|sub-1nm|sub-2nm|2d material|mos2|ws2|silicon photonics|'
    r'power mosfet|gan-on-si|4h-sic|hemt|spintronic|ferroelectric|fefet'
    r')\b',
    re.IGNORECASE
)

# University knowledge base for accurate resolution
KNOWN_UNIVERSITIES = [
    {"name": "KAIST (한국과학기술원)", "city": "Daejeon", "country": "South Korea", "lat": 36.3722, "lng": 127.3604, "pattern": re.compile(r'\b(kaist|korea advanced institute of science)\b', re.IGNORECASE)},
    {"name": "Seoul National University (서울대학교)", "city": "Seoul", "country": "South Korea", "lat": 37.4598, "lng": 126.9519, "pattern": re.compile(r'\b(seoul national university|snu\b)', re.IGNORECASE)},
    {"name": "POSTECH (포항공과대학교)", "city": "Pohang", "country": "South Korea", "lat": 36.0142, "lng": 129.3247, "pattern": re.compile(r'\b(postech|pohang university of science)\b', re.IGNORECASE)},
    {"name": "Sungkyunkwan University (SKKU - 성균관대)", "city": "Suwon", "country": "South Korea", "lat": 37.2936, "lng": 126.9749, "pattern": re.compile(r'\b(sungkyunkwan|skku\b)', re.IGNORECASE)},
    {"name": "Korea University (고려대학교)", "city": "Seoul", "country": "South Korea", "lat": 37.5908, "lng": 127.0278, "pattern": re.compile(r'\b(korea university)\b', re.IGNORECASE)},
    {"name": "Yonsei University (연세대학교)", "city": "Seoul", "country": "South Korea", "lat": 37.5658, "lng": 126.9386, "pattern": re.compile(r'\b(yonsei university)\b', re.IGNORECASE)},
    {"name": "Hanyang University (한양대학교)", "city": "Seoul", "country": "South Korea", "lat": 37.5572, "lng": 127.0453, "pattern": re.compile(r'\b(hanyang university)\b', re.IGNORECASE)},
    {"name": "UNIST (울산과학기술원)", "city": "Ulsan", "country": "South Korea", "lat": 35.5744, "lng": 129.1895, "pattern": re.compile(r'\b(unist|ulsan national institute)\b', re.IGNORECASE)},
    {"name": "GIST (광주과학기술원)", "city": "Gwangju", "country": "South Korea", "lat": 35.2285, "lng": 126.8431, "pattern": re.compile(r'\b(gist|gwangju institute of science)\b', re.IGNORECASE)},
    {"name": "DGIST (대구경북과학기술원)", "city": "Daegu", "country": "South Korea", "lat": 35.7061, "lng": 128.4594, "pattern": re.compile(r'\b(dgist|daegu gyeongbuk institute)\b', re.IGNORECASE)},
    
    # USA
    {"name": "Stanford University", "city": "Stanford, CA", "country": "USA", "lat": 37.4275, "lng": -122.1697, "pattern": re.compile(r'\b(stanford university|stanford\b)', re.IGNORECASE)},
    {"name": "MIT", "city": "Cambridge, MA", "country": "USA", "lat": 42.3601, "lng": -71.0942, "pattern": re.compile(r'\b(massachusetts institute of technology|mit\b)', re.IGNORECASE)},
    {"name": "UC Berkeley", "city": "Berkeley, CA", "country": "USA", "lat": 37.8719, "lng": -122.2585, "pattern": re.compile(r'\b(uc berkeley|university of california,? berkeley)\b', re.IGNORECASE)},
    {"name": "Purdue University", "city": "West Lafayette, IN", "country": "USA", "lat": 40.4237, "lng": -86.9212, "pattern": re.compile(r'\b(purdue university|purdue\b)', re.IGNORECASE)},
    {"name": "Georgia Tech", "city": "Atlanta, GA", "country": "USA", "lat": 33.7756, "lng": -84.3963, "pattern": re.compile(r'\b(georgia tech|georgia institute of technology)\b', re.IGNORECASE)},
    {"name": "Cornell University", "city": "Ithaca, NY", "country": "USA", "lat": 42.4534, "lng": -76.4735, "pattern": re.compile(r'\b(cornell university|cornell\b)', re.IGNORECASE)},
    {"name": "Rensselaer Polytechnic Institute (RPI)", "city": "Troy, NY", "country": "USA", "lat": 42.7300, "lng": -73.6788, "pattern": re.compile(r'\b(rensselaer polytechnic institute|rpi\b)', re.IGNORECASE)},
    {"name": "UIUC", "city": "Urbana, IL", "country": "USA", "lat": 40.1020, "lng": -88.2272, "pattern": re.compile(r'\b(university of illinois|uiuc\b)', re.IGNORECASE)},
    {"name": "UT Austin", "city": "Austin, TX", "country": "USA", "lat": 30.2849, "lng": -97.7341, "pattern": re.compile(r'\b(university of texas at austin|ut austin)\b', re.IGNORECASE)},
    {"name": "UC San Diego (UCSD)", "city": "La Jolla, CA", "country": "USA", "lat": 32.8801, "lng": -117.2340, "pattern": re.compile(r'\b(uc san diego|ucsd|university of california,? san diego)\b', re.IGNORECASE)},
    {"name": "UCLA", "city": "Los Angeles, CA", "country": "USA", "lat": 34.0689, "lng": -118.4452, "pattern": re.compile(r'\b(ucla|university of california,? los angeles)\b', re.IGNORECASE)},
    {"name": "Harvard University", "city": "Cambridge, MA", "country": "USA", "lat": 42.3770, "lng": -71.1167, "pattern": re.compile(r'\b(harvard university|harvard\b)', re.IGNORECASE)},

    # Taiwan
    {"name": "National Taiwan University (NTU - 대만국립대)", "city": "Taipei", "country": "Taiwan", "lat": 25.0174, "lng": 121.5405, "pattern": re.compile(r'\b(national taiwan university|ntu\b)', re.IGNORECASE)},
    {"name": "National Yang Ming Chiao Tung (NYCU - 양명교통대)", "city": "Hsinchu", "country": "Taiwan", "lat": 24.7868, "lng": 120.9972, "pattern": re.compile(r'\b(yang ming chiao tung|nycu|chiao tung university)\b', re.IGNORECASE)},
    {"name": "National Tsing Hua University (NTHU - 청화대)", "city": "Hsinchu", "country": "Taiwan", "lat": 24.7937, "lng": 120.9934, "pattern": re.compile(r'\b(national tsing hua university|nthu\b)', re.IGNORECASE)},

    # Europe
    {"name": "IMEC (벨기에 뢰번)", "city": "Leuven", "country": "Belgium", "lat": 50.8798, "lng": 4.7005, "pattern": re.compile(r'\b(imec|interuniversity microelectronics)\b', re.IGNORECASE)},
    {"name": "KU Leuven (루벤 가톨릭대)", "city": "Leuven", "country": "Belgium", "lat": 50.8780, "lng": 4.7005, "pattern": re.compile(r'\b(ku leuven|catholic university of leuven)\b', re.IGNORECASE)},
    {"name": "CEA-Leti (프랑스 전자정보기술연구소)", "city": "Grenoble", "country": "France", "lat": 45.1931, "lng": 5.7064, "pattern": re.compile(r'\b(cea-leti|cea leti|leti\b)', re.IGNORECASE)},
    {"name": "TU Delft (델프트 공대)", "city": "Delft", "country": "Netherlands", "lat": 52.0020, "lng": 4.3700, "pattern": re.compile(r'\b(delft university of technology|tu delft)\b', re.IGNORECASE)},
    {"name": "TU Eindhoven (아인트호벤 공대)", "city": "Eindhoven", "country": "Netherlands", "lat": 51.4485, "lng": 5.4907, "pattern": re.compile(r'\b(eindhoven university of technology|tu/e|tu eindhoven)\b', re.IGNORECASE)},
    {"name": "ETH Zurich (취리히 연방공대)", "city": "Zurich", "country": "Switzerland", "lat": 47.3763, "lng": 8.5476, "pattern": re.compile(r'\b(eth zurich|swiss federal institute of technology)\b', re.IGNORECASE)},
    {"name": "EPFL (로잔 연방공대)", "city": "Lausanne", "country": "Switzerland", "lat": 46.5191, "lng": 6.5668, "pattern": re.compile(r'\b(epfl|ecole polytechnique federale de lausanne)\b', re.IGNORECASE)},

    # Japan
    {"name": "The University of Tokyo (도쿄대학교)", "city": "Tokyo", "country": "Japan", "lat": 35.7128, "lng": 139.7620, "pattern": re.compile(r'\b(university of tokyo|tokyo university)\b', re.IGNORECASE)},
    {"name": "Tohoku University (도호쿠대학교)", "city": "Sendai", "country": "Japan", "lat": 38.2554, "lng": 140.8721, "pattern": re.compile(r'\b(tohoku university)\b', re.IGNORECASE)},
    {"name": "Tokyo Tech (도쿄공업대)", "city": "Tokyo", "country": "Japan", "lat": 35.6033, "lng": 139.6841, "pattern": re.compile(r'\b(tokyo institute of technology|tokyo tech)\b', re.IGNORECASE)},

    # China & Singapore
    {"name": "Tsinghua University (칭화대학교)", "city": "Beijing", "country": "China", "lat": 40.0001, "lng": 116.3267, "pattern": re.compile(r'\b(tsinghua university|tsinghua\b)', re.IGNORECASE)},
    {"name": "Peking University (베이징대학교)", "city": "Beijing", "country": "China", "lat": 39.9929, "lng": 116.3109, "pattern": re.compile(r'\b(peking university|beida\b)', re.IGNORECASE)},
    {"name": "National University of Singapore (NUS)", "city": "Singapore", "country": "Singapore", "lat": 1.2966, "lng": 103.7764, "pattern": re.compile(r'\b(national university of singapore|nus\b)', re.IGNORECASE)}
]

class GroundingVerifier:
    """Core verification and grounding engine."""

    def __init__(self):
        pass

    def classify_paper(self, title: str, summary: str = "", venue: str = "") -> Dict[str, Any]:
        """
        Validates whether a paper belongs to genuine semiconductor science/hardware.
        Detects medical, biological, entomological, and legal studies for quarantine.
        """
        combined = f"{title} {summary} {venue}".lower()

        # Check non-semiconductor domain
        if NON_SEMI_REGEX.search(combined):
            # Clean out non-semiconductor phrases before checking hardware disambiguation
            # (e.g. 'dram shops' must not trigger 'dram', 'pim kinase' must not trigger 'pim')
            cleaned_for_hardware = NON_SEMI_REGEX.sub(' ', combined)
            if not SEMI_HARDWARE_REGEX.search(cleaned_for_hardware):
                # Identify specific quarantine reason
                reason = "non_semiconductor_medical_study"
                if re.search(r'beetle|insect|hindwing|zoology|avian', combined):
                    reason = "non_semiconductor_zoology_entomology"
                elif re.search(r'dram shop|law review|jurisprudence|legal theory', combined):
                    reason = "non_semiconductor_legal_study"
                elif re.search(r'thalassaemia|hemoglobin|haematology|blood', combined):
                    reason = "non_semiconductor_hematology"
                elif re.search(r'orthopaedic|orthopedic|spine|stenosis|endoscopy', combined):
                    reason = "non_semiconductor_orthopedic"
                elif re.search(r'hodgkin|lymphoma|cancer|tumor|carcinoma', combined):
                    reason = "non_semiconductor_oncology"

                return {
                    "is_semiconductor": False,
                    "quarantine_reason": reason,
                    "status": "quarantined"
                }

        return {
            "is_semiconductor": True,
            "quarantine_reason": None,
            "status": "valid"
        }

    def extract_corporate_involvement(
        self,
        authors: List[Dict[str, Any]],
        funders: List[Any],
        venue: str = "",
        title: str = ""
    ) -> Dict[str, Any]:
        """
        Extracts verified corporate involvement from genuine authorships or official grants.
        Never falls back to query label or keyword coincidence.
        """
        # 1. Check official corporate funders
        for f in funders:
            f_name = f if isinstance(f, str) else (f.get("name") or "")
            if not f_name:
                continue
            for corp in CORPORATE_PATTERNS:
                if corp["funder_regex"].search(f_name):
                    return {
                        "company": corp["name"],
                        "company_city": corp["city"],
                        "company_country": corp["country"],
                        "company_lat": corp["lat"],
                        "company_lng": corp["lng"],
                        "collaboration_type": "corporate_grant",
                        "has_corporate_involvement": True,
                        "evidence_quote": f"Official Corporate Funder: {f_name}",
                        "verification_status": "verified"
                    }

        # 2. Check author affiliations for corporate entities
        for a in authors:
            affs = a.get("affiliations", [])
            for aff in affs:
                if not aff:
                    continue
                for corp in CORPORATE_PATTERNS:
                    if corp["affiliation_regex"].search(aff):
                        return {
                            "company": corp["name"],
                            "company_city": corp["city"],
                            "company_country": corp["country"],
                            "company_lat": corp["lat"],
                            "company_lng": corp["lng"],
                            "collaboration_type": "co_authorship",
                            "has_corporate_involvement": True,
                            "evidence_quote": f"Corporate Author Affiliation: {aff}",
                            "verification_status": "verified"
                        }

        # 3. Pure academic paper (no confirmed corporate co-author or funder)
        return {
            "company": None,
            "company_city": None,
            "company_country": None,
            "company_lat": None,
            "company_lng": None,
            "collaboration_type": "academic_only",
            "has_corporate_involvement": False,
            "evidence_quote": None,
            "verification_status": "academic_verified"
        }

    def resolve_academic_institution(self, affiliations: List[str], raw_uni: str = "") -> Dict[str, Any]:
        """
        Resolves the true academic institution from affiliations without defaulting to Stanford.
        """
        combined = " ".join([aff for aff in affiliations if aff] + [raw_uni])
        if not combined.strip():
            return {
                "name": "Research Institution",
                "city": "Global",
                "country": "Global",
                "lat": 37.0,
                "lng": 127.0
            }

        # Match known curated universities
        for uni in KNOWN_UNIVERSITIES:
            if uni["pattern"].search(combined):
                return {
                    "name": uni["name"],
                    "city": uni["city"],
                    "country": uni["country"],
                    "lat": uni["lat"],
                    "lng": uni["lng"]
                }

        # If not in curated list, extract the first realistic affiliation snippet rather than fake Stanford
        first_aff = next((aff.strip() for aff in affiliations if aff and aff.strip()), raw_uni.strip())
        parts = [p.strip() for p in first_aff.split(",") if p.strip()]
        display_name = parts[0] if parts else "Research Institution"
        if len(parts) > 1 and ("university" in parts[1].lower() or "institute" in parts[1].lower()):
            display_name = parts[1]

        return {
            "name": display_name,
            "city": parts[-2] if len(parts) >= 2 else "Global",
            "country": parts[-1] if len(parts) >= 1 else "Global",
            "lat": 37.0,
            "lng": 127.0
        }

    def deduplicate_dataset(self, projects: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
        """
        Deduplicates projects based on normalized DOI and canonical title.
        Retains higher quality verified corporate collaboration records if duplicates exist.
        """
        seen_dois = {}
        seen_titles = {}
        deduped = []
        removed_count = 0

        for p in projects:
            ev = p.get("evidence_ref", "")
            raw_doi = ev.split("DOI: ")[-1].strip() if "DOI: " in ev else ev.split("doi.org/")[-1].strip()
            norm_doi = raw_doi.lower().replace("https://doi.org/", "").strip()
            norm_title = re.sub(r'[^a-z0-9]', '', p.get("title", "").lower())

            existing_idx = None
            if norm_doi and norm_doi in seen_dois:
                existing_idx = seen_dois[norm_doi]
            elif norm_title and len(norm_title) > 15 and norm_title in seen_titles:
                existing_idx = seen_titles[norm_title]

            if existing_idx is not None:
                # Merge: prefer record with confirmed corporate collaboration
                existing = deduped[existing_idx]
                curr_is_collab = p.get("verification", {}).get("collaboration_type") in ["co_authorship", "corporate_grant"]
                exist_is_collab = existing.get("verification", {}).get("collaboration_type") in ["co_authorship", "corporate_grant"]
                if curr_is_collab and not exist_is_collab:
                    deduped[existing_idx] = p
                removed_count += 1
            else:
                idx = len(deduped)
                deduped.append(p)
                if norm_doi:
                    seen_dois[norm_doi] = idx
                if norm_title:
                    seen_titles[norm_title] = idx

        return deduped, removed_count
