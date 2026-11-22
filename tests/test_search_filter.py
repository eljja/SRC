import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _run_node(script: str) -> dict:
    proc = subprocess.run(
        ["node", "-e", script],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return json.loads(proc.stdout.strip())


def test_src_bilingual_and_compound_search_queries():
    script = r"""
const fs = require('fs');
const vm = require('vm');

const ctx = { console, Math, Date, JSON, Set, Map, Array, Object, RegExp, String, Number, Boolean, Error, parseInt, parseFloat };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

if (fs.existsSync('js/searchNormalizer.js')) {
  vm.runInContext(fs.readFileSync('js/searchNormalizer.js', 'utf8'), ctx, { filename: 'js/searchNormalizer.js' });
}
vm.runInContext(fs.readFileSync('js/dataManager.js', 'utf8'), ctx, { filename: 'js/dataManager.js' });

const raw = JSON.parse(fs.readFileSync('data/collaborations.json', 'utf8'));
const dm = new ctx.DataManager();
dm.rawProjects = raw.projects || [];
dm.rawProjects.forEach(p => {
  p._searchStr = [
    p.title, p.topic, p.professor, p.university, p.company,
    p.institute_or_consortium, p.summary, p.category
  ].filter(Boolean).join(' ').toLowerCase();
});

const queries = [
  '삼성전자 HBM',
  '삼성전자HBM',
  'SK하이닉스',
  'SK하이닉스 산학',
  'SK하이닉스HBM',
  '하이브리드 본딩',
  '서울대 반도체',
  'TSMC',
  'KAIST',
  '인텔 EUV',
  '엔비디아',
  '마이크론 HBM',
  '포항공대',
];

const out = {};
for (const q of queries) {
  dm.resetFilters();
  dm.setFilter('searchQuery', q);
  out[q] = {
    total: dm.filteredProjects.length,
    verifiedCollab: dm.filteredProjects.filter(p => dm.isConfirmedCorporateCollab(p)).length,
  };
}
console.log(JSON.stringify(out));
"""
    res = _run_node(script)

    # Samsung + HBM (with or without space) must match the English Samsung Electronics HBM corpus
    assert res["삼성전자 HBM"]["total"] >= 100, f"Expected >=100 for '삼성전자 HBM', got {res['삼성전자 HBM']}"
    assert res["삼성전자HBM"]["total"] == res["삼성전자 HBM"]["total"], (
        f"Compound spacing mismatch: {res['삼성전자HBM']} vs {res['삼성전자 HBM']}"
    )

    # SK Hynix (Korean alias + '산학' qualifier)
    assert res["SK하이닉스"]["total"] >= 150, f"Expected >=150 for 'SK하이닉스', got {res['SK하이닉스']}"
    assert res["SK하이닉스 산학"]["total"] >= 100, f"Expected >=100 for 'SK하이닉스 산학', got {res['SK하이닉스 산학']}"
    assert res["SK하이닉스 산학"]["verifiedCollab"] == res["SK하이닉스 산학"]["total"], (
        "Searching with '산학' should narrow to confirmed corporate collaborations"
    )

    # Hybrid bonding, SNU, Intel, NVIDIA, Micron, POSTECH
    assert res["하이브리드 본딩"]["total"] >= 500, f"Expected >=500 for '하이브리드 본딩', got {res['하이브리드 본딩']}"
    assert res["서울대 반도체"]["total"] >= 500, f"Expected >=500 for '서울대 반도체', got {res['서울대 반도체']}"
    assert res["TSMC"]["total"] >= 200
    assert res["KAIST"]["total"] >= 150
    assert res["인텔 EUV"]["total"] >= 20
    assert res["엔비디아"]["total"] >= 50
    assert res["마이크론 HBM"]["total"] >= 10
    assert res["포항공대"]["total"] >= 50


def test_venture_bilingual_and_compound_search_queries():
    script = r"""
const fs = require('fs');
const vm = require('vm');

const ctx = { console, Math, Date, JSON, Set, Map, Array, Object, RegExp, String, Number, Boolean, Error, parseInt, parseFloat };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

if (fs.existsSync('js/searchNormalizer.js')) {
  vm.runInContext(fs.readFileSync('js/searchNormalizer.js', 'utf8'), ctx, { filename: 'js/searchNormalizer.js' });
}
vm.runInContext(fs.readFileSync('js/ventureDataManager.js', 'utf8'), ctx, { filename: 'js/ventureDataManager.js' });

const raw = JSON.parse(fs.readFileSync('data/ventures.json', 'utf8'));
const vdm = new ctx.VentureDataManager();
vdm.rawInvestments = raw.investments || [];
vdm.rawInvestments.forEach(inv => {
  inv._searchStr = [
    inv.investor_company, inv.cvc_arm, inv.startup_name, inv.startup_tagline,
    inv.startup_tech_tag, inv.sector, inv.investment_round,
    inv.investment_amount_display, inv.startup_description,
    inv.startup_hq_city, inv.startup_hq_country,
    inv.investment_year != null ? String(inv.investment_year) : ''
  ].filter(Boolean).join(' ').toLowerCase();
});

const queries = [
  '삼성',
  '삼성전자',
  'SK하이닉스',
  '엔비디아',
  '인텔',
  '패키징',
  'Packaging',
  '광인터커넥트',
  '한국 스타트업',
  '양자',
];

const out = {};
for (const q of queries) {
  vdm.resetFilters();
  vdm.setFilter('searchQuery', q);
  out[q] = vdm.filteredInvestments.length;
}
console.log(JSON.stringify(out));
"""
    res = _run_node(script)

    assert res["삼성"] >= 30, f"Expected >=30 for Venture '삼성', got {res}"
    assert res["삼성전자"] >= 30, f"Expected >=30 for Venture '삼성전자', got {res}"
    assert res["SK하이닉스"] >= 15, f"Expected >=15 for Venture 'SK하이닉스', got {res}"
    assert res["엔비디아"] >= 35, f"Expected >=35 for Venture '엔비디아', got {res}"
    assert res["인텔"] >= 35, f"Expected >=35 for Venture '인텔', got {res}"
    assert res["패키징"] >= 10, f"Expected >=10 for Venture '패키징', got {res}"
    assert res["Packaging"] >= 10, f"Expected >=10 for Venture 'Packaging', got {res}"
    assert res["광인터커넥트"] >= 30, f"Expected >=30 for Venture '광인터커넥트', got {res}"
    assert res["한국 스타트업"] >= 10, f"Expected >=10 for Venture '한국 스타트업', got {res}"
    assert res["양자"] >= 15, f"Expected >=15 for Venture '양자', got {res}"
