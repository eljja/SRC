# Global Semiconductor Industry-Academia-Institute R&D Observatory
> **글로벌 반도체 산학연(産學研) R&D 협력 지도 및 상호 연결망 시각화 시스템 (v7.8.0)**

[![GitHub Pages Deployment](https://img.shields.io/badge/Hosted%20On-GitHub%20Pages-blue?logo=github)](https://eljja.github.io/SRC)
[![Dataset Scale](https://img.shields.io/badge/Census%20Data-13%2C691%20Verified%20Projects-emerald?logo=semantic-web)](#)
[![Period Covered](https://img.shields.io/badge/Period-2020--2026%20(5%20Years)-amber)](#)
[![Verification](https://img.shields.io/badge/Verification-100%25%20DOI%20%2F%20Peer--Reviewed-cyan)](#)
[![Architecture](https://img.shields.io/badge/Architecture-100%25%20Static%20SPA-purple)](#)

🌐 **웹 서비스 접속 주소 (GitHub Pages)**: [https://eljja.github.io/SRC](https://eljja.github.io/SRC)

---

## 📌 프로젝트 소개

본 프로젝트는 **최근 5개년(2020~2026년)** 동안 전 세계 주요 반도체 기업(삼성전자, TSMC, Intel, SK하이닉스, NVIDIA, ASML, AMAT, Qualcomm, Micron 등), 연구 컨소시엄(IMEC, SRC, CEA-Leti, Albany NanoTech, ITRI 등), 그리고 글로벌 유수 대학교(교수 연구실) 간에 수행된 **13,691건의 실존 R&D 프로젝트 전수 조사(Full Census)** 데이터를 인터랙티브 세계 지도, 관계망 네트워크 그래프, D3 통계 대시보드, 디렉토리로 시각화한 단독 실행형 웹 플랫폼입니다.

모든 데이터는 Crossref 및 Europe PMC 기반의 실제 DOI, 논문, 특허, 공식 과제 공시를 근거로 100% 검증된 실존 자료만을 수록하고 있습니다.

---

## 🚀 핵심 기능 및 뷰(View) 구성

### 1. 🗺️ 4단계 시각화 세계 지도 (Map View)
- **2색 기관 그라데이션 회랑**: 기업 브랜드 고유 색상 ➔ 대학교/연구기관 권역 색상으로 이어지는 2색 SVG 그라데이션 아크 연결선.
- **플로팅 비주얼 컨트롤 툴바**:
  - `⚡ 스마트 자동`: 줌 레벨에 따라 핵심 회랑을 지능적으로 선별 노출
  - `🎯 선택 집중`: 마커 호버/클릭 시 해당 기관의 연결망만 레이저 하이라이트 (주변 93% 디밍)
  - `🌟 주요 협력`: 3건 이상 다수 연계된 핵심 산학 축선 집중 표시
  - `📍 마커만`: 선을 숨기고 연구 거점 마커만 깔끔하게 표시
- **컬러 모드 전환**: `🌈 기관 그라데이션` ↔ `🏷️ 7대 기술 도메인별 색상`

### 2. 🕸️ 최적화된 D3 Force Graph (Network View)
- **⚡ 핵심 거점망 (Core Hub) LOD 모드**: 과제 2건 이상 핵심 허브 중심의 쾌적한 뷰와 전체 2,662개 기관 노드 뷰 간 원클릭 토글.
- **물리 엔진 최적화**: `alphaDecay(0.04)` 및 `velocityDecay(0.4)` 적용으로 2초 내 안정적인 레이아웃 안착.
- **줌 적응형 라벨 & 더블클릭 연동**: 확대 레벨에 따른 점진적 라벨 노출 및 노드 더블클릭 시 해당 기관의 전체 과제 목록으로 즉시 전환.

### 3. 📊 인터랙티브 D3 통계·랭킹 대시보드 (Analytics View)
- **📈 2020~2026 연도별 산학협력 R&D 추이**: D3.js Stacked Bar Chart로 연도별 과제 수 및 **진행중(Active) / 완료(Completed)** 비중 시각화.
- **🍩 7대 핵심 기술 도메인 도넛 차트**: GAA, HBM, 첨단 패키징, EUV, AI 반도체 등 7대 분야 점유율 시각화 (**클릭 시 해당 도메인 과제 목록으로 즉시 필터 연동**).
- **🌍 주요 국가 및 권역별 연구 협력 분포**: 한국, 미국, 대만, 유럽, 일본, 중국 등 수평 바 차트.
- **🔢 Top-N 동적 랭킹 선택기**: `[Top 5]` `[Top 10]` `[Top 20]` `[전체]` 버튼으로 최다 기업/대학/교수/연구소 표시 건수 조절.

### 4. 📋 고성능 과제 디렉토리 및 검색 (Table View)
- **실시간 검색 디바운스(250ms)**: 13,691건 대규모 데이터셋에 대해 버벅거림 없는 타이핑 검색 및 복합 단어 토큰 검색 지원.
- **직접 페이지 번호 이동 & 페이지 크기 선택기**: `1, 2, 3...` 직접 클릭 네비게이션 및 `[20 / 40 / 100건씩 보기]` 지원.
- **다차원 연쇄 필터**: 기업, 대학, 교수, 연구소, 기술도메인, 진행상태(진행중/완료) 즉시 필터링.

### 5. 📱 모바일 반응형 & UI/UX 편의성
- **모바일 사이드바 드로어**: 모바일 화면에서 햄버거 메뉴(☰)를 통한 부드러운 슬라이드인 필터 제어.
- **다크 테마 커스텀 스크롤바 & 포커스 링**: 전역 다크 스크롤바와 WAI-ARIA 웹 접근성 준수.
- **데이터 신선도 트래커 (Freshness Tracker)**: DB 갱신일과 접속일 비교 배지.
- **📥 데이터셋 JSON 원클릭 내보내기**.

---

## 🛠️ 기술 스택 및 아키텍처

| 구분 | 사용 기술 |
|---|---|
| **Frontend Framework** | Pure Vanilla JavaScript (ES6+), HTML5, CSS3 (Modern Dark Theme) |
| **Map Engine** | Leaflet.js v1.9.4 + CartoDB Dark Matter Basemap |
| **Data Visualization** | D3.js v7 (Force Simulation, Stacked Bar, Donut, Horizontal Bar) |
| **SEO & Indexing** | Google Search Console Meta Verification, `sitemap.xml`, `robots.txt`, JSON-LD (Schema.org) |
| **Hosting & CI/CD** | GitHub Pages (서버 없이 100% 클라이언트 브라우저에서 고속 구동) |

---

## 📂 디렉토리 구조

```
d:/Code/SRC/
├── index.html                   # 메인 단일 페이지 (SPA, SEO 및 JSON-LD 메타 포함)
├── sitemap.xml                  # 검색 엔진 크롤러용 사이트맵
├── robots.txt                   # 검색 로봇 허용 설정 및 사이트맵 링크
├── favicon.svg                  # 반도체 패키지 IC 다이 SVG 파비콘
├── README.md                    # 서비스 소개 및 상세 설명서
├── css/
│   └── style.css                # 반응형 다크 테마, 글래스모피즘, 차트 스타일
├── js/
│   ├── app.js                   # 메인 코디네이터, D3 차트 렌더러, 디바운스, 페이지네이션
│   ├── dataManager.js           # 13,691건 필터링, 정렬, 연도별/권역별 통계 연산
│   ├── map.js                   # Leaflet 세계 지도, 2색 그라데이션 아크, LOD 제어
│   ├── network.js               # D3 Force Graph, 핵심 거점망(Hub) LOD, 시뮬레이션
│   └── tracker.js               # 접속일자 비교, 데이터 신선도 뱃지
├── data/
│   └── collaborations.json      # 최근 5개년 13,691건 실존 산학연 R&D 전수 데이터셋
└── .github/
    └── workflows/
        └── deploy.yml           # GitHub Pages 자동 배포 CI/CD
```

---

## 💻 로컬 실행 및 배포 방법

### 1. 브라우저에서 바로 실행
별도의 Node.js 설치나 빌드 과정 없이 `index.html` 파일을 더블 클릭하여 크롬, 엣지, 사파리 등 모던 브라우저에서 즉시 실행할 수 있습니다.

### 2. GitHub Pages 자동 배포
`main` 브랜치에 코드를 푸시하면 GitHub Actions를 통해 [https://eljja.github.io/SRC](https://eljja.github.io/SRC)에 즉각 반영됩니다.
