import json
import os

additional = [
    {
        'investor_company': 'TSMC',
        'cvc_arm': 'VentureTech Alliance',
        'startup_name': 'DeepX',
        'startup_tagline': '[Edge AI NPU] 물리 보안·로보틱스·가전용 초저전력 실시간 온디바이스 AI 프로세서',
        'startup_tech_tag': 'Edge NPU',
        'investment_date': '2024-05',
        'investment_year': 2024,
        'investment_round': 'Series C',
        'investment_amount_usd': 80000000,
        'investment_amount_display': '$80M',
        'sector': 'Edge AI & IoT',
        'startup_description': 'TSMC 28nm 및 5nm 첨단 파운드리 공정 기반으로 초저전력 엣지 NPU DX-M1을 공동 양산하는 전략적 생태계 파트너십.',
        'startup_hq_city': 'Seongnam',
        'startup_hq_country': 'South Korea',
        'startup_lat': 37.4200,
        'startup_lon': 127.1260,
        'syndicate_partners': ['Samsung Catalyst Fund'],
        'source_url': 'https://deepx.ai',
        'status': 'active'
    },
    {
        'investor_company': 'TSMC',
        'cvc_arm': 'VentureTech Alliance',
        'startup_name': 'Celestial AI',
        'startup_tagline': '[광인터커넥트] Photonic Fabric™ 기반 광학 I/O 및 고대역폭 분산 메모리 패브릭',
        'startup_tech_tag': '광인터커넥트',
        'investment_date': '2024-03',
        'investment_year': 2024,
        'investment_round': 'Series C',
        'investment_amount_usd': 175000000,
        'investment_amount_display': '$175M',
        'sector': 'Optical Interconnect & Photonics',
        'startup_description': 'TSMC 첨단 3D 하이브리드 본딩 및 COUPE 실리콘 포토닉스 플랫폼에서 Photonic Fabric 칩렛을 통합하기 위한 전략적 공조.',
        'startup_hq_city': 'Santa Clara',
        'startup_hq_country': 'USA',
        'startup_lat': 37.3541,
        'startup_lon': -121.9552,
        'syndicate_partners': ['Samsung Catalyst Fund', 'AMD Ventures', 'Qualcomm Ventures'],
        'source_url': 'https://www.celestial.ai',
        'status': 'active'
    },
    {
        'investor_company': 'SK Hynix',
        'cvc_arm': 'SK Square',
        'startup_name': 'FuriosaAI',
        'startup_tagline': '[AI 가속기] 차세대 데이터센터 고효율 LLM 추론 반도체 RNGD',
        'startup_tech_tag': 'AI 가속기',
        'investment_date': '2023-11',
        'investment_year': 2023,
        'investment_round': 'Series B',
        'investment_amount_usd': 60000000,
        'investment_amount_display': '$60M',
        'sector': 'AI/ML Chips & Accelerators',
        'startup_description': 'SK하이닉스 고대역폭 메모리 HBM3와 LPDDR5X를 퓨리오사AI의 차세대 NPU 칩에 직결 탑재하기 위한 메모리 생태계 협력.',
        'startup_hq_city': 'Seoul',
        'startup_hq_country': 'South Korea',
        'startup_lat': 37.5665,
        'startup_lon': 126.9780,
        'syndicate_partners': ['Naver', 'DSC Investment'],
        'source_url': 'https://furiosa.ai',
        'status': 'active'
    },
    {
        'investor_company': 'SK Hynix',
        'cvc_arm': 'SK Square',
        'startup_name': 'Fadu',
        'startup_tagline': '[SSD 컨트롤러] PCIe Gen5/Gen6 및 CXL 지원 하이퍼스케일러 데이터센터 SSD 컨트롤러',
        'startup_tech_tag': 'CXL SSD 제어기',
        'investment_date': '2022-06',
        'investment_year': 2022,
        'investment_round': 'Pre-IPO',
        'investment_amount_usd': 40000000,
        'investment_amount_display': '$40M',
        'sector': 'Memory & Interconnect IP',
        'startup_description': 'SK하이닉스의 최첨단 낸드 플래시 메모리와 파두의 고성능 컨트롤러를 결합한 차세대 데이터센터 SSD 공동 개발.',
        'startup_hq_city': 'Seoul',
        'startup_hq_country': 'South Korea',
        'startup_lat': 37.5665,
        'startup_lon': 126.9780,
        'syndicate_partners': ['Samsung Ventures'],
        'source_url': 'https://fadu.io',
        'status': 'active'
    },
    {
        'investor_company': 'SK Hynix',
        'cvc_arm': 'SK Telecom Alliance',
        'startup_name': 'Mobigen',
        'startup_tagline': '[빅데이터 인텔리전스] 5G 네트워크 빅데이터 분석 및 인메모리 분산 데이터 인텔리전스',
        'startup_tech_tag': '빅데이터 SW',
        'investment_date': '2021-09',
        'investment_year': 2021,
        'investment_round': 'Strategic Investment',
        'investment_amount_usd': 10000000,
        'investment_amount_display': '$10M',
        'sector': 'Software & EDA',
        'startup_description': '이동통신망 트래픽과 반도체 팹 센서 데이터를 실시간 인메모리로 수집·분석하는 소프트웨어 플랫폼.',
        'startup_hq_city': 'Seoul',
        'startup_hq_country': 'South Korea',
        'startup_lat': 37.5665,
        'startup_lon': 126.9780,
        'syndicate_partners': [],
        'source_url': 'https://www.mobigen.com',
        'status': 'active'
    },
    {
        'investor_company': 'Intel',
        'cvc_arm': 'Intel Capital',
        'startup_name': 'SeekOut',
        'startup_tagline': '[엔터프라이즈 AI 탐색] 딥러닝 기반 기술 인재 및 반도체 엔지니어링 분석 AI 플랫폼',
        'startup_tech_tag': '엔터프라이즈 AI',
        'investment_date': '2022-01',
        'investment_year': 2022,
        'investment_round': 'Series C',
        'investment_amount_usd': 115000000,
        'investment_amount_display': '$115M',
        'sector': 'Software & EDA',
        'startup_description': '인텔 및 실리콘밸리 테크 기업용 인재 탐색 AI 플랫폼. 방대한 엔지니어링 논문과 특허를 분석해 R&D 팀 구성 지원.',
        'startup_hq_city': 'Bellevue',
        'startup_hq_country': 'USA',
        'startup_lat': 47.6101,
        'startup_lon': -122.2015,
        'syndicate_partners': ['Tiger Global', 'Madrona Venture Group'],
        'source_url': 'https://seekout.com',
        'status': 'active'
    },
    {
        'investor_company': 'Intel',
        'cvc_arm': 'Intel Capital',
        'startup_name': 'Hyperscience',
        'startup_tagline': '[업무 자동화 AI] 복잡한 금융·제조 문서를 고속 판독하는 하이퍼오토메이션 엔터프라이즈 AI',
        'startup_tech_tag': '문서인식 AI',
        'investment_date': '2021-12',
        'investment_year': 2021,
        'investment_round': 'Series E',
        'investment_amount_usd': 100000000,
        'investment_amount_display': '$100M',
        'sector': 'Software & EDA',
        'startup_description': '인텔 제온 프로세서 최적화 딥러닝 광학문자인식(OCR) 엔진을 통해 미가공 종이 문서를 정형 데이터로 자동 전환.',
        'startup_hq_city': 'New York',
        'startup_hq_country': 'USA',
        'startup_lat': 40.7128,
        'startup_lon': -74.0060,
        'syndicate_partners': ['Bessemer Venture Partners', 'Tiger Global'],
        'source_url': 'https://www.hyperscience.com',
        'status': 'active'
    },
    {
        'investor_company': 'Intel',
        'cvc_arm': 'Intel Capital',
        'startup_name': 'VeriSilicon',
        'startup_tagline': '[실리콘 플랫폼 솔루션] 첨단 커스텀 실리콘 반도체 설계 및 IP 턴키 플랫폼',
        'startup_tech_tag': '실리콘 플랫폼 IP',
        'investment_date': '2021-02',
        'investment_year': 2021,
        'investment_round': 'Strategic Capital Alliance',
        'investment_amount_usd': 30000000,
        'investment_amount_display': '$30M',
        'sector': 'Chiplet & Advanced Architecture',
        'startup_description': 'NPU, ISP, VPU 그래픽 코어를 자체 보유한 실리콘 플랫폼 서비스 선두 기업 (SiPaaS). 인텔 파운드리 및 칩렛 생태계 협력.',
        'startup_hq_city': 'Shanghai',
        'startup_hq_country': 'China',
        'startup_lat': 31.2304,
        'startup_lon': 121.4737,
        'syndicate_partners': [],
        'source_url': 'https://www.verisilicon.com',
        'status': 'active'
    },
    {
        'investor_company': 'Samsung Electronics',
        'cvc_arm': 'Samsung Catalyst Fund',
        'startup_name': 'Groq',
        'startup_tagline': '[LPU 추론 엔진] 결정론적 텐서 스트리밍 아키텍처 기반 초고속 LLM 언어 처리 프로세서(LPU)',
        'startup_tech_tag': '초고속 LPU',
        'investment_date': '2023-08',
        'investment_year': 2023,
        'investment_round': 'Strategic Foundry Partnership',
        'investment_amount_usd': 50000000,
        'investment_amount_display': '$50M+',
        'sector': 'AI/ML Chips & Accelerators',
        'startup_description': '구글 TPU 창시자 Jonathan Ross 창업. 삼성전자 테일러 팹 4nm 공정에서 차세대 LPU 칩을 생산하기 위한 파운드리 및 자금 연합.',
        'startup_hq_city': 'Mountain View',
        'startup_hq_country': 'USA',
        'startup_lat': 37.3861,
        'startup_lon': -122.0839,
        'syndicate_partners': ['D1 Capital', 'BlackRock'],
        'source_url': 'https://groq.com/newsroom',
        'status': 'active'
    },
    {
        'investor_company': 'Samsung Electronics',
        'cvc_arm': 'Samsung Ventures',
        'startup_name': 'Posiflex',
        'startup_tagline': '[스마트 IoT 단말] 스마트 리테일 및 엣지 서비스용 임베디드 단말 시스템 반도체 솔루션',
        'startup_tech_tag': '임베디드 단말',
        'investment_date': '2022-03',
        'investment_year': 2022,
        'investment_round': 'Strategic Alliance',
        'investment_amount_usd': 15000000,
        'investment_amount_display': '$15M',
        'sector': 'Edge AI & IoT',
        'startup_description': '글로벌 5대 POS 단말 시스템 제조사. 삼성 시스템LSI 엣지 프로세서 및 터치 디스플레이 칩셋 채용을 위한 전략적 지분 파트너십.',
        'startup_hq_city': 'New Taipei City',
        'startup_hq_country': 'Taiwan',
        'startup_lat': 25.0124,
        'startup_lon': 121.4657,
        'syndicate_partners': [],
        'source_url': 'https://www.posiflex.com',
        'status': 'active'
    },
    {
        'investor_company': 'NVIDIA',
        'cvc_arm': 'NVentures',
        'startup_name': 'Poolside',
        'startup_tagline': '[AI 코딩 파운데이션] 엔지니어링 소프트웨어 자동 개발 및 프로그래밍 특화 대규모 언어모델',
        'startup_tech_tag': 'AI 코딩모델',
        'investment_date': '2024-10',
        'investment_year': 2024,
        'investment_round': 'Series B',
        'investment_amount_usd': 500000000,
        'investment_amount_display': '$500M',
        'sector': 'Software & EDA',
        'startup_description': 'GitHub 전 CTO Jason Warner 창업. 1만 개 이상의 엔비디아 GPU 클러스터에서 복잡한 소프트웨어 아키텍처를 자동 코딩하는 파운데이션 모델 학습.',
        'startup_hq_city': 'Paris',
        'startup_hq_country': 'France',
        'startup_lat': 48.8566,
        'startup_lon': 2.3522,
        'syndicate_partners': ['Bain Capital Ventures', 'DST Global', 'Citi Ventures'],
        'source_url': 'https://poolside.ai',
        'status': 'active'
    },
    {
        'investor_company': 'NVIDIA',
        'cvc_arm': 'NVentures',
        'startup_name': 'Moonvalley',
        'startup_tagline': '[비디오 생성 AI] 물리 법칙을 학습한 고품질 시네마틱 텍스트 투 비디오 생성 파운데이션 모델',
        'startup_tech_tag': '비디오 생성AI',
        'investment_date': '2023-10',
        'investment_year': 2023,
        'investment_round': 'Series A',
        'investment_amount_usd': 70000000,
        'investment_amount_display': '$70M',
        'sector': 'Software & EDA',
        'startup_description': '물리적 연속성과 광학 효과를 정확히 계산하는 비디오 생성 모델. 엔비디아 H100 텐서코어 GPU 클러스터에서 초고속 추론 수행.',
        'startup_hq_city': 'Toronto',
        'startup_hq_country': 'Canada',
        'startup_lat': 43.6532,
        'startup_lon': -79.3832,
        'syndicate_partners': ['General Catalyst', 'Bessemer'],
        'source_url': 'https://moonvalley.ai',
        'status': 'active'
    },
    {
        'investor_company': 'NVIDIA',
        'cvc_arm': 'NVIDIA Corporate Investments',
        'startup_name': 'Wadhwani AI',
        'startup_tagline': '[공공 보건 AI] 농업 해충 감지 및 개발도상국 결핵 판독용 엣지 컴퓨터 비전 AI',
        'startup_tech_tag': '공공 비전AI',
        'investment_date': '2023-05',
        'investment_year': 2023,
        'investment_round': 'Strategic Grant & Equity',
        'investment_amount_usd': 10000000,
        'investment_amount_display': '$10M',
        'sector': 'Software & EDA',
        'startup_description': '인도 뭄바이 기반 공익 AI 연구소. 저사양 스마트폰에서도 현장 추론 가능한 엣지 비전 모델을 엔비디아 임베디드 플랫폼으로 배포.',
        'startup_hq_city': 'Mumbai',
        'startup_hq_country': 'India',
        'startup_lat': 19.0760,
        'startup_lon': 72.8777,
        'syndicate_partners': ['Google.org'],
        'source_url': 'https://wadhwaniai.org',
        'status': 'active'
    },
    {
        'investor_company': 'Broadcom',
        'cvc_arm': 'Broadcom Strategic Technology Alliance',
        'startup_name': 'Sonics',
        'startup_tagline': '[온칩 통신 버스] 복합 멀티코어 SoC를 위한 고속 온칩 인터커넥트 및 전력 관리 IP',
        'startup_tech_tag': '온칩 NoC IP',
        'investment_date': '2021-08',
        'investment_year': 2021,
        'investment_round': 'Strategic IP Alliance',
        'investment_amount_usd': 15000000,
        'investment_amount_display': '$15M',
        'sector': 'Chiplet & Advanced Architecture',
        'startup_description': '브로드컴 통신 SoC 칩의 내부 대역폭 병목을 해결하고 동적 전력 차단을 정밀 제어하기 위한 NoC IP 라이선스 및 지분 제휴.',
        'startup_hq_city': 'Milpitas',
        'startup_hq_country': 'USA',
        'startup_lat': 37.4323,
        'startup_lon': -121.8996,
        'syndicate_partners': [],
        'source_url': 'https://www.broadcom.com',
        'status': 'active'
    },
    {
        'investor_company': 'Onsemi',
        'cvc_arm': 'onsemi Corporate Ventures',
        'startup_name': 'SensL Technologies',
        'startup_tagline': '[SiPM 광자 센서] 자율주행 라이다 및 의료 영상용 초고감도 단일 광자 애벌랜치 실리콘 광전자 증배관',
        'startup_tech_tag': 'SiPM 광센서',
        'investment_date': '2021-03',
        'investment_year': 2021,
        'investment_round': 'Strategic Expansion',
        'investment_amount_usd': 35000000,
        'investment_amount_display': '$35M',
        'sector': 'Automotive & Sensors',
        'startup_description': '아일랜드 코크 소재. 기존 광전증폭관(PMT)을 대체하여 저전압 실리콘 칩에서 단일 광자(Single Photon) 수준의 극미약 빛을 감지하는 SiPM 양산.',
        'startup_hq_city': 'Cork',
        'startup_hq_country': 'Ireland',
        'startup_lat': 51.8985,
        'startup_lon': -8.4756,
        'syndicate_partners': [],
        'source_url': 'https://www.onsemi.com',
        'status': 'active'
    },
    {
        'investor_company': 'Texas Instruments',
        'cvc_arm': 'TI Strategic Investments',
        'startup_name': 'Enosemi',
        'startup_tagline': '[광반도체 웨이퍼 테스트] 실리콘 포토닉스 PIC 웨이퍼 레벨 초고속 자동 광학 검사 장비',
        'startup_tech_tag': '광웨이퍼 계측',
        'investment_date': '2022-06',
        'investment_year': 2022,
        'investment_round': 'Series A',
        'investment_amount_usd': 12000000,
        'investment_amount_display': '$12M',
        'sector': 'Advanced Manufacturing',
        'startup_description': '실리콘 포토닉스 칩의 광 결합 손실과 파장 응답을 웨이퍼 다이싱 이전에 고속 측정하는 비접촉 광학 프로빙 솔루션.',
        'startup_hq_city': 'Santa Clara',
        'startup_hq_country': 'USA',
        'startup_lat': 37.3541,
        'startup_lon': -121.9552,
        'syndicate_partners': ['Applied Ventures'],
        'source_url': 'https://enosemi.com',
        'status': 'active'
    }
]

with open('data/ventures.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

investments = data['investments']
existing_keys = set((inv['investor_company'].strip().lower(), inv['startup_name'].strip().lower()) for inv in investments)

company_prefix_map = {
    'Samsung Electronics': 'SAM', 'SK Hynix': 'SKH', 'Intel': 'INT', 'NVIDIA': 'NV',
    'Qualcomm': 'QCOM', 'Micron Technology': 'MU', 'Applied Materials': 'AMAT',
    'TSMC': 'TSMC', 'Lam Research': 'LAM', 'ASML': 'ASML', 'Tokyo Electron': 'TEL',
    'KLA Corporation': 'KLA', 'Synopsys': 'SNPS', 'Cadence': 'CDNS',
    'Infineon Technologies': 'IFX', 'STMicroelectronics': 'STM', 'NXP Semiconductors': 'NXP',
    'GlobalFoundries': 'GF', 'Arm': 'ARM', 'Sony Semiconductor': 'SONY',
    'MediaTek': 'MTK', 'Renesas Electronics': 'REN', 'Kioxia': 'KIOX',
    'Broadcom': 'AVGO', 'Onsemi': 'ON', 'Texas Instruments': 'TXN',
    'Wolfspeed': 'WOLF', 'imec.xpand': 'IMEC'
}

added = 0
for d in additional:
    key = (d['investor_company'].strip().lower(), d['startup_name'].strip().lower())
    if key not in existing_keys:
        d['status'] = d.get('status', 'active')
        investments.append(d)
        existing_keys.add(key)
        added += 1

# Re-index all IDs
company_counts = {}
for inv in investments:
    comp = inv['investor_company']
    pfx = company_prefix_map.get(comp, 'OTH')
    company_counts[pfx] = company_counts.get(pfx, 0) + 1
    inv['id'] = f"VC-{pfx}-{company_counts[pfx]:03d}"

unique_startups = set(inv['startup_name'] for inv in investments)
unique_investors = set(inv['investor_company'] for inv in investments)

data['metadata']['total_investments'] = len(investments)
data['metadata']['total_investors'] = len(unique_investors)
data['metadata']['total_startups'] = len(unique_startups)

with open('data/ventures.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Total investments now: {len(investments)} (Added {added})")
print(f"Total startups: {len(unique_startups)}")
print(f"Total investors: {len(unique_investors)}")
