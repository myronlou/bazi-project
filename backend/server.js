const express = require('express');
const cors = require('cors');
const LunarCalendar = require('lunar-calendar');
const { Solar } = require('lunar-javascript');
const moment = require('moment-timezone');

const app = express();
app.use(cors());
app.use(express.json());

// ========== 1) 八字常數 ==========
const TIANGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const DIZHI = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

// 建立六十甲子陣列
const JIAZI_60 = [];
for (let i = 0; i < 60; i++) {
  const stem = TIANGAN[i % 10];
  const branch = DIZHI[i % 12];
  JIAZI_60.push(stem + branch);
}

// 地支藏干
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

// 天干資訊
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

// 五行生剋關係
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

/** 2) 計算十神 */
function calculateTenGod(dayStem, otherStem) {
  const dm = stemInfo[dayStem];
  const ot = stemInfo[otherStem];
  if (!dm || !ot) return '';

  const samePolarity = (dm.yin === ot.yin);
  const diffPolarity = !samePolarity;

  // 1) 同我者 => 比肩(同性), 劫財(異性)
  if (ot.element === dm.element) {
    return samePolarity ? '比肩' : '劫財';
  }
  // 2) 我生者 => 食神(同性), 傷官(異性)
  if (outputs[dm.element] === ot.element) {
    return samePolarity ? '食神' : '傷官';
  }
  // 3) 我克者 => 正財(異性), 偏財(同性)
  if (wealth[dm.element] === ot.element) {
    return diffPolarity ? '正財' : '偏財';
  }
  // 4) 生我者 => 正印(異性), 偏印(同性)
  if (resources[dm.element] === ot.element) {
    return diffPolarity ? '正印' : '偏印';
  }
  // 5) 克我者 => 正官(異性), 七殺(同性)
  if (officer[dm.element] === ot.element) {
    return diffPolarity ? '正官' : '七殺';
  }
  return '';
}

/** 3) 計算地支藏干的十神 */
function calculateBranchTenGods(dayStem, branchChar) {
  const hiddenStems = branchHiddenStems[branchChar] || [];
  return hiddenStems.map(hs => ({
    stem: hs,
    tenGod: calculateTenGod(dayStem, hs)
  }));
}

/** 4) 天干轉五行 */
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

/** 5) 計算五行數量（僅計算天干） */
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

/** 6) 找出缺失的五行 */
function findMissingElements(counts) {
  const missing = [];
  for (let elem in counts) {
    if (counts[elem] === 0) {
      missing.push(elem);
    }
  }
  return missing;
}

/** 7) 判斷日主強弱，找出喜用神 */
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

/** 8) 判斷年干為陽干還是陰干 */
function isYangYearStem(stem) {
  return ['甲','丙','戊','庚','壬'].includes(stem);
}

/** 9) 甲子步進函數 (向前/向後) */
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

/** 10) 計算起運年齡的占位函數 */
/**
 * 獲取某年份的節氣數據 { name, date }，並按日期升序排序。
 * 透過 lunar-javascript 函式庫解析 "節氣表"。
 */
function getSolarTermsOfYear(year) {
  const allowedTerms = new Set(["立春","惊蛰","清明","立夏","芒种","小暑","立秋","白露","寒露","立冬","大雪","小寒"]);
  const solarJan1 = Solar.fromYmd(year, 1, 1);
  const lunarJan1 = solarJan1.getLunar();
  const jieQiTable = lunarJan1.getJieQiTable();

  const results = [];
  for (const termName in jieQiTable) {
    // 只保留特定的“節”
    if (!allowedTerms.has(termName)) continue;
    
    const solarObj = jieQiTable[termName];
    const termDate = moment.tz({
      year: solarObj.getYear(),
      month: solarObj.getMonth() - 1,
      date: solarObj.getDay(),
      hour: solarObj.getHour(),
      minute: solarObj.getMinute(),
      second: solarObj.getSecond()
    }, 'Asia/Shanghai');
    
    results.push({
      name: termName,
      date: termDate.toDate()
    });
  }
  
  results.sort((a, b) => a.date - b.date);
  return results;
}

/** 查找距離出生時間最近的節氣 */
function findSolarTerm(birthMoment, forward) {
  const birthDate = moment.tz(birthMoment, 'Asia/Shanghai');
  const birthYear = birthDate.year();
  
  // 檢查前後3年，確保跨年時仍能找到節氣
  const yearsToCheck = forward 
    ? [birthYear - 1, birthYear, birthYear + 1]
    : [birthYear + 1, birthYear, birthYear - 1];

  let terms = [];
  for (const year of yearsToCheck) {
    try {
      terms.push(...getSolarTermsOfYear(year));
    } catch(e) {/* handle error */}
  }

  terms.sort((a, b) => a.date - b.date);
  const birthTime = birthDate.valueOf();

  if (forward) {
    return terms.find(t => t.date.getTime() > birthTime);
  } else {
    const filtered = terms.filter(t => t.date.getTime() < birthTime);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }
}

/** 計算起運年齡 */
function calculateStartAge(birthdate, birthtime, forward, timezone) {
  // 直接解析输入的上海时间，不再额外转换
  const birthMoment = moment.tz(`${birthdate} ${birthtime}`, 'YYYY-MM-DD HH:mm', timezone);

  if (!birthMoment.isValid()) return 0;

  const foundTerm = findSolarTerm(birthMoment.toDate(), forward);
  if (!foundTerm) return 0;

  // 解析節氣時間
  const termMoment = moment.tz(foundTerm.date, timezone);
  
  // 调试输出
  console.log(`出生時間: ${birthMoment.format('YYYY-MM-DD HH:mm')}`);
  console.log(`選定的節氣: ${foundTerm.name}，時間: ${termMoment.format('YYYY-MM-DD HH:mm')}`);
  
  const diffMs = forward 
    ? termMoment  - birthMoment
    : birthMoment - termMoment;

  console.log(`時間差 (毫秒): ${diffMs}`)

  const totalDays = Math.abs(diffMs) / (1000 * 3600 * 24);
  console.log(`相差天數: ${totalDays.toFixed(2)} 日`);

  const startAge = totalDays / 3;
  console.log(`計算出的起運年齡: ${startAge.toFixed(2)} 歲`);

  // 計算起運的完整年份
  const years = Math.floor(totalDays / 3);
  // 計算剩餘的天數
  const remainingDays = totalDays % 3;
  // 將剩餘的天數轉換為月與日
  const months = Math.floor(remainingDays * 4); // 一天折合四個月
  const days = (remainingDays * 4 - months) * 30; // 將月的小數部分轉換為天數，假設每月 30 天

  console.log(`計算出的起運年齡: ${years} 歲 ${months} 個月 ${days.toFixed(0)} 日`);

  return startAge;
}


/** 11) 計算大運陣列（10 個周期，每個大運帶有十神） */
function calculateDaYun(yearGZ, monthGZ, birthdate, birthtime, gender, dayStem, timezone) {
  // 確定大運方向
  const yearStem = yearGZ[0];
  const isYearYang = ['甲','丙','戊','庚','壬'].includes(yearStem);
  const forward = (isYearYang && gender === 'male') || (!isYearYang && gender === 'female');

  // 計算準確的起運年齡（直接使用提供的時區）
  const rawAge = calculateStartAge(birthdate, birthtime, forward, timezone);
  console.log(`原始起運年齡: ${rawAge.toFixed(2)} 歲`);

  const fullYears = Math.floor(rawAge);
  const extraMonths = Math.floor((rawAge - fullYears) * 12);

  const birthMoment = moment.tz(`${birthdate} ${birthtime}`, 'YYYY-MM-DD HH:mm', timezone);
  // 計算大運開始時間，添加完整的年份與額外月份
  const startMoment = birthMoment.clone()
    .add(fullYears, 'years')
    .add(extraMonths, 'months');

  const startCalendarYear = startMoment.year();
  const startCalendarMonth = startMoment.month() + 1;
  console.log(`birthMoment ${birthMoment} , year ${startCalendarYear}, month ${startCalendarMonth}` )
  const Age = startCalendarYear - birthMoment.year();

  // 驗證月干支位置
  const baseIndex = JIAZI_60.indexOf(monthGZ);
  if (baseIndex < 0) {
    throw new Error(`Invalid month Ganzhi: ${monthGZ}`);
  }

  // 生成大運周期
  let currentPillar = stepGanZhi(monthGZ, 1, forward);
  const daYunList = [];
  
  // 這裡我們對每個大運的起運年齡與終止年齡進行四捨五入處理
  let currentAge = Age;
  let currentYear = startCalendarYear;
  let currentMonth = startCalendarMonth;
  let startYear = fullYears;
  let startMonth = extraMonths;

  for (let i = 1; i <= 10; i++) {
    // 計算十神關係
    const daYunStem = currentPillar.charAt(0);
    const daYunTenGod = calculateTenGod(dayStem, daYunStem);
    
    // 計算地支藏干關係
    const daYunBranch = currentPillar.charAt(1);
    const fuXingArray = calculateBranchTenGods(dayStem, daYunBranch);

    // 對當前運齡與結束運齡進行取整處理
    const startAgeRounded = Math.round(currentAge) + 1;
    const endAgeRounded = Math.round(currentAge + 10);

    daYunList.push({
      index: i,
      pillar: currentPillar,
      tenGod: daYunTenGod,
      fuXing: fuXingArray,
      startAge: startAgeRounded,
      endAge: endAgeRounded,
      startCalendarYear: currentYear,
      endCalendarYear: currentYear + 9, // 完整10年的跨度
      startCalendarMonth: currentMonth,
      startYear: startYear,
      startMonth: startMonth
    });

    // 準備下一個循環
    currentAge += 10;
    currentYear += 10;
    currentPillar = stepGanZhi(currentPillar, 1, forward);
  }

  return daYunList;
}

/**
 * 計算流年（從 1 歲到 100 歲）
 * 每一年 => baseYearIndex + i => 干支
 * 也顯示地支藏干（副星）
 */
function calculateLiuNian(yearGZ, dayStem, birthYear) {
  const baseIndex = JIAZI_60.indexOf(yearGZ);
  if (baseIndex < 0) return [];

  const liuNianList = [];
  // 計算 1 到 100 歲的流年
  for (let i = 0; i <= 100; i++) {
    const pillar = JIAZI_60[(baseIndex + i) % 60];
    const stem = pillar.charAt(0);
    const branch = pillar.charAt(1);

    const mainTenGod = calculateTenGod(dayStem, stem);
    const fuXingArray = calculateBranchTenGods(dayStem, branch);

    const actualYear = birthYear + i;

    liuNianList.push({
      age: i + 1,
      pillar,
      tenGod: mainTenGod,
      fuXing: fuXingArray,
      year: actualYear
    });
  }
  return liuNianList;
}

/** 12) 主八字計算函數*/
function calculateBazi(birthdate, birthtime, gender, timezone) {
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

  // 計算時柱
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

  // 天干十神計算
  const stemTenGod = {
    年柱: calculateTenGod(dayStem, yearGZ[0]),
    月柱: calculateTenGod(dayStem, monthGZ[0]),
    日柱: '日主',
    時柱: calculateTenGod(dayStem, timeGan)
  };

  // 地支藏干十神計算 => 陣列格式 { stem, tenGod }
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

  // 生成大運 (每 10 年一輪)
  const daYun = calculateDaYun(yearGZ, monthGZ, birthdate, birthtime, gender, dayStem, timezone);

  // 計算流年 (從 1 歲到 100 歲，每年一個干支)
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
    const { birthdate, birthtime, gender, timezone } = req.body;

    // Pass gender into calculateBazi
    const result = calculateBazi(birthdate, birthtime, gender || 'male', timezone);

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
