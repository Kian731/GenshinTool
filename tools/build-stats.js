// 面板計算與有效詞條推導
// ── 這裡的假設全部集中在 ASSUME，不同意就直接改這個物件 ──
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const R = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const ASSUME = {
  花: 4780,        // 生之花 主詞條（+20 五星）固定生命值
  羽: 311,         // 死之羽 主詞條 固定攻擊力
  沙杯冠百分比: 0.466,  // 攻擊力%／生命值%／防禦力% 主詞條
  沙杯冠精通: 187,      // 元素精通 主詞條
  沙充能: 0.518,        // 元素充能效率 主詞條
  冠暴擊率: 0.311,
  冠暴擊傷害: 0.622,
  杯元素傷: 0.466,
  杯治療: 0.359,
  副詞條主屬性: 0.25,   // 副詞條累積的 攻擊%／生命%／防禦% （約 6 條）
  副詞條暴擊率: 0.20,   // 副詞條累積暴擊率（約 6 條）
  副詞條暴擊傷害: 0.40, // 副詞條累積暴擊傷害（約 6 條）
  基礎暴擊率: 0.05,
  基礎暴擊傷害: 0.50,
  雙暴目標: [0.70, 2.00],
};

const avatarCurve = Object.fromEntries(R('data/_raw/avatar_curve.json').find(x => x.level === 90).curveInfos.map(c => [c.type, c.value]));
const WEAPONS = R('data/weapons.json');
const ARTIFACTS = R('data/artifacts.json');
const wByName = Object.fromEntries(WEAPONS.map(w => [w.名稱, w]));
const aByName = Object.fromEntries(ARTIFACTS.map(a => [a.名稱, a]));

// Lv90 基礎面板（角色）：初始值 × 90 級成長曲線 + 第 6 階突破加成（突破加成是累計值，取最後一階）
function baseStats(detail) {
  const base = {};
  (detail.upgrade.prop || []).forEach(p => base[p.propType] = p.initValue * (avatarCurve[p.type] || 1));
  const last = (detail.upgrade.promote || []).filter(p => p.addProps).pop() || { addProps: {} };
  const add = last.addProps || {};
  const g = k => Math.round((base[k] || 0) + (add[k] || 0));
  const specKey = Object.keys(add).find(k => !/BASE_(HP|ATTACK|DEFENSE)/.test(k));
  return {
    生命值: g('FIGHT_PROP_BASE_HP'),
    攻擊力: g('FIGHT_PROP_BASE_ATTACK'),
    防禦力: g('FIGHT_PROP_BASE_DEFENSE'),
    突破加成Key: specKey || null,
    突破加成值: specKey ? add[specKey] : 0,
  };
}

// 從技能原文判斷傷害吃哪個屬性（遊戲文字會直接寫「基於…生命值上限」）
function scalingStat(talentText) {
  const hit = re => (talentText.match(re) || []).length;
  const hp = hit(/基於[^，。]{0,14}生命值上限|生命值上限的\d/g);
  const def = hit(/基於[^，。]{0,14}防禦力|防禦力的\d/g);
  const em = hit(/基於[^，。]{0,14}元素精通|元素精通的\d/g);
  const best = Math.max(hp, def, em);
  if (best < 2) return '攻擊力';
  if (em === best) return '元素精通';
  if (hp === best) return '生命值';
  return '防禦力';
}

// 套裝 2 件效果提供的固定加成（用來算面板）
function setBonus(name) {
  const a = aByName[name];
  if (!a) return {};
  const t = a.二件.replace(/<[^>]+>/g, '');
  const num = re => { const m = t.match(re); return m ? Number(m[1]) / 100 : 0; };
  return {
    攻擊力: num(/攻擊力提高(\d+(?:\.\d+)?)%/),
    生命值: num(/生命值提升(\d+(?:\.\d+)?)%/),
    防禦力: num(/防禦力提高(\d+(?:\.\d+)?)%/),
    充能: num(/元素充能效率提高(\d+(?:\.\d+)?)%/),
    精通: (t.match(/元素精通提高(\d+)點/) || [0, 0])[1] / 100,
    暴擊率: num(/暴擊率提[高升](\d+(?:\.\d+)?)%/),
  };
}

// 有效詞條 + 畢業面板參考
function buildPanel(c, detail, base) {
  const talentText = [...Object.values(detail.talent || {})].map(t => String(t.description).replace(/<[^>]+>/g, '')).join(' ');
  let scale = scalingStat(talentText);
  // 突破加成是精通、且體系吃反應時，視為精通型
  if (base.突破加成Key === 'FIGHT_PROP_ELEMENT_MASTERY' && /綻放|激化|感電|燃燒/.test(c.反應體系.join(''))) scale = '元素精通';
  if (OVERRIDE[c.原名]) scale = OVERRIDE[c.原名].scale || scale;

  const q = (detail.talent ? Object.values(detail.talent).find(t => t.cost) : null);
  const qCost = q ? q.cost : 0;
  const 輸出型 = ['主C', '副C'].includes(c.定位);
  const 無暴擊 = !!(OVERRIDE[c.原名] || {}).noCrit;
  const pct = scale === '元素精通' ? '攻擊力' : scale; // 精通型的沙杯冠百分比仍以攻擊力為主

  // 主詞條
  const 沙 = [];
  if (scale === '元素精通') 沙.push('元素精通');
  if (!輸出型 && qCost >= 60) 沙.push('元素充能效率');
  沙.push(pct + '%');
  if (輸出型 && qCost >= 80) 沙.push('元素充能效率');

  // 主動技能的傷害若「視為月曜／星系反應傷害」，那部分算反應傷害，
  // 不吃元素傷害加成，所以空之杯不該推薦元素傷害加成（例：奧黛塔、桑多涅、冰主、莉奈婭）
  const 主動文字 = Object.values(detail.talent || {})
    .filter(t => t.type !== 2)
    .map(t => String(t.description).replace(/<[^>]+>/g, '')).join(' ');
  const 反應輸出 = /視為[^，。]{0,14}(月綻放|月感電|月結晶|星爍|星擴散|星超導|月曜)反應/.test(主動文字);

  const 杯 = 反應輸出 ? [pct + '%', '元素精通']
    : (輸出型 ? [c.元素 + '元素傷害加成', pct + '%']
    : (c.定位 === '治療' ? ['治療加成', pct + '%'] : [pct + '%', c.元素 + '元素傷害加成']));

  const 冠 = 無暴擊 ? ['治療加成', pct + '%']
    : (輸出型 ? ['暴擊傷害', '暴擊率']
      : (c.定位 === '治療' ? ['治療加成', '暴擊率'] : [pct + '%', '暴擊率']));

  // 副詞條優先序
  const 副 = [];
  if (scale === '元素精通') 副.push('元素精通');
  if (輸出型) {
    if (!無暴擊) 副.push('暴擊率', '暴擊傷害');
    副.push(pct + '%');
    if (qCost >= 60) 副.push('元素充能效率');
  } else {
    // 輔助／治療／護盾：先把充能與主屬性堆夠，雙暴是有餘裕才考慮
    if (qCost >= 60) 副.push('元素充能效率');
    副.push(pct + '%');
    if (!無暴擊) 副.push('暴擊率', '暴擊傷害');
  }
  if (scale !== '元素精通' && /綻放|激化|擴散|燃燒|感電/.test(c.反應體系.join(''))) 副.push('元素精通');

  // ── 畢業面板參考 ──
  const w = wByName[c.武器推薦[0]] || null;
  const set = setBonus((c.聖遺物[0] || '').replace(/[0-9]/g, '').split('+')[0]);
  const key = { 攻擊力: '攻擊力', 生命值: '生命值', 防禦力: '防禦力', 元素精通: '攻擊力' }[scale];
  const wSub = w && w.副屬性Key;
  const wPct = n => wSub === n ? Number(String(w.副屬性值).replace('%', '')) / 100 : 0;
  const subMap = { 攻擊力: 'FIGHT_PROP_ATTACK_PERCENT', 生命值: 'FIGHT_PROP_HP_PERCENT', 防禦力: 'FIGHT_PROP_DEFENSE_PERCENT' };

  const 沙給百分比 = 沙[0] === key + '%';
  const 百分比加成 = (沙給百分比 ? ASSUME.沙杯冠百分比 : 0)
    + ASSUME.副詞條主屬性 + (set[key] || 0) + wPct(subMap[key]);
  const 固定 = key === '生命值' ? ASSUME.花 : (key === '攻擊力' ? ASSUME.羽 : 0);
  const 主面板 = Math.round((base[key] + (key === '攻擊力' && w ? w.基礎攻擊 : 0)) * (1 + 百分比加成) + 固定);

  const 暴率 = base.突破加成Key === 'FIGHT_PROP_CRITICAL' ? base.突破加成值 : 0;
  const 暴傷 = base.突破加成Key === 'FIGHT_PROP_CRITICAL_HURT' ? base.突破加成值 : 0;

  const 目標 = [];
  目標.push({ 項目: key === '攻擊力' ? '攻擊力面板' : key + '面板', 值: 主面板.toLocaleString(), 註: (w ? '帶' + w.名稱 + '、' : '') + (沙給百分比 ? key + '%沙' : 沙[0]) });
  if (!無暴擊) {
    目標.push({ 項目: '暴擊率 / 暴擊傷害', 值: '70% / 200%', 註: '雙暴比 1:2，暴擊率×2＋暴擊傷害 ≥ 340' + (暴率 ? '；突破加成已給 ' + (暴率 * 100).toFixed(1) + '% 暴擊率' : '') + (暴傷 ? '；突破加成已給 ' + (暴傷 * 100).toFixed(1) + '% 暴擊傷害' : '') });
  } else {
    目標.push({ 項目: '暴擊', 值: '不需要', 註: '此角色機制無法暴擊，詞條全部避開雙暴' });
  }
  if (qCost) {
    const 需求 = 輸出型 ? (qCost >= 80 ? '140～180%' : '110～140%') : (qCost >= 80 ? '200%＋' : qCost >= 60 ? '160～200%' : '120～160%');
    目標.push({ 項目: '元素充能效率', 值: 需求, 註: '元素爆發耗能 ' + qCost + '，實際需求依隊伍充能環境調整' });
  }
  if (scale === '元素精通' || /綻放|激化|燃燒/.test(c.反應體系.join(''))) {
    目標.push({ 項目: '元素精通', 值: scale === '元素精通' ? '800～1000' : '150～300', 註: scale === '元素精通' ? '反應傷害主要來源' : '反應副收益，有餘裕再堆' });
  }
  if (c.定位 === '治療') 目標.push({ 項目: '治療加成', 值: '30%＋', 註: '杯或冠擇一即可' });
  if (反應輸出) 目標.push({ 項目: '空之杯注意', 值: '別選元素傷害加成',
    註: '這名角色的主要傷害會轉為月曜／星系反應傷害。月反應扱傷害的特性是「可暴擊、無視敵人防禦、元素精通加算、不吃傷害加成」，所以元素傷害加成杯完全沒有收益；杯請走 ' + pct + '% 或元素精通' });

  return {
    成長屬性: scale,
    反應輸出,
    有效詞條: { 沙: uniq(沙).slice(0, 3), 杯: uniq(杯).slice(0, 2), 冠: uniq(冠).slice(0, 2), 副詞條: uniq(副).slice(0, 5) },
    畢業目標: 目標,
    爆發耗能: qCost || null,
  };
}
const uniq = a => [...new Set(a)];

// 少數靠規則判斷不出來的例外
const OVERRIDE = {
  '珊瑚宮心海': { noCrit: true, scale: '生命值' },
  '妮露': { scale: '生命值' },
  '芙寧娜': { scale: '生命值' },
  '那維萊特': { scale: '生命值' },
  '希格雯': { scale: '生命值' },
  '夜蘭': { scale: '生命值' },
  '哥倫比婭': { scale: '生命值' },
  '塔利雅': { scale: '生命值' },
  '沃雅妮莎': { scale: '生命值' },
  '甘雨': { scale: '攻擊力' },
  '提納里': { scale: '攻擊力' },
  '納西妲': { scale: '元素精通' },
  '菈烏瑪': { scale: '元素精通' },
  '奈芙爾': { scale: '元素精通' },
  '愛諾': { scale: '元素精通' },
  '卡維': { scale: '元素精通' },
  '艾梅莉埃': { scale: '元素精通' },
  '茲白': { scale: '防禦力' },
  '葉洛亞': { scale: '防禦力' },
  '雲堇': { scale: '防禦力' },
  '五郎': { scale: '防禦力' },
};

module.exports = { ASSUME, baseStats, buildPanel, OVERRIDE };
