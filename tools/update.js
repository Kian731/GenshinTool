// 一鍵更新：抓最新資料 → 重建輸出檔 → 補下載圖片 → 驗證
// 只需要 Node.js（不需要 Git Bash、不需要 npm install）
// 用法：雙擊根目錄的「更新資料.bat」，或在這個資料夾執行  node tools/update.js
//
// 參數：
//   --skip-images   不下載圖片（只更新資料，快很多）
//   --force         已存在的明細檔也重新抓一次
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ARGS = process.argv.slice(2);
const SKIP_IMAGES = ARGS.includes('--skip-images');
const FORCE = ARGS.includes('--force');

const AMBER = 'https://gi.yatta.moe/api/v2/cht';
const ASSET = 'https://gi.yatta.moe/assets/UI';
const GAMEDATA = 'https://raw.githubusercontent.com/DimbreathBot/AnimeGameData/master/ExcelBinOutput';
const UA = { 'User-Agent': 'Mozilla/5.0' };

let 失敗 = [];
const p = (...a) => path.join(ROOT, ...a);
const 確保資料夾 = d => fs.mkdirSync(p(d), { recursive: true });
const 說 = (...a) => console.log(...a);
const 標題 = s => console.log('\n\x1b[36m' + s + '\x1b[0m');

async function 抓(url, { binary = false, timeout = 60000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
  } finally { clearTimeout(timer); }
}

// 同時最多開幾條連線，避免被對方擋
async function 並行(items, worker, 並行數 = 8, 進度標籤 = '') {
  let done = 0, ok = 0;
  const queue = items.slice();
  const run = async () => {
    while (queue.length) {
      const item = queue.shift();
      try { if (await worker(item)) ok++; } catch (e) { 失敗.push(進度標籤 + ' ' + item + '：' + e.message); }
      done++;
      if (進度標籤 && done % 25 === 0) process.stdout.write('  ' + done + '/' + items.length + '\r');
    }
  };
  await Promise.all(Array.from({ length: Math.min(並行數, items.length) }, run));
  if (進度標籤) process.stdout.write(' '.repeat(30) + '\r');
  return ok;
}

const 存JSON = async (url, 目標) => { fs.writeFileSync(p(目標), await 抓(url), 'utf8'); };

// 抓明細（已存在就跳過，除非 --force）
async function 抓明細(ids, 目錄, url組法, 標籤) {
  確保資料夾(目錄);
  const 待抓 = ids.filter(id => FORCE || !fs.existsSync(p(目錄, id + '.json')));
  if (!待抓.length) { 說('  ' + 標籤 + '：已是最新（' + ids.length + ' 筆）'); return 0; }
  const n = await 並行(待抓, async id => {
    const txt = await 抓(url組法(id));
    const j = JSON.parse(txt);
    if (j.response !== 200 && !j.data) throw new Error('回應異常');
    fs.writeFileSync(p(目錄, id + '.json'), txt, 'utf8');
    return true;
  }, 8, 標籤);
  說('  ' + 標籤 + '：新增 ' + n + ' 筆（原有 ' + (ids.length - 待抓.length) + ' 筆）');
  return n;
}

async function 抓圖(清單, 目錄, url組法, 標籤) {
  確保資料夾(目錄);
  const 待抓 = 清單.filter(n => !fs.existsSync(p(目錄, n + '.png')));
  if (!待抓.length) { 說('  ' + 標籤 + '：已是最新（' + 清單.length + ' 張）'); return 0; }
  const n = await 並行(待抓, async name => {
    const buf = await 抓(url組法(name), { binary: true, timeout: 90000 });
    if (buf.length < 100) throw new Error('檔案過小');
    fs.writeFileSync(p(目錄, name + '.png'), buf);
    return true;
  }, 6, 標籤);
  說('  ' + 標籤 + '：新增 ' + n + ' 張');
  return n;
}

const 跑建置 = file => {
  說('  → ' + file);
  const out = execFileSync(process.execPath, [p('tools', file)], { cwd: ROOT, encoding: 'utf8' });
  out.trim().split('\n').forEach(l => 說('    ' + l));
};

(async () => {
  const t0 = Date.now();
  說('\x1b[1m原神圖鑒 — 資料更新\x1b[0m');
  說('Node ' + process.version + (SKIP_IMAGES ? '｜略過圖片' : '') + (FORCE ? '｜強制重抓' : ''));
  確保資料夾('data/_raw'); 確保資料夾('data/_build');

  // ── 1. 總表 ──
  標題('[1/6] 抓取角色／武器／聖遺物總表');
  await 存JSON(AMBER + '/avatar', 'data/_raw_yatta_cht.json');
  await 存JSON(AMBER + '/weapon', 'data/_raw/weapons.json');
  await 存JSON(AMBER + '/reliquary', 'data/_raw/reliquary.json');
  const 角色表 = JSON.parse(fs.readFileSync(p('data/_raw_yatta_cht.json'), 'utf8')).data.items;
  const 武器表 = JSON.parse(fs.readFileSync(p('data/_raw/weapons.json'), 'utf8')).data.items;
  const 聖遺物表 = JSON.parse(fs.readFileSync(p('data/_raw/reliquary.json'), 'utf8')).data.items;
  說('  角色 ' + Object.keys(角色表).length + '｜武器 ' + Object.keys(武器表).length +
     '｜聖遺物 ' + Object.keys(聖遺物表).length);

  // ── 2. 明細 ──
  標題('[2/6] 抓取天賦／命座／武器／聖遺物明細');
  await 抓明細(Object.keys(角色表), 'data/_raw/detail', id => AMBER + '/avatar/' + id, '角色明細');
  await 抓明細(Object.keys(武器表), 'data/_raw/weapon_detail', id => AMBER + '/weapon/' + id, '武器明細');
  await 抓明細(Object.keys(聖遺物表), 'data/_raw/reliquary_detail', id => AMBER + '/reliquary/' + id, '聖遺物明細');

  // ── 3. 成長曲線與經驗表 ──
  標題('[3/6] 更新成長曲線與等級經驗表');
  for (const [f, 目標] of [
    ['AvatarCurveExcelConfigData.json', 'data/_raw/avatar_curve.json'],
    ['WeaponCurveExcelConfigData.json', 'data/_raw/weapon_curve.json'],
    ['AvatarLevelExcelConfigData.json', 'data/_raw/avatar_level.json'],
    ['WeaponLevelExcelConfigData.json', 'data/_raw/weapon_level.json'],
  ]) {
    try { await 存JSON(GAMEDATA + '/' + f, 目標); 說('  ' + f + ' ✓'); }
    catch (e) { 說('  ' + f + ' ✗ ' + e.message + '（沿用舊檔）'); }
  }

  // ── 4. 重建輸出檔 ──
  標題('[4/6] 重建資料檔');
  跑建置('build-equip.js');
  跑建置('build-data.js');

  // ── 5. 圖片 ──
  if (SKIP_IMAGES) {
    標題('[5/6] 圖片');
    說('  （--skip-images，略過）');
  } else {
    標題('[5/6] 補下載圖片');
    const 角色 = JSON.parse(fs.readFileSync(p('data/characters.json'), 'utf8'));
    const 頭像 = [...new Set(角色.map(c => path.basename(c.頭像, '.png')))];
    await 抓圖(頭像, 'images/icon', n => ASSET + '/UI_AvatarIcon_' + n + '.png', '角色頭像');
    // 奇偶等少數角色官方沒有抽卡立繪，抓不到是正常的
    const 立繪缺 = 頭像.filter(n => !fs.existsSync(p('images/splash', n + '.png')));
    if (立繪缺.length) {
      const before = 失敗.length;
      await 抓圖(立繪缺, 'images/splash', n => ASSET + '/UI_Gacha_AvatarImg_' + n + '.png', '角色立繪');
      失敗 = 失敗.filter((x, i) => i < before || !x.startsWith('角色立繪'));  // 立繪缺失不算錯誤
    } else 說('  角色立繪：已是最新');
    await 抓圖(['Wind', 'Rock', 'Electric', 'Grass', 'Water', 'Fire', 'Ice'],
      'images/element', n => ASSET + '/UI_Buff_Element_' + n + '.png', '元素圖標');
    const 圖標清單 = fs.readFileSync(p('data/_build/icon-list.txt'), 'utf8').trim().split('\n').filter(Boolean);
    const 分類 = n => /^UI_EquipIcon_/.test(n) ? 'weapon' : (/^UI_RelicIcon_/.test(n) ? 'artifact' : 'item');
    for (const [dir, 標籤] of [['weapon', '武器圖標'], ['artifact', '聖遺物圖標'], ['item', '素材圖標']]) {
      const list = 圖標清單.filter(n => 分類(n) === dir);
      // 聖遺物圖標在 /assets/UI/reliquary/ 底下
      await 抓圖(list, 'images/' + dir,
        n => ASSET + (dir === 'artifact' ? '/reliquary/' : '/') + n + '.png', 標籤);
    }
  }

  // ── 6. 驗證 + 待辦 ──
  標題('[6/6] 驗證配裝資料');
  let 驗證過 = true;
  try { 說('  ' + execFileSync(process.execPath, [p('tools/validate.js')], { cwd: ROOT, encoding: 'utf8' }).trim()); }
  catch (e) { 驗證過 = false; 說((e.stdout || '').trim()); }

  const 角色 = JSON.parse(fs.readFileSync(p('data/characters.json'), 'utf8'));
  const 未分類 = [...new Set(角色.filter(c => c.定位 === '未分類').map(c => c.名稱))];
  const 無配裝 = [...new Set(角色.filter(c => !c.聖遺物.length).map(c => c.名稱))];

  標題('完成（耗時 ' + ((Date.now() - t0) / 1000).toFixed(0) + ' 秒）');
  說('  角色 ' + 角色.length + '｜資料更新至 ' + 角色.map(c => c.上線日).sort().pop());
  if (失敗.length) {
    說('\n\x1b[33m下載失敗 ' + 失敗.length + ' 筆（通常是網路問題，重跑一次就好）：\x1b[0m');
    失敗.slice(0, 10).forEach(x => 說('  ' + x));
    if (失敗.length > 10) 說('  …還有 ' + (失敗.length - 10) + ' 筆');
  }
  if (未分類.length || 無配裝.length) {
    說('\n\x1b[33m有新角色需要手動補資料：\x1b[0m');
    if (未分類.length) 說('  tools/roles.js  要補定位／標籤：' + 未分類.join('、'));
    if (無配裝.length) 說('  tools/builds.js 要補配裝：' + 無配裝.join('、'));
    說('  補完後重跑一次（或執行：node tools/build-data.js）');
  } else if (驗證過 && !失敗.length) {
    說('\n\x1b[32m一切正常，直接打開 index.html 就是最新的。\x1b[0m');
  }
  process.exitCode = 驗證過 ? 0 : 1;
})().catch(e => {
  console.error('\n\x1b[31m更新中斷：' + e.message + '\x1b[0m');
  console.error('如果是連線問題，等一下再重跑即可；已下載的部分不會重抓。');
  process.exitCode = 1;
});
