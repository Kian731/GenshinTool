// 由 Project Amber (gi.yatta.moe) 原始資料 + roles.js + builds.js，產生 data/characters.json / .csv / .js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const roles = require('./roles.js');
const builds = require('./builds.js');
const { baseStats, buildPanel, ASSUME } = require('./build-stats.js');
const REF = require('./reference.js');
const MATS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/_build/char-materials.json'), 'utf8'));

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', '_raw_yatta_cht.json'), 'utf8')).data;

const ELEM = { Wind:'風', Rock:'岩', Electric:'雷', Grass:'草', Water:'水', Fire:'火', Ice:'冰' };
const ELEM_EN = { Wind:'Anemo', Rock:'Geo', Electric:'Electro', Grass:'Dendro', Water:'Hydro', Fire:'Pyro', Ice:'Cryo' };
const WEAPON = { WEAPON_SWORD_ONE_HAND:'單手劍', WEAPON_CLAYMORE:'雙手劍', WEAPON_POLE:'長柄武器', WEAPON_BOW:'弓', WEAPON_CATALYST:'法器' };
const REGION = {
  MONDSTADT:'蒙德', LIYUE:'璃月', INAZUMA:'稻妻', SUMERU:'須彌', FONTAINE:'楓丹',
  NATLAN:'納塔', NODKRAI:'挪德卡萊', NODKRAI_ZIBAI:'挪德卡萊', SNEZHNAYA:'至冬',
  SNEZHNAYA_STAR:'至冬', FATUI:'愚人眾', RANGER:'其他', OMNI_SCOURGE:'其他',
  HVISION:'其他', MAINACTOR:'旅行者',
};
// 體型 → 性別 / 少年‧成年（以官方模型體型為準，非實際年齡）
const BODY = {
  LOLI: { 體型:'蘿莉', 性別:'女', 年齡層:'少年' },
  GIRL: { 體型:'少女', 性別:'女', 年齡層:'少年' },
  LADY: { 體型:'成女', 性別:'女', 年齡層:'成年' },
  BOY:  { 體型:'少年', 性別:'男', 年齡層:'少年' },
  MALE: { 體型:'成男', 性別:'男', 年齡層:'成年' },
};

// ── 技能文字整理 ────────────────────────────────────────
// 保留遊戲原本的重點顏色，移除 {LINK} 之類的內部標記
function fmt(s) {
  return String(s || '')
    .replace(/\{LINK#[^}]*\}|\{\/LINK\}/g, '')
    .replace(/\{NON_BREAK_SPACE\}/g, ' ')
    .replace(/<color=#([0-9A-Fa-f]{6})[0-9A-Fa-f]{0,2}>/g, '<b style="color:#$1">')
    .replace(/<\/color>/g, '</b>')
    .replace(/<[^>]*>/g, m => /^<\/?b/.test(m) ? m : '')
    .replace(/\\n|\r\n|\n/g, '<br>')
    .trim();
}
const plain = s => fmt(s).replace(/<[^>]+>/g, '');

// ── 技能功能標籤（由技能文字自動擷取） ──────────────────
// 逐句判斷：「加成」類必須句中出現隊友範圍字樣才會標記，其餘為通用機能
const TEAM = /隊伍|附近的所有角色|附近的角色|目前場上角色|所有角色|隊友|領域[中內][^，。]{0,14}角色|範圍內[^，。]{0,14}角色|其中的[^，。]{0,14}角色|影響下的[^，。]{0,10}角色|其他角色/;
// [標籤, 效果條件, 是否需要隊友範圍, 額外條件(句子, 角色名)]
// 排除「自己的抗性／防禦力降低」這類自身減益（例如荒瀧一斗）
const notSelf = kind => (s, name) =>
  !new RegExp('(自身|自己|' + name + ')的?[^，。]{0,10}(所有)?(元素)?' + kind).test(s);
// 只保留「能提供給其他隊員」的能力：加成類、治療、附魔、充能、減傷、抗打斷都要求句中出現隊友範圍；
// 減抗／減防是對敵人掛的減益、聚怪與護盾是對當前場上角色生效，皆視為團隊向
const RULES = [
  ['減抗',      /((元素抗性|抗性)[^，。]{0,8}(降低|減少)|(降低|減少)[^，。]{0,20}抗性)/, false, notSelf('抗性')],
  ['減防',      /(防禦力[^，。]{0,8}(降低|減少)|(降低|減少)[^，。]{0,20}防禦力|無視[^，。]{0,12}防禦力)/, false, notSelf('防禦力')],
  ['團隊增傷',  /(造成的傷害|元素傷害加成|傷害加成|反應傷害)(提升|提高|擢升)|傷害(提升|提高|擢升)|(提供|獲得|使|施加)[^，。]{0,20}元素傷害加成|(提升|提高|擢升)[^，。]{0,24}造成的傷害/, true],
  ['攻擊力加成', /攻擊力(提升|提高)|(獲得|提供|使)[^，。]{0,20}攻擊力加成|(提高|提升)[^，。]{0,20}攻擊力/, true],
  ['暴擊加成',  /暴擊(率|傷害)(提升|提高)|(提高|提升)[^，。]{0,20}暴擊(率|傷害)/, true],
  ['精通加成',  /元素精通(提升|提高)|(提高|提升)[^，。]{0,20}元素精通/, true],
  ['生命值加成', /生命值上限(提升|提高)|(提高|提升)[^，。]{0,20}生命值上限/, true],
  ['防禦力加成', /防禦力(提升|提高)|(獲得|提供|使)[^，。]{0,20}防禦力加成|(提高|提升)[^，。]{0,20}防禦力/, true],
  ['充能支援',  /恢復[^，。]{0,12}元素能量|元素充能效率(提升|提高)/, true],
  ['治療',      /回復生命值|恢復生命值|治療量|進行治療|持續回復/, true],
  ['護盾',      /(創造|獲得|展開|賦予|生成|形成|凝聚)[^，。]{0,10}護盾|護盾強效|護盾庇護/, false],
  ['元素附魔',  /附魔|轉為[^，。]{0,14}元素傷害/, true],
  ['聚怪',      /牽引|吸引附近|嘲諷|拉近/, false],
  ['減傷',      /受到的傷害(降低|減少)|傷害減免|承受的傷害(降低|減少)/, true],
  ['抗打斷',    /抗打斷/, true],
];

// 依句子切開（<br> 也視為斷句），避免跨句誤判
const sentences = html => String(html)
  .replace(/<br>/g, '。').replace(/<[^>]+>/g, '')
  .split(/[。！\n]/).filter(s => s.trim());

// 「隊伍中自己的目前場上角色」指的是隊友，把這種寫法正規化掉，避免被當成「自身」
const norm = s => s
  // 「（不包括砂糖自己）」這種排除註記要先拿掉，否則會被誤判成受益者是自己
  .replace(/[（(][^）)]*(不包括|不含|除外)[^）)]*[）)]/g, '')
  .replace(/除(裝備者|自身|自己)以外[，、]?/g, '')
  .replace(/隊伍中自己的/g, '隊伍中的')
  .replace(/自己的目前場上角色/g, '目前場上角色')
  .replace(/自己的角色/g, '隊伍中的角色');

// 團隊向判定：效果前面要先出現隊友範圍字樣，而且效果的「受益者」不能是角色自己
// （例：阿羅夏 C1「隊伍中附近的角色觸發雷元素相關反應後，將為阿羅夏恢復15點元素能量」
//   句子雖然有「隊伍中」，但回能的是他自己，不算團隊支援）
// 效果的「受益者」是不是角色自己
// 只看最近一個逗號之後那一小段：「基於雲堇的防禦力，提高造成的傷害」換算來源是自己、
// 受益者是隊友，不算自身向；「將為阿羅夏恢復15點元素能量」才是自身向
function selfTargeted(s, name, idx) {
  const tail = s.slice(Math.max(0, idx - 16), idx).split(/[，、；：]/).pop();
  return new RegExp('(自身|自己|' + name + ')').test(tail);
}

// 逐句標出「這句在不在隊友範圍內」。
// 除了句子自己出現隊友字樣，還處理遊戲文本常見的區塊寫法：
//   「…為附近的隊伍中所有角色賦予『飛雲旗陣』。」 → 之後單獨一行的「飛雲旗陣」是區塊標題，
//   該區塊底下的敘述都算作用在隊友身上（雲堇 Q 就是這個格式）。
function teamScopes(talentText) {
  const segs = sentences(talentText).map(norm);
  const teamBuffs = new Set();
  segs.forEach(s => {
    if (!TEAM.test(s)) return;
    (s.match(/[「『]([^」』]{2,12})[」』]/g) || []).forEach(x => teamBuffs.add(x.replace(/[「『」』]/g, '')));
  });
  let inBlock = false;
  return segs.map(s => {
    const bare = s.replace(/[「『」』·・]/g, '').trim();
    if (bare.length <= 12 && !/[，。]/.test(s)) inBlock = teamBuffs.has(bare);
    return { s, team: TEAM.test(s) || inBlock };
  });
}

function teamBenefit(talentText, name, re) {
  return teamScopes(talentText).some(({ s, team }) => {
    if (!team) return false;
    const g = new RegExp(re.source, 'g');
    let m;
    while ((m = g.exec(s)) !== null) {
      if (!selfTargeted(s, name, m.index)) return true;
      if (g.lastIndex === m.index) g.lastIndex++;
    }
    return false;
  });
}

function tagSkills(src, name) {
  const out = {};
  for (const [label, htmlList] of src) {
    for (const [tag, re, needTeam, needAlso] of RULES) {
      const hit = needTeam
        ? htmlList.some(html => teamBenefit(html, name, re))
        : htmlList.flatMap(sentences).some(s => re.test(s) && (!needAlso || needAlso(s, name)));
      if (hit) (out[tag] = out[tag] || []).push(label);
    }
  }
  return out;
}

const items = Object.values(raw.items).sort((a, b) => a.release - b.release || String(a.id).localeCompare(String(b.id)));
const missRole = [], missBuild = [], noDetail = [];

const out = items.map(c => {
  const isTraveler = c.region === 'MAINACTOR' && /^1000000[57]/.test(String(c.id));
  const g = BODY[c.bodyType] || {};
  const key = isTraveler ? `旅行者|${c.element}` : c.name;
  const r = roles[key];
  const b = builds[key];
  if (!r) missRole.push(c.name);
  if (!b) missBuild.push(c.name);
  const short = c.icon.replace('UI_AvatarIcon_', '');
  const el = c.element || null;
  const name = isTraveler ? `旅行者（${g.性別 === '男' ? '空' : '熒'}）·${ELEM[el] || ''}` : c.name;

  // 天賦與命座
  let 天賦 = [], 命座 = [], 功能 = {}, detail = null;
  const df = path.join(ROOT, 'data', '_raw', 'detail', c.id + '.json');
  if (fs.existsSync(df)) {
    const d = detail = JSON.parse(fs.readFileSync(df, 'utf8')).data;
    const ts = Object.values(d.talent || {});
    let seenSkill = 0;
    天賦 = ts.map((t, i) => {
      let 類型;
      if (i === 0) 類型 = '普通攻擊';
      else if (t.type === 1) 類型 = '元素爆發';
      else if (t.type === 2) 類型 = '固有天賦';
      else 類型 = (++seenSkill === 1) ? '元素戰技' : '特殊技能';
      const 說明 = fmt(t.description);
      const src = 類型 === '固有天賦' ? '被動' : '主動';
      return { 類型, 名稱: t.name, 說明, 冷卻: t.cooldown || null, 消耗: t.cost || null,
        功能: Object.keys(tagSkills([[src, [說明]]], c.name)) };
    });
    命座 = Object.values(d.constellation || {}).map((x, i) => {
      const 說明 = fmt(x.description);
      return { 序: i + 1, 名稱: x.name, 說明, 功能: Object.keys(tagSkills([['命座', [說明]]], c.name)) };
    });
    功能 = tagSkills([
      ['主動', 天賦.filter(t => t.類型 !== '固有天賦').map(t => t.說明)],
      ['被動', 天賦.filter(t => t.類型 === '固有天賦').map(t => t.說明)],
      ['命座', 命座.map(x => x.說明)],
    ], c.name);
  } else noDetail.push(c.name);

  const mats = MATS[c.id] || { 突破: [], 天賦: [] };

  // 特殊戰鬥體系：只留需要專門配隊的機制（月曜／星系反應、夜魂），
  // 蒸發融化凍結這類一般反應幾乎人人可打，當篩選條件沒有鑑別度，不列入
  // 判定方式：角色的技能或命座原文只要提到該反應，就算跟這個體系有關係
  // （不管是自己打出、把一般反應轉成它、增幅它，還是把它列進觸發條件——都代表配得上）。
  // 蒸發融化凍結那種一般反應不列入，當篩選沒有鑑別度。
  const SPECIAL = ['月綻放', '月感電', '月結晶', '星爍', '星擴散', '星超導'];
  const 全文 = [...天賦, ...命座].map(t => t.說明.replace(/<[^>]+>/g, '')).join(' ');
  const 特殊體系 = [
    ...SPECIAL.filter(x => 全文.includes(x)),
    ...((r && r[1] || []).includes('夜魂') ? ['夜魂'] : []),
  ];

  // Lv90 基礎面板 + 有效詞條 + 畢業目標（詳見 tools/build-stats.js）
  const 基礎面板 = detail ? baseStats(detail) : null;
  const meta = {
    元素: el ? ELEM[el] : '無', 定位: r ? r[0] : '未分類', 原名: c.name,
    反應體系: b ? (b.r || []) : [], 聖遺物: b ? (b.a || []) : [], 武器推薦: b ? (b.w || []) : [],
  };
  const panel = (detail && 基礎面板) ? buildPanel(meta, detail, 基礎面板) : null;

  // 參考表（HoYoLAB 社群統整）優先；表內沒有的角色沿用規則推導
  const ref = REF[c.name];
  const 詞條 = ref
    ? {
        來源: '參考表',
        沙: ref.主詞條.時之沙.split(/\s*or\s*/), 杯: ref.主詞條.空之杯.split(/\s*or\s*/),
        冠: ref.主詞條.理之冠.split(/\s*or\s*/), 副詞條: ref.副詞條,
      }
    : (panel ? {
        來源: (b && b.src) || '規則推導',
        沙: panel.有效詞條.沙, 杯: panel.有效詞條.杯, 冠: panel.有效詞條.冠,
        副詞條: (b && b.sub) || panel.有效詞條.副詞條.join(' > '),
      } : null);

  return {
    id: String(c.id),
    名稱: name,
    原名: c.name,
    星級: c.rank,
    元素: el ? ELEM[el] : '無',
    元素Key: el || 'None',
    元素EN: el ? ELEM_EN[el] : '—',
    武器: WEAPON[c.weaponType] || '—',
    定位: r ? r[0] : '未分類',
    標籤: r ? r[1] : [],
    特色: r ? r[2] : '',
    性別: g.性別 || '—',
    體型: g.體型 || '—',
    年齡層: g.年齡層 || '—',
    地區: REGION[c.region] || c.region,
    突破加成: raw.props[c.specialProp] || '—',
    生日: c.birthday && c.birthday[0] ? `${c.birthday[0]}/${c.birthday[1]}` : '—',
    上線日: new Date(c.release * 1000).toISOString().slice(0, 10),
    是旅行者: isTraveler || c.region === 'MAINACTOR',
    反應體系: b ? (b.r || []) : [],
    特殊體系,
    聖遺物: ref ? ref.聖遺物 : (b ? (b.a || []) : []),
    武器推薦: b ? (b.w || []) : [],
    關鍵命座: b ? (b.k || []) : [],
    配裝推測: !!(b && b.x),
    配裝備註: (b && b.note) || '',
    功能,
    天賦,
    命座,
    基礎面板: 基礎面板 ? {
      生命值: 基礎面板.生命值, 攻擊力: 基礎面板.攻擊力, 防禦力: 基礎面板.防禦力,
      突破加成值: 基礎面板.突破加成Key === 'FIGHT_PROP_ELEMENT_MASTERY'
        ? Math.round(基礎面板.突破加成值) + ''
        : (基礎面板.突破加成值 * 100).toFixed(1) + '%',
    } : null,
    成長屬性: panel ? panel.成長屬性 : '—',
    反應輸出: !!(panel && panel.反應輸出),
    參考定位: ref ? ref.定位 : '',
    天賦優先: ref ? ref.天賦優先 : ((b && b.t) || ''),
    參考面板: ref ? ref.參考面板 : ((b && b.p) || ''),
    詞條來源: 詞條 ? 詞條.來源 : '',
    有效詞條: 詞條,
    畢業目標: panel ? panel.畢業目標 : [],
    爆發耗能: panel ? panel.爆發耗能 : null,
    突破素材: mats.突破,
    天賦素材: mats.天賦,
    頭像: `images/icon/${short}.png`,
    立繪: `images/splash/${short}.png`,
  };
});

const dataDir = path.join(ROOT, 'data');
fs.writeFileSync(path.join(dataDir, 'characters.json'), JSON.stringify(out, null, 1), 'utf8');
fs.writeFileSync(path.join(dataDir, 'characters.js'), 'window.CHARACTERS = ' + JSON.stringify(out) + ';\n', 'utf8');

// CSV（Excel 用，BOM 開頭避免亂碼）— 不含天賦／命座全文
const cols = ['名稱','星級','元素','武器','定位','標籤','反應體系','功能標籤','聖遺物','武器推薦','關鍵命座','性別','體型','年齡層','地區','突破加成','生日','上線日','特色'];
const cell = (o, k) => {
  if (k === '功能標籤') return Object.keys(o.功能).join('/');
  if (k === '關鍵命座') return o.關鍵命座.map(([n, d]) => `C${n} ${d}`).join('；');
  const v = o[k];
  return Array.isArray(v) ? v.join('/') : v;
};
const csv = '﻿' + cols.join(',') + '\n' + out.map(o =>
  cols.map(k => {
    const v = cell(o, k);
    return /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
  }).join(',')
).join('\n');
fs.writeFileSync(path.join(dataDir, 'characters.csv'), csv, 'utf8');

const mb = n => (fs.statSync(path.join(dataDir, n)).size / 1048576).toFixed(2) + ' MB';
console.log('已輸出 %d 名角色 → characters.json (%s) / .js (%s) / .csv', out.length, mb('characters.json'), mb('characters.js'));
if (missRole.length) console.log('⚠ 缺少定位分類：', [...new Set(missRole)].join(', '));
if (missBuild.length) console.log('⚠ 缺少配裝資料：', [...new Set(missBuild)].join(', '));
if (noDetail.length) console.log('⚠ 缺少天賦資料（請執行 tools/fetch-detail.sh）：', [...new Set(noDetail)].join(', '));
const by = k => out.reduce((m, o) => (m[o[k]] = (m[o[k]] || 0) + 1, m), {});
const byArr = k => out.reduce((m, o) => (o[k].forEach(v => m[v] = (m[v] || 0) + 1), m), {});
console.log('定位', by('定位'));
console.log('反應體系', byArr('反應體系'));
console.log('功能標籤', out.reduce((m, o) => (Object.keys(o.功能).forEach(v => m[v] = (m[v] || 0) + 1), m), {}));
console.log('天賦數合計', out.reduce((n, o) => n + o.天賦.length, 0), '｜命座數合計', out.reduce((n, o) => n + o.命座.length, 0));
