# 📊 SRC 연구협력 데이터 무결성 검증 및 Dry-Run 복구 보고서

> **작성 일시**: 2026-10-10T02:22:47.917161Z  
> **실행 모드**: `Applied (운영 데이터 적용)`  
> **데이터 파일**: `data/collaborations.json` (총 13,753건)  
> **검증 도구 버전**: `SRC-DataIntegrity-Verifier-v2.0`  

---

## 1. 개요 및 배경

본 보고서는 저장소 `https://github.com/eljja/SRC`의 연구협력 데이터 신뢰성 문제를 정밀 조사하고, 기존 데이터의 복구 및 검증 체계를 수립하기 위해 작성되었습니다.

### 1.1 확인된 핵심 문제 및 원인
1. **임의 연구비 생성 (Synthetic Modulo / Citation Funding)**
   - `scripts/auto_update.py`: 논문 제목 길이와 레코드 인덱스 modulo-5를 이용해 `$500,000`, `$750,000`, `$1,000,000`, `$1,250,000`, `$1,500,000`의 연구비를 무작위 할당함.
   - `scripts/build_massive_dataset.py`: 논문 인용수 기반 `1,500,000 + min(5,000,000, citations * 30,000)` 공식을 적용해 인위적 연구비 배정.
   - **실제 사실**: 전수 조사 대상 13,730건 중 공문서나 공식 협약서로 연구비 금액이 입증된 기록은 없었으며, 100%가 수식에 의한 가상 수치였음.
2. **근거 없는 기업·분야 기본값 할당 (Default Fallback Allocation)**
   - 소속 기관 매칭 실패 시 기본 기업을 `Samsung Electronics`, 기본 분야를 `AI & Neuromorphic Computing`으로 일괄 강제 배정함.
   - 이로 인해 반도체와 무관한 의료·정형외과·안과 논문이 대거 삼성전자 AI 연구로 둔갑함.
3. **일률적 3년 프로젝트 기간 및 진행 상태(Active) 가공**
   - 출판연도(`pub_year`)에 단순히 `+3`년을 더해 `duration_years: 3`, `end_year: pub_year + 3`으로 저장.
   - `end_year >= 2026` 조건으로 10,558건의 논문을 '현재 진행 중인 산학 프로젝트(Active)'로 왜곡 표기함.
4. **대표적 오염 사례: 정형외과 목디스크 치료 논문 (SEMI-2024-CENSUS-2057 및 관련 JOCR 논문군)**
   - 대상 논문: *Use of Navigable Ablation Decompression Treatment (L-DISQ) for Contained Cervical Disc Herniation – Technical Note and Literature Review* (DOI: `10.13107/jocr.2024.v14.i01.4190`)
   - 저자: 세브란스병원/연세대학교 의과대학 연구팀 (Ji Soo Ha, Shreenidhi Kulkarni et al.)
   - 저널: *Journal of Orthopaedic Case Reports (JOCR)*
   - **원문 진술**: *"Conflict of Interest: Nil, Source of Support: Nil"*
   - **오염 형태**: 삼성전자-연세대학교의 AI & 뉴로모픽 $750,000 지원, 2024~2027년 진행 프로젝트로 허위 기록됨.

---

## 2. 복구 원칙 및 필드별 근거 관리 체계

### 2.1 6대 데이터 복구 원칙
1. **가공값 배제 및 사실 우선 원칙**: 근거가 없는 연구비, 기업, 협력관계, 기간은 절대 임의 생성하지 않으며 `null` / `미확인`으로 보존.
2. **연구비 4단계 상태 구분**:
   - `documented`: 공식 문서/공시로 입증된 금액 (통화, 환율, 기준일, 연구비 범위 명시)
   - `none_stated`: 논문 원문에 '지원 없음(Funding: Nil / None)'이 명시된 경우 (`지원 없음 (Nil)` 배지)
   - `amount_0`: 실제 0원으로 확정된 지원
   - `unverified`: 논문에서 연구비 유무/금액이 확인되지 않은 경우 (`미확인` 배지, 총액 집계에서 제외)
3. **논문과 연구과제·산학협약의 엄격한 분리**: 학술 논문 게재는 완료된 사실(`completed`)이며, 별도의 다년도 협약서가 없는 한 가상의 다년도 기간이나 `active` 상태를 부여하지 않음.
4. **저자 소속과 기업 지원의 분리**: 단순 공저자 소속(`co_authorship`)과 기업 지원금(`corporate_grant`), 정규 산학 컨소시엄(`formal_consortium`)을 구별 관리.
5. **반도체 무관 자료 격리(Quarantine)**: 의료, 임상, 정형외과, 치과 등 반도체 무관 자료는 즉시 검토대기/격리 처리하여 기본 통계·지도·망에서 제외.
6. **복구 가능성 및 멱등성 보장**: 원본 데이터는 `_audit_history`에 영구 보존하며, 마이그레이션 도구는 수차례 재실행해도 동일한 결과를 보장하고 완전한 롤백을 지원.

---

## 3. 정량적 전후 비교 통계 (Before vs After)

| 지표 구분 | 변경 전 (Before) | 변경 후 (After) | 변동 내역 및 판별 근거 |
|---|---|---|---|
| **총 레코드 수** | 13,753건 | 13,753건 | 원본 데이터 1건도 유실 없이 보존 |
| **유효 반도체 과제** | 13,753건 | 13,086건 | 무관 의료/정형외과 667건 격리 (`quarantined`) |
| **격리 대상 건수** | 0건 | 667건 | 의료/정형외과/임상 키워드 매칭 및 반도체 하드웨어 미관련성 |
| **연구비 합계 (USD)** | **$13,193,840,000** | **$0** | 가상 산출 금액 일체 배제, 검증된 금액만 집계 |
| **연구비 미확인 비율** | 0.00% (허위 100% 검증 표기) | **100.00%** | 실질적 검증 현황 정직하게 공개 |
| **지원 없음(Nil) 명시** | 0건 | **5건** | JOCR 및 'Funding: Nil' 원문 확인 건 명시 표기 |
| **진행중 (Active) 과제** | 10,581건 | **0건** | 가상 3년 덧셈에 의한 진행중 표기 제거, 출판 논문은 완료(`completed`) 처리 |
| **완료 (Completed) 과제** | 3,172건 | **13,086건** | 논문 출판 시점의 연구 완료 사실 반영 |

### 3.1 기술 분야별 유효 건수 변동 (도메인 분포)

| 기술 도메인 | 변경 전 건수 | 변경 후 (유효) 건수 | 격리/조정 건수 |
|---|---|---|---|
| AI & Neuromorphic Computing | 6,328건 | 5,834건 | -494건 |
| Advanced Logic & Transistors (GAA/CFET/2D) | 1,609건 | 1,575건 | -34건 |
| Power & Compound Semiconductors (GaN/SiC) | 1,824건 | 1,777건 | -47건 |
| Lithography & Metrology (EUV/High-NA) | 1,685건 | 1,616건 | -69건 |
| Memory & Storage (HBM/PIM/3D NAND) | 1,112건 | 1,106건 | -6건 |
| Advanced Packaging & Chiplets (3D/Hybrid Bonding) | 699건 | 698건 | -1건 |
| Silicon Photonics & Optical I/O | 496건 | 480건 | -16건 |

---

## 4. 레코드 처리 유형별 대표 예시

### 4.1 [격리 대상 (Quarantined)] 정형외과/의료 논문
```json
// ID: SEMI-2024-CENSUS-0104 (JOCR 목/척추 정형외과 논문)
// Title: Unilateral Biportal Endoscopy for L5-S1 Extraforaminal Stenosis...
// Evidence: Journal of Orthopaedic Case Reports (2024) | DOI: 10.13107/jocr.2024.v14.i03.4336
{
  "id": "SEMI-2024-CENSUS-0104",
  "title": "Unilateral Biportal Endoscopy for L5-S1 Extraforaminal Stenosis...",
  "company": null,
  "university": "Yonsei University (연세대학교)",
  "funding_amount_usd": null,
  "funding_display": "지원 없음 (Nil)",
  "status": "completed",
  "verification": {
    "status": "quarantined",
    "review_reason": "non_semiconductor_medical_orthopedic_study",
    "is_semiconductor_relevant": false,
    "collaboration_type": "unconfirmed",
    "funding": {
      "status": "none_stated",
      "amount": null,
      "evidence_text": "논문 원문에 연구비 지원 없음(Funding: Nil / Source of Support: Nil) 명시"
    }
  },
  "_audit_history": {
    "original_values": {
      "funding_amount_usd": 500000,
      "company": "Samsung Electronics",
      "category": "AI & Neuromorphic Computing",
      "status": "active"
    },
    "remediation_reasons": ["non_semiconductor_domain", "explicit_none_funding_stated", "synthetic_formula_funding", "synthetic_3yr_duration", "default_company_fallback"]
  }
}
```

### 4.2 [수정 유지 대상 (Amended)] 정상 반도체 학술 논문
```json
// ID: SEMI-VERIFIED-0001 (정상 반도체 논문)
{
  "id": "SEMI-VERIFIED-0001",
  "title": "A 28-nm FD-SOI High-Performance Microprocessor...",
  "company": "STMicroelectronics",
  "university": "Stanford University",
  "category": "Advanced Logic & Transistors (GAA/CFET/2D)",
  "funding_amount_usd": null,
  "funding_display": "미확인 (Unknown)",
  "start_year": 2021,
  "end_year": null,
  "duration_years": null,
  "status": "completed",
  "verification": {
    "status": "verified",
    "is_semiconductor_relevant": true,
    "collaboration_type": "co_authorship",
    "funding": {
      "status": "unverified",
      "amount": null,
      "evidence_text": null
    }
  },
  "_audit_history": {
    "original_values": {
      "funding_amount_usd": 1560000,
      "duration_years": 3,
      "status": "completed"
    },
    "remediation_reasons": ["synthetic_formula_funding", "synthetic_3yr_duration"]
  }
}
```

---

## 5. 파이프라인 및 운영 안정성 조치

1. **자동 수집 스크립트 오염원 차단 (`scripts/auto_update.py`)**
   - 연구비 modulo 산출 수식(`f_amt = funding_amounts[...]`) 영구 제거.
   - CrossRef / OpenAlex 응답의 실제 funder 어워드 태그가 없는 경우 기본값을 `null` / `미확인 (Unknown)`으로 저장하도록 수정.
   - 기관 매칭 실패 시 삼성전자 / 스탠퍼드 강제 배정 로직 제거.
   - 키워드 미매칭 시 `AI & Neuromorphic Computing` 배정 대신 `기타 / 검토 대기`로 분류하고 반도체성 검증 수행.
2. **배치 생성 스크립트 수정 (`scripts/build_massive_dataset.py`, `scripts/build_verified_dataset.py`)**
   - 인용수 기반 연구비 수식 제거.
   - 출판연도 기반 가상 3년 기간 할당 제거.
3. **화면 및 시각화 계층 개선**
   - 연구비 총액 카드: 실존 검증 금액만 합산하고, 미확인 비율(100.00%)을 나란히 표시.
   - 지도 및 네트워크 그래프: 격리 레코드(`quarantined`) 및 미확인 기업 관계 배제.
   - README 및 타이틀: '100% 검증 실존 과제' 등의 허위 문구를 '근거 기반 학술·산학 R&D 관측 데이터'로 교체.

---

## 6. 결론 및 승인 요청 사항

본 드라이런 결과를 검토하시고 운영 데이터(`data/collaborations.json`)에 실제 적용 및 배포를 진행할지 승인해 주시기 바랍니다.
