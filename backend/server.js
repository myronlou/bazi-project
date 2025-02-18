const express = require('express');
const cors = require('cors');
const LunarCalendar = require('lunar-calendar');

const app = express();
app.use(cors());
app.use(express.json());

// ========== 1) BaZi Constants ==========
const TIANGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// Build 60 JiaZi array
const JIAZI_60 = [];
for (let i = 0; i < 60; i++) {
  const stem = TIANGAN[i % 10];
  const branch = DIZHI[i % 12];
  JIAZI_60.push(stem + branch);
}

// Earthly Branch Hidden Stems
const branchHiddenStems = {
  '子': ['癸'],
  '丑': ['己','癸','辛'],
  '寅': ['甲','丙','戊'],
  '卯': ['乙'],
  '辰': ['戊','乙','癸'],
  '巳': ['丙','戊','庚'],
  '午': ['丁','己'],
  '未': ['己','丁','乙'],
  '申': ['庚','壬','戊'],
  '酉': ['辛'],
  '戌': ['戊','辛','丁'],
  '亥': ['壬','甲']
};

const dominantHiddenStem = {
  '子': '癸',
  '丑': '己',
  '寅': '甲',
  '卯': '乙',
  '辰': '戊',
  '巳': '丙',
  '午': '丁',
  '未': '己',
  '申': '庚',
  '酉': '辛',
  '戌': '戊',
  '亥': '壬'
};

// Stem info
const stemInfo = {
  '甲': { element: 'wood',  yin: false },
  '乙': { element: 'wood',  yin: true  },
  '丙': { element: 'fire',  yin: false },
  '丁': { element: 'fire',  yin: true  },
  '戊': { element: 'earth', yin: false },
  '己': { element: 'earth', yin: true  },
  '庚': { element: 'metal', yin: false },
  '辛': { element: 'metal', yin: true  },
  '壬': { element: 'water', yin: false },
  '癸': { element: 'water', yin: true  }
};

// Relationship maps
const outputs = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood'
};
const resources = {
  wood: 'water',
  fire: 'wood',
  earth: 'fire',
  metal: 'earth',
  water: 'metal'
};
const wealth = {
  wood: 'earth',
  fire: 'metal',
  earth: 'water',
  metal: 'wood',
  water: 'fire'
};
const officer = {
  wood: 'metal',
  fire: 'water',
  earth: 'wood',
  metal: 'fire',
  water: 'earth'
};

/** 2) Calculate Ten God using snippet rules */
function calculateTenGod(dayStem, otherStem) {
  const dm = stemInfo[dayStem];
  const ot = stemInfo[otherStem];
  if (!dm || !ot) return '';

  const samePolarity = (dm.yin === ot.yin);
  const diffPolarity = !samePolarity;

  // 1) 同我者 => 比肩(同性), 劫财(异性)
  if (ot.element === dm.element) {
    return samePolarity ? '比肩' : '劫財';
  }
  // 2) 我生者 => 食神(同性), 伤官(异性)
  if (outputs[dm.element] === ot.element) {
    return samePolarity ? '食神' : '傷官';
  }
  // 3) 我克者 => 正财(异性), 偏财(同性)
  if (wealth[dm.element] === ot.element) {
    return diffPolarity ? '正財' : '偏財';
  }
  // 4) 生我者 => 正印(异性), 偏印(同性)
  if (resources[dm.element] === ot.element) {
    return diffPolarity ? '正印' : '偏印';
  }
  // 5) 克我者 => 正官(异性), 七杀(同性)
  if (officer[dm.element] === ot.element) {
    return diffPolarity ? '正官' : '七殺';
  }
  return '';
}

/** 3) Earthly Branch hidden stems => array of { stem, tenGod } */
function calculateBranchTenGods(dayStem, branchChar) {
  const hiddenStems = branchHiddenStems[branchChar] || [];
  return hiddenStems.map(hs => ({
    stem: hs,
    tenGod: calculateTenGod(dayStem, hs)
  }));
}

/** 4) Convert Heavenly Stem => Five Element label */
function getStemElementChar(stemChar) {
  const map = {
    '甲': '木','乙': '木',
    '丙': '火','丁': '火',
    '戊': '土','己': '土',
    '庚': '金','辛': '金',
    '壬': '水','癸': '水'
  };
  return map[stemChar] || '';
}

/** 5) Count Five Elements (Heavenly Stems only) */
function countFiveElements(pillars) {
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (let key in pillars) {
    const stem = pillars[key][0];
    const elemChar = getStemElementChar(stem);
    if (counts[elemChar] !== undefined) {
      counts[elemChar] += 1;
    }
  }
  return counts;
}

/** 6) Missing elements */
function findMissingElements(counts) {
  const missing = [];
  for (let elem in counts) {
    if (counts[elem] === 0) {
      missing.push(elem);
    }
  }
  return missing;
}

/** 7) Simple Day Master Strength => Favorable Element */
function findFavorableElement(dayStem, counts) {
  const dm = stemInfo[dayStem];
  if (!dm) return '';

  const dmElem = dm.element;
  const resourceElem = resources[dmElem];

  function toCN(e) {
    switch (e) {
      case 'wood':  return '木';
      case 'fire':  return '火';
      case 'earth': return '土';
      case 'metal': return '金';
      case 'water': return '水';
      default:      return '';
    }
  }

  const dmElemCN = toCN(dmElem);
  const resourceElemCN = toCN(resourceElem);

  let strength = 0;
  strength += (counts[dmElemCN] || 0);
  strength += (counts[resourceElemCN] || 0);

  const isStrong = strength >= 2;
  const controllingElem = officer[dmElem];
  const controllingElemCN = toCN(controllingElem);

  return isStrong ? controllingElemCN : resourceElemCN;
}

/** 8) Year Stem => Yang or Yin? */
function isYangYearStem(stem) {
  return ['甲','丙','戊','庚','壬'].includes(stem);
}

/** 9) Step 60 JiaZi forward/back */
function stepGanZhi(start, steps, forward=true) {
  const idx = JIAZI_60.indexOf(start);
  if (idx < 0) return start;

  let newIndex;
  if (forward) {
    newIndex = (idx + steps) % 60;
  } else {
    newIndex = (idx - steps + 60) % 60;
  }
  return JIAZI_60[newIndex];
}

/** 10) Placeholder for startAge calculation */
function calculateStartAge(birthdate, forward) {
  const days = 20; // placeholder
  const rawAge = days / 3;
  const startAge = Math.floor(rawAge);
  return startAge;
}

/** 11) Calculate DaYun array (now 10 cycles, with TenGod for each pillar) */
function calculateDaYun(yearGZ, monthGZ, birthdate, gender, dayStem) {
  const yearStem = yearGZ[0];
  const isYearYang = isYangYearStem(yearStem);

  // forward or backward
  let forward = true;
  if ((isYearYang && gender === 'male') || (!isYearYang && gender === 'female')) {
    forward = true;
  } else {
    forward = false;
  }

  const [yyyyStr] = birthdate.split('-');
  const birthYear = parseInt(yyyyStr, 10);

  let currentAge = calculateStartAge(birthdate, forward); // integer
  const baseIndex = JIAZI_60.indexOf(monthGZ);
  if (baseIndex < 0) return [];

  // first DaYun => +1 step from month pillar
  let currentPillar = stepGanZhi(monthGZ, 1, forward);

  const daYunList = [];
  for (let i = 1; i <= 10; i++) {
    // 1) main Heavenly Stem => main TenGod
    const daYunStem = currentPillar.charAt(0);
    const daYunTenGod = calculateTenGod(dayStem, daYunStem);

    // 2) “副星” => use the branch’s dominant hidden stem => e.g. 午 => 丁
    const daYunBranch = currentPillar.charAt(1);
    const fuXingArray = calculateBranchTenGods(dayStem, daYunBranch);

    const startCalendarYear = birthYear + currentAge;
    const endCalendarYear = birthYear + currentAge + 10 - 1;

    const thisDaYun = {
      index: i,
      pillar: currentPillar,
      tenGod: daYunTenGod,  // main star
      fuXing: fuXingArray,               // “副星”
      startAge: currentAge,
      endAge: currentAge + 10,
      startCalendarYear,
      endCalendarYear
    };

    daYunList.push(thisDaYun);

    currentAge += 10;
    currentPillar = stepGanZhi(currentPillar, 1, forward);
  }

  return daYunList;
}

/**
 * Calculate 流年 (annual pillars) for age 1..100
 * Each year => baseYearIndex + i => pillar
 * Also show multiple hidden stems as “副星.”
 */
function calculateLiuNian(yearGZ, dayStem, birthYear) {
  const baseIndex = JIAZI_60.indexOf(yearGZ);
  if (baseIndex < 0) return [];

  const liuNianList = [];
  // We do age 1..100 => so birth year + i
  for (let i = 1; i <= 100; i++) {
    const pillar = JIAZI_60[(baseIndex + i) % 60];
    const stem = pillar.charAt(0);
    const branch = pillar.charAt(1);

    const mainTenGod = calculateTenGod(dayStem, stem);
    const fuXingArray = calculateBranchTenGods(dayStem, branch);

    const actualYear = birthYear + i;

    liuNianList.push({
      age: i,
      pillar,
      tenGod: mainTenGod,
      fuXing: fuXingArray,
      year: actualYear
    });
  }
  return liuNianList;
}

/** 12) Main BaZi Calculation
 *     IMPORTANT: we add "gender" as a third param
 */
function calculateBazi(birthdate, birthtime, gender='male') {
  const [year, month, day] = birthdate.split('-').map(Number);
  const [hour] = birthtime.split(':').map(Number);

  const lunar = LunarCalendar.solarToLunar(year, month, day);
  if (!lunar) throw new Error('農曆轉換失敗');

  const yearGZ = lunar.GanZhiYear;  
  const monthGZ= lunar.GanZhiMonth; 
  const dayGZ  = lunar.GanZhiDay;
  if (!yearGZ || !monthGZ || !dayGZ) {
    throw new Error('缺少干支數據');
  }

  // 時柱
  const shichen = Math.floor((hour + 1) / 2) % 12;
  const dayStem = dayGZ[0];
  const dayStemIndex = TIANGAN.indexOf(dayStem);
  if (dayStemIndex === -1) {
    throw new Error(`找不到日干: ${dayStem}`);
  }
  const timeGanIndex = ((dayStemIndex % 5) * 2 + shichen) % 10;
  const timeGan = TIANGAN[timeGanIndex];
  const timeZhi = DIZHI[shichen];

  const pillars = {
    年柱: yearGZ,
    月柱: monthGZ,
    日柱: dayGZ,
    時柱: timeGan + timeZhi
  };

  // Heavenly Stems Ten Gods
  const stemTenGod = {
    年柱: calculateTenGod(dayStem, yearGZ[0]),
    月柱: calculateTenGod(dayStem, monthGZ[0]),
    日柱: '日主',
    時柱: calculateTenGod(dayStem, timeGan)
  };

  // Earthly Branch hidden stems => array of { stem, tenGod }
  const branchTenGod = {
    年柱: calculateBranchTenGods(dayStem, yearGZ[1]),
    月柱: calculateBranchTenGods(dayStem, monthGZ[1]),
    日柱: calculateBranchTenGods(dayStem, dayGZ[1]),
    時柱: calculateBranchTenGods(dayStem, timeZhi)
  };

  const shishenDetail = {};
  for (let key of ['年柱','月柱','日柱','時柱']) {
    shishenDetail[key] = {
      stem: stemTenGod[key],
      branch: branchTenGod[key]
    };
  }

  const fiveElementCounts = countFiveElements(pillars);
  const missingElements   = findMissingElements(fiveElementCounts);
  const favorableElement  = findFavorableElement(dayStem, fiveElementCounts);

  // Generate DaYun (eight 10-year luck pillars)
  const daYun = calculateDaYun(yearGZ, monthGZ, birthdate, gender, dayStem);

  // 流年 => from age 1..100 => each with fuXing array
  const birthYearNum = year;
  const liuNian = calculateLiuNian(yearGZ, dayStem, birthYearNum);

  return {
    success: true,
    pillars,
    lunar,
    shishen: stemTenGod,
    shishenDetail,
    fiveElementCounts,
    missingElements,
    favorableElement,
    daYun,
    liuNian
  };
}

// ========== Express Endpoint ==========

app.post('/api/bazi', (req, res) => {
  try {
    // Destructure gender from req.body
    const { birthdate, birthtime, gender } = req.body;

    // Pass gender into calculateBazi
    const result = calculateBazi(birthdate, birthtime, gender || 'male');

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

const PORT = 5001;
app.listen(PORT, () => console.log(`後端運行中: http://localhost:${PORT}`));
