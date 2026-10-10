# Global Semiconductor Academic & R&D Literature Census Observatory
> **글로벌 반도체 학술 연구 및 산학 R&D 문헌 센서스 대시보드 (v7.8.0)**

[![GitHub Pages Deployment](https://img.shields.io/badge/Hosted%20On-GitHub%20Pages-blue?logo=github)](https://eljja.github.io/SRC)
[![Dataset Scale](https://img.shields.io/badge/Census%20Data-Academic%20%26%20R%26D%20Census-emerald?logo=semantic-web)](#)
[![Period Covered](https://img.shields.io/badge/Period-2020--2026-amber)](#)
[![Evidence Standard](https://img.shields.io/badge/Data%20Integrity-Evidence--Based%20Provenanced-cyan)](#)
[![Architecture](https://img.shields.io/badge/Architecture-100%25%20Static%20SPA-purple)](#)

🌐 **웹 서비스 접속 주소 (GitHub Pages)**: [https://eljja.github.io/SRC](https://eljja.github.io/SRC)

---

## 📌 프로젝트 소개 및 데이터 신뢰성 원칙

본 프로젝트는 **최근 반도체 분야 학술 문헌 및 연구 과제(2020~2026년)**를 대상으로 Crossref, OpenAlex, Europe PMC 등 공인 학술 레지스트리의 DOI 문헌을 수집·체계화하여 인터랙티브 지도, 관계망 그래프, 디렉토리로 제공하는 오픈 사이언스 대시보드입니다.

### 🛡️ 데이터 관리 및 검증 원칙 (Data Integrity Principles)

1. **근거 기반 필드 관리 (No Evidence, No Fabrication)**
   - 문헌에 명시적 지원금 액수가 없는 경우 **임의의 추정값을 배정하지 않고 `null / 미확인(Unknown)`**으로 보존합니다.
   - 제목 길이, 인용 수, 레코드 번호 등을 이용한 인위적 펀딩 계산 공식은 전면 배제되었습니다.
2. **학술 논문과 기업 지원과제의 엄격한 구분**
   - 저자 소속(Affiliation)에 기업이 포함되어 있더라도, 공식 연구비 지원이나 공식 산학 프로젝트 계약이 문헌에 명시되지 않은 경우 기업 지원과제로 단정하지 않고 `소속기반(저자)`으로 구분합니다.
3. **'지원 없음(Nil/None)'과 '미확인(Unknown)'의 명확한 분리**
   - 논문에 "Source of Support: Nil" 또는 "None"으로 명시된 사례는 `none_stated(지원 없음)`로 정확히 기록하며, 단순 미확인과 구분합니다.
4. **프로젝트 기간 및 진행 상태의 합리적 판정**
   - 게재 연도만 확인되는 일반 학술 논문은 임의로 3년 기간을 부여하지 않으며, 단일 게재 연도 및 `완료(Completed/Published)` 상태로 관리합니다.
5. **비반도체 분야 문헌 격리 (Quarantine)**
   - 정형외과, 치과, 수의학, 종양학 등 반도체 및 하드웨어 연관성이 확인되지 않은 수집 문헌은 `검토대기(Quarantined)` 영역으로 격리하여 기본 지도, 관계망, 통계 집계에서 제외합니다.
6. **필드별 검증 이력 보존 (_audit_history)**
   - 원본 수집값과 보정 이력은 `_audit_history.original_values`에 보존되어 언제든지 롤백 및 감사(Audit)가 가능합니다.

---

## 🚀 핵심 기능 및 뷰(View) 구성

### 1. 🗺️ 세계 지도 (Map View)
- **검증된 산학 연계 회랑만 표기**: 기업의 공식 연구 지원 또는 참여가 입증된 관계에 한해 2색 SVG 그라데이션 아크 연결선 표시.
- **플로팅 비주얼 컨트롤 툴바**:
  - `⚡ 스마트 자동`: 줌 레벨에 따라 주요 축선 선별 노출
  - `🎯 선택 집중`: 마커 호버/클릭 시 해당 기관 연결망 집중 하이라이트
  - `🌟 주요 협력`: 다수 연계된 핵심 산학 축선 표시
  - `📍 마커만`: 연결선 없이 연구 거점 마커만 표시
- **컬러 모드 전환**: `🌈 기관 그라데이션` ↔ `🏷️ 7대 기술 도메인별 색상`

### 2. 🕸️ 관계망 그래프 (Network View)
- **세부 주제별 심층망 (Subtopic Mode)**: 7대 기술 분야 내 세부 주제별 집중도 및 연구 동향 시각화.
- **7대 도메인 총괄망 (Topic Mode)**: 기술 도메인 중심의 글로벌 연구 기관 연결망.
- **산학 기관망 (Institution Mode)**: 검증된 산학 협력 기관 간 상호 연결망.
- **⚡ 핵심 거점망 (Core Hub) 토글**: 핵심 거점 노드 필터링 및 시뮬레이션 안정화.

### 3. 📊 통계·랭킹 분석 (Analytics View)
- **연도별 문헌 추이 (2020~2026)**: 연도별 게재 및 과제 진행 상태 스택 바 차트.
- **7대 기술 도메인 비중**: GAA, HBM, 첨단 패키징, EUV, AI 반도체 등 도메인별 점유율.
- **주요 국가 및 권역별 분포**: 한국, 미국, 대만, 유럽, 일본 등 권역별 연구 현황.
- **기업별 도메인 관심도 매트릭스**: 주요 글로벌 기업의 기술 분야별 연구 집중도.

### 4. 📋 디렉토리 및 검색 (Table View)
- **검증 상태 뱃지 표기**: `지원 없음(Nil)`, `미확인(Unknown)`, `검증완료`, `검토대기` 일관 표기.
- **고속 검색 및 필터**: 복합 키워드 검색, 기업/대학/교수/연구소/기술분야/상태 다차원 필터링.
- **📥 데이터 내보내기**: 검증 메타데이터가 포함된 `JSON` 및 `CSV (RFC 4180)` 다운로드.

---

## 🛠️ 데이터 정리 및 복구 도구 (Remediation & Rollback CLI)

본 저장소는 데이터 신뢰성 확보를 위해 멱등성(Idempotency)과 롤백을 지원하는 데이터 정리 도구를 포함합니다.

```bash
# 1. 드라이런 (Dry-run): 실제 파일 변경 없이 진단 및 영향 분석 보고서 생성
python scripts/remediate_dataset.py --dry-run --report reports/dry_run_remediation_report.md

# 2. 적용 (Apply): 검증 원칙에 따라 데이터셋 보정 및 백업 생성
python scripts/remediate_dataset.py --apply

# 3. 롤백 (Rollback): 보정 전 원본 백업 파일로 즉시 복원
python scripts/remediate_dataset.py --rollback
```

---

## 📂 디렉토리 구조

```
d:/Code/SRC/
├── index.html                   # 메인 SPA 대시보드
├── README.md                    # 서비스 소개 및 데이터 원칙 문서
├── css/
│   └── style.css                # 반응형 다크 테마 및 컴포넌트 스타일
├── js/
│   ├── app.js                   # 메인 코디네이터, 모달, 디렉토리, CSV/JSON 내보내기
│   ├── dataManager.js           # 데이터셋 로딩, 검증 기반 필터링 및 통계 집계
│   ├── map.js                   # Leaflet 지도 렌더러 (검증된 연결선 선별 표기)
│   ├── network.js               # D3 Force 관계망 그래프
│   └── tracker.js               # 데이터 갱신일 및 신선도 트래커
├── data/
│   ├── collaborations.json      # R&D 문헌 센서스 데이터셋
│   └── ventures.json            # 글로벌 반도체 CVC 벤처 투자 데이터셋
├── scripts/
│   ├── auto_update.py           # 학술 API 자동 수집 스크립트 (검증 스키마 준수)
│   ├── remediate_dataset.py     # 데이터 보정, 감사 및 롤백 도구
│   ├── build_massive_dataset.py # 대규모 데이터셋 빌더 (규칙 보정 완료)
│   └── build_verified_dataset.py# 검증 데이터셋 빌더
├── tests/
│   ├── test_data_integrity.py   # 데이터 무결성 및 생성 원칙 단위 테스트
│   └── test_remediation.py      # 마이그레이션 멱등성 및 롤백 테스트
└── reports/
    └── dry_run_remediation_report.md # 데이터 보정 dry-run 상세 분석 보고서
```

---

## 💻 로컬 실행 방법

별도의 서버 설치 없이 웹 브라우저에서 `index.html`을 열어 로컬에서 바로 실행할 수 있습니다.
Python 로컬 서버를 사용할 경우:

```bash
python -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```
