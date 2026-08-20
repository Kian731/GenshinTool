// 武器效果／聖遺物套裝效果的功能分類，以及精煉 1～5 階的合併顯示
const SRC = require('./weapon-source.js');

// 效果分類規則（依序比對，可同時命中多個）
const TAGS = [
  ['攻擊力',   /攻擊力(提升|提高|加成)|(提高|提升)[^，。]{0,12}攻擊力/],
  ['暴擊',     /暴擊(率|傷害)(提升|提高)|(提高|提升)[^，。]{0,12}暴擊(率|傷害)/],
  ['元素精通', /元素精通(提升|提高)|(提高|提升)[^，。]{0,12}元素精通/],
  ['元素充能', /元素充能效率(提升|提高)|恢復[^，。]{0,12}元素能量/],
  ['生命值',   /生命值上限(提升|提高)|(提高|提升)[^，。]{0,12}生命值/],
  ['防禦力',   /防禦力(提升|提高)|(提高|提升)[^，。]{0,12}防禦力/],
  ['護盾',     /護盾/],
  ['治療',     /治療加成|治療量|回復生命值|恢復生命值/],
  ['元素傷害', /元素傷害加成|對應元素傷害/],
  ['物理傷害', /物理傷害/],
  ['普攻增傷', /普通攻擊造成的傷害(提升|提高)|普通攻擊[^，。]{0,10}傷害(提升|提高)/],
  ['重擊增傷', /重擊造成的傷害(提升|提高)|重擊[^，。]{0,10}傷害(提升|提高)|重擊的暴擊/],
  ['下落增傷', /下落攻擊[^，。]{0,10}傷害(提升|提高)/],
  ['戰技增傷', /元素戰技造成的傷害(提升|提高)/],
  ['爆發增傷', /元素爆發造成的傷害(提升|提高)/],
  ['減抗',     /抗性[^，。]{0,8}(降低|減少)|(降低|減少)[^，。]{0,12}抗性/],
  ['減防',     /防禦力[^，。]{0,8}(降低|減少)|無視[^，。]{0,12}防禦力/],
  ['攻速',     /攻擊速度(提升|提高)/],
  ['團隊增益', /隊伍中[^，。]{0,30}(提升|提高|獲得|恢復)/],
  ['月反應',   /月綻放|月感電|月結晶|月曜反應/],
  ['星系反應', /星爍|星擴散|星超導/],
  ['一般反應', /蒸發|融化|超載|感電|超導|擴散|結晶|綻放|激化|燃燒/],
  ['夜魂',     /夜魂/],
  ['生命之契', /生命之契/],
];

const plain = s => String(s || '').replace(/<[^>]+>/g, '');

function effectTags(...texts) {
  const t = texts.map(plain).join(' ');
  return TAGS.filter(([, re]) => re.test(t)).map(([k]) => k);
}

// 精煉 1～5 階通常只有數字不同，合併成一行：「暴擊率提升 14%/17.5%/21%/24.5%/28%」
// 若五階的文字結構不一致（少數武器會改寫敘述）就回傳 null，讓呼叫端退回逐階列出
function mergeRefine(list) {
  if (!list || list.length < 2) return null;
  const parts = list.map(s => plain(s).split(/(\d+(?:\.\d+)?)/));
  const n = parts[0].length;
  if (!parts.every(p => p.length === n)) return null;
  for (let i = 0; i < n; i += 2) if (!parts.every(p => p[i] === parts[0][i])) return null;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '';
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) { out += esc(parts[0][i]); continue; }
    const nums = parts.map(p => p[i]);
    out += nums.every(x => x === nums[0])
      ? '<b class="rn rsame">' + nums[0] + '</b>'
      : nums.map((x, j) => '<b class="rn r' + j + '">' + x + '</b>').join('<i class="rsep">/</i>');
  }
  return out;
}

// 依規則表判定獲取來源
function weaponSource(w) {
  for (const r of SRC) {
    if (r.名稱 && r.名稱.includes(w.名稱)) return r.來源;
    if (r.前綴 && r.前綴.some(p => w.名稱.startsWith(p))) return r.來源;
    if (r.星級 !== undefined) {
      const list = Array.isArray(r.星級) ? r.星級 : [r.星級];
      if (list.includes(w.星級)) return r.來源;
    }
  }
  return '—';
}

module.exports = { effectTags, mergeRefine, weaponSource, TAGS };
