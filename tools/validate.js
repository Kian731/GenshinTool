// 配裝驗證：檢查推薦的聖遺物／武器是否真的適用於該角色
// 用法：node tools/validate.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const R = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const D = R('data/characters.json');
const W = R('data/weapons.json');
const A = R('data/artifacts.json');
const skins = new Set(R('data/_build/weapon-skins.json'));
const wByName = Object.fromEntries(W.map(w => [w.名稱, w]));
const aByName = Object.fromEntries(A.map(a => [a.名稱, a]));

// 套裝的適用條件：c 為角色物件，回傳 true 表示這套對他有意義
const 月曜 = c => c.反應體系.some(r => /^(月|星)/.test(r));
const 有 = (c, ...rs) => rs.some(r => c.反應體系.includes(r));
const 近戰 = c => ['單手劍', '雙手劍', '長柄武器'].includes(c.武器);
const 遠程 = c => ['弓', '法器'].includes(c.武器);
const COND = {
  '樂園遺落之花': c => 有(c, '綻放', '超綻放', '烈綻放', '月綻放'),
  '深林的記憶':   c => c.元素 === '草' || 有(c, '綻放', '超綻放', '烈綻放', '月綻放', '蔓激化', '超激化'),
  '如雷的盛怒':   c => c.元素 === '雷' || 有(c, '感電', '超載', '超導', '超綻放', '超激化', '月感電', '星超導'),
  '熾烈的炎之魔女': c => c.元素 === '火',
  '冰風迷途的勇士': c => c.元素 === '冰' || 有(c, '凍結'),
  '翠綠之影':     c => c.元素 === '風',
  '沙上樓閣史話': c => c.元素 === '風',
  '悠古的磐岩':   c => 有(c, '結晶', '月結晶'),
  '華館夢醒形骸記': c => c.元素 === '岩',
  '水仙之夢':     c => c.元素 === '水',
  '沉淪之心':     c => c.元素 === '水',
  '海染硨磲':     c => !!c.功能.治療 || c.定位 === '治療' || c.標籤.includes('治療'),
  '昔時之歌':     c => !!c.功能.治療 || c.定位 === '治療' || c.標籤.includes('治療'),
  '被憐愛的少女': c => !!c.功能.治療 || c.定位 === '治療' || c.標籤.includes('治療'),
  '黑曜秘典':     c => c.地區 === '納塔' || c.標籤.includes('夜魂'),
  '血紅之證':     c => 有(c, '星擴散'),
  '爐火融煉之心': c => 有(c, '星爍'),
  '影中沉凝的幻滅': c => 有(c, '超導', '星超導'),
  '晨星與月的曉歌': 月曜,
  '紡月的夜歌':   月曜,
  '穹境示現之夜': 月曜,
  '角鬥士的終幕禮': 近戰,
  '流浪大地的樂團': 遠程,
};

const bad = [];
for (const c of D) {
  const seen = new Set();
  for (const raw of c.聖遺物) {
    if (raw.includes('2+2')) continue;   // 「攻擊2+2」這類散搭寫法不是套裝名
    for (const part of raw.split('+')) {
      const n = part.replace(/[0-9]/g, '').replace(/（.*?）/g, '').trim();
      const 有註記 = /（.*?）/.test(part);
      if (seen.has(n)) bad.push([c.名稱, '聖遺物重複', n]);
      seen.add(n);
      if (!aByName[n]) { bad.push([c.名稱, '聖遺物不存在', n]); continue; }
      // 帶括號註記的（例：樂園遺落之花4（超綻放））表示限定隊伍才用，不套用一般條件
      if (!有註記 && COND[n] && !COND[n](c)) bad.push([c.名稱, '套裝條件不符', n]);
    }
  }
  const ws = new Set();
  for (const n of c.武器推薦) {
    if (ws.has(n)) bad.push([c.名稱, '武器重複', n]);
    ws.add(n);
    if (skins.has(n)) { bad.push([c.名稱, '這是武器外觀不是武器', n]); continue; }
    const w = wByName[n];
    if (!w) { bad.push([c.名稱, '武器不存在', n]); continue; }
    if (w.類型 !== c.武器) bad.push([c.名稱, '武器類型不符（角色用' + c.武器 + '）', n + '（' + w.類型 + '）']);
  }
}

if (!bad.length) console.log('配裝驗證全部通過 ✓（' + D.length + ' 名角色）');
else {
  console.log('發現 ' + bad.length + ' 個問題：');
  bad.forEach(([a, b, c2]) => console.log('  ' + a + ' :: ' + b + ' :: ' + c2));
}
process.exit(bad.length ? 1 : 0);
