# Global Semiconductor Industry-Academia-Institute R&D Observatory
> **글로벌 반도체 산학연(産學研) R&D 협력 지도 및 상호 연결망 시각화 시스템**

[![GitHub Pages Deployment](https://img.shields.io/badge/Hosted%20On-GitHub%20Pages-blue?logo=github)](https://eljja.github.io/SRC)
[![Dataset Version](https://img.shields.io/badge/Dataset-2026.08.20-emerald)](#)
[![No Server Required](https://img.shields.io/badge/Architecture-100%25%20Static%20SPA-purple)](#)

🌐 **웹 서비스 접속 주소 (GitHub Pages)**: [https://eljja.github.io/SRC](https://eljja.github.io/SRC)

---

## 📌 프로젝트 소개
본 프로젝트는 최근 10년(2015~2026년) 동안 전 세계 주요 반도체 기업(삼성전자, TSMC, 인텔, SK하이닉스, 엔비디아, ASML, AMAT 등), 연구소/컨소시엄(IMEC, SRC, Albany NanoTech, CEA-Leti, ITRI 등), 그리고 글로벌 유수 대학교(교수 연구실) 간에 진행된 **차세대 반도체 핵심 연구 과제와 산학 협력망**을 지도 및 인터랙티브 네트워크로 한눈에 파악할 수 있는 단독 실행형 정적 웹 플랫폼입니다.

---

## 🚀 핵심 기능

1. **🗺️ 인터랙티브 세계 지도 & 연결선 시각화 (Map View)**
   - Leaflet.js 기반의 다크 테마 글로벌 맵.
   - 대학교(담당교수 연구실), 반도체 기업, 연구소/컨소시엄 위치 마커 표시.
   - 기업 ↔ 대학교 간의 산학 협력 관계를 지리적 베지어 곡선(Geodesic Arc)으로 렌더링.
   - 진행중인 활성 과제는 점선 애니메이션으로 구별.

2. **🕸️ 관계망 네트워크 그래프 (Network View)**
   - D3.js Force-Directed Graph 기반의 다차원 관계망.
   - `기업 ↔ 컨소시엄 ↔ 대학교(교수) ↔ 연구 주제` 간의 4단계 상호 연결 관계를 드래그/줌/필터링 가능.

3. **📊 다차원 다이나믹 필터 & 정렬 시스템**
   - **기업별 (Company)**: TSMC, 삼성전자, Intel, SK하이닉스, NVIDIA, ASML, AMAT 등
   - **학교별 (University)**: Stanford, MIT, KAIST, 서울대, Purdue, UC Berkeley 등
   - **교수별 (Professor/PI)**: 전 세계 석학 연구책임자별 정렬 및 확인
   - **연구소/컨소시엄별 (Institute)**: SRC JUMP 2.0 (7개 센터), IMEC IIAP, DARPA ERI, CEA-Leti 등
   - **기술 분야별 (Domain)**: CFET/3D 트랜지스터, 2D 신소재, HBM/하이브리드 본딩, High-NA EUV, 광반도체(포토닉스), PIM/AI 소자, 전력 반도체(GaN/SiC)
   - **진행 상태 (Status)**: 🟢 진행중 (Active, 3개년 주기 반영) / ⚪ 완료 (Completed)

4. **⏱️ 접속일 실시간 감지 & 데이터 갱신 알림 (Freshness Tracker)**
   - 데이터베이스 최종 업데이트 날짜(`2026-08-20`) 기록.
   - 사용자가 웹 브라우저로 접속한 당일 날짜를 자동 비교.
   - 경과 일수에 따라 `🟢 최신 상태 (Fresh)`, `🟡 확인 권장 (Moderate)`, `🔴 업데이트 필요 (Needs Update)` 배지 및 알림 안내.

5. **📥 데이터셋 JSON 내보내기**
   - 브라우저에서 현재 필터링되거나 전체 탑재된 R&D 데이터셋을 원클릭으로 JSON 파일로 내보내기 가능.

---

## 🛠️ 기술 스택 및 아키텍처
* **Frontend**: HTML5, CSS3 (Modern Glassmorphism Dark Theme), Vanilla JavaScript (ES6+)
* **Map Engine**: Leaflet.js v1.9.4 + CartoDB Dark Matter Basemap
* **Graph Engine**: D3.js v7 (Force Simulation, Zoom, Drag)
* **Hosting**: GitHub Pages (별도의 Node.js / 백엔드 로컬 서버 없이 100% 클라이언트 브라우저에서 구동)

---

## 📂 디렉토리 구조
```
d:/Code/SRC/
├── index.html                   # 메인 단일 페이지 (SPA)
├── README.md                    # 서비스 설명 및 매뉴얼
├── css/
│   └── style.css                # 반응형 다크 테마 UI 스타일
├── js/
│   ├── app.js                   # 메인 앱 코디네이터 및 UI 바인딩
│   ├── dataManager.js           # 필터링, 정렬, 통계 연산 모듈
│   ├── map.js                   # Leaflet 세계 지도 & 협력 곡선 렌더러
│   ├── network.js               # D3 관계망 그래프 렌더러
│   └── tracker.js               # 접속일자 비교 및 신선도 트래커
├── data/
│   └── collaborations.json      # 10개년 글로벌 산학연 R&D 데이터셋
└── .github/
    └── workflows/
        └── deploy.yml           # GitHub Pages 자동 배포 CI/CD
```

---

## 💻 로컬 확인 및 GitHub Pages 배포 방법

### 1. GitHub Pages 자동 배포
* 본 저장소를 GitHub `https://github.com/eljja/SRC`의 `main` 브랜치에 푸시하면, `.github/workflows/deploy.yml` 액션이 동작하여 [https://eljja.github.io/SRC](https://eljja.github.io/SRC)에 즉시 배포됩니다.
* 저장소 Settings -> Pages에서 Source를 `GitHub Actions`로 설정해 주시면 됩니다.

### 2. 브라우저에서 바로 열기
* 로컬 서버 실행 없이 `index.html` 파일을 더블 클릭하여 크롬/엣지/사파리 브라우저에서 바로 열람하실 수 있습니다.
