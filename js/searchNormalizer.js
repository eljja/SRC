/**
 * SearchNormalizer Module
 * Shared bilingual (Korean <-> English) & compound-token search query parser
 * for both SRC R&D Observatory and Semiconductor CVC Venture Observatory.
 */
(function (globalScope) {
  'use strict';

  // Multi-word / compound phrases matched BEFORE splitting Korean/English boundaries.
  // Ordered longest-first at runtime.
  const PHRASE_ALIASES = [
    // Korean / English Corporate Compound Names
    { keys: ['sk하이닉스', 'sk 하이닉스', 'sk hynix', '에스케이하이닉스', '에스케이 하이닉스'], alts: ['sk hynix', 'hynix', 'sk하이닉스', '하이닉스'] },
    { keys: ['삼성전자', '삼성 전자', 'samsung electronics', '삼성벤처스', '삼성 벤처스', '삼성 카탈리스트', 'samsung ventures', 'samsung catalyst'], alts: ['samsung', '삼성전자', '삼성'] },
    { keys: ['인텔 캐피탈', '인텔캐피탈', 'intel capital'], alts: ['intel', '인텔'] },
    { keys: ['도쿄일렉트론', '도쿄 일렉트론', 'tokyo electron'], alts: ['tokyo electron', 'tel', '도쿄일렉트론'] },
    { keys: ['어플라이드 머티어리얼즈', '어플라이드머티어리얼즈', 'applied materials'], alts: ['applied materials', 'amat', '어플라이드'] },
    { keys: ['램리서치', '램 리서치', 'lam research'], alts: ['lam research', '램리서치'] },
    { keys: ['글로벌파운드리', '글로벌 파운드리', 'globalfoundries'], alts: ['globalfoundries', '글로벌파운드리'] },
    { keys: ['에스티마이크로', 'stmicroelectronics'], alts: ['stmicroelectronics', 'stmicro', '에스티마이크로'] },
    { keys: ['인피니언', 'infineon technologies'], alts: ['infineon', '인피니언'] },
    { keys: ['마이크론', 'micron technology'], alts: ['micron', '마이크론'] },
    { keys: ['소니 반도체', 'sony semiconductor'], alts: ['sony', '소니'] },

    // Universities (Compound)
    { keys: ['서울대학교', '서울대', 'seoul national university', 'seoul national'], alts: ['seoul national', 'snu', '서울대'] },
    { keys: ['포항공과대학교', '포항공과대', '포항공대', '포스텍', 'pohang university'], alts: ['postech', 'pohang university', '포항공대', '포스텍'] },
    { keys: ['성균관대학교', '성균관대', 'sungkyunkwan university'], alts: ['sungkyunkwan', 'skku', '성균관'] },
    { keys: ['한국과학기술원', '카이스트'], alts: ['kaist', 'korea advanced institute', '카이스트'] },
    { keys: ['연세대학교', '연세대'], alts: ['yonsei', '연세대'] },
    { keys: ['고려대학교', '고려대'], alts: ['korea university', '고려대'] },
    { keys: ['한양대학교', '한양대'], alts: ['hanyang', '한양대'] },
    { keys: ['울산과학기술원', '유니스트'], alts: ['unist', '유니스트'] },
    { keys: ['광주과학기술원', '지스트'], alts: ['gist', 'gwangju institute', '지스트'] },
    { keys: ['대구경북과학기술원', '디지스트'], alts: ['dgist', '디지스트'] },
    { keys: ['조지아텍', '조지아 공대', 'georgia tech'], alts: ['georgia tech', 'georgia institute', '조지아텍'] },
    { keys: ['도쿄대', '도쿄대학교', 'university of tokyo'], alts: ['university of tokyo', 'tokyo', '도쿄대'] },
    { keys: ['대만대', '국립대만대', 'national taiwan'], alts: ['national taiwan', 'ntu', '대만대'] },

    // Technology Phrases
    { keys: ['하이브리드 본딩', '하이브리드본딩', 'hybrid bonding'], alts: ['hybrid bonding', 'hybrid bond', '하이브리드 본딩'] },
    { keys: ['고대역폭 메모리', '고대역폭메모리', 'high bandwidth memory'], alts: ['hbm', 'high bandwidth memory', '고대역폭'] },
    { keys: ['광 인터커넥트', '광인터커넥트', '실리콘 포토닉스', '실리콘포토닉스', 'silicon photonics', 'optical interconnect'], alts: ['photonics', 'optical', 'silicon photonics', '광인터커넥트', '포토닉스'] },
    { keys: ['high-na euv', 'high na euv', '하이 na euv'], alts: ['euv', 'high-na', 'extreme ultraviolet'] },
    { keys: ['3nm gaa', '2nm gaa', '게이트 올 어라운드', 'gate-all-around', 'gate all around'], alts: ['gaa', 'gate-all-around', 'nanosheet'] },
    { keys: ['첨단 패키징', '어드밴스드 패키징', 'advanced packaging', '3d 패키징'], alts: ['packaging', 'package', '패키징', '2.5d', '3d ic', 'cowos', 'chiplet', 'hybrid bonding'] },
    { keys: ['전력 반도체', '전력반도체', 'power semiconductor'], alts: ['power', 'sic', 'gan', '전력반도체', '전력'] },
    { keys: ['양자 컴퓨팅', '양자컴퓨팅', '양자 컴퓨터', '양자컴퓨터', 'quantum computing'], alts: ['quantum', 'qubit', '양자'] },
    { keys: ['ai 가속기', 'ai 칩', 'ai 반도체', '인공지능 반도체'], alts: ['ai', 'accelerator', 'npu', 'neural', '인공지능'] },
    { keys: ['south korea', '대한민국'], alts: ['south korea', 'korea', '한국', 'seoul', 'daejeon', 'suwon', 'pangyo'] },
  ];

  // Single-token bilingual alias map (each entry expands to OR alternatives)
  const TOKEN_ALIASES = {
    // Companies
    '삼성': ['samsung', '삼성'],
    '삼성전자': ['samsung', '삼성전자', '삼성'],
    'samsung': ['samsung', '삼성'],
    '하이닉스': ['sk hynix', 'hynix', '하이닉스', 'sk하이닉스'],
    'hynix': ['sk hynix', 'hynix', '하이닉스'],
    '인텔': ['intel', '인텔'],
    'intel': ['intel', '인텔'],
    '엔비디아': ['nvidia', '엔비디아'],
    'nvidia': ['nvidia', '엔비디아'],
    '퀄컴': ['qualcomm', '퀄컴'],
    'qualcomm': ['qualcomm', '퀄컴'],
    '마이크론': ['micron', '마이크론'],
    'micron': ['micron', '마이크론'],
    '브로드컴': ['broadcom', '브로드컴'],
    '인피니언': ['infineon', '인피니언'],
    '키옥시아': ['kioxia', '키옥시아'],
    '소니': ['sony', '소니'],
    '시높시스': ['synopsys', '시높시스'],
    '케이던스': ['cadence', '케이던스'],
    '미디어텍': ['mediatek', '미디어텍'],
    '어플라이드': ['applied materials', 'amat', '어플라이드'],
    '울프스피드': ['wolfspeed', '울프스피드'],
    '온세미': ['onsemi', '온세미'],
    '티에스엠씨': ['tsmc', '티에스엠씨'],
    '에이에스엠엘': ['asml', '에이에스엠엘'],
    '암': ['arm', '암'],

    // Universities & Research Institutes
    '서울대': ['seoul national', 'snu', '서울대'],
    '카이스트': ['kaist', 'korea advanced institute', '카이스트'],
    'kaist': ['kaist', 'korea advanced institute', '카이스트'],
    '포항공대': ['postech', 'pohang university', '포항공대', '포스텍'],
    '포스텍': ['postech', 'pohang university', '포항공대', '포스텍'],
    'postech': ['postech', 'pohang university', '포항공대', '포스텍'],
    '성균관대': ['sungkyunkwan', 'skku', '성균관'],
    '연세대': ['yonsei', '연세대'],
    '고려대': ['korea university', '고려대'],
    '한양대': ['hanyang', '한양대'],
    '스탠포드': ['stanford', '스탠포드', '스탠퍼드'],
    '스탠퍼드': ['stanford', '스탠포드', '스탠퍼드'],
    '버클리': ['berkeley', 'uc berkeley', '버클리'],
    '엠아이티': ['mit', 'massachusetts institute'],
    '칼텍': ['caltech', 'california institute of technology'],
    '코넬': ['cornell', '코넬'],
    '미시간': ['michigan', '미시간'],
    '퍼듀': ['purdue', '퍼듀'],
    '칭화대': ['tsinghua', '칭화'],
    '아이멕': ['imec', '아이멕'],

    // Semiconductor Technologies & Domains
    'hbm': ['hbm', 'high bandwidth memory', '고대역폭'],
    'gaa': ['gaa', 'gate-all-around', 'nanosheet'],
    'euv': ['euv', 'extreme ultraviolet'],
    '패키징': ['packaging', 'package', '패키징', '2.5d', '3d ic', 'cowos', 'chiplet', 'hybrid bonding'],
    'packaging': ['packaging', 'package', '패키징', '2.5d', '3d ic', 'cowos', 'chiplet', 'hybrid bonding'],
    '칩렛': ['chiplet', 'ucie', '칩렛', 'interconnect'],
    'chiplet': ['chiplet', 'ucie', '칩렛'],
    '포토닉스': ['photonics', 'optical', 'silicon photonics', '포토닉스', '광인터커넥트'],
    'photonics': ['photonics', 'optical', 'silicon photonics', '포토닉스', '광인터커넥트'],
    '광통신': ['photonics', 'optical', '광인터커넥트', '포토닉스'],
    '양자': ['quantum', 'qubit', '양자'],
    'quantum': ['quantum', 'qubit', '양자'],
    '뉴로모픽': ['neuromorphic', 'pim', 'cim', 'computing-in-memory', '뉴로모픽'],
    '메모리': ['memory', 'dram', 'nand', 'sram', 'hbm', 'mram', 'rram', 'reram', 'feram', '메모리'],
    '파운드리': ['foundry', 'lithography', 'cmos', 'finfet', 'gaa', '파운드리'],
    '노광': ['lithography', 'euv', 'duv', '노광'],
    '식각': ['etch', 'etching', '식각'],
    '증착': ['deposition', 'ald', 'cvd', 'pvd', '증착'],
    '소재': ['material', 'wafer', 'substrate', 'photoresist', '소재'],
    '전력': ['power', 'sic', 'gan', '전력'],
    '인공지능': ['ai', 'artificial intelligence', 'npu', 'neural', '인공지능'],
    '가속기': ['accelerator', 'npu', 'gpu', 'ai', '가속기'],
    '본딩': ['bonding', 'bond', '본딩'],
    '하이브리드': ['hybrid', '하이브리드'],
    '실리콘': ['silicon', '실리콘'],

    // Countries / Regions
    '한국': ['south korea', 'korea', '한국', 'seoul', 'daejeon', 'suwon', 'pangyo'],
    '국내': ['south korea', 'korea', '한국', 'seoul', 'daejeon', 'suwon', 'pangyo'],
    '미국': ['usa', 'united states', 'california', '미국'],
    '대만': ['taiwan', 'hsinchu', '대만'],
    '일본': ['japan', 'tokyo', '일본'],
    '유럽': ['europe', 'belgium', 'netherlands', 'germany', 'france', 'uk', 'switzerland', '유럽'],
    '중국': ['china', 'beijing', 'shanghai', '중국'],
    '이스라엘': ['israel', '이스라엘'],
  };

  // Collaboration intent keywords (trigger corporate-collaboration filter on SRC)
  const COLLAB_INTENT_TOKENS = new Set([
    '산학', '산학협력', '산학과제', '산학연', '기업협력', '기업연계', '공동연구'
  ]);

  // Domain-wide context words ignored ONLY when combined with more specific terms
  const CONTEXT_STOPWORDS = new Set([
    '반도체', '과제', '연구', '논문', '프로젝트', '스타트업', '벤처', '벤처스',
    '투자', '기업', '대학', '대학교', '연구소', '연구실', '기술', '칩'
  ]);

  // Sort phrase patterns longest-first so specific phrases match before substrings
  const SORTED_PHRASES = [];
  PHRASE_ALIASES.forEach(entry => {
    entry.keys.forEach(key => {
      SORTED_PHRASES.push({ key: key.toLowerCase(), alts: entry.alts });
    });
  });
  SORTED_PHRASES.sort((a, b) => b.key.length - a.key.length);

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Parse a raw user search query into normalized AND-of-OR token groups
   * plus optional collaboration intent flag.
   *
   * @param {string} rawQuery
   * @returns {{ groups: string[][], requireCorporateCollab: boolean }}
   */
  function parseSearchQuery(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') {
      return { groups: [], requireCorporateCollab: false };
    }

    let working = rawQuery
      .toLowerCase()
      .replace(/[#·,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!working) {
      return { groups: [], requireCorporateCollab: false };
    }

    const groups = [];
    let requireCorporateCollab = false;

    // 1. Extract known multi-word / compound phrases first
    for (let i = 0; i < SORTED_PHRASES.length; i++) {
      const phrase = SORTED_PHRASES[i];
      if (!working.includes(phrase.key)) continue;

      // For pure ASCII short phrases (like 'tel' or 'snu'), respect word boundaries;
      // for Korean or multi-word phrases, allow direct substring extraction (e.g. '삼성전자hbm', 'sk하이닉스hbm')
      const isAsciiOnly = /^[a-z0-9\s\-+.]+$/.test(phrase.key);
      const pattern = isAsciiOnly
        ? new RegExp('(^|[\\s/])' + escapeRegex(phrase.key) + '(?=$|[\\s/])', 'gi')
        : new RegExp(escapeRegex(phrase.key), 'gi');

      if (pattern.test(working)) {
        groups.push(phrase.alts);
        working = working.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
      }
    }

    // 2. Split remaining Hangul <-> Latin/Digit glued boundaries (e.g. "삼성전자hbm" -> "삼성전자 hbm")
    working = working
      .replace(/([가-힣])([a-z0-9])/gi, '$1 $2')
      .replace(/([a-z0-9])([가-힣])/gi, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();

    const rawTokens = working ? working.split(/\s+/).filter(Boolean) : [];
    const deferredStopwords = [];

    for (let i = 0; i < rawTokens.length; i++) {
      const token = rawTokens[i];
      if (COLLAB_INTENT_TOKENS.has(token)) {
        requireCorporateCollab = true;
        continue;
      }
      if (CONTEXT_STOPWORDS.has(token)) {
        deferredStopwords.push(token);
        continue;
      }
      if (TOKEN_ALIASES[token]) {
        groups.push(TOKEN_ALIASES[token]);
      } else {
        groups.push([token]);
      }
    }

    // Only keep domain stopwords if the user typed ONLY stopwords (and no collab intent)
    if (groups.length === 0 && !requireCorporateCollab && deferredStopwords.length > 0) {
      deferredStopwords.forEach(sw => {
        if (sw === '반도체') {
          groups.push(['반도체', 'semiconductor']);
        } else {
          groups.push([sw]);
        }
      });
    }

    return { groups, requireCorporateCollab };
  }

  /**
   * Test whether a pre-indexed lowercase search string matches parsed query groups.
   *
   * @param {string} searchText
   * @param {{ groups: string[][], requireCorporateCollab: boolean }} parsed
   * @returns {boolean}
   */
  function matchesParsedQuery(searchText, parsed) {
    if (!parsed || !parsed.groups || parsed.groups.length === 0) return true;
    const text = searchText || '';
    for (let i = 0; i < parsed.groups.length; i++) {
      const alts = parsed.groups[i];
      let matched = false;
      for (let j = 0; j < alts.length; j++) {
        if (text.includes(alts[j])) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    }
    return true;
  }

  const SearchNormalizer = {
    parseSearchQuery,
    matchesParsedQuery,
    PHRASE_ALIASES,
    TOKEN_ALIASES,
    COLLAB_INTENT_TOKENS,
    CONTEXT_STOPWORDS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchNormalizer;
  }
  if (globalScope) {
    globalScope.SearchNormalizer = SearchNormalizer;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
