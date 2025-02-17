const express = require('express');
const cors = require('cors');
const LunarCalendar = require('lunar-calendar');

const app = express();
app.use(cors());
app.use(express.json());

// ========== 1) BaZi Constants ==========

// Heavenly Stems
const TIANGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
// Earthly Branches
const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// Earthly Branch Hidden Stems
const branchHiddenStems = {
  '子': ['癸'],
  '丑': ['己','癸','辛'],
  '寅': ['甲','丙','戊'],
  '卯': ['乙'],
  '辰': ['戊','乙','癸'],
  '巳': ['丙','戊'],
  '午': ['丁','己'],
  '未': ['己','乙','丁'],
  '申': ['庚','壬','戊'],
  '酉': ['辛'],
  '戌': ['戊','辛','丁'],
  '亥': ['壬','甲']
};

// Stem info: each stem’s element + yin/yang
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

// Five Element relationships for Ten Gods
const outputs = {   // DM produces this
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood'
};
const resources = { // DM is produced by this
  wood: 'water',
  fire: 'wood',
  earth: 'fire',
  metal: 'earth',
  water: 'metal'
};
const wealth = {    // DM controls this
  wood: 'earth',
  fire: 'metal',
  earth: 'water',
  metal: 'wood',
  water: 'fire'
};
const officer = {   // DM is controlled by this
  wood: 'metal',
  fire: 'water',
  earth: 'wood',
  metal: 'fire',
  water: 'earth'
};

// ========== 2) Calculate Ten God for two stems ==========

/**
 * calculateTenGod(dayStem, otherStem)
 * Returns the Ten God label (比肩, 劫财, 食神, 伤官, 正财, 偏财, 正官, 七杀, 正印, 偏印).
 * If something is missing, returns ''.
 */
function calculateTenGod(dayStem, otherStem) {
  const dm = stemInfo[dayStem];
  const other = stemInfo[otherStem];
  if (!dm || !other) return '';

  // 1) Same element => 比肩 vs 劫财
  if (other.element === dm.element) {
    return dm.yin === other.yin ? '比肩' : '劫财';
  }

  // 2) Day Master produces the other => 食神 vs 伤官
  if (outputs[dm.element] === other.element) {
    return dm.yin === other.yin ? '食神' : '伤官';
  }

  // 3) Day Master controls the other => 正财 vs 偏财
  if (wealth[dm.element] === other.element) {
    return dm.yin === other.yin ? '正财' : '偏财';
  }

  // 4) The other produces Day Master => 正印 vs 偏印
  if (resources[dm.element] === other.element) {
    return dm.yin === other.yin ? '正印' : '偏印';
  }

  // 5) The other controls Day Master => 正官 vs 七杀
  if (officer[dm.element] === other.element) {
    return dm.yin === other.yin ? '正官' : '七杀';
  }

  return '';
}

// ========== 3) Calculate Ten Gods for the hidden stems of a branch ==========

function calculateBranchTenGods(dayStem, branchChar) {
  // e.g. if branchChar = '辰', hiddenStems = ['戊','乙','癸']
  const hiddenStems = branchHiddenStems[branchChar] || [];
  return hiddenStems.map(hs => calculateTenGod(dayStem, hs));
}

// ========== 4) Convert a stem char to Chinese Five Element label (木,火,土,金,水) ==========

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

// ========== 5) Count Five Elements (simplified: only Heavenly Stems) ==========

function countFiveElements(pillars) {
  // pillars = { 年柱: "庚辰", 月柱: "辛巳", 日柱: "庚辰", 时柱: "庚午" }
  const counts = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };

  for (let key in pillars) {
    const stem = pillars[key][0]; // e.g. "庚"
    const elemChar = getStemElementChar(stem);
    if (counts[elemChar] !== undefined) {
      counts[elemChar] += 1;
    }
  }
  return counts;
}

// ========== 6) Find missing elements (those with count=0) ==========

function findMissingElements(counts) {
  const missing = [];
  for (let elem in counts) {
    if (counts[elem] === 0) {
      missing.push(elem);
    }
  }
  return missing;
}

// ========== 7) Simple Day Master Strength => Favorable Element (喜用神) ==========

function findFavorableElement(dayStem, counts) {
  const dm = stemInfo[dayStem];
  if (!dm) return '';

  const dmElem = dm.element; // e.g. "metal"
  const resourceElem = resources[dmElem]; // e.g. "earth" if DM=metal

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
  const controllingElem = officer[dmElem]; // e.g. "fire"
  const controllingElemCN = toCN(controllingElem);

  return isStrong ? controllingElemCN : resourceElemCN;
}

// ========== 8) Main BaZi Calculation Function ==========

function calculateBazi(birthdate, birthtime) {
  // 1) Parse user input
  const [year, month, day] = birthdate.split('-').map(Number);
  const [hour] = birthtime.split(':').map(Number);

  // 2) Convert solar => lunar
  const lunar = LunarCalendar.solarToLunar(year, month, day);
  if (!lunar) throw new Error('農曆轉換失敗');

  // e.g. "庚辰", "辛巳", "庚辰"
  const yearGZ = lunar.GanZhiYear;
  const monthGZ = lunar.GanZhiMonth;
  const dayGZ = lunar.GanZhiDay;
  if (!yearGZ || !monthGZ || !dayGZ) {
    throw new Error('缺少干支數據');
  }

  // 3) 時柱計算
  const shichen = Math.floor((hour + 1) / 2) % 12;
  const dayStem = dayGZ[0]; // e.g. "庚"
  const dayStemIndex = TIANGAN.indexOf(dayStem);
  if (dayStemIndex === -1) {
    throw new Error(`找不到日干: ${dayStem}`);
  }
  const timeGanIndex = ((dayStemIndex % 5) * 2 + shichen) % 10;
  const timeGan = TIANGAN[timeGanIndex];
  const timeZhi = DIZHI[shichen];

  // 4) 四柱
  const pillars = {
    年柱: yearGZ,      // e.g. "庚辰"
    月柱: monthGZ,     // e.g. "辛巳"
    日柱: dayGZ,       // e.g. "庚辰"
    時柱: timeGan + timeZhi
  };

  // 5) Heavenly Stems Ten Gods
  const stemTenGod = {
    年柱: calculateTenGod(dayStem, yearGZ[0]),
    月柱: calculateTenGod(dayStem, monthGZ[0]),
    日柱: '日主',
    時柱: calculateTenGod(dayStem, timeGan)
  };

  // 6) Earthly Branch Ten Gods (hidden stems)
  const branchTenGod = {
    年柱: calculateBranchTenGods(dayStem, yearGZ[1]),
    月柱: calculateBranchTenGods(dayStem, monthGZ[1]),
    日柱: calculateBranchTenGods(dayStem, dayGZ[1]),
    時柱: calculateBranchTenGods(dayStem, timeZhi)
  };

  // Combine them for easy display
  const shishenDetail = {};
  for (let key of ['年柱','月柱','日柱','時柱']) {
    shishenDetail[key] = {
      stem: stemTenGod[key],      // e.g. "正財"
      branch: branchTenGod[key]   // array of Ten Gods for hidden stems
    };
  }

  // 7) 五行計算 (只看天干，簡化)
  const fiveElementCounts = countFiveElements(pillars);
  const missingElements = findMissingElements(fiveElementCounts);
  const favorableElement = findFavorableElement(dayStem, fiveElementCounts);

  // 8) Return the final result
  return {
    success: true,
    pillars,          // { 年柱:"庚辰", 月柱:"辛巳", 日柱:"庚辰", 時柱:"庚午" }
    lunar,            // lunar date info
    shishen: stemTenGod,      // old style (天干十神)
    shishenDetail,            // includes branch Ten Gods
    fiveElementCounts,
    missingElements,
    favorableElement
  };
}

// ========== Express API Endpoint ==========

app.post('/api/bazi', (req, res) => {
  try {
    const { birthdate, birthtime } = req.body;
    const result = calculateBazi(birthdate, birthtime);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// ========== Start Server ==========

const PORT = 5001;
app.listen(PORT, () => console.log(`後端運行中: http://localhost:${PORT}`));
