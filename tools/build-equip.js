// 產生 data/weapons.js（270 把武器）與 data/artifacts.js（63 套聖遺物）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const R = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const PROPS = R('data/_raw_yatta_cht.json').data.props;
const WTYPE = { WEAPON_SWORD_ONE_HAND:'單手劍', WEAPON_CLAYMORE:'雙手劍', WEAPON_POLE:'長柄武器', WEAPON_BOW:'弓', WEAPON_CATALYST:'法器' };
const SLOT = { EQUIP_BRACER:'生之花', EQUIP_NECKLACE:'死之羽', EQUIP_SHOES:'時之沙', EQUIP_RING:'空之杯', EQUIP_DRESS:'理之冠' };
const wCurve = Object.fromEntries(R('data/_raw/weapon_curve.json').find(x => x.level === 90).curveInfos.map(c => [c.type, c.value]));
const FLAT = new Set(['FIGHT_PROP_ELEMENT_MASTERY']);

const fmt = s => String(s || '')
  .replace(/\{LINK#[^}]*\}|\{\/LINK\}/g, '')
  .replace(/<color=#([0-9A-Fa-f]{6})[0-9A-Fa-f]{0,2}>/g, '<b style="color:#$1">')
  .replace(/<\/color>/g, '</b>')
  .replace(/<[^>]*>/g, m => /^<\/?b/.test(m) ? m : '')
  .replace(/\\n|\r\n|\n/g, '<br>').trim();

const propVal = (type, v) => FLAT.has(type) ? Math.round(v) + '' : (v * 100).toFixed(1) + '%';

// 突破階段的材料需求（costItems 是 id→數量，items 是同一份 JSON 內的名稱對照表）
function promoteCost(promote, items) {
  return (promote || []).filter(p => p.costItems).map(p => ({
    階: p.promoteLevel,
    上限: p.unlockMaxLevel,
    等級需求: p.requiredPlayerLevel || null,
    摩拉: p.coinCost || 0,
    材料: Object.entries(p.costItems).map(([id, n]) => ({
      名稱: (items[id] || {}).name || id,
      數量: n,
      星級: (items[id] || {}).rank || 1,
      圖標: (items[id] || {}).icon || '',
    })),
  }));
}

const iconSet = new Set();

// ── 武器 ──────────────────────────────────────────────
const wlist = R('data/_raw/weapons.json').data.items;
const skins = [];
const weapons = Object.keys(wlist).map(id => {
  const d = R('data/_raw/weapon_detail/' + id + '.json').data;
  // isWeaponSkin = 武器外觀（皮膚），沒有數值與突破資料，不算進武器圖鑒
  if (d.isWeaponSkin || !d.upgrade) { skins.push(d.name); return null; }
  const props = d.upgrade.prop || [];
  const base = props[0], sub = props[1];
  const last = (d.upgrade.promote || []).filter(p => p.addProps).pop();
  const atk = base ? base.initValue * (wCurve[base.type] || 1) + ((last && last.addProps['FIGHT_PROP_BASE_ATTACK']) || 0) : 0;
  const affix = d.affix ? Object.values(d.affix)[0] : null;
  const cost = promoteCost(d.upgrade.promote, d.items || {});
  cost.forEach(p => p.材料.forEach(m => m.圖標 && iconSet.add(m.圖標)));
  iconSet.add(d.icon);
  return {
    id: String(id),
    名稱: d.name,
    星級: d.rank,
    類型: WTYPE[d.type] || d.type,
    基礎攻擊: Math.round(atk),
    副屬性: sub ? (PROPS[sub.propType] || sub.propType) : '—',
    副屬性值: sub ? propVal(sub.propType, sub.initValue * (wCurve[sub.type] || 1)) : '—',
    副屬性Key: sub ? sub.propType : null,
    技能名: affix ? affix.name : '',
    精煉: affix ? Object.values(affix.upgrade).map(fmt) : [],
    描述: fmt(d.description),
    突破: cost,
    圖標: 'images/weapon/' + d.icon + '.png',
  };
}).filter(Boolean).sort((a, b) => b.星級 - a.星級 || a.類型.localeCompare(b.類型) || Number(a.id) - Number(b.id));

// ── 聖遺物 ────────────────────────────────────────────
const rlist = R('data/_raw/reliquary.json').data.items;
const artifacts = Object.keys(rlist).map(id => {
  const d = R('data/_raw/reliquary_detail/' + id + '.json').data;
  const aff = Object.values(d.affixList || {}).map(fmt);
  const suit = Object.entries(d.suit || {}).map(([k, v]) => {
    iconSet.add(v.icon);
    return { 部位: SLOT[k] || k, 名稱: v.name, 說明: fmt(v.description), 圖標: 'images/artifact/' + v.icon + '.png' };
  }).sort((a, b) => Object.values(SLOT).indexOf(a.部位) - Object.values(SLOT).indexOf(b.部位));
  iconSet.add(d.icon);
  return {
    id: String(id),
    名稱: d.name,
    星級: Math.max(...(d.levelList || [1])),
    星級範圍: (d.levelList || []).join('～'),
    二件: aff[0] || '',
    四件: aff[1] || '',
    件數: suit.length,
    部件: suit,
    圖標: 'images/artifact/' + d.icon + '.png',
  };
}).sort((a, b) => b.星級 - a.星級 || Number(b.id) - Number(a.id));

// ── 角色突破 / 天賦材料（供 build-data.js 取用） ────────
const chars = {};
for (const f of fs.readdirSync(path.join(ROOT, 'data/_raw/detail'))) {
  const d = R('data/_raw/detail/' + f).data;
  const items = d.items || {};
  const 突破 = promoteCost(d.upgrade.promote, items);
  // 天賦升級：取一個主要技能的 1→10 級材料總和
  const skill = Object.values(d.talent || {}).find(t => t.promote && Object.keys(t.promote).length > 5);
  const 天賦 = [];
  if (skill) {
    for (const lv of Object.keys(skill.promote).sort((a, b) => a - b)) {
      const p = skill.promote[lv];
      if (!p.costItems) continue;
      天賦.push({
        等級: '→' + p.level,
        摩拉: p.coinCost || 0,
        材料: Object.entries(p.costItems).map(([id, n]) => ({
          名稱: (items[id] || {}).name || id, 數量: n,
          星級: (items[id] || {}).rank || 1, 圖標: (items[id] || {}).icon || '',
        })),
      });
    }
  }
  [...突破, ...天賦].forEach(p => p.材料.forEach(m => m.圖標 && iconSet.add(m.圖標)));
  chars[f.replace('.json', '')] = { 突破, 天賦 };
}

const out = p => path.join(ROOT, p);
fs.writeFileSync(out('data/weapons.js'), 'window.WEAPONS = ' + JSON.stringify(weapons) + ';\n', 'utf8');
fs.writeFileSync(out('data/weapons.json'), JSON.stringify(weapons, null, 1), 'utf8');
fs.writeFileSync(out('data/artifacts.js'), 'window.ARTIFACTS = ' + JSON.stringify(artifacts) + ';\n', 'utf8');
fs.writeFileSync(out('data/artifacts.json'), JSON.stringify(artifacts, null, 1), 'utf8');
fs.writeFileSync(out('data/_build/char-materials.json'), JSON.stringify(chars), 'utf8');
fs.writeFileSync(out('data/_build/icon-list.txt'), [...iconSet].join('\n') + '\n', 'utf8');

const mb = f => (fs.statSync(out(f)).size / 1048576).toFixed(2) + ' MB';
console.log('武器 %d 把 → data/weapons.js (%s)（另排除 %d 個武器外觀）', weapons.length, mb('data/weapons.js'), skins.length);
fs.writeFileSync(out('data/_build/weapon-skins.json'), JSON.stringify(skins), 'utf8');
console.log('聖遺物 %d 套 → data/artifacts.js (%s)', artifacts.length, mb('data/artifacts.js'));
console.log('角色培養素材 %d 名', Object.keys(chars).length);
console.log('需要下載的圖標 %d 張', iconSet.size);
console.log('5★武器 %d、4★武器 %d、5★聖遺物 %d 套',
  weapons.filter(w => w.星級 === 5).length, weapons.filter(w => w.星級 === 4).length,
  artifacts.filter(a => a.星級 === 5).length);
