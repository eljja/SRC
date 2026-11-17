#!/usr/bin/env python3
"""
generate_seo_pages.py
Programmatic SEO Generator for SRC Semiconductor Observatory.
Generates high-authority, crawlable, pre-rendered static HTML landing pages
for top semiconductor companies, universities, and technical domains.
Also updates sitemap.xml and master hub index.
"""

import json
import os
import re
from datetime import datetime
from collections import Counter
from urllib.parse import quote

BASE_URL = "https://eljja.github.io/SRC"
TODAY = datetime.now().strftime("%Y-%m-%d")

# Configuration of targeted entities
COMPANIES = [
    {
        "slug": "samsung",
        "name_ko": "삼성전자 (Samsung Electronics)",
        "query_name": "Samsung Electronics",
        "description": "삼성전자 DS부문 및 종합기술원(SAIT)과 글로벌 주요 대학(서울대, KAIST, 성균관대, MIT 등) 간의 검증된 산학협력 프로젝트 및 차세대 반도체(GAA, HBM, 3D 패키징) 공동 연구 과제 전수 분석.",
        "keywords": ["삼성전자 산학협력", "삼성전자 반도체 연구", "삼성전자 대학 연구실", "삼성 반도체 과제", "Samsung Electronics Semiconductor R&D", "삼성전자 HBM 산학"]
    },
    {
        "slug": "sk-hynix",
        "name_ko": "SK하이닉스 (SK Hynix)",
        "query_name": "SK Hynix",
        "description": "SK하이닉스와 국내외 유수 대학(고려대, 한양대, POSTECH, 서울대 등) 간의 HBM3e/HBM4 초고대역폭 메모리, CXL, 3D NAND 및 차세대 메모리 공정 산학협력 연구 과제 분석.",
        "keywords": ["SK하이닉스 산학협력", "SK하이닉스 반도체 연구", "SK하이닉스 HBM 연구실", "SK하이닉스 대학 과제", "SK Hynix R&D"]
    },
    {
        "slug": "tsmc",
        "name_ko": "TSMC (대만적체전로제조)",
        "query_name": "TSMC",
        "description": "세계 최대 파운드리 TSMC와 글로벌 대학(대만국립대, 스탠퍼드, UC 버클리 등) 간의 첨단 로직 공정(2nm/A16), CoWoS 첨단 패키징, 3D IC 연구 과제 및 산학 R&D 네트워크.",
        "keywords": ["TSMC 산학협력", "TSMC 반도체 연구", "TSMC 파운드리 R&D", "TSMC 대학 연구", "TSMC CoWoS"]
    },
    {
        "slug": "intel",
        "name_ko": "인텔 (Intel)",
        "query_name": "Intel",
        "description": "인텔(Intel Labs)과 글로벌 연구기관(MIT, 스탠퍼드, 버클리, 퍼듀 등) 간의 Intel 18A 공정, RibbonFET GAA, PowerVia 이면전력공급, EMIB/Foveros 첨단 패키징 산학 R&D.",
        "keywords": ["인텔 산학협력", "인텔 반도체 연구", "Intel Labs R&D", "인텔 대학 연구", "인텔 18A GAA"]
    },
    {
        "slug": "nvidia",
        "name_ko": "엔비디아 (NVIDIA)",
        "query_name": "NVIDIA",
        "description": "엔비디아(NVIDIA Research)와 주요 대학 간의 차세대 GPU 아키텍처, AI 가속기(NPU), 광 인터커넥트(Silicon Photonics) 및 차세대 반도체 패키징 산학 연구 과제.",
        "keywords": ["엔비디아 산학협력", "엔비디아 반도체 연구", "NVIDIA Research", "엔비디아 AI 가속기", "엔비디아 연구 과제"]
    },
    {
        "slug": "asml",
        "name_ko": "ASML",
        "query_name": "ASML",
        "description": "글로벌 유일 노광장비 선도기업 ASML과 주요 대학·연구소(IMEC, TU Delft 등) 간의 High-NA(0.55 NA) EUV 노광 공정, 극자외선 광원, 차세대 펠리클 산학협력 연구.",
        "keywords": ["ASML 산학협력", "ASML 노광장비 연구", "ASML EUV R&D", "High-NA EUV 연구", "ASML 대학 연구"]
    },
    {
        "slug": "qualcomm",
        "name_ko": "퀄컴 (Qualcomm)",
        "query_name": "Qualcomm",
        "description": "퀄컴과 글로벌 대학 간의 저전력 무선 통신 반도체, 온디바이스 AI 프로세서, 차세대 모바일 AP 및 오토모티브 칩 산학협력 연구 네트워크.",
        "keywords": ["퀄컴 산학협력", "퀄컴 반도체 연구", "Qualcomm R&D", "온디바이스 AI 반도체", "퀄컴 대학 과제"]
    },
    {
        "slug": "applied-materials",
        "name_ko": "어플라이드 머티어리얼즈 (Applied Materials)",
        "query_name": "Applied Materials (AMAT)",
        "description": "세계 1위 반도체 전공정 장비 기업 어플라이드 머티어리얼즈와 글로벌 대학 간의 원자층 증착(ALD), 선택적 식각 및 이종 집적 소재 산학 R&D.",
        "keywords": ["어플라이드 머티어리얼즈 산학협력", "AMAT 반도체 장비", "반도체 증착 식각 연구", "AMAT 산학 연구"]
    },
    {
        "slug": "lam-research",
        "name_ko": "램리서치 (Lam Research)",
        "query_name": "Lam Research",
        "description": "글로벌 식각 장비 선도기업 램리서치와 주요 대학 연구실 간의 3D NAND 고종횡비 식각, 극저온 식각(Cryogenic Etch) 및 건식 포토레지스트 산학 R&D.",
        "keywords": ["램리서치 산학협력", "Lam Research R&D", "반도체 식각 장비 연구", "3D NAND 식각 산학"]
    },
    {
        "slug": "kla",
        "name_ko": "KLA (케이엘에이)",
        "query_name": "KLA Corporation",
        "description": "반도체 검사·계측 선도기업 KLA와 주요 연구기관 간의 3nm 이하 초미세 웨이퍼 결함 검사, 전자빔 계측 및 광학 오버레이 측정 산학협력 연구.",
        "keywords": ["KLA 산학협력", "KLA 반도체 계측", "웨이퍼 결함 검사 연구", "KLA 계측 R&D"]
    },
    {
        "slug": "micron",
        "name_ko": "마이크론 (Micron Technology)",
        "query_name": "Micron Technology",
        "description": "마이크론과 대학 연구실 간의 1-gamma nm DRAM 공정, EUV 적용 D램, HBM3e 메모리 및 차세대 비휘발성 메모리 산학협력 연구 네트워크.",
        "keywords": ["마이크론 산학협력", "마이크론 반도체 연구", "Micron DRAM HBM", "마이크론 대학 과제"]
    },
    {
        "slug": "tokyo-electron",
        "name_ko": "도쿄일렉트론 (Tokyo Electron - TEL)",
        "query_name": "Tokyo Electron (TEL)",
        "description": "일본 최대 반도체 장비사 도쿄일렉트론과 주요 연구기관 간의 첨단 코터/디벨로퍼, 극저온 고속 식각 및 본딩/디본딩 장비 산학 R&D.",
        "keywords": ["도쿄일렉트론 산학협력", "TEL 반도체 장비", "Tokyo Electron R&D", "도쿄일렉트론 대학 연구"]
    }
]

UNIVERSITIES = [
    {
        "slug": "snu",
        "name_ko": "서울대학교 (Seoul National University)",
        "query_name": "Seoul National University",
        "match_keys": ["Seoul National University", "서울대"],
        "description": "서울대학교 반도체공동연구소(ISRC) 및 주요 연구실과 삼성전자, SK하이닉스, TSMC 등 글로벌 반도체 기업 간의 첨단 소자, 설계, 공정 산학협력 연구 과제 총람.",
        "keywords": ["서울대 반도체 산학협력", "서울대학교 반도체공동연구소", "서울대 반도체 연구실", "서울대 삼성전자 산학", "서울대 SK하이닉스 연구"]
    },
    {
        "slug": "kaist",
        "name_ko": "KAIST (한국과학기술원)",
        "query_name": "KAIST",
        "match_keys": ["KAIST", "한국과학기술원"],
        "description": "KAIST 전기및전자공학부, 반도체공학과 및 연구소와 국내외 주요 기업 간의 차세대 AI 반도체(PIM), HBM 패키징, 초저전력 회로 산학협력 연구 총정리.",
        "keywords": ["KAIST 반도체 산학협력", "카이스트 반도체 연구실", "KAIST 삼성 산학", "KAIST SK하이닉스 산학", "KAIST PIM 연구"]
    },
    {
        "slug": "postech",
        "name_ko": "포항공과대학교 (POSTECH)",
        "query_name": "POSTECH",
        "match_keys": ["POSTECH", "포항공과대학교", "포항공대"],
        "description": "POSTECH 반도체공학과, 신소재공학과 연구실과 글로벌 기업 간의 2차원 반도체 소자, 차세대 메모리, 첨단 나노 소재 산학협력 연구 현황.",
        "keywords": ["포항공대 반도체 산학협력", "POSTECH 반도체 연구", "포항공대 반도체공학과", "포스텍 반도체 연구실"]
    },
    {
        "slug": "skku",
        "name_ko": "성균관대학교 (SKKU)",
        "query_name": "Sungkyunkwan University",
        "match_keys": ["Sungkyunkwan", "성균관대", "SKKU"],
        "description": "성균관대학교 반도체시스템공학과 및 연구진과 삼성전자 등 선도 기업 간의 맞춤형 반도체 설계, 차세대 공정 소재 산학협력 연구 네트워크.",
        "keywords": ["성균관대 반도체시스템공학과", "성균관대 반도체 산학협력", "성대 삼성전자 산학", "성균관대 반도체 연구실"]
    },
    {
        "slug": "yonsei",
        "name_ko": "연세대학교 (Yonsei University)",
        "query_name": "Yonsei University",
        "match_keys": ["Yonsei", "연세대"],
        "description": "연세대학교 시스템반도체공학과 및 전기전자공학부 연구실과 삼성전자, SK하이닉스 간의 시스템 LSI, 지능형 반도체, 초고속 통신 칩 산학 연구.",
        "keywords": ["연세대 시스템반도체공학과", "연세대 반도체 산학협력", "연세대 반도체 연구실", "연세대 삼성전자 산학"]
    },
    {
        "slug": "korea",
        "name_ko": "고려대학교 (Korea University)",
        "query_name": "Korea University",
        "match_keys": ["Korea University", "고려대"],
        "description": "고려대학교 반도체공학과 연구진과 SK하이닉스 등 주요 메모리 기업 간의 차세대 D램, 낸드 플래시, 초미세 패터닝 산학협력 과제 현황.",
        "keywords": ["고려대 반도체공학과", "고려대 반도체 산학협력", "고려대 SK하이닉스 산학", "고려대 반도체 연구실"]
    },
    {
        "slug": "hanyang",
        "name_ko": "한양대학교 (Hanyang University)",
        "query_name": "Hanyang University",
        "match_keys": ["Hanyang", "한양대"],
        "description": "한양대학교 반도체공학과 및 나노소자 연구실과 SK하이닉스, 삼성전자 등과의 차세대 세정/식각 공정, 패키징 소재 산학협력 연구.",
        "keywords": ["한양대 반도체공학과", "한양대 반도체 산학협력", "한양대 반도체 연구실", "한양대 SK하이닉스 산학"]
    },
    {
        "slug": "stanford",
        "name_ko": "스탠퍼드 대학교 (Stanford University)",
        "query_name": "Stanford University",
        "match_keys": ["Stanford", "스탠퍼드"],
        "description": "실리콘밸리의 핵심 스탠퍼드 대학교와 인텔, 엔비디아, TSMC, 삼성전자 간의 차세대 나노전자 소자, 뉴로모픽 칩, 3D IC 집적 기술 산학 연구.",
        "keywords": ["스탠퍼드 반도체 연구", "Stanford Semiconductor R&D", "스탠퍼드 산학협력", "스탠퍼드 전자공학 연구실"]
    },
    {
        "slug": "mit",
        "name_ko": "MIT (매사추세츠 공과대학교)",
        "query_name": "MIT",
        "match_keys": ["MIT", "Massachusetts Institute of Technology"],
        "description": "세계 최고의 공과대학 MIT(MTL, Microsystems Technology Laboratories)와 글로벌 반도체 기업 간의 극한 미세소자, 양자 반도체, 화합물 반도체 산학 R&D.",
        "keywords": ["MIT 반도체 연구", "MIT Semiconductor R&D", "MIT 산학협력", "MIT MTL 연구실"]
    },
    {
        "slug": "berkeley",
        "name_ko": "UC 버클리 (UC Berkeley)",
        "query_name": "UC Berkeley",
        "match_keys": ["Berkeley", "UC Berkeley"],
        "description": "FinFET 및 BSIM 모델의 산실 UC 버클리와 글로벌 반도체 거인 간의 3D 적층 트랜지스터, RISC-V 오픈 아키텍처, 첨단 소자 시뮬레이션 산학 연구.",
        "keywords": ["UC 버클리 반도체 연구", "UC Berkeley Semiconductor", "FinFET BSIM 연구", "버클리 산학협력"]
    },
    {
        "slug": "imec",
        "name_ko": "IMEC (벨기에 세계 최고의 반도체 연구소)",
        "query_name": "IMEC",
        "match_keys": ["IMEC", "벨기에"],
        "description": "글로벌 모든 주요 반도체 기업(삼성, TSMC, Intel, ASML 등)이 참여하는 세계 최고 수준의 첨단 나노전자 R&D 컨소시엄 IMEC의 공동 연구 과제 및 로드맵.",
        "keywords": ["IMEC 반도체 연구", "IMEC 컨소시엄", "벨기에 IMEC 산학협력", "Sub-1nm 반도체 로드맵"]
    }
]

TOPICS = [
    {
        "slug": "hbm",
        "name_ko": "HBM3e / HBM4 초고대역폭 메모리 & PIM/CXL 연구",
        "category_key": "Memory & Storage (HBM/PIM/3D NAND)",
        "description": "AI 시대 핵심인 HBM3e, HBM4 초고대역폭 메모리, Processing-In-Memory(PIM), CXL 메모리 풀링 및 300단 이상 3D V-NAND 관련 글로벌 산학협력 R&D 과제 전수 분석.",
        "keywords": ["HBM 산학협력", "HBM3e HBM4 연구", "CXL 반도체 연구실", "PIM 메모리 연구", "3D NAND 산학 R&D"]
    },
    {
        "slug": "gaa",
        "name_ko": "3nm 이하 GAA / CFET 차세대 로직 트랜지스터 연구",
        "category_key": "Advanced Logic & Transistors (GAA/CFET/2D)",
        "description": "3나노 이하 MBCFET/GAA(Gate-All-Around), 상보형 트랜지스터(CFET), 2차원(2D) 나노시트 소자 등 글로벌 차세대 로직 트랜지스터 산학협력 연구 네트워크.",
        "keywords": ["GAA 산학협력", "3nm 트랜지스터 연구", "CFET 연구실", "MBCFET 반도체 연구", "차세대 로직 소자"]
    },
    {
        "slug": "advanced-packaging",
        "name_ko": "3D 하이브리드 본딩 & 칩렛 첨단 패키징 연구",
        "category_key": "Advanced Packaging & Chiplets (3D/Hybrid Bonding)",
        "description": "무범프 Cu-Cu 직접 접합 하이브리드 본딩, CoWoS 2.5D/3D 실리콘 인터포저, UCIe 표준 칩렛(Chiplet) 이종 집적 기술 관련 글로벌 산학 R&D 프로젝트.",
        "keywords": ["하이브리드 본딩 산학협력", "반도체 칩렛 연구", "첨단 패키징 연구실", "CoWoS 3D 패키징", "UCIe 산학 R&D"]
    },
    {
        "slug": "euv",
        "name_ko": "High-NA EUV 노광 & 원자 단위 계측 공정 연구",
        "category_key": "Lithography & Metrology (EUV/High-NA)",
        "description": "0.55 NA High-NA 극자외선(EUV) 노광 공정, 저결함 카본 나노튜브 펠리클, 확률적 결함(Stochastic Defect) 억제 및 원자 수준 계측 검사 산학 연구 과제.",
        "keywords": ["EUV 산학협력", "High-NA EUV 연구", "반도체 노광공정 연구실", "펠리클 산학 R&D", "EUV 계측 검사"]
    },
    {
        "slug": "ai-chips",
        "name_ko": "AI NPU 가속기 & 뉴로모픽 반도체 연구",
        "category_key": "AI & Neuromorphic Computing",
        "description": "LLM 및 초거대 AI 추론·학습용 NPU 가속기, 멤리스터 기반 아날로그 시냅스 모사 뉴로모픽 칩, 엣지 AI 반도체 관련 글로벌 산학협력 연구 과제 분석.",
        "keywords": ["AI 반도체 산학협력", "NPU 연구실", "뉴로모픽 반도체 연구", "AI 가속기 산학 R&D", "신경망 프로세서 과제"]
    },
    {
        "slug": "power-semi",
        "name_ko": "GaN / SiC 차세대 화합물 전력 반도체 연구",
        "category_key": "Power & Compound Semiconductors (GaN/SiC)",
        "description": "전기차 및 신재생에너지용 탄화규소(SiC), 질화갈륨(GaN) 와이드밴드갭(WBG) 전력 반도체 소자 설계, 고효율 전력 변환 모듈 산학협력 R&D 현황.",
        "keywords": ["전력반도체 산학협력", "SiC 반도체 연구실", "GaN 전력반도체 연구", "화합물 반도체 산학"]
    },
    {
        "slug": "silicon-photonics",
        "name_ko": "실리콘 포토닉스 & 광 인터커넥트 연구",
        "category_key": "Silicon Photonics & Optical I/O",
        "description": "구리 배선의 대역폭 한계를 극복하는 실리콘 포토닉스(Silicon Photonics), CPO(Co-Packaged Optics), 초고속 온칩 광학 I/O 소자 산학협력 연구 과제 총람.",
        "keywords": ["실리콘 포토닉스 산학협력", "광 인터커넥트 연구", "CPO 반도체 연구실", "광통신 소자 산학 R&D"]
    }
]

def load_data():
    with open("data/collaborations.json", "r", encoding="utf-8") as f:
        return json.load(f)

def clean_text(text):
    if not text:
        return ""
    # Remove control chars or garbled sequences
    return re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str(text)).strip()

def render_html_page(title, description, keywords, breadcrumbs, content_html, schema_json_str, depth=2, total_projects=14241):
    canonical_url = f"{BASE_URL}/{breadcrumbs[-1]['path']}"
    css_href = "hub.css" if depth == 1 else "../hub.css"
    root_prefix = "../" if depth == 1 else "../../"
    hub_href = "index.html" if depth == 1 else "../index.html"
    
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Google Search Console Verification -->
  <meta name="google-site-verification" content="tQU4ms4HtuSSnlNO14YJO8OMyy59mqlFixqXl3Lhlbw" />
  
  <!-- Primary SEO Metadata -->
  <title>{title} | SRC Semi-Observatory</title>
  <meta name="description" content="{description}" />
  <meta name="keywords" content="{', '.join(keywords)}" />
  <meta name="author" content="SRC Semi-Observatory" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
  <meta name="theme-color" content="#0b0f19" />
  
  <!-- Canonical & Sitemap Links -->
  <link rel="canonical" href="{canonical_url}" />
  <link rel="sitemap" type="application/xml" title="Sitemap" href="{BASE_URL}/sitemap.xml" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="{canonical_url}" />
  <meta property="og:title" content="{title} | SRC Semi-Observatory" />
  <meta property="og:description" content="{description}" />
  <meta property="og:image" content="{BASE_URL}/favicon.svg" />
  <meta property="og:site_name" content="SRC Semi-Observatory" />
  <meta property="og:locale" content="ko_KR" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="{canonical_url}" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{description}" />
  <meta name="twitter:image" content="{BASE_URL}/favicon.svg" />
  
  <link rel="stylesheet" href="{css_href}">
  
  <!-- Structured Data (JSON-LD) -->
  <script type="application/ld+json">
  {schema_json_str}
  </script>
</head>
<body>
  <!-- Header Navigation -->
  <header class="hub-header">
    <div class="hub-container header-inner">
      <a href="{root_prefix}index.html" class="brand-link">
        <svg class="brand-icon" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V5.25a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 5.25v13.5A2.25 2.25 0 0 0 6.75 21Z" />
        </svg>
        <span>SRC Semi-Observatory</span>
      </a>
      <nav class="hub-nav">
        <a href="{root_prefix}index.html" class="nav-item">🗺️ 메인 대시보드</a>
        <a href="{hub_href}" class="nav-item active">📚 산학협력 디렉토리</a>
        <a href="{root_prefix}venture.html" class="nav-item">🚀 CVC 벤처투자 지도</a>
      </nav>
    </div>
  </header>

  <!-- Breadcrumbs -->
  <div class="breadcrumb-bar">
    <div class="hub-container">
      <nav aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          <li><a href="{root_prefix}index.html">홈</a></li>
          <li><span class="sep">&gt;</span><a href="{hub_href}">산학협력 디렉토리</a></li>
          {"".join([f'<li><span class="sep">&gt;</span><span>{b["name"]}</span></li>' for b in breadcrumbs[2:]])}
        </ol>
      </nav>
    </div>
  </div>

  <!-- Main Content -->
  <main class="hub-container hub-main">
    {content_html}
  </main>

  <!-- Footer -->
  <footer class="hub-footer">
    <div class="hub-container">
      <p class="footer-desc">
        글로벌 반도체 산학협력 및 차세대 R&D 네트워크 센서스 (SRC Semi-Observatory).<br>
        Crossref, OpenAlex, Europe PMC 학술 DOI 검증 기반 공식 문헌 {total_projects:,}건 제공.
      </p>
      <div class="footer-links">
        <a href="{root_prefix}index.html">인터랙티브 지도·그래프 대시보드</a>
        <a href="{hub_href}">전체 기관·주제 디렉토리</a>
        <a href="{root_prefix}venture.html">글로벌 반도체 벤처투자 지도</a>
        <a href="https://github.com/eljja/SRC" target="_blank" rel="noopener">GitHub 저장소</a>
      </div>
    </div>
  </footer>
</body>
</html>
"""

def generate_company_pages(data):
    projects = data.get("projects", [])
    os.makedirs("hub/companies", exist_ok=True)
    generated = []

    for comp in COMPANIES:
        slug = comp["slug"]
        qname = comp["query_name"]
        
        # Filter projects
        matched = [p for p in projects if p.get("company") and qname in p.get("company")]
        # Sort by start_year desc
        matched.sort(key=lambda x: x.get("start_year") or 0, reverse=True)
        
        total_cnt = len(matched)
        verified_cnt = sum(1 for p in matched if p.get("verification", {}).get("status") == "verified")
        
        # Top partner universities
        unis = Counter(p.get("university") for p in matched if p.get("university") and p.get("university") != "Research Institution")
        top_unis = unis.most_common(5)
        
        # Top categories
        cats = Counter(p.get("category") for p in matched if p.get("category"))
        top_cats = cats.most_common(4)

        # Title & Meta
        title = f"{comp['name_ko']} 반도체 산학협력 및 연구 과제 현황 ({total_cnt}건)"
        desc = f"{comp['name_ko']}의 {total_cnt}건 반도체 산학협력 및 R&D 프로젝트 목록. {', '.join([u[0].split('(')[0].strip() for u in top_unis[:3]])} 등 주요 대학 협력, {', '.join([c[0].split('(')[0].strip() for c in top_cats[:2]])} 핵심 연구 문헌 및 DOI 전수 분석."
        
        # CTA URL
        cta_url = f"../../index.html?company={quote(qname)}&view=map"
        
        # Build Table rows
        table_rows = []
        for p in matched[:40]: # Top 40 projects
            pid = p.get("id", "")
            ptitle = clean_text(p.get("title", ""))
            puni = clean_text(p.get("university", "")).split("(")[0].strip()
            pprof = clean_text(p.get("professor", "-"))
            pcat = clean_text(p.get("category", "")).split("(")[0].strip()
            pyear = p.get("start_year", "-")
            pevid = p.get("evidence_ref", "")
            
            doi_match = re.search(r'(https?://doi\.org/[^\s,\)]+)', pevid)
            doi_link = f'<a href="{doi_match.group(1)}" target="_blank" rel="noopener" class="doi-pill">DOI ↗</a>' if doi_match else '<span class="text-muted">문헌</span>'
            
            tier_badge = '<span class="badge badge-verified">검증 산학협력</span>' if p.get("verification", {}).get("status") == "verified" else '<span class="badge badge-academic">학술 연구</span>'
            
            table_rows.append(f"""
            <tr>
              <td class="col-title">
                <div class="table-project-title">{ptitle}</div>
                <div class="table-project-sub">{tier_badge} <span class="text-muted">ID: {pid}</span></div>
              </td>
              <td>{puni}</td>
              <td>{pprof}</td>
              <td><span class="category-tag">{pcat}</span></td>
              <td>{pyear}</td>
              <td class="col-center">{doi_link}</td>
            </tr>
            """)

        # Cross links
        cross_links_html = "".join([
            f'<a href="{c["slug"]}.html" class="hub-pill">{c["name_ko"].split("(")[0].strip()}</a> '
            for c in COMPANIES if c["slug"] != slug
        ])

        content_html = f"""
        <div class="hub-page-header">
          <span class="hub-badge-corp">기업 산학협력 분석</span>
          <h1 class="hub-title">{comp['name_ko']} 반도체 산학협력 연구 네트워크</h1>
          <p class="hub-intro">{comp['description']}</p>
        </div>

        <!-- Stat Grid -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-num">{total_cnt:,}</div>
            <div class="stat-label">조사 연구 과제수</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-num">{verified_cnt:,}</div>
            <div class="stat-label">공식 검증 산학협력</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{len(unis)}</div>
            <div class="stat-label">협력 대학교·연구기관</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{len(cats)}</div>
            <div class="stat-label">연구 기술 도메인</div>
          </div>
        </div>

        <!-- CTA Bar -->
        <div class="cta-banner">
          <div class="cta-text">
            <h3>🌐 인터랙티브 지도 & 관계망 그래프에서 확인하기</h3>
            <p>{comp['name_ko']}의 전 세계 대학 협력 거점망과 연구 축선을 3D 인터랙티브 대시보드로 탐색해보세요.</p>
          </div>
          <a href="{cta_url}" class="cta-btn">🗺️ 대시보드에서 {comp['name_ko'].split('(')[0].strip()} 보기 ➔</a>
        </div>

        <!-- Research Domains & Partner Highlights -->
        <div class="content-split">
          <div class="split-box">
            <h2 class="box-title">🏢 주요 협력 대학 (Top Partners)</h2>
            <ul class="data-list">
              {"".join([f'<li><span class="item-name">{u[0].split("(")[0].strip()}</span><span class="item-count">{u[1]}건</span></li>' for u in top_unis])}
            </ul>
          </div>
          <div class="split-box">
            <h2 class="box-title">🔬 핵심 연구 기술 분야 (Domains)</h2>
            <ul class="data-list">
              {"".join([f'<li><span class="item-name">{c[0].split("(")[0].strip()}</span><span class="item-count">{c[1]}건</span></li>' for c in top_cats])}
            </ul>
          </div>
        </div>

        <!-- Projects Table -->
        <section class="table-section">
          <div class="section-header-row">
            <h2 class="section-title">📋 대표 산학협력 및 R&D 프로젝트 목록 (상위 40건)</h2>
            <a href="{cta_url}" class="view-all-link">전체 {total_cnt}건 대시보드에서 검색 & 필터링 ↗</a>
          </div>
          <div class="table-responsive">
            <table class="hub-table">
              <thead>
                <tr>
                  <th>연구 주제 및 프로젝트</th>
                  <th>수행 대학교</th>
                  <th>담당 교수(PI)</th>
                  <th>연구 분야</th>
                  <th>연도</th>
                  <th>문헌</th>
                </tr>
              </thead>
              <tbody>
                {"".join(table_rows)}
              </tbody>
            </table>
          </div>
        </section>

        <!-- FAQ Section for Rich Snippets -->
        <section class="faq-section">
          <h2 class="section-title">❓ 자주 묻는 질문 (FAQ)</h2>
          <div class="faq-item">
            <h3>Q. {comp['name_ko'].split('(')[0].strip()}는 주로 어떤 대학과 산학협력을 진행하나요?</h3>
            <p>본 센서스 분석에 따르면 {comp['name_ko'].split('(')[0].strip()}는 {', '.join([u[0].split('(')[0].strip() for u in top_unis[:3]])} 등 국내외 선도 대학 연구실과 가장 활발한 공동 연구 및 인재 양성 프로젝트를 수행하고 있습니다.</p>
          </div>
          <div class="faq-item">
            <h3>Q. 가장 많은 투자가 이루어지는 핵심 기술 분야는 어디인가요?</h3>
            <p>{', '.join([c[0].split('(')[0].strip() for c in top_cats[:3]])} 분야의 연구 비중이 가장 높으며, 차세대 미세 공정 및 지능형 반도체 소자 연구가 중심을 이룹니다.</p>
          </div>
        </section>

        <!-- Related Companies Cross-links -->
        <section class="crosslinks-section">
          <h3 class="crosslink-title">🔗 다른 반도체 기업 산학협력 네트워크 보기</h3>
          <div class="pill-group">
            {cross_links_html}
          </div>
        </section>
        """

        # Schema JSON-LD
        schema_json = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE_URL}/"},
                        {"@type": "ListItem", "position": 2, "name": "산학협력 디렉토리", "item": f"{BASE_URL}/hub/index.html"},
                        {"@type": "ListItem", "position": 3, "name": comp["name_ko"], "item": f"{BASE_URL}/hub/companies/{slug}.html"}
                    ]
                },
                {
                    "@type": "Article",
                    "headline": title,
                    "description": desc,
                    "url": f"{BASE_URL}/hub/companies/{slug}.html",
                    "datePublished": "2024-01-01",
                    "dateModified": TODAY,
                    "author": {"@type": "Organization", "name": "SRC Semi-Observatory"},
                    "publisher": {"@type": "Organization", "name": "SRC Semi-Observatory", "logo": f"{BASE_URL}/favicon.svg"}
                },
                {
                    "@type": "FAQPage",
                    "mainEntity": [
                        {
                            "@type": "Question",
                            "name": f"{comp['name_ko'].split('(')[0].strip()}는 주로 어떤 대학과 산학협력을 진행하나요?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": f"{comp['name_ko'].split('(')[0].strip()}는 {', '.join([u[0].split('(')[0].strip() for u in top_unis[:3]])} 등 주요 대학과 활발한 공동 연구를 수행하고 있습니다."
                            }
                        },
                        {
                            "@type": "Question",
                            "name": "가장 많은 투자가 이루어지는 핵심 기술 분야는 어디인가요?",
                            "acceptedAnswer": {
                                "@type": "Answer",
                                "text": f"{', '.join([c[0].split('(')[0].strip() for c in top_cats[:3]])} 분야의 연구 비중이 가장 높습니다."
                            }
                        }
                    ]
                }
            ]
        }

        breadcrumbs = [
            {"name": "홈", "path": "index.html"},
            {"name": "산학협력 디렉토리", "path": "hub/index.html"},
            {"name": comp["name_ko"], "path": f"hub/companies/{slug}.html"}
        ]

        html_out = render_html_page(
            title=title,
            description=desc,
            keywords=comp["keywords"],
            breadcrumbs=breadcrumbs,
            content_html=content_html,
            schema_json_str=json.dumps(schema_json, ensure_ascii=False, indent=2)
        )

        out_path = f"hub/companies/{slug}.html"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_out)
        
        generated.append({
            "path": out_path,
            "url": f"{BASE_URL}/{out_path}",
            "title": title,
            "count": total_cnt
        })

    return generated

def generate_university_pages(data):
    projects = data.get("projects", [])
    os.makedirs("hub/universities", exist_ok=True)
    generated = []

    for uni in UNIVERSITIES:
        slug = uni["slug"]
        mkeys = uni["match_keys"]
        
        # Filter projects where university contains any match_key
        matched = [p for p in projects if p.get("university") and any(k.lower() in p.get("university", "").lower() for k in mkeys)]
        matched.sort(key=lambda x: x.get("start_year") or 0, reverse=True)
        
        total_cnt = len(matched)
        if total_cnt == 0:
            continue
            
        verified_cnt = sum(1 for p in matched if p.get("verification", {}).get("status") == "verified")
        
        # Partner companies
        comps = Counter(p.get("company") for p in matched if p.get("company") and p.get("company") != "-" and p.get("company") != "미지정")
        top_comps = comps.most_common(5)
        
        # Top categories
        cats = Counter(p.get("category") for p in matched if p.get("category"))
        top_cats = cats.most_common(4)
        
        # Top professors
        profs = Counter(p.get("professor") for p in matched if p.get("professor") and p.get("professor") != "-")
        top_profs = profs.most_common(5)

        title = f"{uni['name_ko']} 반도체 산학협력 및 연구실 과제 현황 ({total_cnt}건)"
        desc = f"{uni['name_ko']}의 {total_cnt}건 반도체 연구 과제 및 산학협력 현황. {', '.join([c[0].split('(')[0].strip() for c in top_comps[:3]])} 등 글로벌 선도 기업 협력, {', '.join([p[0] for p in top_profs[:3]])} 교수 연구실 및 학술 문헌 DOI 전수 분석."
        
        cta_url = f"../../index.html?university={quote(uni['query_name'])}&view=map"
        
        table_rows = []
        for p in matched[:40]:
            pid = p.get("id", "")
            ptitle = clean_text(p.get("title", ""))
            pcomp = clean_text(p.get("company", "학술 연구")).split("(")[0].strip()
            pprof = clean_text(p.get("professor", "-"))
            pcat = clean_text(p.get("category", "")).split("(")[0].strip()
            pyear = p.get("start_year", "-")
            pevid = p.get("evidence_ref", "")
            
            doi_match = re.search(r'(https?://doi\.org/[^\s,\)]+)', pevid)
            doi_link = f'<a href="{doi_match.group(1)}" target="_blank" rel="noopener" class="doi-pill">DOI ↗</a>' if doi_match else '<span class="text-muted">문헌</span>'
            
            tier_badge = '<span class="badge badge-verified">검증 산학협력</span>' if p.get("verification", {}).get("status") == "verified" else '<span class="badge badge-academic">학술 연구</span>'
            
            table_rows.append(f"""
            <tr>
              <td class="col-title">
                <div class="table-project-title">{ptitle}</div>
                <div class="table-project-sub">{tier_badge} <span class="text-muted">ID: {pid}</span></div>
              </td>
              <td><strong>{pcomp}</strong></td>
              <td>{pprof}</td>
              <td><span class="category-tag">{pcat}</span></td>
              <td>{pyear}</td>
              <td class="col-center">{doi_link}</td>
            </tr>
            """)

        cross_links_html = "".join([
            f'<a href="{u["slug"]}.html" class="hub-pill">{u["name_ko"].split("(")[0].strip()}</a> '
            for u in UNIVERSITIES if u["slug"] != slug
        ])

        content_html = f"""
        <div class="hub-page-header">
          <span class="hub-badge-uni">대학교·연구소 R&D 분석</span>
          <h1 class="hub-title">{uni['name_ko']} 반도체 연구 포트폴리오</h1>
          <p class="hub-intro">{uni['description']}</p>
        </div>

        <!-- Stat Grid -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-num">{total_cnt:,}</div>
            <div class="stat-label">연구 과제·문헌수</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-num">{verified_cnt:,}</div>
            <div class="stat-label">기업 검증 산학협력</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{len(comps)}</div>
            <div class="stat-label">참여 기업 네트워크</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{len(cats)}</div>
            <div class="stat-label">연구 분야 도메인</div>
          </div>
        </div>

        <!-- CTA Bar -->
        <div class="cta-banner">
          <div class="cta-text">
            <h3>🌐 인터랙티브 지도 & 관계망 그래프에서 확인하기</h3>
            <p>{uni['name_ko']}와 글로벌 반도체 기업 간의 지리적 연결망 및 협력 구조를 한눈에 살펴보세요.</p>
          </div>
          <a href="{cta_url}" class="cta-btn">🗺️ 대시보드에서 {uni['name_ko'].split('(')[0].strip()} 보기 ➔</a>
        </div>

        <!-- Highlights -->
        <div class="content-split">
          <div class="split-box">
            <h2 class="box-title">🏢 주요 협력 기업 (Partners)</h2>
            <ul class="data-list">
              {"".join([f'<li><span class="item-name">{c[0].split("(")[0].strip()}</span><span class="item-count">{c[1]}건</span></li>' for c in top_comps])}
            </ul>
          </div>
          <div class="split-box">
            <h2 class="box-title">👨‍🏫 주요 연구책임자 / 교수 (PIs)</h2>
            <ul class="data-list">
              {"".join([f'<li><span class="item-name">{p[0]} 교수</span><span class="item-count">{p[1]}건</span></li>' for p in top_profs])}
            </ul>
          </div>
        </div>

        <!-- Table Section -->
        <section class="table-section">
          <div class="section-header-row">
            <h2 class="section-title">📋 대표 연구 및 산학협력 프로젝트 (상위 40건)</h2>
            <a href="{cta_url}" class="view-all-link">전체 {total_cnt}건 대시보드에서 보기 ↗</a>
          </div>
          <div class="table-responsive">
            <table class="hub-table">
              <thead>
                <tr>
                  <th>연구 주제 및 프로젝트</th>
                  <th>참여/발주 기업</th>
                  <th>담당 교수(PI)</th>
                  <th>연구 분야</th>
                  <th>연도</th>
                  <th>문헌</th>
                </tr>
              </thead>
              <tbody>
                {"".join(table_rows)}
              </tbody>
            </table>
          </div>
        </section>

        <!-- FAQ Section -->
        <section class="faq-section">
          <h2 class="section-title">❓ 자주 묻는 질문 (FAQ)</h2>
          <div class="faq-item">
            <h3>Q. {uni['name_ko'].split('(')[0].strip()}와 가장 많이 협력하는 반도체 기업은 어디인가요?</h3>
            <p>본 센서스 데이터에 따르면 {', '.join([c[0].split('(')[0].strip() for c in top_comps[:3]])} 등이 가장 활발한 산학 공동 연구를 수행하고 있습니다.</p>
          </div>
          <div class="faq-item">
            <h3>Q. 주요 연구 분야는 무엇인가요?</h3>
            <p>{', '.join([c[0].split('(')[0].strip() for c in top_cats[:3]])} 등이 주요 연구 분야로 집계되었습니다.</p>
          </div>
        </section>

        <!-- Cross Links -->
        <section class="crosslinks-section">
          <h3 class="crosslink-title">🔗 다른 대학 연구 네트워크 보기</h3>
          <div class="pill-group">
            {cross_links_html}
          </div>
        </section>
        """

        schema_json = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE_URL}/"},
                        {"@type": "ListItem", "position": 2, "name": "산학협력 디렉토리", "item": f"{BASE_URL}/hub/index.html"},
                        {"@type": "ListItem", "position": 3, "name": uni["name_ko"], "item": f"{BASE_URL}/hub/universities/{slug}.html"}
                    ]
                },
                {
                    "@type": "Article",
                    "headline": title,
                    "description": desc,
                    "url": f"{BASE_URL}/hub/universities/{slug}.html",
                    "datePublished": "2024-01-01",
                    "dateModified": TODAY,
                    "author": {"@type": "Organization", "name": "SRC Semi-Observatory"},
                    "publisher": {"@type": "Organization", "name": "SRC Semi-Observatory", "logo": f"{BASE_URL}/favicon.svg"}
                }
            ]
        }

        breadcrumbs = [
            {"name": "홈", "path": "index.html"},
            {"name": "산학협력 디렉토리", "path": "hub/index.html"},
            {"name": uni["name_ko"], "path": f"hub/universities/{slug}.html"}
        ]

        html_out = render_html_page(
            title=title,
            description=desc,
            keywords=uni["keywords"],
            breadcrumbs=breadcrumbs,
            content_html=content_html,
            schema_json_str=json.dumps(schema_json, ensure_ascii=False, indent=2)
        )

        out_path = f"hub/universities/{slug}.html"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_out)
        
        generated.append({
            "path": out_path,
            "url": f"{BASE_URL}/{out_path}",
            "title": title,
            "count": total_cnt
        })

    return generated

def generate_topic_pages(data):
    projects = data.get("projects", [])
    os.makedirs("hub/topics", exist_ok=True)
    generated = []

    for top in TOPICS:
        slug = top["slug"]
        cat_key = top["category_key"]
        
        matched = [p for p in projects if p.get("category") == cat_key]
        matched.sort(key=lambda x: x.get("start_year") or 0, reverse=True)
        
        total_cnt = len(matched)
        verified_cnt = sum(1 for p in matched if p.get("verification", {}).get("status") == "verified")
        
        comps = Counter(p.get("company") for p in matched if p.get("company") and p.get("company") != "-" and p.get("company") != "미지정")
        top_comps = comps.most_common(5)
        
        unis = Counter(p.get("university") for p in matched if p.get("university") and p.get("university") != "Research Institution")
        top_unis = unis.most_common(5)

        title = f"{top['name_ko']} 산학 R&D 과제 현황 ({total_cnt}건)"
        desc = f"{top['name_ko']} 글로벌 산학협력 및 연구 과제 {total_cnt}건 전수 목록. {', '.join([c[0].split('(')[0].strip() for c in top_comps[:3]])} 및 {', '.join([u[0].split('(')[0].strip() for u in top_unis[:3]])}의 첨단 연구 문헌과 DOI 전수 분석."
        
        cta_url = f"../../index.html?category={quote(cat_key)}&view=network"
        
        table_rows = []
        for p in matched[:40]:
            pid = p.get("id", "")
            ptitle = clean_text(p.get("title", ""))
            pcomp = clean_text(p.get("company", "학술 연구")).split("(")[0].strip()
            puni = clean_text(p.get("university", "-")).split("(")[0].strip()
            pprof = clean_text(p.get("professor", "-"))
            pyear = p.get("start_year", "-")
            pevid = p.get("evidence_ref", "")
            
            doi_match = re.search(r'(https?://doi\.org/[^\s,\)]+)', pevid)
            doi_link = f'<a href="{doi_match.group(1)}" target="_blank" rel="noopener" class="doi-pill">DOI ↗</a>' if doi_match else '<span class="text-muted">문헌</span>'
            
            tier_badge = '<span class="badge badge-verified">검증 산학협력</span>' if p.get("verification", {}).get("status") == "verified" else '<span class="badge badge-academic">학술 연구</span>'
            
            table_rows.append(f"""
            <tr>
              <td class="col-title">
                <div class="table-project-title">{ptitle}</div>
                <div class="table-project-sub">{tier_badge} <span class="text-muted">ID: {pid}</span></div>
              </td>
              <td><strong>{pcomp}</strong></td>
              <td>{puni}</td>
              <td>{pprof}</td>
              <td>{pyear}</td>
              <td class="col-center">{doi_link}</td>
            </tr>
            """)

        cross_links_html = "".join([
            f'<a href="{t["slug"]}.html" class="hub-pill">{t["name_ko"].split("(")[0].strip()}</a> '
            for t in TOPICS if t["slug"] != slug
        ])

        content_html = f"""
        <div class="hub-page-header">
          <span class="hub-badge-tech">핵심 반도체 기술 분석</span>
          <h1 class="hub-title">{top['name_ko']} 글로벌 연구 네트워크</h1>
          <p class="hub-intro">{top['description']}</p>
        </div>

        <!-- Stat Grid -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-num">{total_cnt:,}</div>
            <div class="stat-label">연구 과제·논문수</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-num">{verified_cnt:,}</div>
            <div class="stat-label">기업 검증 산학협력</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{len(comps)}</div>
            <div class="stat-label">주요 참여 기업</div>
          </div>
          <div class="stat-card">
            <div class="stat-num">{len(unis)}</div>
            <div class="stat-label">연구 수행 대학군</div>
          </div>
        </div>

        <!-- CTA Bar -->
        <div class="cta-banner">
          <div class="cta-text">
            <h3>🌐 관계망 그래프 & 세계 지도에서 탐색하기</h3>
            <p>이 기술 분야의 핵심 연구 허브와 기업-대학 간 지식 전파 구조를 인터랙티브 그래프로 확인하세요.</p>
          </div>
          <a href="{cta_url}" class="cta-btn">🕸️ 그래프 대시보드 열기 ➔</a>
        </div>

        <!-- Highlights -->
        <div class="content-split">
          <div class="split-box">
            <h2 class="box-title">🏢 기술 주도 참여 기업 (Top Companies)</h2>
            <ul class="data-list">
              {"".join([f'<li><span class="item-name">{c[0].split("(")[0].strip()}</span><span class="item-count">{c[1]}건</span></li>' for c in top_comps])}
            </ul>
          </div>
          <div class="split-box">
            <h2 class="box-title">🎓 핵심 연구 수행 대학 (Top Universities)</h2>
            <ul class="data-list">
              {"".join([f'<li><span class="item-name">{u[0].split("(")[0].strip()}</span><span class="item-count">{u[1]}건</span></li>' for u in top_unis])}
            </ul>
          </div>
        </div>

        <!-- Table Section -->
        <section class="table-section">
          <div class="section-header-row">
            <h2 class="section-title">📋 대표 과제 및 연구 문헌 목록 (상위 40건)</h2>
            <a href="{cta_url}" class="view-all-link">대시보드에서 전체 보기 ↗</a>
          </div>
          <div class="table-responsive">
            <table class="hub-table">
              <thead>
                <tr>
                  <th>연구 주제 및 프로젝트</th>
                  <th>참여/발주 기업</th>
                  <th>수행 대학</th>
                  <th>담당 교수</th>
                  <th>연도</th>
                  <th>문헌</th>
                </tr>
              </thead>
              <tbody>
                {"".join(table_rows)}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Cross Links -->
        <section class="crosslinks-section">
          <h3 class="crosslink-title">🔗 다른 핵심 반도체 기술 분야 보기</h3>
          <div class="pill-group">
            {cross_links_html}
          </div>
        </section>
        """

        schema_json = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                        {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE_URL}/"},
                        {"@type": "ListItem", "position": 2, "name": "산학협력 디렉토리", "item": f"{BASE_URL}/hub/index.html"},
                        {"@type": "ListItem", "position": 3, "name": top["name_ko"], "item": f"{BASE_URL}/hub/topics/{slug}.html"}
                    ]
                },
                {
                    "@type": "Article",
                    "headline": title,
                    "description": desc,
                    "url": f"{BASE_URL}/hub/topics/{slug}.html",
                    "datePublished": "2024-01-01",
                    "dateModified": TODAY,
                    "author": {"@type": "Organization", "name": "SRC Semi-Observatory"},
                    "publisher": {"@type": "Organization", "name": "SRC Semi-Observatory", "logo": f"{BASE_URL}/favicon.svg"}
                }
            ]
        }

        breadcrumbs = [
            {"name": "홈", "path": "index.html"},
            {"name": "산학협력 디렉토리", "path": "hub/index.html"},
            {"name": top["name_ko"], "path": f"hub/topics/{slug}.html"}
        ]

        html_out = render_html_page(
            title=title,
            description=desc,
            keywords=top["keywords"],
            breadcrumbs=breadcrumbs,
            content_html=content_html,
            schema_json_str=json.dumps(schema_json, ensure_ascii=False, indent=2)
        )

        out_path = f"hub/topics/{slug}.html"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_out)
        
        generated.append({
            "path": out_path,
            "url": f"{BASE_URL}/{out_path}",
            "title": title,
            "count": total_cnt
        })

    return generated

def generate_hub_index(comp_pages, uni_pages, topic_pages, total_projects=14241, verified_collabs=2410):
    title = "글로벌 반도체 산학협력 및 차세대 R&D 디렉토리 허브"
    desc = f"글로벌 주요 반도체 기업(삼성전자, SK하이닉스, TSMC, Intel, NVIDIA 등), 유수 대학(서울대, KAIST, MIT 등), 핵심 기술 분야(HBM, GAA, 3D 패키징, EUV)별 {total_projects:,}건 연구 과제 전수 색인 디렉토리."
    
    comp_cards = "".join([
        f"""
        <a href="companies/{os.path.basename(p['path'])}" class="dir-card">
          <div class="dir-card-header">
            <span class="dir-badge">기업</span>
            <span class="dir-count">{p['count']:,}건</span>
          </div>
          <h3 class="dir-name">{p['title'].split('(')[0].replace('반도체 산학협력 및 연구 과제 현황', '').strip()}</h3>
          <p class="dir-sub">산학협력 및 대학 연구 과제 분석 ➔</p>
        </a>
        """
        for p in comp_pages
    ])

    uni_cards = "".join([
        f"""
        <a href="universities/{os.path.basename(p['path'])}" class="dir-card">
          <div class="dir-card-header">
            <span class="dir-badge uni">대학</span>
            <span class="dir-count">{p['count']:,}건</span>
          </div>
          <h3 class="dir-name">{p['title'].split('(')[0].replace('반도체 산학협력 및 연구실 과제 현황', '').strip()}</h3>
          <p class="dir-sub">참여 기업 및 연구 포트폴리오 ➔</p>
        </a>
        """
        for p in uni_pages
    ])

    topic_cards = "".join([
        f"""
        <a href="topics/{os.path.basename(p['path'])}" class="dir-card">
          <div class="dir-card-header">
            <span class="dir-badge tech">기술</span>
            <span class="dir-count">{p['count']:,}건</span>
          </div>
          <h3 class="dir-name">{p['title'].split('(')[0].replace('산학 R&D 과제 현황', '').strip()}</h3>
          <p class="dir-sub">핵심 연구기관 및 과제 목록 ➔</p>
        </a>
        """
        for p in topic_pages
    ])

    content_html = f"""
    <div class="hub-page-header">
      <h1 class="hub-title">📚 글로벌 반도체 산학협력 전수 디렉토리</h1>
      <p class="hub-intro">
        본 디렉토리는 전 세계 {total_projects:,}건의 반도체 연구 문헌 및 {verified_collabs:,}건의 공식 검증 산학협력 데이터를 기업별, 대학별, 기술 도메인별로 분류하여 검색엔진에 최적화된 정적 웹페이지로 제공합니다.
      </p>
    </div>

    <!-- Quick Jump Links -->
    <div class="quick-jump-bar">
      <span>바로가기:</span>
      <a href="#companies-sec">🏢 주요 기업 ({len(comp_pages)}개)</a>
      <a href="#universities-sec">🎓 주요 대학교 ({len(uni_pages)}개)</a>
      <a href="#topics-sec">🔬 핵심 기술 도메인 ({len(topic_pages)}개)</a>
      <a href="../index.html">🗺️ 인터랙티브 메인 대시보드</a>
    </div>

    <!-- Companies Section -->
    <section id="companies-sec" class="dir-section">
      <div class="section-header-row">
        <h2 class="section-title">🏢 주요 반도체 기업별 산학협력 현황</h2>
      </div>
      <div class="dir-grid">
        {comp_cards}
      </div>
    </section>

    <!-- Universities Section -->
    <section id="universities-sec" class="dir-section">
      <div class="section-header-row">
        <h2 class="section-title">🎓 주요 대학 및 연구기관별 산학협력 현황</h2>
      </div>
      <div class="dir-grid">
        {uni_cards}
      </div>
    </section>

    <!-- Topics Section -->
    <section id="topics-sec" class="dir-section">
      <div class="section-header-row">
        <h2 class="section-title">🔬 핵심 반도체 기술 분야별 연구 네트워크</h2>
      </div>
      <div class="dir-grid">
        {topic_cards}
      </div>
    </section>
    """

    breadcrumbs = [
        {"name": "홈", "path": "index.html"},
        {"name": "산학협력 디렉토리", "path": "hub/index.html"}
    ]

    schema_json = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "홈", "item": f"{BASE_URL}/"},
                    {"@type": "ListItem", "position": 2, "name": "산학협력 디렉토리", "item": f"{BASE_URL}/hub/index.html"}
                ]
            },
            {
                "@type": "CollectionPage",
                "headline": title,
                "description": desc,
                "url": f"{BASE_URL}/hub/index.html",
                "dateModified": TODAY,
                "publisher": {"@type": "Organization", "name": "SRC Semi-Observatory"}
            }
        ]
    }

    html_out = render_html_page(
        title=title,
        description=desc,
        keywords=["반도체 산학협력 디렉토리", "반도체 연구 과제 목록", "삼성전자 산학협력", "SK하이닉스 산학협력", "TSMC 연구", "서울대 반도체", "KAIST 반도체", "HBM", "GAA"],
        breadcrumbs=breadcrumbs,
        content_html=content_html,
        schema_json_str=json.dumps(schema_json, ensure_ascii=False, indent=2),
        depth=1,
        total_projects=total_projects
    )

    with open("hub/index.html", "w", encoding="utf-8") as f:
        f.write(html_out)

def generate_hub_css():
    css_content = """/* Hub Directory CSS - High Performance & Responsive */
:root {
  --bg-primary: #0b0f19;
  --bg-secondary: #111827;
  --bg-card: #1f2937;
  --border-color: #374151;
  --text-primary: #f3f4f6;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --accent-cyan: #38bdf8;
  --accent-blue: #3b82f6;
  --accent-purple: #a855f7;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Pretendard", sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

.hub-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* Header */
.hub-header {
  background: rgba(17, 24, 39, 0.95);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 50;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.1rem;
}

.brand-icon {
  width: 24px;
  height: 24px;
  color: var(--accent-cyan);
}

.hub-nav {
  display: flex;
  gap: 1rem;
}

.nav-item {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.88rem;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.nav-item:hover, .nav-item.active {
  color: #fff;
  background: var(--bg-card);
}

/* Breadcrumb */
.breadcrumb-bar {
  background: rgba(15, 23, 42, 0.6);
  border-bottom: 1px solid rgba(55, 65, 81, 0.5);
  padding: 0.6rem 0;
  font-size: 0.82rem;
}

.breadcrumb-list {
  display: flex;
  list-style: none;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.breadcrumb-list a {
  color: var(--text-secondary);
  text-decoration: none;
}

.breadcrumb-list a:hover {
  color: var(--accent-cyan);
  text-decoration: underline;
}

.breadcrumb-list .sep {
  color: var(--text-muted);
}

/* Page Header */
.hub-page-header {
  margin: 2.5rem 0 1.8rem;
}

.hub-badge-corp {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
  font-size: 0.78rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-weight: 600;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.hub-badge-uni {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
  font-size: 0.78rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-weight: 600;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.hub-badge-tech {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
  font-size: 0.78rem;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  font-weight: 600;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.hub-title {
  font-size: 1.85rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  margin-bottom: 0.6rem;
}

.hub-intro {
  color: var(--text-secondary);
  font-size: 0.98rem;
  max-width: 900px;
  line-height: 1.6;
}

/* Stat Grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.25rem;
}

.stat-card.highlight {
  border-color: rgba(56, 189, 248, 0.4);
  background: rgba(56, 189, 248, 0.05);
}

.stat-num {
  font-size: 1.9rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.2;
}

.stat-card.highlight .stat-num {
  color: var(--accent-cyan);
}

.stat-label {
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}

/* CTA Banner */
.cta-banner {
  background: linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 10px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

.cta-text h3 {
  color: #fff;
  font-size: 1.15rem;
  margin-bottom: 0.25rem;
}

.cta-text p {
  color: var(--text-secondary);
  font-size: 0.88rem;
}

.cta-btn {
  background: #2563eb;
  color: #fff;
  padding: 0.75rem 1.4rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.92rem;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.cta-btn:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
}

/* Split Content */
.content-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

@media (max-width: 768px) {
  .content-split { grid-template-columns: 1fr; }
}

.split-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.25rem;
}

.box-title {
  font-size: 1.05rem;
  color: #fff;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(55, 65, 81, 0.5);
  padding-bottom: 0.5rem;
}

.data-list {
  list-style: none;
}

.data-list li {
  display: flex;
  justify-content: space-between;
  padding: 0.45rem 0;
  border-bottom: 1px dashed rgba(55, 65, 81, 0.3);
  font-size: 0.88rem;
}

.data-list li:last-child { border-bottom: none; }
.item-name { color: var(--text-primary); }
.item-count { color: var(--accent-cyan); font-weight: 600; }

/* Table Section */
.table-section {
  margin-bottom: 3rem;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.section-title {
  font-size: 1.25rem;
  color: #fff;
}

.view-all-link {
  color: var(--accent-cyan);
  text-decoration: none;
  font-size: 0.85rem;
}

.view-all-link:hover { text-decoration: underline; }

.table-responsive {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.hub-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.hub-table th {
  background: var(--bg-card);
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.hub-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(55, 65, 81, 0.4);
  vertical-align: middle;
}

.hub-table tr:hover {
  background: rgba(31, 41, 55, 0.5);
}

.col-title { min-width: 260px; max-width: 400px; }
.table-project-title { color: #fff; font-weight: 500; line-height: 1.4; margin-bottom: 0.25rem; }
.table-project-sub { font-size: 0.75rem; display: flex; gap: 0.4rem; align-items: center; }

.badge {
  font-size: 0.68rem;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-weight: 600;
}
.badge-verified { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
.badge-academic { background: rgba(148, 163, 184, 0.2); color: #cbd5e1; }

.category-tag {
  background: rgba(55, 65, 81, 0.6);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.doi-pill {
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.75rem;
  white-space: nowrap;
}
.doi-pill:hover { background: rgba(56, 189, 248, 0.15); }
.col-center { text-align: center; }

/* FAQ Section */
.faq-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2.5rem;
}

.faq-item {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(55, 65, 81, 0.4);
}

.faq-item:first-of-type { border-top: none; padding-top: 0; }
.faq-item h3 { font-size: 0.98rem; color: #fff; margin-bottom: 0.35rem; }
.faq-item p { font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; }

/* Cross Links */
.crosslinks-section {
  margin-bottom: 3rem;
}

.crosslink-title {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.pill-group {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.hub-pill {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  text-decoration: none;
  padding: 0.35rem 0.75rem;
  border-radius: 20px;
  font-size: 0.82rem;
  transition: all 0.15s ease;
}

.hub-pill:hover {
  background: var(--bg-card);
  border-color: var(--accent-cyan);
  color: #fff;
}

/* Master Directory Index */
.quick-jump-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 2rem;
  font-size: 0.85rem;
}

.quick-jump-bar span { color: var(--text-muted); }
.quick-jump-bar a { color: var(--accent-cyan); text-decoration: none; }
.quick-jump-bar a:hover { text-decoration: underline; }

.dir-section { margin-bottom: 2.5rem; }

.dir-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.dir-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.25rem;
  text-decoration: none;
  transition: all 0.2s ease;
}

.dir-card:hover {
  border-color: var(--accent-cyan);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.dir-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.dir-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-weight: 600;
}

.dir-badge.uni {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.dir-badge.tech {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.dir-count {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.dir-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.35rem;
}

.dir-sub {
  font-size: 0.78rem;
  color: var(--text-secondary);
}

/* Footer */
.hub-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 2.5rem 0;
  margin-top: 4rem;
  text-align: center;
}

.footer-desc {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.82rem;
}

.footer-links a:hover { color: var(--accent-cyan); }
"""
    os.makedirs("hub", exist_ok=True)
    with open("hub/hub.css", "w", encoding="utf-8") as f:
        f.write(css_content)

def update_sitemap(all_pages):
    urls_xml = [
        f"""  <url>
    <loc>{BASE_URL}/</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>""",
        f"""  <url>
    <loc>{BASE_URL}/hub/index.html</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.95</priority>
  </url>""",
        f"""  <url>
    <loc>{BASE_URL}/venture.html</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>"""
    ]

    for p in all_pages:
        # Give companies priority 0.85, unis 0.85, topics 0.85
        urls_xml.append(f"""  <url>
    <loc>{p['url']}</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>""")

    joined_urls = "\n".join(urls_xml)
    sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
{joined_urls}
</urlset>
"""
    with open("sitemap.xml", "w", encoding="utf-8") as f:
        f.write(sitemap_content)
    print(f"Updated sitemap.xml with {len(urls_xml)} URLs.")

def main():
    print("Loading collaborations dataset...")
    data = load_data()
    projects = data.get("projects", [])
    total_projects = len(projects)
    verified_collabs = sum(
        1 for p in projects
        if (p.get("verification") or {}).get("status") != "quarantined"
        and (p.get("verification") or {}).get("collaboration_type") in ("corporate_grant", "co_authorship")
    )

    print("Generating hub CSS...")
    generate_hub_css()
    
    print("Generating Company SEO Landing Pages...")
    comp_pages = generate_company_pages(data)
    print(f"  Generated {len(comp_pages)} company pages.")

    print("Generating University SEO Landing Pages...")
    uni_pages = generate_university_pages(data)
    print(f"  Generated {len(uni_pages)} university pages.")

    print("Generating Topic SEO Landing Pages...")
    topic_pages = generate_topic_pages(data)
    print(f"  Generated {len(topic_pages)} topic pages.")

    print("Generating Master Hub Directory Index...")
    generate_hub_index(comp_pages, uni_pages, topic_pages, total_projects=total_projects, verified_collabs=verified_collabs)

    print("Updating sitemap.xml...")
    all_pages = comp_pages + uni_pages + topic_pages
    update_sitemap(all_pages)

    print("\nSUCCESS! Programmatic SEO execution complete.")
    print(f"Total static SEO landing pages generated: {len(all_pages) + 1}")

if __name__ == "__main__":
    main()
