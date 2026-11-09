// 端對端測試（手機尺寸）：node tests/e2e.js
// 需要 Playwright；會自動啟動本機靜態伺服器。
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const SHOT_DIR = process.env.SHOT_DIR || null;
const REQ_LOG = [];          // 伺服器收到的路徑（離線快取測試用）
let SW_OVERRIDE = null;      // 模擬升版：改由這段內容回應 sw.js

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      REQ_LOG.push(p);
      if (p === '/sw.js' && SW_OVERRIDE) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); return res.end(SW_OVERRIDE); }
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, () => resolve(server));
  });
}

async function main() {
  const server = await serve();
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  // 其他流程測試：成就改用文字提示（不跳星光成就劇場，避免擋住後續點擊）；劇場另有專門測試（theater: true）
  const _newContext = browser.newContext.bind(browser);
  browser.newContext = async (opts = {}) => {
    const { theater, story, goldGame, ...rest } = opts;
    const c = await _newContext(rest);
    if (!theater) await c.addInitScript(() => { window.__cgpNoTheater = true; });
    if (!story) await c.addInitScript(() => { window.__cgpNoStory = true; });   // 金島劇情另有專門測試（story: true）
    // 金島小遊戲（木島上線前各 1/2 機率）：其他流程固定抓住星星；落葉找松果另有專門測試（goldGame: 'leaf'）
    await c.addInitScript((g) => { window.__cgpGoldGame = g; }, goldGame || 'stars');
    return c;
  };
  const ctx = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
  const shot = async (name) => { if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true }); };
  const noHScroll = async (label) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, `${label} 出現橫向捲動 (${over}px)`);
  };
  const text = (sel) => page.locator(sel).innerText();
  /** 進入設定：第一次設定家長密碼 1234，之後輸入密碼解鎖（離開設定會自動上鎖） */
  async function passPin(pg = page) {
    await pg.waitForSelector('[data-testid=pin], .tabs');
    if (!(await pg.locator('[data-testid=pin]').count())) return;
    if (await pg.locator('#pin-2').count()) { await pg.fill('#pin-1', '1234'); await pg.fill('#pin-2', '1234'); }
    else await pg.fill('#pin-1', '1234');
    await pg.click('[data-action=pin-submit]');
    await pg.waitForSelector('.tabs');
  }

  await page.goto(url);
  await shot('01-empty-home');
  await noHScroll('空首頁');

  // 新增兩個孩子
  async function addChild(name, start) {
    await page.click('[data-action="add-child"] >> nth=0');
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="startPoints"]', String(start));
    await page.click('#modal-form button[type="submit"]');
  }
  await addChild('端端', 100);                                         // 沒有孩子時：首頁的「新增孩子」
  assert.equal(await page.locator('main [data-action="add-child"]').count(), 0, '有孩子後首頁不再顯示新增孩子');
  await page.click('.child-card >> nth=0');                            // 小孩頁面：設定城堡下方的新增孩子（圖示＋文字）
  await page.waitForSelector('.sky .add-kid');
  assert.match(await text('.add-kid'), /新增孩子/);
  const ak = await page.evaluate(() => { const a = document.querySelector('.add-kid').getBoundingClientRect(), c = document.querySelector('.castle-link').getBoundingClientRect(); return { dx: Math.abs((a.left + a.right) / 2 - (c.left + c.right) / 2), below: a.top >= c.bottom - 2, h: a.height }; });
  assert.ok(ak.dx < 1.5 && ak.below, '新增孩子在設定城堡正下方');
  assert.ok(ak.h < 60, '按鈕縮小（高度 ' + ak.h + 'px）');
  await addChild('波妞', 0);
  // 孩子 4 位以上：切換列每排 3 位（第二排在下方）；3 位以下一排
  await page.evaluate(() => { const s = window.__cgpStore; s.addChild({ name: '小明同學' }); s.addChild({ name: '阿寶' }); });
  await page.reload(); await page.waitForSelector('.kid-switch');
  const kidRows = await page.evaluate(() => [...new Set([...document.querySelectorAll('.kid-switch .kid')].map((k) => Math.round(k.getBoundingClientRect().top)))].length);
  assert.ok(await page.locator('.kid-switch.many').count() === 1 && kidRows === 2, '4 位孩子：兩排（實際 ' + kidRows + ' 排）');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, '不橫向溢出');
  await page.evaluate(() => { const s = window.__cgpStore; s.getChildren().slice(2).forEach((c) => s.deleteChild(c.id)); });
  await page.goto(url + '#home');
  assert.equal(await page.locator('.child-card').count(), 2);
  assert.match(await text('.child-card >> nth=0'), /100 點/);
  assert.match(await text('.child-card >> nth=0'), /今日 0/);
  await shot('02-home');

  // 設定：新增 +20 加分、共同任務（指定兩人）
  await page.click('a[aria-label="設定"]');
  // 第一次進設定：要求設定家長密碼
  await page.waitForSelector('[data-testid=pin] #pin-2');
  // （設定分頁換行檢查在輸入密碼之後）
  assert.match(await text('[data-testid=pin]'), /設定家長密碼/);
  await passPin();
  // 設定分頁全部看得到：每排 4 個換行，不用左右滑
  const tabsOk = await page.evaluate(() => [...document.querySelectorAll('.tabs .tab')].every((t) => { const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth && t.scrollWidth <= t.clientWidth; }));
  assert.ok(tabsOk, '設定分頁沒有超出畫面、文字沒有被截掉');
  await page.click('a[href="#rules-bonus"]');
  await page.click('[data-action="add-item"]');
  await page.fill('input[name="name"]', '超棒表現');
  await page.fill('input[name="points"]', '20');
  await page.click('#modal-form button[type="submit"]');
  await page.click('[data-action="add-item"]');
  await page.fill('input[name="name"]', '多做十分');
  await page.fill('input[name="points"]', '10');
  await page.click('#modal-form button[type="submit"]');

  assert.equal(await page.locator('a[href="#rules-task"]').count(), 0, '不再有獨立的任務分頁');
  await page.click('[data-action="add-item"]');
  await page.fill('input[name="name"]', '共同閱讀');
  await page.fill('input[name="points"]', '8');
  assert.ok(await page.locator('select[name="freqType"]').isHidden(), '未勾每日任務時不顯示頻率');
  await page.check('#item-daily');
  assert.ok(await page.locator('input[name="custom"]').isHidden(), '每日任務不能自填');
  await page.selectOption('select[name="freqType"]', 'daily');
  await page.check('input[name="scope"][value="some"]');
  await page.check('input[name="childIds"] >> nth=0');
  await page.check('input[name="childIds"] >> nth=1');
  await shot('03-task-form');
  await page.click('#modal-form button[type="submit"]');
  assert.match(await text('.rows'), /📋 每日任務[\s\S]*共同閱讀[\s\S]*端端、波妞/);
  await noHScroll('設定頁');
  await shot('04-settings-tasks');

  // 案例 A：端端起始 100，+20、-5 → 115 / +15
  await page.goto(url + '#home');
  await page.click('.child-card >> text=端端');
  await page.click('.score-btn.bonus >> text=超棒表現');          // 預設顯示加分
  await page.click('.seg-btn.penalty');                            // 切到扣分
  assert.equal(await page.locator('.score-btn.bonus').count(), 0, '扣分頁不顯示加分項目');
  await page.click('.score-btn.penalty >> text=違反約定');
  assert.equal(await text('[data-testid=total]'), '115');
  assert.equal(await text('[data-testid=today]'), '+15');
  console.log('✔ 案例 A：總點數 115、今日 +15');

  // 案例 B：端端完成共同任務，波妞不得同步
  await page.click('.task >> text=共同閱讀');
  assert.ok(await page.locator('.task.done >> text=共同閱讀').isVisible());
  assert.equal(await text('[data-testid=total]'), '123');
  await shot('05-child-page');
  await noHScroll('孩子頁');
  await page.click('a[aria-label="回首頁"]');
  assert.match(await text('.child-card >> nth=0'), /123 點[\s\S]*今日 \+23/);
  await page.click('.child-card >> text=波妞');
  assert.equal(await page.locator('.task.done >> text=共同閱讀').count(), 0);
  assert.equal(await text('[data-testid=today]'), '0');
  console.log('✔ 案例 B：共同任務完成狀態各自獨立');

  // 案例 C：點錯 +10 後撤銷
  await page.click('a[aria-label="回首頁"]');
  await page.click('.child-card >> text=端端');
  const before = [await text('[data-testid=total]'), await text('[data-testid=today]')];
  const recCount = await page.locator('.rec').count();
  await page.fill('#score-search', '閱讀');
  assert.ok(await page.locator('#score-list .task.done >> text=共同閱讀').isVisible(), '搜尋也找得到每日任務');
  await page.fill('#score-search', '');
  // 用搜尋找到項目（搜尋同時涵蓋加分與扣分）
  await page.fill('#score-search', '十分');
  assert.equal(await page.locator('.score-btn').count(), 1);
  await page.click('.score-btn.bonus >> text=多做十分'); // 誤按 +10
  assert.equal(await page.inputValue('#score-search'), '', '記錄後清除搜尋');
  assert.equal(await text('[data-testid=total]'), String(Number(before[0]) + 10));
  assert.match(await text('.undo-bar'), /多做十分 \+10/);
  await page.click('[data-action=undo]');
  assert.deepEqual([await text('[data-testid=total]'), await text('[data-testid=today]')], before);
  assert.equal(await page.locator('.rec').count(), recCount);
  console.log('✔ 案例 C：撤銷後總點數、今日得分、紀錄皆恢復');

  // 兌換獎勵
  await page.click('.bottom-nav a >> text=兌換');
  await page.waitForSelector('.shop-grid');
  await shot('05b-shop');
  await page.click('[data-action=redeem] >> nth=0');
  await page.click('#confirm [data-yes]');
  assert.match(await text('[data-testid=total]'), new RegExp(String(Number(before[0]) - 30) + '$'));
  assert.match(await text('.records'), /看卡通 30 分鐘[\s\S]*-30/, '兌換紀錄');
  await page.click('.bottom-nav a >> text=小孩');
  await page.waitForSelector('.summary');
  assert.equal(await text('[data-testid=total]'), String(Number(before[0]) - 30));
  assert.equal(await text('[data-testid=today]'), before[1], '兌換不影響今日淨得分');
  assert.match(await text('.records'), /看卡通 30 分鐘[\s\S]*-30/);
  console.log('✔ 兌換獎勵：扣總點數、留下紀錄、不影響今日淨得分');
  const afterRedeem = await text('[data-testid=total]');

  // 案例 D：重新整理後資料保留
  await page.reload();
  assert.equal(await text('[data-testid=total]'), afterRedeem);
  assert.equal(await text('[data-testid=today]'), before[1]);
  assert.ok(await page.locator('.task.done >> text=共同閱讀').isVisible());
  console.log('✔ 案例 D：重新整理後資料保留');

  // 備份匯出 → 清空 → 匯入
  await page.goto(url + '#rules-backup');
  await passPin();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export]')]);
  const backupPath = await download.path();
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(backup.children.length, 2);
  await page.evaluate(() => localStorage.clear());
  await page.goto(url + '#home');
  await page.reload();
  assert.equal(await page.locator('.child-card').count(), 0);
  await page.goto(url + '#rules-backup');
  await passPin();
  await page.setInputFiles('input[data-action=import]', backupPath);
  await page.click('#confirm [data-yes]');
  await page.waitForSelector('.toast >> text=匯入完成');
  await page.goto(url + '#home');
  assert.equal(await page.locator('.child-card').count(), 2);
  assert.match(await text('.child-card >> nth=0'), new RegExp(afterRedeem + ' 點'));
  console.log('✔ 備份匯出與匯入還原');

  // 編輯與刪除孩子
  await page.goto(url + '#rules-children');
  await passPin();
  await page.click('[data-action=edit-child] >> nth=1');
  await page.fill('input[name="name"]', '波妞妞');
  await page.click('#modal-form button[type="submit"]');
  assert.match(await text('.rows'), /波妞妞/);
  await page.click('[data-action=delete-child] >> nth=1');
  await page.click('#confirm [data-yes]');
  assert.equal(await page.locator('.rows .row').count(), 1);
  console.log('✔ 編輯、刪除孩子');

  // 大量項目：分數篩選與搜尋
  await page.evaluate(() => {
    const st = window.__cgpStore;
    const pts = [3, 5, 10, 20];
    for (let i = 0; i < 40; i++) st.addItem({ kind: i >= 20 ? 'penalty' : 'bonus', name: '規定' + i, points: pts[i % 4] });
  });
  await page.goto(url + '#home');
  await page.click('.child-card >> nth=0');
  await page.click('.seg-btn.penalty');
  const chipTexts = await page.locator('.pts-chip').allInnerTexts();
  assert.deepEqual(chipTexts, ['全部', '-3', '-5', '-10', '-20'], '扣分分數依輕到重排列');
  // 加分・扣分版面：單欄條列、沒有分數分類標題、切換按鈕不顯示項目數、篩選按鈕 48×48 正圓形、分數靠右、可橫向捲動
  const lay = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.scorer .score-btn')];
    return {
      cols: new Set(btns.map((x) => Math.round(x.getBoundingClientRect().left))).size,
      ptsRight: new Set(btns.map((x) => Math.round(x.querySelector('.score-pts').getBoundingClientRect().right))).size,
      heads: document.querySelectorAll('.scorer .pts-head').length,
      seg: [...document.querySelectorAll('.scorer .seg-btn')].map((x) => x.textContent.trim()),
      chips: [...document.querySelectorAll('.scorer .pts-chip')].map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), getComputedStyle(x).borderRadius]; }),
    };
  });
  assert.equal(lay.cols, 1, '規定清單單欄');
  assert.equal(lay.ptsRight, 1, '分數標籤固定靠右');
  assert.equal(lay.heads, 0, '不再插入分數分類標題');
  assert.deepEqual(lay.seg, ['👍 加分', '⚠️ 扣分'], '切換按鈕不顯示項目數量');
  assert.ok(lay.chips.every((c) => c[0] === 48 && c[1] === 48 && c[2] === '50%'), '篩選按鈕 48×48 正圓形：' + JSON.stringify(lay.chips));
  // 最後一筆能捲到撤銷列與導覽列上方完整看見
  const lastOk = await page.evaluate(async () => {
    const last = [...document.querySelectorAll('.scorer .score-btn')].pop();
    last.scrollIntoView({ block: 'end' }); window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 50));
    const r = last.getBoundingClientRect(), u = document.querySelector('.undo-bar').getBoundingClientRect();
    return r.bottom <= u.top + 1;
  });
  assert.ok(lastOk, '最後一筆規定不被撤銷列或導覽列遮住');
  await page.click('.pts-chip >> text=-10');
  const shownPts = await page.locator('.score-btn .score-pts').allInnerTexts();
  assert.ok(shownPts.length === 5 && shownPts.every(t => t === '-10'), '只顯示 -10 的項目');
  await shot('06-filter-penalty');
  await page.fill('#score-search', '規定1');
  assert.ok(await page.locator('#score-search').evaluate(el => el === document.activeElement), '輸入時不失去焦點');
  const names = await page.locator('.score-btn .score-name').allInnerTexts();
  assert.ok(names.length > 0 && names.every(n => n.includes('規定1')));
  const before40 = await text('[data-testid=total]');
  await page.click('.score-btn >> text=規定11');
  assert.equal(await text('[data-testid=total]'), String(Number(before40) + 20));
  await noHScroll('大量項目孩子頁');
  await page.fill('#score-search', '找不到的東西');
  assert.match(await text('#score-list'), /找不到/);
  await page.goto(url + '#rules-penalty');
  await passPin();
  await page.fill('#settings-search', '規定3');
  const rows = await page.locator('#settings-list .row').allInnerTexts();
  assert.ok(rows.length > 0 && rows.every(r => r.includes('規定3')));
  await shot('07-settings-search');
  console.log('✔ 大量項目：加分／扣分切換、分數篩選、搜尋');

  // 只匯入規則（新增模式）＋ 自填點數 ＋ 額外星星
  const rulesFile = path.join(require('os').tmpdir(), 'cgp-rules-' + Date.now() + '.json');
  const childNames = await page.evaluate(() => window.__cgpStore.getChildren().map(c => c.name));
  fs.writeFileSync(rulesFile, JSON.stringify({
    children: [{ id: 'k1', name: childNames[0] }],
    items: [
      { id: 'n1', kind: 'bonus', name: '上英文課表現良好', points: 0, custom: true, childIds: ['k1'] },
      { id: 'n2', kind: 'bonus', name: '好好表達心情', points: 0, stars: 10, childIds: 'all' },
      { id: 'n3', kind: 'bonus', name: '多做十分', points: 10, childIds: 'all' }
    ],
    rewards: [{ id: 'w1', name: '去公園', cost: 100 }]
  }));
  const recordsBefore = await page.evaluate(() => window.__cgpStore.data.records.length);
  await page.goto(url + '#rules-backup');
  await passPin();
  await page.setInputFiles('input[data-action=import-rules]', rulesFile);
  await page.waitForSelector('#confirm >> text=新增 2 條');
  await page.click('#confirm [data-yes]');
  assert.equal(await page.evaluate(() => window.__cgpStore.data.records.length), recordsBefore, '紀錄保留');
  await page.goto(url + '#home');
  await page.click('.child-card >> nth=0');
  const totalBeforeCustom = Number(await text('[data-testid=total]'));
  await page.fill('#score-search', '英文課');
  assert.equal(await text('.score-btn .score-pts'), '自填');
  await page.click('.score-btn >> text=上英文課表現良好');
  await page.fill('#custom-points', '15');
  await shot('08-custom-points');
  await page.click('#modal-form button[type="submit"]');
  assert.equal(Number(await text('[data-testid=total]')), totalBeforeCustom + 15);
  await page.fill('#score-search', '表達心情');
  assert.equal(await text('.score-btn .score-pts'), '⭐10');
  await page.click('.score-btn >> text=好好表達心情');
  assert.equal(Number(await text('[data-testid=total]')), totalBeforeCustom + 15, '星星不算生活點數');
  assert.match(await text('.records'), /好好表達心情[\s\S]*⭐10/);
  console.log('✔ 只匯入規則、自填點數、額外星星紀錄');
  const afterCustom = await text('[data-testid=total]');

  // CSV 匯入（Excel 中文版 Big5 編碼）＋ 修改後再匯入會更新
  await page.goto(url + '#rules-backup');
  await passPin();
  await page.setInputFiles('input[data-action=import-rules]', path.join(__dirname, 'fixtures/sample-rules-big5.csv'));
  await page.waitForSelector('#confirm >> text=新增 16 條');
  assert.match(await text('#confirm'), /新增孩子：小美、小明/);
  assert.match(await text('#confirm'), /第 19 列/);
  await shot('09-csv-result');
  await page.click('#confirm [data-yes]');
  const editedCsv = path.join(require('os').tmpdir(), 'cgp-edited-' + Date.now() + '.csv');
  fs.writeFileSync(editedCsv, fs.readFileSync(path.join(__dirname, 'fixtures/sample-rules.csv'), 'utf8')
    .replace('大吼大叫,-20', '大吼大叫,-15'));
  await page.setInputFiles('input[data-action=import-rules]', editedCsv);
  await page.waitForSelector('#confirm >> text=更新 1 條');
  await page.click('#confirm [data-yes]');
  assert.equal(await page.evaluate(() => window.__cgpStore.getItems('penalty').find(i => i.sourceId === 'R055').points), -15);
  console.log('✔ CSV 匯入（Big5）與修改後更新');

  // 記分總覽：統計、排行、完成率、修改、刪除、補登
  await page.goto(url + '#home');
  await page.click('a[href="#report"]');
  await page.waitForSelector('.stat-card');
  const kidsCount = await page.evaluate(() => window.__cgpStore.getChildren().length);
  assert.equal(await page.locator('.stat-card').count(), kidsCount, '全部：每個孩子一張統計卡');
  const first = await page.evaluate(() => window.__cgpStore.getChildren()[0]);
  await page.click('[data-action=report-child][data-id="' + first.id + '"]');
  assert.equal(await page.locator('.stat-card').count(), 1);
  await page.click('[data-action=report-period][data-kind=day]');
  const netToday = await page.evaluate((id) => window.__cgpStore.getTodayNet(id), first.id);
  assert.equal(await page.locator('.stat .big').innerText(), (netToday > 0 ? '+' : '') + netToday);
  await shot('10-report');
  await noHScroll('總覽頁');

  // 修改一筆紀錄的點數
  const totalA = await page.evaluate((id) => window.__cgpStore.getTotal(id), first.id);
  const target = await page.evaluate((id) => window.__cgpStore.getRecords(id).find(r => r.type === 'bonus' && r.points > 0), first.id);
  await page.click('.rec[data-id="' + target.id + '"]');
  await page.fill('#rec-points', String(target.points + 7));
  await page.click('#modal-form button[type="submit"]');
  assert.equal(await page.evaluate((id) => window.__cgpStore.getTotal(id), first.id), totalA + 7);
  // 改到昨天
  await page.click('.rec[data-id="' + target.id + '"]');
  const yesterday = await page.evaluate(() => window.CGPReport.addDays(window.__cgpStore.today(), -1));
  await page.fill('#rec-date', yesterday);
  await page.click('#modal-form button[type="submit"]');
  assert.equal(await page.locator('.rec[data-id="' + target.id + '"]').count(), 0, '移到昨天後今天的明細不再顯示');
  assert.equal(await page.evaluate((id) => window.__cgpStore.getTodayNet(id), first.id), netToday - target.points);
  // 刪除
  await page.click('[data-action=report-nav] >> nth=0'); // 前一天
  await page.click('.rec[data-id="' + target.id + '"]');
  await page.click('#rec-delete');
  await page.click('#confirm [data-yes]');
  assert.equal(await page.evaluate((id) => window.__cgpStore.getRecord(id), target.id), null);
  assert.equal(await page.evaluate((id) => window.__cgpStore.getTotal(id), first.id), totalA - target.points);
  // 補登（目前在昨天，預設日期就是昨天）
  await page.click('[data-action=backfill]');
  assert.equal(await page.inputValue('#bf-date'), yesterday);
  const opt = await page.evaluate((id) => window.__cgpStore.getItemsFor(id, 'bonus').find(i => !i.custom && i.points > 0), first.id);
  await page.selectOption('#bf-item', opt.id);
  assert.equal(await page.inputValue('#bf-points'), String(opt.points));
  await shot('11-backfill');
  await page.click('#modal-form button[type="submit"]');
  assert.ok(await page.locator('.rec >> text=' + opt.name).first().isVisible());
  assert.match(await text('.records'), /補登/);
  await page.click('[data-action=report-period][data-kind=month]');
  assert.ok(await page.locator('.comp li').count() > 0, '月份有任務完成率');
  await noHScroll('總覽月');
  await shot('12-report-month');
  console.log('✔ 記分總覽、修改、刪除、補登');

  // 孩子頁的紀錄也能點開修改
  await page.goto(url + '#child-' + first.id);
  await page.click('.records .rec >> nth=0');
  assert.ok(await page.locator('#rec-delete').isVisible());
  await page.click('#modal-form [data-close]');
  const afterCustom2 = await text('[data-testid=total]');

  // 介面改版：頭銜、等級、每週目標、首頁選孩子、本週挑戰、底部導覽列
  await page.goto(url + '#rules-children');
  await passPin();
  await page.click('[data-action=edit-child] >> nth=0');
  await page.fill('input[name="title"]', '小小店長');
  await page.check('input[name="badge"][value="🦊"]', { force: true });
  await page.fill('input[name="weeklyGoal"]', '500');
  await page.click('#modal-form button[type="submit"]');
  await page.goto(url + '#home');
  assert.match(await text('.child-card >> nth=0'), /小小店長\s*Lv\.\d+/);
  assert.match(await text('.week-card'), /\/ 500 點/);
  await shot('13-home-new');
  await noHScroll('新首頁');
  assert.equal(await page.locator('.tiles, [data-action=pick-child]').count(), 0, '首頁不再有和底部功能列重複的四個磚塊');
  await page.click('.bottom-nav a >> text=挑戰');
  await page.waitForSelector('.challenges');
  assert.ok(await page.locator('.bottom-nav .nav-item.active >> text=挑戰').isVisible());
  // 新增一個容易達成的挑戰並領取
  await page.goto(url + '#rules-challenge');
  await passPin();
  await page.click('[data-action=add-challenge]');
  await page.fill('input[name="name"]', '測試挑戰');
  await page.selectOption('select[name="metric"]', 'net');
  assert.ok(await page.locator('select[name="itemId"]').isHidden());
  await page.fill('input[name="target"]', '1');
  await page.fill('input[name="rewardPoints"]', '15');
  await page.click('#modal-form button[type="submit"]');
  await page.goto(url + '#challenge-' + first.id);
  const beforeClaim = await page.evaluate((id) => window.__cgpStore.getTotal(id), first.id);
  const claimBtn = page.locator('.challenge:has-text("測試挑戰") [data-action=claim]');
  await claimBtn.click();
  assert.ok(await page.locator('.challenge:has-text("測試挑戰") .claimed').isVisible());
  assert.equal(await page.evaluate((id) => window.__cgpStore.getTotal(id), first.id), beforeClaim + 15);
  await shot('14-challenge');
  await noHScroll('挑戰頁');
  // 孩子切換
  const kids = await page.evaluate(() => window.__cgpStore.getChildren().map(c => c.id));
  if (kids.length > 1) {
    await page.click('.kid-switch a[href="#challenge-' + kids[1] + '"]');
    await page.waitForFunction((h) => location.hash === h, '#challenge-' + kids[1]);
    assert.equal(await page.evaluate(() => location.hash), '#challenge-' + kids[1]);
    await page.waitForSelector('.kid.active[href="#challenge-' + kids[1] + '"]');
    await page.click('.bottom-nav a >> text=小孩');
    await page.waitForSelector('.summary');
    assert.equal(await page.evaluate(() => location.hash), '#child-' + kids[1], '導覽列記得目前的孩子');
  }
  await page.click('.bottom-nav a >> text=紀錄');
  await page.waitForSelector('.stat-card');
  console.log('✔ 頭銜等級、每週目標、選孩子、本週挑戰、底部導覽列');
  await page.goto(url + '#child-' + first.id);
  const afterCustom2b = await text('[data-testid=total]');

  // 舊版網址格式仍可使用
  const cid = await page.evaluate(() => window.__cgpStore.getChildren()[0].id);
  await page.goto(url + '#/child/' + cid);
  assert.equal(await text('[data-testid=total]'), afterCustom2b);
  console.log('✔ 相容舊版網址格式');

  // ---------- Phase 2 驗收（全新資料） ----------
  {
    const c2 = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
    const q = await c2.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const ids = await q.evaluate(() => {
      const s = window.__cgpStore;
      const mk = (n) => s.addChild({ name: n }).id;
      const add = (kind, name, points) => s.addItem({ kind, name, points }).id;
      return { A: mk('甲'), B: mk('乙'), C: mk('丙'), p20: add('bonus', '加二十', 20), p50: add('bonus', '加五十', 50),
        m20: add('penalty', '扣二十', 20), m15: add('penalty', '扣十五', 15) };
    });
    const tap = async (child, name, kind) => {
      await q.goto(url + '#child-' + child);
      await q.click('.seg-btn.' + (kind || 'bonus'));
      await q.click('.score-btn >> text=' + name);
    };
    const stars = (id) => q.evaluate((i) => window.__cgpStore.getStarBalance(i), id);

    // 案例 A：+20 → 解鎖、4 星
    await tap(ids.A, '加二十');
    assert.match(await q.locator('[data-testid=adventure]').innerText(), /今日冒險已解鎖[\s\S]*⭐4/);
    await q.click('[data-action=enter-adventure]');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('[data-testid=stars]');
    assert.equal((await q.locator('[data-testid=stars]').innerText()).trim(), '4');
    await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, '15-lobby.png') : path.join(require('os').tmpdir(), 'lobby.png'), fullPage: true });
    console.log('✔ Phase 2 案例 A：+20 解鎖並取得 4 星');

    // 案例 B：+20、-20 → 不解鎖
    await tap(ids.B, '加二十');
    await tap(ids.B, '扣二十', 'penalty');
    assert.match(await q.locator('[data-testid=adventure]').innerText(), /🔒[\s\S]*今日冒險尚未解鎖/);
    assert.ok(await q.locator('[data-testid=adventure] button').isDisabled(), '未解鎖不可進入');
    assert.equal(await stars(ids.B), 0);
    await q.goto(url + '#adventure-' + ids.B);
    assert.match(await q.locator('.adv-status').innerText(), /尚未解鎖/);
    assert.equal(await stars(ids.B), 0, '直接打開大廳也不會發星');
    console.log('✔ Phase 2 案例 B：淨得分 0 不解鎖、不得星');

    // 案例 C：+50、-15 → 7 星
    await tap(ids.C, '加五十');
    await tap(ids.C, '扣十五', 'penalty');
    await q.click('[data-action=enter-adventure]');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('[data-testid=stars]');
    assert.equal(await stars(ids.C), 7);
    console.log('✔ Phase 2 案例 C：淨得分 35 取得 7 星');

    // 案例 D：重新整理、重新開啟、再按一次都不會再加 7 星
    await q.reload();
    await q.goto(url + '#child-' + ids.C);
    assert.match(await q.locator('[data-testid=adventure]').innerText(), /已出發[\s\S]*⭐7/);
    assert.equal(await q.locator('[data-action=enter-adventure]').count(), 0);
    const q2 = await c2.newPage();
    await q2.goto(url + '#adventure-' + ids.C);
    assert.equal((await q2.locator('[data-testid=stars]').innerText()).trim(), '7');
    await tap(ids.C, '加五十'); // 結算後再加分
    assert.equal(await stars(ids.C), 7);
    console.log('✔ Phase 2 案例 D：重新整理、重新開啟後不重複發星');
    assert.equal(await stars(ids.A), 4, '孩子各自獨立');
    await c2.close();
  }

  // ---------- Phase 3 驗收（全新資料、可控時間） ----------
  {
    const c3 = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
    const q = await c3.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '甲' });
      const b = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, b.id);
      return a.id;
    });
    // 未出發：地圖不能玩
    await q.goto(url + '#map-' + id);
    assert.match(await q.locator('.map-hint').innerText(), /還沒出發/);
    assert.ok(await q.locator('[data-action=open-shop]').isDisabled());
    // 出發後從大廳進入地圖
    await q.goto(url + '#child-' + id);
    await q.click('[data-action=enter-adventure]');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.map-cta[href]');
    await q.click('.map-cta[href]');
    await q.waitForSelector('#pawn');
    assert.equal((await q.locator('[data-testid=stars]').innerText()).trim(), '20');

    // 案例 A：購買 6 面骰扣 5 星、進背包
    await q.click('[data-action=open-shop]');
    await q.click('#confirm [data-buy=d6]');
    assert.match(await q.locator('.shop-bal').innerText(), /目前有\s*15\b/);
    await q.click('#confirm [data-buy=d6]');
    await q.click('#confirm [data-buy=d6]');
    await q.click('#confirm [data-buy=d6]');
    await q.click('#confirm [data-no]');
    assert.equal((await q.locator('[data-testid=stars]').innerText()).trim(), '0');
    assert.match(await q.locator('.dice-btn.d6').innerText(), /×4/);
    console.log('✔ Phase 3 案例 A：購買 6 面骰扣 5 星、進背包');

    // 案例 B：擲出 4，棋子逐格 1→2→3→4
    await q.evaluate(() => { const seq = [3.5 / 6]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    const seen = [];
    await q.exposeFunction('__seen', (v) => seen.push(Number(v)));
    await q.evaluate(() => {
      new MutationObserver(() => window.__seen(document.getElementById('pawn').dataset.pos))
        .observe(document.getElementById('pawn'), { attributes: true, attributeFilter: ['data-pos'] });
    });
    await q.click('[data-action=roll][data-kind=d6]');
    await q.waitForFunction(() => !document.getElementById('dice-overlay') || document.getElementById('dice-overlay').hidden, null, { timeout: 5000 });
    await q.waitForFunction(() => document.querySelector('[data-testid=pos]').textContent.startsWith('4 '), null, { timeout: 8000 });
    assert.deepEqual(seen.slice(0, 4), [1, 2, 3, 4], '逐格移動');
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 8000 });
    assert.equal(await q.locator('#pawn .pawn-bit').count(), 0, '停在普通格：角色不做驚訝或開心');
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    console.log('✔ Phase 3 案例 B：擲出 4 逐格移動 1→2→3→4');

    // 案例 C：3 次後不能第 4 次
    await q.evaluate(() => { window.__cgpStore.random = () => 0; });
    for (let i = 0; i < 2; i++) {
      await q.click('[data-action=roll][data-kind=d6]');
      await q.waitForFunction((n) => document.querySelector('[data-testid=rolls]').textContent.startsWith(n + ' '), i + 2, { timeout: 8000 });
      await q.waitForFunction(() => !document.querySelector('.dice-btn.d6[disabled]') || document.querySelector('[data-testid=rolls]').textContent.startsWith('3'), null, { timeout: 8000 });
      await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 8000 });   // 等角色動畫（例如開寶箱）播完
      if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    }
    await q.waitForTimeout(400);
    assert.equal(await q.locator('[data-testid=rolls]').innerText(), '3 / 3');
    assert.ok(await q.locator('.dice-btn.d6').isDisabled(), '第 4 次不能擲');
    assert.match(await q.locator('.map-hint').innerText(), /3 次骰子用完/);
    await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, '16-map.png') : path.join(require('os').tmpdir(), 'map.png'), fullPage: true });
    console.log('✔ Phase 3 案例 C：每天最多 3 次骰子');

    // 案例 D：隔天剩餘骰子仍在、次數重置
    await q.clock.setFixedTime(new Date('2026-11-07T09:00:00'));
    await q.reload();
    await q.goto(url + '#map-' + id);
    assert.match(await q.locator('.dice-btn.d6').innerText(), /×1/, '剩餘骰子隔天仍存在');
    assert.equal(await q.locator('[data-testid=rolls]').innerText(), '0 / 3');
    console.log('✔ Phase 3 案例 D：剩餘骰子隔天仍存在');
    await c3.close();
  }

  // ---------- 今日冒險出發：一個視窗勾選多位孩子一起結算；商店在地圖左下角 ----------
  {
    const c6 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c6.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const ids = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '甲' }), b = s.addChild({ name: '乙' }), c = s.addChild({ name: '丙' });
      const it = s.addItem({ kind: 'bonus', name: '加分', points: 20 });
      s.recordItem(a.id, it.id); s.recordItem(b.id, it.id); s.recordItem(b.id, it.id); // 丙 0 分：未解鎖
      return [a.id, b.id, c.id];
    });
    await q.goto(url + '#child-' + ids[0]);
    await q.click('[data-action=enter-adventure]');
    await q.waitForSelector('#confirm .go-box');
    const rows = await q.$$eval('#confirm .go-row', (rs) => rs.map((r) => [r.className.replace('go-row ', ''), r.querySelector('input').checked, r.querySelector('input').disabled]));
    assert.deepEqual(rows, [['ready', true, false], ['ready', true, false], ['locked', false, true]], '可出發預設勾選、未解鎖不可勾');
    assert.match(await q.locator('#confirm [data-yes]').innerText(), /2 位一起出發/);
    assert.match(await q.locator('#confirm .go-row.locked').innerText(), /大於 0 才能出發/);
    // 取消勾選乙 → 只剩 1 位；再勾回來
    await q.click('#confirm .go-row:nth-child(2) input');
    assert.equal(await q.locator('#confirm [data-yes]').innerText(), '出發！');
    await q.click('#confirm .go-row:nth-child(2) input');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.map-cta[href]');
    assert.ok(q.url().endsWith('#adventure-' + ids[0]), '回到按下按鈕的孩子');
    const st = await q.evaluate((ids) => ids.map((id) => !!window.__cgpStore.getSettlement(id)), ids);
    assert.deepEqual(st, [true, true, false], '甲乙一起結算、丙未結算');
    assert.deepEqual(await q.evaluate((ids) => ids.slice(0, 2).map((id) => window.__cgpStore.getStarBalance(id)), ids), [4, 8]);
    // 已出發的孩子再按：直接進大廳，不再跳視窗
    await q.goto(url + '#child-' + ids[1]);
    const btn = q.locator('[data-action=enter-adventure]');
    if (await btn.count()) { await btn.first().click(); await q.waitForSelector('.map-cta[href]'); assert.equal(await q.locator('#confirm[open]').count(), 0); }
    // 第二次開視窗：已出發顯示 ✅
    await q.evaluate((cid) => { const s = window.__cgpStore; const it = s.addItem({ kind: 'bonus', name: '再加', points: 5 }); s.recordItem(cid, it.id); }, ids[2]);
    await q.goto(url + '#child-' + ids[2]);
    await q.click('[data-action=enter-adventure]');
    await q.waitForSelector('#confirm .go-box');
    assert.deepEqual(await q.$$eval('#confirm .go-row', (rs) => rs.map((r) => r.className.replace('go-row ', ''))), ['done', 'done', 'ready']);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.map-cta[href]');
    // 商店：地圖左下角大按鈕，不和右下角縮放鈕重疊、可開啟
    await q.click('.map-cta[href]');
    await q.waitForSelector('#pawn');
    assert.equal(await q.locator('.hud [data-action=open-shop]').count(), 0, '上方不再有商店小按鈕');
    const box = await q.evaluate(() => {
      const v = document.querySelector('.map-view').getBoundingClientRect(), s = document.querySelector('.map-shop').getBoundingClientRect(), c = document.querySelector('.map-ctrl').getBoundingClientRect();
      return { left: s.left - v.left, bottom: v.bottom - s.bottom, w: s.width, overlap: s.right > c.left };
    });
    assert.ok(box.left < 20 && box.bottom < 20 && box.w >= 64 && !box.overlap, '商店在左下角：' + JSON.stringify(box));
    await q.waitForFunction(() => { const i = document.querySelector('.map-shop img'); return i && i.complete && i.naturalWidth === 384 && getComputedStyle(i).objectFit === 'contain'; }, null, { timeout: 8000 }); // 商店圖載入、contain
    await q.click('.map-shop');
    await q.waitForSelector('#confirm .shop-box');
    console.log('✔ 今日冒險出發：勾選多位孩子一起結算、未解鎖不可選、已出發打勾；商店在地圖左下角');
    await c6.close();
  }

  // ---------- Phase 4 第 1 步：命運格、命運卡、特殊任務 ----------
  {
    const c7 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c7.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '甲', startPoints: 0 });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 3; s.setPlayerTile(a.id, 10); s.save();
      return a.id;
    });
    await q.goto(url + '#map-' + id);
    await q.waitForSelector('#pawn');
    // 地圖：4 個命運格（暫用 🔮）＋圖例
    assert.deepEqual(await q.$$eval('.mtile.mt-fate', (els) => els.map((e) => +e.dataset.n)), [11, 14, 21, 27, 41, 44, 51, 66, 69, 76, 87, 93]);
    assert.equal(await q.locator('.mt-fate .tile-art img[src="images/tiles/fate.webp"]').count(), 12, '命運格用水晶球圖（第一～四區共 12 格）');
    await q.waitForFunction(() => [...document.querySelectorAll('.mt-fate img')].every((i) => i.complete && i.naturalWidth === 192));
    assert.match(await q.locator('.legend').innerText(), /命運/);
    // 擲 4 → 第 14 格命運格 → 後退 2 格到第 12 格（寶箱格不觸發）
    await q.evaluate(() => { const seq = [3.5 / 6, 0.8, 0.9]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#confirm[open]', { timeout: 10000 });
    const msg = await q.locator('#confirm').innerText();
    assert.match(msg, /命運卡[\s\S]*往回退了 2 格/);
    assert.match(msg, /停在第 12 格/);
    await q.click('#confirm [data-yes]');
    assert.equal(await q.locator('[data-testid=pos]').innerText(), '12 / 100');
    assert.equal(await q.locator('#pawn').getAttribute('data-tile'), 'gold-01-012');
    // 擲 2 → 第 14 格命運格 → 特殊任務：讚美與感謝（0.3）
    await q.evaluate(() => { const seq = [1.5 / 6, 0.3]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#confirm[open]', { timeout: 10000 });
    assert.match(await q.locator('#confirm').innerText(), /特殊任務[\s\S]*讚美[\s\S]*已加到任務頁/);
    await q.click('#confirm [data-yes]');
    // 抽到當天就能勾選完成；首頁本週進度有提醒
    await q.goto(url + '#home');
    await q.waitForSelector('[data-testid=special-remind]');
    assert.match(await q.locator('[data-testid=special-remind]').innerText(), /甲：🔮 特殊任務 1 項[\s\S]*讚美/);
    await q.click('[data-testid=special-remind] .special-remind');
    await q.waitForSelector('[data-testid=special]');
    assert.match(await q.locator('[data-testid=special]').innerText(), /到 11\/8 前完成/);
    const before = await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id);
    await q.click('[data-action=special-toggle]');
    await q.waitForSelector('.special-check.on');
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), before + 20);
    assert.match(await q.locator('.records').innerText(), /特殊任務：和所有家人說一句讚美的話和感謝的話/);
    await q.click('[data-action=special-toggle]');                 // 再點一次：取消勾選 → 提醒會收回成就
    await q.waitForSelector('#confirm[open]');
    assert.match(await q.locator('#confirm').innerText(), /取消[\s\S]*\+20[\s\S]*會一起收回成就[\s\S]*第一個特殊任務/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.special-check:not(.on)');
    assert.match(await q.locator('#toast').innerText(), /收回成就[\s\S]*第一個特殊任務/);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), before);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getAchievements(cid).find((a) => a.id === 'special1').done, id), false);
    await q.click('[data-action=special-toggle]');
    await q.waitForSelector('.special-check.on');
    await q.click('[data-action=undo]');                           // 撤銷上一筆 → 提醒 → 恢復未完成
    await q.waitForSelector('#confirm[open]');
    assert.match(await q.locator('#confirm').innerText(), /撤銷「特殊任務：[\s\S]*會一起收回成就[\s\S]*第一個特殊任務/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.special-check:not(.on)');
    await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'undo-revoke.png') : path.join(require('os').tmpdir(), 'ur.png') });
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), before);
    await q.click('[data-action=special-cancel]');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => !document.querySelector('[data-testid=special]'));
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, '任務頁不可橫向溢出');
    // 頁首按鈕：首頁機器貓 → 冒險大廳；冒險大廳機器貓 → 首頁；漂浮城堡 → 設定（360px 也顯示，沒有齒輪）
    await q.goto(url + '#home');
    assert.equal(await q.locator('.sky .castle-link').isVisible(), true, '360px 也看得到城堡');
    assert.equal(await q.locator('a.gear:not(.castle-link)').count(), 0, '齒輪已移除');
    assert.match(await q.locator('.mascot-link').innerText(), /冒險大廳/);
    await q.click('.mascot-link');
    await q.waitForSelector('.adv-hero .mascot-link');
    assert.match(await q.locator('.mascot-link').innerText(), /首頁/);
    await q.click('.mascot-link');
    await q.waitForSelector('.hero .mascot-link');
    await q.click('.sky .castle-link');
    await q.waitForSelector('[data-testid=pin]');
    console.log('✔ Phase 4：命運格 4 格、命運卡後退動畫、特殊任務當天可勾選 +20、再點取消、撤銷恢復、首頁提醒、取消任務');
    await c7.close();
  }

  // ---------- 一般冒險事件視窗（2026-11-09）：卡片式、單一視窗整合多個事件；內容沿用事件原文 ----------
  for (const vp of [{ width: 360, height: 800 }, { width: 360, height: 560 }, { width: 1280, height: 800 }]) {
    const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: vp.width < 600, serviceWorkers: 'block' });
    const q = await c.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '甲', startPoints: 0 });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 6; s.save();
      return a.id;
    });
    const roll = async (from, seq, setup) => {
      await q.evaluate(([cid, from, seq, setup]) => {
        const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, from);
        if (setup) { const ch = s._addMapChest(cid, 'milestone'); ch.n = setup; ch.tileId = s.getBoard(cid).tiles[setup].id; }
        s.random = () => (seq.length ? seq.shift() : 0); s.save();
      }, [id, from, seq, setup || 0]);
      await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
      await q.click('.dice-btn.d6');
      await q.waitForSelector('#confirm[open] [data-testid=event]', { timeout: 10000 });
      const ok = await q.evaluate(() => { const b = document.querySelector('#confirm [data-yes]').getBoundingClientRect(), d = document.querySelector('#confirm .ev').getBoundingClientRect();
        return b.bottom <= innerHeight && b.top >= 0 && d.top >= 0 && d.bottom <= innerHeight && d.right <= innerWidth && d.left >= 0; });
      assert.ok(ok, vp.width + 'x' + vp.height + '：視窗與按鈕都在畫面內');
      return q.locator('#confirm .ev').innerText();
    };
    const shot = async (name) => { if (SHOT_DIR) await q.locator('#confirm .ev').screenshot({ path: path.join(SHOT_DIR, 'event-' + name + '-' + vp.width + 'x' + vp.height + '.png') }); };
    const close = async () => { await q.click('#confirm [data-yes]'); await q.waitForSelector('#confirm[open]', { state: 'detached', timeout: 3000 }).catch(() => {}); };
    // 1. 命運卡後退：第 12 格擲 2 → 第 14 格 → 往回退 2 格
    let t = await roll(12, [1.5 / 6, 0.8, 0.9]);
    assert.match(t, /命運卡出現！[\s\S]*擲出 2・停在第 12 格[\s\S]*命運卡｜往回退[\s\S]*往回退了 2 格[\s\S]*繼續冒險！/);
    assert.ok(await q.locator('#confirm .ev.ev-fate .ev-card.ev-fate').count());
    await shot('fate'); await close();
    // 2. 路障：第 10 格擲 1 → 第 11 格
    t = await roll(10, [0.5 / 6, 0.95, 0.4]);
    assert.match(t, /遇到小麻煩！[\s\S]*停在第 11 格[\s\S]*命運卡｜路障[\s\S]*這次沒有影響，下次繼續前進/);
    assert.ok(await q.locator('#confirm .ev.ev-block .ev-card.ev-block').count());
    await shot('block'); await close();
    // 3. 沿路撿到神秘寶箱＋命運卡路障（同一個視窗）：第 8 格擲 3，經過第 10 格的神秘寶箱，停在第 11 格命運格
    const bag0 = await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.mysteryChest || 0, id);
    t = await roll(8, [2.5 / 6, 0.95, 0.6], 10);
    assert.match(t, /冒險新發現！[\s\S]*擲出 3・停在第 11 格[\s\S]*神秘寶箱 ×1[\s\S]*黃金鑰匙[\s\S]*命運卡｜路障/);
    assert.equal(await q.locator('#confirm .ev-card').count(), 2, '兩個事件放在同一個視窗');
    assert.match(await q.locator('#confirm .ev-art img').getAttribute('src'), /mystery_chest/, '主圖用本次獲得的獎勵');
    await shot('multi'); await close();
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.mysteryChest || 0, id), bag0 + 1, '神秘寶箱只收 1 個，關閉視窗不會重複發放');
    // 4. 特殊任務（較長的文字）：第 12 格擲 2 → 第 14 格
    t = await roll(12, [1.5 / 6, 0.3]);
    assert.match(t, /命運卡出現！[\s\S]*命運卡｜特殊任務[\s\S]*已加到任務頁/);
    await shot('special'); await close();
    if (vp.height === 800 && vp.width === 360) {
      const types = await q.evaluate((cid) => window.__cgpStore.getBoard(cid).tiles.map((t) => t.type), id);
      // （區域終點木門只在後面區域還沒開放時才存在；金島四區都已開放，這個事件目前不會發生，不另外測）
      // 5. 今天的小遊戲已經玩完：停在小遊戲格 → 機會轉成神秘寶箱（不開始小遊戲）
      const mgTile = types.indexOf('minigame');
      await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.minigames.push({ id: 'done1', childId: cid, date: s.today(), tile: 7, status: 'done', caught: 0, stars: 0, ts: 1 }); s.save(); }, id);
      t = await roll(mgTile - 1, [0.5 / 6]);
      assert.match(t, /成功前進！[\s\S]*停在第 \d+ 格[\s\S]*小遊戲[\s\S]*今天的小遊戲已經玩完了[\s\S]*神秘寶箱/);
      assert.equal(await q.locator('#mg').count(), 0, '不會開始小遊戲');
      await shot('minigame-over'); await close();
      // 6. 機會卡礦車前進 2 格，接著停在命運格（路障）：按「上車！」→ 同一個視窗兩張卡
      const ch = types.findIndex((x, i) => x === 'chance' && types[i + 2] === 'fate');
      assert.ok(ch > 0, '找得到礦車會停到命運格的機會格');
      await q.evaluate(([cid, from]) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, from); const seq = [0.5 / 6, 0, 0.95, 0.1]; s.random = () => (seq.length ? seq.shift() : 0); s.save(); }, [id, ch - 1]);
      await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
      await q.click('.dice-btn.d6');
      await q.waitForSelector('#cart-btn', { timeout: 10000 }); await q.click('#cart-btn');
      await q.waitForSelector('#confirm[open] [data-testid=event]', { timeout: 15000 });
      t = await q.locator('#confirm .ev').innerText();
      assert.match(t, new RegExp('遇到小麻煩！[\\s\\S]*停在第 ' + (ch + 2) + ' 格[\\s\\S]*機會[\\s\\S]*礦車[\\s\\S]*命運卡｜路障'));
      assert.equal(await q.locator('#confirm .ev-card').count(), 2, '機會卡和接著的命運卡在同一個視窗');
      await shot('cart-chain'); await close();
    }
    await c.close();
  }
  console.log('✔ 一般冒險事件視窗：命運卡後退、路障、撿到神秘寶箱＋命運卡合併一個視窗、特殊任務、小遊戲次數用完、礦車接著停在命運格；手機、矮螢幕、桌面都不超出畫面');

  // ---------- Phase 4 第 2 步：小遊戲「抓住星星」 ----------
  {
    const c8 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 760 }, serviceWorkers: 'block' });
    const q = await c8.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '甲' });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 2; s.setPlayerTile(a.id, 4); s.save();
      return a.id;
    });
    await q.goto(url + '#map-' + id);
    await q.waitForSelector('#pawn');
    assert.match(await q.locator('.mt-minigame').first().getAttribute('title'), /抓住星星/);
    const before = await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id);
    await q.evaluate(() => { const seq = [2.5 / 6]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    await q.click('.dice-btn.d6');                                  // 擲 3 → 第 7 格小遊戲
    await q.waitForSelector('#mg .mg-star.first', { timeout: 10000 });
    await q.waitForFunction(() => { const i = getComputedStyle(document.getElementById('mg')).backgroundImage; return /minigame\/bg\.webp/.test(i); });
    // 第 1 顆在正中央，點到才開始計時
    const pos = await q.evaluate(() => {
      const f = document.getElementById('mg-field').getBoundingClientRect(), s = document.querySelector('.mg-star.first').getBoundingClientRect();
      return { x: (s.left + s.width / 2 - f.left) / f.width, w: document.querySelector('.mg-star.first').offsetWidth };
    });
    assert.ok(Math.abs(pos.x - 0.5) < 0.02 && pos.w >= 96, '第 1 顆在正中央且最大：' + JSON.stringify(pos));
    await q.waitForTimeout(1500);
    assert.equal(await q.locator('#mg-sec').innerText(), '10', '還沒點第 1 顆不計時');
    await q.click('.mg-star.first', { force: true });             // 第 1 顆有呼吸動畫
    // 再抓 2 顆
    for (let k = 0; k < 2; k++) {
      const st = q.locator('.mg-star:not(.first):not(.got):not(.miss)').first();
      await st.waitFor({ timeout: 5000 });
      await st.click({ force: true });
    }
    assert.equal(await q.locator('#mg-count').innerText(), '3');
    // 後 5 秒：一次出現 2 顆、縮小為 0.5 倍（約 39px）
    await q.waitForFunction(() => document.querySelectorAll('.mg-star.small:not(.got):not(.miss)').length >= 2, null, { timeout: 9000 });
    assert.equal(await q.evaluate(() => document.querySelector('.mg-star.small').offsetWidth), 39);
    // 結束：先排出抓到的銀色星星，再合成能量星星（每 3 顆合成 1 顆）
    await q.waitForSelector('.mg-step1', { timeout: 15000 });
    assert.match(await q.locator('.mg-step1').innerText(), /抓到 3 顆銀色星星/);
    assert.equal(await q.locator('.mg-step1 .mg-silver').count(), 3, '排出 3 顆銀色星星');
    assert.equal(await q.locator('.mg-step1 [data-mg=claim]').count(), 0, '第 1 個視窗還不能收下');
    await q.click('.mg-step1 [data-mg=merge]');
    await q.waitForSelector('.mg-step2');
    assert.match(await q.locator('.mg-step2').innerText(), /每 3 顆銀色星星合成 1 顆能量星星[\s\S]*\+1 能量星星/);
    assert.equal(await q.locator('.mg-step2 .mg-group').count(), 1, '合成 1 顆能量星星');
    await q.click('.mg-step2 [data-mg=claim]');
    await q.waitForFunction(() => !document.getElementById('mg'));
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id), before + 1, '抓到 3 顆 → 1 顆能量星星');
    assert.equal(await q.locator('.mg-resume').count(), 0);
    // 稍後再玩 → 地圖出現「還沒玩完」按鈕，重新整理後仍可繼續
    await q.clock.setFixedTime(new Date('2026-11-07T10:00:00'));
    await q.evaluate((cid) => {
      const s = window.__cgpStore; const it = s.addItem({ kind: 'bonus', name: 'x', points: 10 });
      s.recordItem(cid, it.id); s.settleToday(cid); s.setPlayerTile(cid, 14);
      const seq = [2.5 / 6]; s.random = () => (seq.length ? seq.shift() : 0); s.save();
    }, id);
    await q.reload(); await q.waitForSelector('#pawn');
    await q.evaluate(() => { const seq = [2.5 / 6]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    await q.click('.dice-btn.d6');                                  // 擲 3 → 第 17 格小遊戲
    await q.waitForSelector('#mg .mg-star.first', { timeout: 10000 });
    await q.click('#mg [data-mg=later]');
    await q.waitForSelector('.mg-resume');
    await q.reload(); await q.waitForSelector('.mg-resume');
    await q.click('.mg-resume');
    await q.waitForSelector('#mg .mg-star.first');
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, '小遊戲不可橫向溢出');
    console.log('✔ Phase 4：抓住星星（第 1 顆在中央、點到才計時、抓 3 得 3 星、稍後再玩與重新整理後繼續）');

    // 家長試玩網址 #minigame-test：不給星星、不算次數、不動存檔
    const snap = await q.evaluate(() => localStorage.getItem('cgp-data'));
    await q.goto(url + '#minigame-test'); await q.reload();       // 模擬直接開啟網址
    await q.waitForSelector('#mg.practice .mg-star.first');
    assert.match(await q.locator('#mg-tip').innerText(), /試玩模式/);
    await q.click('.mg-star.first', { force: true });
    await q.waitForSelector('.mg-step1', { timeout: 15000 });
    await q.click('.mg-step1 [data-mg=merge]');
    await q.waitForSelector('.mg-step2');
    assert.match(await q.locator('.mg-step2').innerText(), /試玩模式，不會真的得到星星/);
    assert.equal(await q.locator('.mg-step2 [data-mg=claim]').count(), 0);
    await q.click('.mg-step2 [data-mg=again]');
    await q.waitForSelector('#mg.practice .mg-star.first');
    assert.equal(await q.locator('#mg').count(), 1, '再玩一次只有一個遊戲畫面');
    await q.click('#mg [data-mg=later]');
    await q.waitForFunction(() => !document.getElementById('mg') && location.hash === '#home');
    assert.equal(await q.evaluate(() => localStorage.getItem('cgp-data')), snap, '試玩不改變存檔');
    console.log('✔ Phase 4：試玩網址 #minigame-test（不給星星、可再玩一次、離開回首頁、存檔不變）');
    await c8.close();
  }

  // ---------- 寶物商店 Phase 2：冒險寶物商店（兌換頁） ----------
  {
    const c9 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 780 }, serviceWorkers: 'block' });
    const q = await c9.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const [id, id2] = await q.evaluate(() => {
      const s = window.__cgpStore;
      return [s.addChild({ name: '端端', startPoints: 150 }).id, s.addChild({ name: '波妞', startPoints: 150 }).id];
    });
    await q.goto(url + '#shop-' + id);
    await q.waitForSelector('[data-testid=treasure]');
    await q.waitForFunction(() => [...document.querySelectorAll('.treasure-art img')].every((i) => i.complete && i.naturalWidth === 256));
    const cards = await q.$$eval('.treasure-card', (cs) => cs.map((c) => [c.dataset.treasure, c.querySelector('.treasure-price').textContent.trim()]));
    assert.deepEqual(cards, [['skates', '點10 點'], ['shield', '點10 點'], ['magicDice', '點10 點'], ['luckyMedal', '點100 點'], ['wings', '點100 點'], ['starCall', '點50 點'], ['pineHide', '點50 點'], ['door', '點200 點']]);
    assert.equal(await q.evaluate(() => getComputedStyle(document.querySelector('.treasure-art img')).objectFit), 'contain');
    // 兌換防護罩
    await q.click('[data-treasure=shield] [data-action=buy-treasure]');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => /背包 ×1/.test(document.querySelector('[data-treasure=shield]').textContent));
    assert.match(await q.locator('[data-testid=total]').innerText(), /140/);   // 150 − 防護罩 10 點
    assert.match(await q.locator('[data-testid=treasure] h2').innerText(), /本週已兌換 1 \/ 3 件/);
    assert.match(await q.locator('.records').innerText(), /寶物：防護罩[\s\S]*-10/);
    // 再買 2 件 → 本週 3 件，全部按鈕停用並顯示原因
    for (const t of ['skates', 'magicDice']) {
      await q.click('[data-treasure=' + t + '] [data-action=buy-treasure]');
      await q.click('#confirm [data-yes]');
      await q.waitForFunction((t) => /背包 ×1/.test(document.querySelector('[data-treasure=' + t + ']').textContent), t);
    }
    const btns = await q.$$eval('.treasure-buy', (bs) => bs.map((b) => [b.disabled, b.textContent]));
    assert.ok(btns.every(([d, t]) => d && t === '本週已兌換 3 件'), JSON.stringify(btns));
    // 另一位孩子不受影響；點數不足顯示還差幾點
    await q.goto(url + '#shop-' + id2);
    await q.waitForSelector('[data-testid=treasure]');
    assert.equal(await q.locator('[data-treasure=wings] .treasure-buy').isDisabled(), false);
    // 確認視窗快速連點兩下：只兌換一次
    await q.click('[data-treasure=skates] [data-action=buy-treasure]');
    await q.dblclick('#confirm [data-yes]');
    await q.waitForTimeout(300);
    assert.deepEqual(await q.evaluate((cid) => [window.__cgpStore.getTotal(cid), window.__cgpStore.getPlayer(cid).bag.skates], id2), [140, 1], '連點不重複扣點');
    await q.evaluate((cid) => window.__cgpStore.updateChild(cid, { startPoints: 60 }), id2);   // 扣掉溜冰鞋 10 點 → 50 點
    await q.reload(); await q.waitForSelector('[data-testid=treasure]');
    assert.equal(await q.locator('[data-treasure=wings] .treasure-buy').innerText(), '還差 50 點');
    // 冒險大廳的背包
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.settlements.push({ id: 'st', childId: cid, date: s.today(), net: 1, baseStars: 0, bonusStars: 0, stars: 0, paidRecordIds: [], ts: 1 }); s.save(); }, id);   // 直接標記已出發（不新增紀錄）
    await q.goto(url + '#map-' + id);
    await q.waitForSelector('[data-testid=item-bar]');
    assert.match(await q.locator('.dice-btn.skates').innerText(), /×1/);
    assert.deepEqual(await q.$$eval('.item-btn', (els) => els.map((e) => e.dataset.kind)), ['magicDice', 'shield'], '背包道具在地圖道具列');
    // 星星呼喚：背包按一下 → 確認 → 馬上開始一局抓住星星（不占今天的 1 次）
    await q.evaluate((cid) => { const s = window.__cgpStore; s.getPlayer(cid).bag.starCall = 1; s.save(); }, id);
    await q.reload(); await q.waitForSelector('.item-btn[data-kind=starCall]');
    assert.match(await q.locator('.item-btn[data-kind=starCall]').innerText(), /星星呼喚[\s\S]*×1・玩一局/);
    await q.click('.item-btn[data-kind=starCall]');
    assert.match(await q.locator('#confirm').innerText(), /星星呼喚[\s\S]*不占今天的 1 次小遊戲/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('#mg .mg-star.first');
    assert.match(await q.locator('#mg-tip').innerText(), /星星呼喚：額外一局/);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.starCall, id), 0);
    await q.click('#mg [data-mg=later]');
    await q.waitForFunction(() => !document.getElementById('mg'));
    assert.equal(await q.locator('.mg-resume').count(), 1, '稍後再玩：地圖出現繼續按鈕');
    // 撤銷最後一筆兌換 → 收回神奇骰子、退點
    await q.goto(url + '#child-' + id);
    await q.click('[data-action=undo]');
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.magicDice, id), 0);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), 130);   // 150 − 防護罩 10 − 溜冰鞋 10
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0);
    console.log('✔ 寶物商店：6 款商品、兌換扣點進背包、每週 3 件、點數不足原因、背包顯示、撤銷收回道具');
    await c9.close();
  }

  // ---------- 寶物商店 Phase 3：家長密碼、神諭祝福、寶箱庫存 ----------
  {
    const c10 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 780 }, serviceWorkers: 'block' });
    const q = await c10.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const [k1, k2] = await q.evaluate(() => { const s = window.__cgpStore; return [s.addChild({ name: '端端' }).id, s.addChild({ name: '波妞' }).id]; });
    // 第一次進設定 → 設定密碼
    await q.goto(url + '#rules-blessing');
    await q.waitForSelector('[data-testid=pin] #pin-2');
    await q.fill('#pin-1', '1234'); await q.fill('#pin-2', '4321');
    await q.click('[data-action=pin-submit]');
    assert.equal(await q.locator('[data-testid=pin]').count(), 1, '兩次不同不能設定');
    await q.fill('#pin-1', '1234'); await q.fill('#pin-2', '1234');
    await q.click('[data-action=pin-submit]');
    await q.waitForSelector('[data-testid=blessing]');
    assert.equal(await q.locator('.bless-kind').count(), 5);
    await q.waitForFunction(() => [...document.querySelectorAll('.bless-art img')].length === 5 && [...document.querySelectorAll('.bless-art img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 8000 });   // 5 張獎勵圖都載入
    // 送波妞 神秘寶箱 ×2＋鼓勵的話；再送幸運星
    await q.click('.bless-kid:has(input[value="' + k2 + '"])');
    await q.click('.bless-kind:has(input[value=mysteryChest])');
    await q.selectOption('#bless-qty', '2');
    await q.fill('#bless-msg', '今天主動收玩具，好棒！');
    await q.click('[data-action=blessing-send]');
    assert.match(await q.locator('#confirm').innerText(), /波妞[\s\S]*神秘寶箱 ×2[\s\S]*主動收玩具/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.bless-hist li');
    await q.click('.bless-kind:has(input[value=luckyStar])');
    await q.click('[data-action=blessing-send]');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => document.querySelectorAll('.bless-hist li').length === 2);
    assert.match(await q.locator('.bless-hist').innerText(), /幸運星 ×1 → 波妞[\s\S]*神秘寶箱 ×2 → 波妞[\s\S]*主動收玩具/);
    assert.deepEqual(await q.evaluate((id) => [window.__cgpStore.getPlayer(id).bag.giftMysteryChest, window.__cgpStore.getStarBalance(id)], k2), [2, 10]);
    assert.equal(await q.evaluate((id) => window.__cgpStore.getPlayer(id).bag.giftMysteryChest, k1), 0, '端端不受影響');
    // 收回當天送錯的：送一般寶箱 ×1 → 按「收回」→ 背包歸零、紀錄顯示已收回、孩子不會看到
    await q.click('.bless-kind:has(input[value=chest])');
    await q.click('[data-action=blessing-send]');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => document.querySelectorAll('.bless-hist li').length === 3);
    assert.equal(await q.locator('[data-action=blessing-revoke]').count(), 3, '今天送的都可以收回');
    await q.click('.bless-hist li:first-child [data-action=blessing-revoke]');
    assert.match(await q.locator('#confirm').innerText(), /收回[\s\S]*一般寶箱 ×1[\s\S]*還沒用掉/);
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => /已收回 1 份/.test(document.querySelector('.bless-hist li:first-child').textContent));
    assert.equal(await q.locator('.bless-hist li:first-child [data-action=blessing-revoke]').count(), 0, '收回後不能再收');
    assert.equal(await q.evaluate((id) => window.__cgpStore.getPlayer(id).bag.chest, k2), 0);
    console.log('✔ 神諭祝福收回：當天可收回、只收回還沒用掉的、孩子不會看到');
    // 離開設定 → 自動上鎖；錯誤密碼進不去；寫入端也擋
    await q.goto(url + '#home');
    await q.goto(url + '#rules-children');
    await q.waitForSelector('[data-testid=pin] #pin-1');
    assert.equal(await q.locator('#pin-2').count(), 0);
    assert.equal(await q.evaluate(() => { try { window.__cgpStore.sendBlessing(window.__cgpStore.getChildren()[0].id, 'luckyStar', 1); return 'sent'; } catch (e) { return e.message; } }), '需要家長密碼才能執行');
    await q.fill('#pin-1', '0000'); await q.click('[data-action=pin-submit]');
    assert.equal(await q.locator('[data-testid=pin]').count(), 1, '錯誤密碼不能進入');
    // 忘記密碼 → 答對驗證題 → 重設
    await q.click('[data-action=pin-forgot]');
    const qs = await q.locator('.pin-quiz-q').innerText();
    const [x, y] = qs.match(/\d+/g).map(Number);
    await q.fill('#pin-quiz', String(x * y));
    await q.click('[data-action=pin-quiz]');
    await q.fill('#pin-1', '5678'); await q.fill('#pin-2', '5678');
    await q.click('[data-action=pin-submit]');
    await q.waitForSelector('.tabs');
    assert.ok(await q.evaluate(() => window.__cgpStore.checkParentPin('5678')));
    // 孩子端：進冒險大廳看到神諭祝福 → 收下 → 背包開神秘寶箱
    await q.goto(url + '#adventure-' + k2);
    await q.waitForSelector('#confirm .bless-box');
    const bt = await q.locator('#confirm .bless-box').innerText();
    assert.match(bt, /神諭祝福[\s\S]*神秘寶箱 ×2[\s\S]*主動收玩具[\s\S]*幸運星 ×1[\s\S]*\+10 能量星星/);
    assert.equal(await q.locator('#confirm .star-rain i').count(), 10, '幸運星：10 顆星星動畫');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => !document.querySelector('#confirm[open]'));
    await q.reload(); await q.waitForSelector('.map-card');
    assert.equal(await q.locator('#confirm[open]').count(), 0, '收下後不再跳出');
    await q.goto(url + '#map-' + k2); await q.waitForSelector('[data-testid=item-bar]');
    assert.match(await q.locator('.chest-btn[data-kind=giftMysteryChest]').innerText(), /神秘寶箱[\s\S]*×2/);
    await q.evaluate(() => { window.__cgpStore.random = () => 0.5; });
    await q.click('.chest-btn[data-kind=giftMysteryChest]');
    await q.waitForSelector('#confirm .rw.rw-rare');   // 神秘寶箱：稀有版獎勵彈窗
    assert.match(await q.locator('#confirm .rw').innerText(), /稀有獎勵[\s\S]*打開神秘寶箱[\s\S]*×1[\s\S]*已收入冒險背包[\s\S]*收下戰利品/);
    assert.equal(await q.locator('#confirm .rw-extra').count(), 0, '沒有額外獎勵就不顯示');
    assert.equal(await q.locator('#confirm .rw-foot').count(), 0, '開背包寶箱沒有骰子資訊');
    await q.click('#confirm [data-yes]');
    assert.match(await q.locator('.chest-btn[data-kind=giftMysteryChest]').innerText(), /×1/);
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0);
    console.log('✔ 寶物商店 Phase 3：家長密碼（設定、上鎖、錯誤、忘記重設）、神諭祝福發送與紀錄、孩子領取、神秘寶箱開箱');
    await c10.close();
  }

  // ---------- 寶物商店 Phase 4A：地圖上使用道具 ----------
  {
    const c12 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c12.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '端端' });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      Object.assign(s.getPlayer(a.id).bag, { magicDice: 1, rerollTicket: 1, door: 1, wings: 1, luckyMedal: 1, bonusPlay: 1, shield: 1 });
      s.setPlayerTile(a.id, 1); s.save();
      return a.id;
    });
    await q.goto(url + '#map-' + id);
    await q.waitForSelector('[data-testid=item-bar]');
    assert.deepEqual(await q.$$eval('.item-btn', (bs) => bs.map((b) => b.dataset.kind)),
      ['magicDice', 'wings', 'door', 'luckyMedal', 'bonusPlay', 'shield', 'rerollTicket']);
    // 神奇骰子＋命運重骰券：擲出 2 → 重擲 → 6（第 1 格 → 第 7 格，小遊戲）
    await q.evaluate(() => { const seq = [1.5 / 12, 0.5, 5.5 / 12]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0.5); });
    await q.click('.item-btn[data-kind=magicDice]');
    await q.waitForSelector('#confirm .reroll-box', { timeout: 10000 });
    assert.match(await q.locator('#confirm .reroll-box').innerText(), /擲出 2[\s\S]*剩 1 張/);
    await q.evaluate(() => { const seq = [5.5 / 12]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0.5); });
    await q.click('#confirm [data-reroll]');
    await q.waitForSelector('#mg .mg-star.first', { timeout: 10000 });     // 第 7 格：小遊戲
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).pos, id), 7);
    assert.equal(await q.locator('#mg-sec').count(), 1);
    await q.click('#mg [data-mg=later]');
    assert.equal(await q.locator('[data-testid=rolls]').innerText(), '0 / 3', '神奇骰子不占每日次數');
    assert.ok(await q.locator('.item-btn[data-kind=magicDice]').count() === 0, '用完就不顯示');
    // 好運金牌：啟用
    await q.click('.item-btn[data-kind=luckyMedal]');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.medal-on');
    // 再來 3 次：啟用 → 上方顯示額外次數
    await q.click('.item-btn[data-kind=bonusPlay]');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.hud-bonus');
    assert.match(await q.locator('.hud-bonus').innerText(), /\+3/);
    // 任意門：點地圖上的第 12 格（寶箱）→ 傳送，好運金牌讓寶箱效果 2 次
    await q.click('.item-btn[data-kind=door]');
    await q.waitForSelector('.map-view.picking');
    await q.evaluate(() => { window.__cgpStore.random = () => 0.1; });
    const pt = await q.evaluate(() => {
      const view = document.getElementById('map-view').getBoundingClientRect();
      const cand = [...document.querySelectorAll('.mtile')].map((el) => ({ n: +el.dataset.n, r: el.getBoundingClientRect() }))
        .filter((t) => t.n !== 7 && t.n < 100 && t.r.left > view.left + 10 && t.r.right < view.right - 60 && t.r.top > view.top + 10 && t.r.bottom < view.bottom - 10);
      const t = cand.find((c) => c.n === 5) || cand[0];
      return { n: t.n, x: t.r.left + t.r.width / 2, y: t.r.top + t.r.height / 2 };
    });
    await q.mouse.click(pt.x, pt.y);
    assert.match(await q.locator('#confirm').innerText(), new RegExp('傳送到第 ' + pt.n + ' 格'));
    await q.click('#confirm [data-yes]');
    await q.waitForFunction((n) => document.querySelector('[data-testid=pos]').textContent.startsWith(n + ' '), pt.n, { timeout: 10000 });
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.door, id), 0);
    await q.waitForSelector('#confirm[open]', { timeout: 10000 }).catch(() => {});
    if (await q.locator('#confirm[open] [data-yes]').count()) await q.click('#confirm [data-yes]');
    // 飛行翼：前進 20 格（不超過第 100 格）
    const before = await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).pos, id);
    await q.evaluate(() => { window.__cgpStore.random = () => 0.5; });
    await q.click('.item-btn[data-kind=wings]');
    await q.waitForFunction((b) => +document.querySelector('[data-testid=pos]').textContent.split(' ')[0] === Math.min(100, b + 20), before, { timeout: 15000 });
    // 每日上限：任意門今天已用 1 次 → 變灰；飛行翼顯示前進類剩餘次數（合計 5 次）
    await q.evaluate((cid) => { const s = window.__cgpStore; Object.assign(s.getPlayer(cid).bag, { door: 1, wings: 1, skates: 1 }); s.save(); }, id);
    await q.reload(); await q.waitForSelector('[data-testid=item-bar]');
    assert.ok(await q.locator('.item-btn[data-kind=door]').isDisabled(), '任意門每天 1 次，用過就變灰');
    assert.match(await q.locator('.item-btn[data-kind=door]').innerText(), /今天已用/);
    assert.match(await q.locator('.item-btn[data-kind=wings]').innerText(), /今天剩 4 次/);
    await q.evaluate((cid) => { const s = window.__cgpStore; for (let i = 0; i < 4; i++) s._logItem(cid, 'use', 'skates', 1, '測試', ''); s.save(); }, id);
    await q.reload(); await q.waitForSelector('[data-testid=item-bar]');
    assert.ok(await q.locator('.item-btn[data-kind=wings]').isDisabled(), '前進類用滿 5 次：飛行翼變灰');
    assert.ok(await q.locator('.dice-btn.skates').isDisabled(), '溜冰鞋也變灰');
    assert.match(await q.locator('.dice-btn.skates').innerText(), /今天已用完/);
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0);
    console.log('✔ 寶物商店 Phase 4A：前進道具每日 5 次、任意門每日 1 次；道具列、神奇骰子＋命運重骰券、好運金牌、再來 3 次、任意門點選格子、飛行翼');
    await c12.close();
  }

  // ---------- 寶物商店 Phase 4B：地圖神秘寶箱、黃金鑰匙、寶物磁鐵、里程碑 ----------
  {
    const c13 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c13.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '端端' });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      s._addMapChest(a.id, 'milestone');
      Object.assign(s.getPlayer(a.id).bag, { skates: 1, magnet: 1 });
      s.setPlayerTile(a.id, 1); s.random = () => 0; s.save();      // 寶箱出現在前方 2 格（第 3 格）
      return a.id;
    });
    await q.goto(url + '#map-' + id);
    await q.waitForSelector('.map-chest[data-chest="3"]');
    assert.match(await q.locator('#toast').innerText(), /附近似乎藏著神秘寶物/);
    // 寶物磁鐵：列出前後 5 格內的寶箱
    await q.click('.item-btn[data-kind=magnet]');
    await q.waitForSelector('#confirm .magnet-box');
    assert.match(await q.locator('#confirm .magnet-box').innerText(), /第 3 格・神秘寶箱[\s\S]*前方 2 格[\s\S]*第 5 格・一般寶箱/);
    await q.click('#confirm [data-no]');
    // 溜冰鞋經過第 3 格 → 撿到神秘寶箱
    await q.evaluate(() => { window.__cgpStore.random = () => 0.3; });
    await q.click('.dice-btn.skates');
    await q.waitForSelector('#confirm[open]', { timeout: 10000 });
    assert.match(await q.locator('#confirm .ev').innerText(), /冒險新發現！[\s\S]*前進 3 格・停在第 4 格[\s\S]*神秘寶箱 ×1[\s\S]*黃金鑰匙打開[\s\S]*繼續冒險！/);
    await q.click('#confirm [data-yes]');
    assert.equal(await q.locator('.map-chest').count(), 0);
    // 背包：沒有鑰匙打不開；有鑰匙就能開
    await q.waitForSelector('.chest-btn[data-kind=mysteryChest]');
    assert.match(await q.locator('.chest-btn[data-kind=mysteryChest]').innerText(), /要黃金鑰匙/);
    await q.click('.chest-btn[data-kind=mysteryChest]');
    assert.match(await q.locator('#toast').innerText(), /黃金鑰匙/);
    await q.evaluate((cid) => { window.__cgpStore.getPlayer(cid).bag.goldenKey = 1; window.__cgpStore.save(); }, id);
    await q.reload(); await q.waitForSelector('.chest-btn[data-kind=mysteryChest]');
    await q.click('.chest-btn[data-kind=mysteryChest]');
    await q.waitForSelector('#confirm .rw.rw-rare');
    assert.match(await q.locator('#confirm .rw').innerText(), /用掉 1 把黃金鑰匙/);
    await q.click('#confirm [data-yes]');
    // 寶物磁鐵吸走第 5 格一般寶箱 → 地圖上那格的寶箱圖示消失（變普通石板）；新的一輪重新放滿
    await q.evaluate((cid) => { const s = window.__cgpStore; s.getPlayer(cid).bag.magnet = 1; s.random = () => 0.1; s.save(); }, id);
    await q.reload(); await q.waitForSelector('.item-btn[data-kind=magnet]');
    assert.equal(await q.locator('.mtile[data-n="5"].mt-chest').count(), 1);
    await q.click('.item-btn[data-kind=magnet]');
    await q.click('#confirm .magnet-opt[data-id="gold-01-005"]');
    await q.waitForFunction(() => !!document.querySelector('.mtile[data-n="5"].looted'), null, { timeout: 8000 });
    assert.equal(await q.locator('.mtile[data-n="5"].mt-chest').count(), 0, '吸走後寶箱圖示消失');
    assert.equal(await q.locator('.mtile[data-n="5"] .tile-art').count(), 0);
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    await q.evaluate((cid) => { const s = window.__cgpStore; s._newLap(cid); s.save(); }, id);
    await q.reload(); await q.waitForSelector('#pawn');
    assert.equal(await q.locator('.mtile[data-n="5"].mt-chest').count(), 1, '新的一輪寶箱重新出現');
    // 里程碑：累計得分 +500 → 黃金鑰匙（提示訊息）
    await q.evaluate(() => { const s = window.__cgpStore; s.addItem({ kind: 'bonus', name: '超級幫忙', points: 500 }); });
    await q.goto(url + '#child-' + id);
    await q.fill('#score-search', '超級幫忙');
    await q.click('.score-btn:has-text("超級幫忙")');
    await q.waitForFunction(() => /黃金鑰匙/.test(document.getElementById('toast').textContent));
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.goldenKey, id), 1);
    console.log('✔ 寶物商店 Phase 4B：地圖神秘寶箱與提示、經過撿到、寶物磁鐵選單、鑰匙開箱、里程碑黃金鑰匙');
    await c13.close();
  }

  // ---------- Phase 5：結束今日冒險與今日小結 ----------
  {
    const c14 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c14.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '端端' });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 2; s.save();
      return a.id;
    });
    await q.goto(url + '#map-' + id);
    await q.evaluate(() => { const seq = [1.5 / 6]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0.5); });
    await q.click('.dice-btn.d6');
    await q.waitForFunction(() => document.querySelector('[data-testid=pos]').textContent.startsWith('2 '), null, { timeout: 10000 });
    if (await q.locator('#confirm[open] [data-yes]').count()) await q.click('#confirm [data-yes]');
    await q.click('[data-action=end-day]');
    assert.match(await q.locator('#confirm').innerText(), /結束今日冒險[\s\S]*2 次擲骰會作廢[\s\S]*道具會保留/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('#confirm .summary-box');
    const sum = await q.locator('#confirm .summary-box').innerText();
    assert.match(sum, /今天的冒險結束了[\s\S]*今天走了[\s\S]*2 格（第 0 → 2 格）[\s\S]*擲骰[\s\S]*1 次[\s\S]*能量星星[\s\S]*20 顆/);
    await q.click('#confirm [data-yes]');
    assert.equal(await q.locator('.dice-btn.d6').isDisabled(), true, '結束後不能擲骰');
    assert.match(await q.locator('.map-hint').innerText(), /已經結束/);
    assert.equal(await q.locator('[data-action=end-day]').count(), 0);
    // 冒險大廳：顯示已結束，可再看小結
    await q.goto(url + '#adventure-' + id);
    await q.click('.map-card [data-action=show-summary]');
    await q.waitForSelector('#confirm .summary-box');
    assert.match(await q.locator('#confirm .summary-box h2').innerText(), /今日小結/);
    await q.click('#confirm [data-yes]');
    assert.equal(await q.locator('.quick-row').count(), 0, '快速入口已移除');
    assert.equal(await q.locator('[data-testid=bag]').count(), 0, '背包移到地圖');
    assert.equal(await q.locator('.adv-status.ok .settle-log').count(), 1, '結算紀錄在綠底卡內');
    // 設定 → 孩子：解除今天的結束（家長密碼）
    await q.goto(url + '#rules-children');
    await passPin(q);
    await q.click('[data-action=reopen-day]');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction((cid) => !window.__cgpStore.isAdventureEnded(cid), id);
    // 設定 → 孩子：重置今天的次數上限（骰子 3 次等重新計算，道具不退回）
    const rollsBefore = await q.evaluate((cid) => window.__cgpStore.getRollsToday(cid), id);
    assert.ok(rollsBefore > 0, '今天已經擲過骰子');
    await q.click('[data-action=reset-limits]');
    assert.match(await q.locator('#confirm').innerText(), /重置[\s\S]*骰子 3 次、小遊戲 1 次[\s\S]*不會退回/);
    await q.click('#confirm [data-yes]');
    await q.waitForFunction((cid) => window.__cgpStore.getRollsToday(cid) === 0, id);
    assert.match(await q.locator('#toast').innerText(), /已重置/);
    // 設定 → 孩子：重新結算今天（結算後又加 20 分 → 補發 4 星）
    const bal0 = await q.evaluate((cid) => { const s = window.__cgpStore; const it = s.addItem({ kind: 'bonus', name: '補加分', points: 20 }); s.recordItem(cid, it.id); return s.getStarBalance(cid); }, id);
    await q.goto(url + '#rules-children'); await q.reload();
    await passPin(q);
    await q.click('[data-action=resettle-day]');
    assert.match(await q.locator('#confirm').innerText(), /重新結算[\s\S]*補發 ⭐4[\s\S]*只補發差額/);
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(([cid, b]) => window.__cgpStore.getStarBalance(cid) === b + 4, [id, bal0]);
    await q.click('[data-action=resettle-day]');
    assert.match(await q.locator('#confirm').innerText(), /沒有要補發的星星/);
    await q.click('#confirm [data-yes]');
    assert.equal(await q.evaluate(() => { try { window.__cgpStore.lockParent(); window.__cgpStore.reopenAdventure('x'); return 'ok'; } catch (e) { return e.message; } }), '需要家長密碼才能執行');
    await q.evaluate((cid) => { window.__cgpStore.endAdventure(cid); }, id);
    // 重新整理仍然鎖住；任務頁顯示已結束
    await q.goto(url + '#child-' + id); await q.reload();
    assert.match(await q.locator('[data-testid=adventure]').innerText(), /今日冒險已結束/);
    // 機器貓回首頁
    await q.click('.mascot-link');
    await q.waitForSelector('.hero .mascot-link');
    console.log('✔ Phase 5：結束今日冒險（作廢提示、今日小結、當天鎖住、冒險大廳再看小結、重新整理仍鎖住）、機器貓回首頁');
    await c14.close();
  }

  // ---------- 成就與金島通關畫面 ----------
  {
    const c16 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c16.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '端端', startPoints: 1200 });
      const it = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 1; s.setPlayerTile(a.id, 97); s.save();
      return a.id;
    });
    await q.goto(url + '#child-' + id);
    await q.waitForSelector('[data-testid=achievements]');
    assert.match(await q.locator('#toast').innerText(), /解鎖成就[\s\S]*獲得 1000 分/);
    assert.equal(await q.locator('h1, .plaque').first().innerText().then((t) => /小孩/.test(t)), true, '頁面標題改為「小孩」');
    assert.match(await q.locator('.bottom-nav, nav').last().innerText(), /小孩/);
    assert.equal(await q.locator('[data-testid=achievements]').getAttribute('open'), null, '小孩頁面：全部成就預設收起');
    assert.match(await q.locator('[data-testid=achievements] summary').innerText(), /全部成就[\s\S]*已解鎖 5 \/ 27/);   // 冒險開始、獲得 1000 分、抵達水晶礦谷、抵達齒輪工坊、抵達金冠城堡
    assert.match(await q.locator('[data-testid=achievements] summary').innerText(), /最近：/, '摺疊時顯示最近得到的一個成就');
    assert.ok(await q.evaluate(() => { const d = document.querySelector('[data-testid=achievements]').getBoundingClientRect(), n = document.querySelector('[data-testid=achievements]').nextElementSibling.getBoundingClientRect(); return n.top - d.bottom >= 12; }), '和最近紀錄之間留間距，不疊在一起');
    assert.ok(await q.evaluate(() => { const d = document.querySelector('[data-testid=achievements]'), r = [...document.querySelectorAll('.panel h2')].find((x) => /最近紀錄/.test(x.textContent)); return d.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING; }), '在最近紀錄上方');
    // 冒險大廳不再顯示成就
    await q.goto(url + '#adventure-' + id);
    await q.waitForSelector('[data-testid=adventure], .adventure');
    assert.equal(await q.locator('[data-testid=achievements]').count(), 0, '冒險大廳移除成就區');
    // 首頁：最近得到的成就（最近 3 個），點一列進到小孩頁面並展開
    await q.goto(url + '#home');
    await q.waitForSelector('[data-testid=home-achievements]');
    assert.match(await q.locator('[data-testid=home-achievements]').innerText(), /最近得到的成就[\s\S]*端端[\s\S]*5 \/ 27/);
    assert.equal(await q.locator('[data-testid=home-achievements] .ach-mini').count(), 3);
    assert.ok(await q.evaluate(() => { const a = document.querySelector('[data-testid=home-achievements]'), w = document.querySelector('.week-card'); return a.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING; }), '在本週進度上方');
    await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'home-achievements.png') : path.join(require('os').tmpdir(), 'ha.png'), fullPage: true });
    await q.click('[data-action=open-achievements][data-id="' + id + '"]');
    await q.waitForFunction(() => location.hash.startsWith('#child-'));
    await q.waitForSelector('[data-testid=achievements][open]');
    await q.locator('[data-testid=achievements]').screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'achievements.png') : path.join(require('os').tmpdir(), 'ach.png') });
    assert.equal(await q.locator('[data-testid=achievements] .ach').count(), 5, '展開只列已得到的 5 個成就');
    assert.equal(await q.locator('[data-testid=achievements] .ach:not(.done)').count(), 0, '不顯示未達成的成就');
    assert.equal(await q.locator('[data-testid=achievements] .ach-cat h3').count(), 2, '沒有成就的類別（收集）不顯示');
    // 點成就卡：比照得到成就的視窗（我的成就、大徽章、名稱、條件、達成日期、知道了；沒有音效按鈕與煙火）
    await q.click('[data-action=ach-info][data-id=reachR2]');
    await q.waitForSelector('#ach-theater.th-view[open]');
    assert.match(await q.locator('#ach-theater').innerText(), /我的成就[\s\S]*知道了[\s\S]*抵達水晶礦谷[\s\S]*走到第 31 格[\s\S]*達成/);
    assert.match(await q.locator('#ach-theater .th-main img').getAttribute('src'), /badge_reachR2\.webp$/);
    assert.ok((await q.locator('#ach-theater .th-main .badge').boundingBox()).width >= 190, '徽章放大');
    assert.equal(await q.locator('#ach-theater .th-sound, #ach-theater .th-burst, #ach-theater [data-th=collection]').count(), 0);
    if (SHOT_DIR) await q.screenshot({ path: path.join(SHOT_DIR, 'ach-view.png') });
    await q.click('#ach-theater [data-th=close]');
    await q.waitForSelector('#ach-theater', { state: 'detached' });
    // 從第 97 格擲 6：走到第 100 格（全島終點，多的步數捨棄）
    await q.goto(url + '#map-' + id);
    await q.evaluate(() => { window.__cgpStore.random = () => 0.99; });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('.map-fireworks', { state: 'attached', timeout: 10000 });   // 先在城堡門前放煙火彩帶，再顯示全螢幕慶祝
    await q.waitForTimeout(700);
    await q.locator('#map-view').screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'gold-fireworks.png') : path.join(require('os').tmpdir(), 'fw.png') });
    await q.waitForSelector('#clear-screen', { timeout: 10000 });
    assert.equal(await q.locator('.map-fireworks').count(), 0, '煙火結束後移除');
    assert.match(await q.locator('#clear-screen').innerText(), /恭喜通關金島[\s\S]*神秘寶箱 ×1[\s\S]*金島通關/);
    await q.click('#clear-screen [data-clear-ok]');
    await q.waitForFunction(() => !document.getElementById('clear-screen'));
    assert.equal(await q.locator('#pawn').getAttribute('data-tile'), 'gold-04-100');
    assert.match(await q.locator('.map-hint').innerText(), /抵達金冠城堡[\s\S]*新的一輪/);
    assert.match(await q.locator('.legend').innerText(), /全島終點/);
    assert.doesNotMatch(await q.locator('.legend').innerText(), /區域終點/, '全島開放後沒有區域邊界');
    await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'gold-end.png') : path.join(require('os').tmpdir(), 'ge.png') });
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.giftMysteryChest, id), 1);
    assert.ok(await q.evaluate((cid) => window.__cgpStore.getAchievements(cid).find((a) => a.id === 'goldClear1').done, id));
    // 換島：模擬木島開放（複製金島地圖）→ 在終點再擲一次 → 前往木島起點，地圖標題換成木島
    await q.evaluate((cid) => {
      const G = window.CGPGame, g = G.buildGold(), s = window.__cgpStore;
      G.registerBoard('wood', { name: '木島', goalName: '精靈巨樹', totalTiles: 100, world: g.world, regions: g.regions,
        tiles: g.tiles.map((t) => Object.assign({}, t, { id: t.id.replace('gold', 'wood'), regionId: t.regionId.replace('gold', 'wood') })) });
      s.getPlayer(cid).bag.d6 = 1; s.data.adventure.rolls = []; s.random = () => 0.1; s.save();
    }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
    assert.match(await q.locator('.map-hint').innerText(), /下次出發前往「木島」/);
    await q.click('.dice-btn.d6');
    await q.waitForFunction(() => (document.querySelector('#pawn') || {}).dataset && document.querySelector('#pawn').dataset.tile === 'wood-01-001', null, { timeout: 10000 });
    assert.match(await q.locator('.plaque h1').innerText(), /木島/);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).islands.gold.maxReached, id), 100, '金島進度保存');
    console.log('✔ 換島：木島開放後通關金島 → 下一次出發到木島起點、地圖換成木島、金島進度保存');
    console.log('✔ 成就：冒險大廳成就區、解鎖提示、說明；金島通關全螢幕慶祝、第一次通關獎勵與成就');
    await c16.close();
  }

  // ---------- 首頁備份提醒 ----------
  {
    const c15 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block', acceptDownloads: true });
    const q = await c15.newPage();
    await q.clock.setFixedTime(new Date('2026-11-01T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    await q.evaluate(() => window.__cgpStore.addChild({ name: '端端' }));
    await q.reload();
    assert.equal(await q.locator('[data-testid=backup-remind]').count(), 0, '剛開始用不提醒');
    await q.clock.setFixedTime(new Date('2026-11-09T10:00:00'));
    await q.reload();
    await q.waitForSelector('[data-testid=backup-remind]');
    assert.match(await q.locator('[data-testid=backup-remind]').innerText(), /還沒有備份過資料[\s\S]*立即匯出[\s\S]*明天再提醒/);
    const [dl] = await Promise.all([q.waitForEvent('download'), q.click('[data-testid=backup-remind] [data-action=export]')]);
    assert.match(dl.suggestedFilename(), /^child-points-backup-2026-11-09\.json$/);
    await q.waitForFunction(() => !document.querySelector('[data-testid=backup-remind]'));
    // 7 天後再提醒；按「明天再提醒」當天不再出現
    await q.clock.setFixedTime(new Date('2026-11-16T10:00:00'));
    await q.reload();
    await q.waitForSelector('[data-testid=backup-remind]');
    assert.match(await q.locator('[data-testid=backup-remind]').innerText(), /已經 7 天沒有備份了/);
    await q.click('[data-action=snooze-backup]');
    await q.waitForFunction(() => !document.querySelector('[data-testid=backup-remind]'));
    await q.reload();
    assert.equal(await q.locator('[data-testid=backup-remind]').count(), 0);
    console.log('✔ 備份提醒：滿 7 天提醒、立即匯出下載並消失、7 天後再提醒、明天再提醒');
    await c15.close();
  }

  // ---------- 設定：還原資料（每日自動備份、載入備份檔覆蓋） ----------
  {
    const c11 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 780 }, serviceWorkers: 'block' });
    const q = await c11.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const cid = await q.evaluate(() => { const s = window.__cgpStore; const c = s.addChild({ name: '端端', startPoints: 100 }); return c.id; });
    // 清空備份區後重建今天的自動備份（含端端 100 點）；備份放在 IndexedDB
    assert.equal(await q.evaluate(async () => { const s = window.__cgpStore; await s.snapReady; await s._snaps.clear(); s._snapIndex = []; await s.dailySnapshot(); return s._snaps.kind; }), 'indexeddb');
    await q.evaluate((id) => { const s = window.__cgpStore; const it = s.addItem({ kind: 'bonus', name: '加', points: 50 }); s.recordItem(id, it.id); }, cid);
    await q.goto(url + '#rules-backup');
    await passPin(q);
    const first = await q.$$eval('main .card', (cs) => cs[0].dataset.testid);
    assert.equal(first, 'restore', '還原資料在備份頁最上方');
    assert.match(await q.locator('[data-testid=restore]').innerText(), /今天開始時[\s\S]*載入備份檔（覆蓋全部資料）/);
    // 還原到今天開始時（加分前）
    await q.click('[data-testid=restore] .snap-row [data-action=restore-snap]');
    assert.match(await q.locator('#confirm').innerText(), /整個 App 還原[\s\S]*先自動備份/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.snap-row:has-text("還原前的狀態")');
    assert.equal(await q.evaluate((id) => window.__cgpStore.getTotal(id), cid), 100);
    // 再還原回來
    await q.click('.snap-row:has-text("還原前的狀態") [data-action=restore-snap]');
    await q.click('#confirm [data-yes]');
    await q.waitForFunction((id) => window.__cgpStore.getTotal(id) === 150, cid);
    // 刪除不要的備份：刪掉「還原前的狀態」，目前資料不變
    await q.waitForSelector('.snap-row:has-text("還原前的狀態")');
    const nSnap = await q.locator('.snap-row').count();
    await q.click('.snap-row:has-text("還原前的狀態") [data-action=delete-snap]');
    assert.match(await q.locator('#confirm').innerText(), /刪除[\s\S]*目前的資料不受影響/);
    await q.click('#confirm [data-yes]');
    await q.waitForFunction((n) => document.querySelectorAll('.snap-row').length === n - 1, nSnap);
    await q.waitForFunction(() => /已刪除這份備份/.test(document.getElementById('toast').textContent));   // 等刪除完成、畫面重新整理後再操作
    assert.equal(await q.evaluate((id) => window.__cgpStore.getTotal(id), cid), 150, '刪除備份不影響目前資料');
    // 載入備份檔覆蓋全部資料
    const f = path.join(require('os').tmpdir(), 'cgp-restore-' + Date.now() + '.json');
    fs.writeFileSync(f, JSON.stringify({ children: [{ id: 'x1', name: '波妞', startPoints: 9 }] }));
    await q.setInputFiles('input[data-action=import]', f);
    await q.waitForFunction(() => /取代目前所有資料[\s\S]*先自動備份/.test(document.getElementById('confirm').textContent));   // 讀檔是非同步的
    await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => window.__cgpStore.getChildren().map((c) => c.name).join() === '波妞');
    console.log('✔ 還原資料：備份頁最上方、還原到今天開始時、可再還原回來、載入備份檔覆蓋前自動備份');
    await c11.close();
  }

  // ---------- 冒險大廳：依孩子所在島嶼輪換地圖關卡卡插圖 ----------
  {
    const c5 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width: 360, height: 800 }, serviceWorkers: 'block' });
    const q = await c5.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const ids = await q.evaluate(() => {
      const s = window.__cgpStore;
      return [s.addChild({ name: '丙' }).id, s.addChild({ name: '丁' }).id];
    });
    const art = async () => {
      await q.locator('.map-card .map-art img').scrollIntoViewIfNeeded();
      await q.waitForFunction(() => { const i = document.querySelector('.map-card .map-art img'); return i && i.complete && i.naturalWidth > 0; });
      return q.evaluate(() => ({
        island: document.querySelector('.map-card').dataset.island,
        src: document.querySelector('.map-card .map-art img').currentSrc.replace(location.origin + location.pathname.replace(/[^/]*$/, ''), ''),
        w: document.querySelector('.map-card .map-art img').naturalWidth,
        dots: [...document.querySelectorAll('.island-dots .dot.active')].map((d) => d.dataset.island)
      }));
    };
    // 預設在金島
    await q.goto(url + '#adventure-' + ids[0]);
    assert.deepEqual(await art(), { island: 'gold', src: 'images/gold-island.webp', w: 1200, dots: ['gold'] });
    const setIsland = (cid, island) => q.evaluate(([cid, island]) => {
      const s = window.__cgpStore; s.getPlayer(cid).island = island; s.save();
    }, [cid, island]);
    for (const island of ['wood', 'water', 'fire', 'earth', 'gold']) {
      await setIsland(ids[0], island);
      await q.reload();
      const a = await art();
      assert.equal(a.island, island);
      assert.equal(a.src, island === 'gold' ? 'images/gold-island.webp' : 'images/islands/' + island + '.webp', island + ' 插圖');
      assert.equal(a.w, 1200);
      assert.deepEqual(a.dots, [island], island + ' 圓點');
      if (SHOT_DIR) await q.locator('.map-card').screenshot({ path: path.join(SHOT_DIR, '19-island-' + island + '.png') });
    }
    // 每個孩子各自依所在島嶼顯示
    await setIsland(ids[0], 'fire');
    await setIsland(ids[1], 'water');
    await q.goto(url + '#adventure-' + ids[0]); await q.reload();
    assert.equal((await art()).island, 'fire');
    await q.goto(url + '#adventure-' + ids[1]);
    assert.equal((await art()).island, 'water');
    // 未知島嶼代號 → 退回金島
    await setIsland(ids[1], 'unknown'); await q.reload();
    assert.equal((await art()).island, 'gold');
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, '冒險大廳出現橫向捲動');
    console.log('✔ 冒險大廳依所在島嶼輪換插圖：金／木／水／火／土、各孩子獨立、未知代號退回金島');
    await c5.close();
  }

  // ---------- 道具圖示：商店、背包（道具列）圖片載入、contain 不變形、價格與效果不變 ----------
  for (const width of [360, 430]) {
    const c4 = await browser.newContext({ ...devices['Pixel 5'], viewport: { width, height: 800 }, serviceWorkers: 'block' });
    const q = await c4.newPage();
    await q.clock.setFixedTime(new Date('2026-11-06T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore;
      const a = s.addChild({ name: '乙' });
      const b = s.addItem({ kind: 'bonus', name: '大加分', points: 100 });
      s.recordItem(a.id, b.id);
      s.recordItem(a.id, b.id);
      return a.id;
    });
    await q.goto(url + '#child-' + id);
    await q.click('[data-action=enter-adventure]');
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('.map-cta[href]');
    await q.click('.map-cta[href]');
    await q.waitForSelector('#pawn');
    assert.equal((await q.locator('[data-testid=stars]').innerText()).trim(), '40');

    // 圖片載入、正方形、object-fit: contain、白色圖示框、手機上至少 48px
    const checkArt = async (sel, label) => {
      const info = await q.$$eval(sel, (els) => els.map((img) => {
        const box = img.parentElement.getBoundingClientRect();
        return { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth === 256 && img.naturalHeight === 256,
          fit: getComputedStyle(img).objectFit, bg: getComputedStyle(img.parentElement).backgroundColor, w: box.width, h: box.height };
      }));
      assert.deepEqual(info.map((i) => i.src).slice(0, 3), ['images/items/dice_6.webp', 'images/items/dice_12.webp', 'images/items/roller_skate.webp'], label + ' 圖片對應');
      for (const i of info) {
        assert.ok(i.ok, label + ' 圖片載入失敗：' + i.src);
        assert.equal(i.fit, 'contain', label + ' 應使用 contain');
        assert.equal(i.bg, 'rgb(255, 255, 255)', label + ' 應為白色圖示框');
        assert.ok(i.w >= 48 && Math.abs(i.w - i.h) < 1, label + ' 圖示框應為正方形且夠大：' + i.w + '×' + i.h);
      }
    };
    await q.waitForFunction(() => [...document.querySelectorAll('.dice-bar img')].every((i) => i.complete && i.naturalWidth));
    await checkArt('.dice-bar .item-art img', '道具列');
    const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, '道具列 ' + width + 'px 出現橫向捲動');

    // 商店：圖示＋名稱＋價格；價格 5／10／4 星不變
    await q.click('[data-action=open-shop]');
    await q.waitForFunction(() => [...document.querySelectorAll('#confirm .shop-row img')].every((i) => i.complete && i.naturalWidth));
    await checkArt('#confirm .shop-row .item-art img', '商店');
    const prices = await q.$$eval('#confirm [data-buy]', (bs) => bs.map((b) => b.getAttribute('data-buy') + b.textContent.trim()));
    assert.deepEqual(prices, ['d6⭐5', 'd12⭐10', 'skates⭐4', 'goldenKey⭐10', 'magnet⭐10']);
    assert.match(await q.locator('#confirm [data-item=d12]').innerText(), /12 面骰/);
    if (SHOT_DIR) await q.locator('#confirm .shop-box').screenshot({ path: path.join(SHOT_DIR, '17-shop-items-' + width + '.png') });
    await q.click('#confirm [data-buy=d12]');
    assert.match(await q.locator('.shop-bal').innerText(), /目前有\s*30\b/);
    await q.click('#confirm [data-buy=skates]');
    assert.match(await q.locator('.shop-bal').innerText(), /目前有\s*26\b/);
    assert.match(await q.locator('#confirm [data-item=skates]').innerText(), /背包 ×1/);
    await q.click('#confirm [data-no]');
    assert.equal((await q.locator('[data-testid=stars]').innerText()).trim(), '26');
    assert.match(await q.locator('.dice-btn.d12').innerText(), /×1/);
    assert.match(await q.locator('.dice-btn.skates').innerText(), /×1/);
    assert.ok(await q.locator('.dice-btn.d6').isDisabled(), '沒有 6 面骰時不可按');
    if (SHOT_DIR) await q.locator('.dice-bar').screenshot({ path: path.join(SHOT_DIR, '18-dice-bar-' + width + '.png') });

    // 溜冰鞋：前進 3 格、不算擲骰次數、背包 -1（第 3 格是機會格，固定抽到「發現礦石 +2 星」）
    await q.evaluate(() => { window.__cgpStore.random = () => 0.3; });   // 5 種機會卡：0.3 → 發光礦石
    await q.click('.dice-btn.skates');
    await q.waitForFunction(() => document.querySelector('[data-testid=pos]') && document.querySelector('[data-testid=pos]').textContent.startsWith('3 '), null, { timeout: 8000 });
    await q.waitForSelector('.dice-btn.skates[disabled]');
    assert.equal(await q.locator('[data-testid=rolls]').innerText(), '0 / 3');
    assert.match(await q.locator('.dice-btn.skates').innerText(), /×0/);
    assert.equal((await q.locator('[data-testid=stars]').innerText()).trim(), '28');
    await checkArt('.dice-bar .item-art img', '使用後道具列');
    console.log('✔ 道具圖示 ' + width + 'px：商店與道具列圖片載入、contain、白框、價格 5／10／4、溜冰鞋前進 3 格不算擲骰');
    await c4.close();
  }

  // ---------- 金島第一區地圖：手機顯示、對齊、逐格移動、重新整理恢復、舊存檔遷移、第 30 格停止 ----------
  {
    const REGION = require('../js/board-gold.js');
    const REGION02 = require('../js/board-gold-02.js');
    const REGION03 = require('../js/board-gold-03.js');
    const REGION04 = require('../js/board-gold-04.js');
    for (const width of [360, 390, 430]) {
      const cx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const q = await cx.newPage();
      q.on('pageerror', (e) => errors.push(e.message));
      await q.goto(url);
      const id = await q.evaluate(() => {
        const s = window.__cgpStore;
        const a = s.addChild({ name: '甲' });
        s.addChild({ name: '乙' });
        const b = s.addItem({ kind: 'bonus', name: '大加分', points: 200 });
        s.recordItem(a.id, b.id); s.settleToday(a.id);
        s.getPlayer(a.id).bag.d6 = 6; s.getPlayer(a.id).bag.d12 = 2; s.save();
        return a.id;
      });
      await q.goto(url + '#map-' + id);
      await q.waitForSelector('#map-world img.map-bg');
      await q.waitForFunction(() => document.querySelector('#map-world img.map-bg').complete);
      // 頁面不橫向溢出（地圖內部拖曳除外）
      const over = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, width + 'px 不可橫向溢出');
      // 背景保持 4:5、不裁切
      const bgRatio = await q.evaluate(() => { const r = document.querySelector('.map-bg').getBoundingClientRect(); return r.width / r.height; });
      assert.ok(Math.abs(bgRatio - 0.8) < 0.002, '背景維持 4:5');
      // 格子事件圖示：圖片載入、contain、白框；角色在起點時起點旗讓位
      await q.waitForFunction(() => [...document.querySelectorAll('.map-world .tile-art img, .legend img')].every((i) => i.complete && i.naturalWidth === 192));
      const arts = await q.evaluate(() => {
        const z = (el) => el.getBoundingClientRect().width;
        const icons = [...document.querySelectorAll('.map-world .tile-art')];
        return {
          types: icons.map((el) => (el.closest('.mtile') ? el.closest('.mtile').className.match(/mt-(\w+)/)[1] : 'start')),
          fit: [...new Set(icons.map((el) => getComputedStyle(el.querySelector('img')).objectFit))],
          bg: [...new Set(icons.map((el) => getComputedStyle(el).backgroundColor))],
          px: Math.round(z(document.querySelector('.mt-chest .tile-art')) * 10) / 10,
          legend: [...document.querySelectorAll('.legend img')].map((i) => i.getAttribute('src').split('/').pop()),
          startHere: document.querySelector('.mstart').classList.contains('here')
        };
      });
      const count = (t) => arts.types.filter((x) => x === t).length;
      assert.deepEqual([count('start'), count('chest'), count('chance'), count('fate'), count('minigame'), count('boundary'), count('end')], [1, 15, 16, 12, 11, 0, 1], '格子圖示數量（第一～四區；第 100 格為全島終點旗）');
      assert.deepEqual(arts.fit, ['contain']); assert.deepEqual(arts.bg, ['rgb(255, 255, 255)']);
      assert.deepEqual(arts.legend, ['chest.webp', 'chance.webp', 'fate.webp', 'minigame.webp', 'finish.webp'], '全島開放：圖例顯示全島終點旗');
      assert.ok(arts.startHere, '角色在起點：起點旗讓位');
      console.log('  ・' + width + 'px 預設縮放：格子圖示約 ' + arts.px + 'px');
      // 30 格依 JSON 座標、與背景同一縮放：比對畫面位置
      async function checkAlign(label) {
        const m = await q.evaluate(() => {
          const bg = document.querySelector('.map-bg').getBoundingClientRect();
          const tiles = [...document.querySelectorAll('.mtile')].map(el => {
            const r = el.getBoundingClientRect();
            return { n: +el.dataset.n, cx: (r.left + r.width / 2 - bg.left) / bg.width, cy: (r.top + r.height / 2 - bg.top) / bg.height, w: r.width };
          });
          const pawn = document.getElementById('pawn'), pr = pawn.querySelector('img').getBoundingClientRect();
          const tile = document.querySelector('.mtile[data-n="' + pawn.dataset.pos + '"]');
          return { tiles, bgw: bg.width, pawnW: pr.width, pawnFeet: { x: pr.left + pr.width / 2, y: pr.bottom },
            tileC: tile ? (() => { const r = tile.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })() : null };
        });
        assert.equal(m.tiles.length, 100, label + '：100 格（第一～四區）');
        for (const t of m.tiles) {
          // 對照第一區背景：1～30 格用第一區 JSON；31～55 格用長地圖總覽座標換算（y 以第一區背景上緣為 0，第二區在其上方為負值）
          const j = t.n <= 30 ? REGION.tiles[t.n - 1] : (() => { const r = t.n <= 55 ? REGION02.tiles[t.n - 31] : t.n <= 80 ? REGION03.tiles[t.n - 56] : REGION04.tiles[t.n - 81]; return { x: r.gx / 1080, y: (r.gy - 4050) / 1350 }; })();
          assert.ok(Math.abs(t.cx - j.x) * m.bgw < 1.5 && Math.abs(t.cy - j.y) * m.bgw * 1.25 < 1.5, label + '：第 ' + t.n + ' 格對齊座標');
        }
        const tileW = m.tiles[0].w;
        if (m.tileC) {
          assert.ok(Math.abs(m.pawnFeet.x - m.tileC.x) < 2, label + '：角色水平對齊格子中心');
          assert.ok(Math.abs(m.pawnFeet.y - m.tileC.y) < tileW * 0.25, label + '：角色腳底在格子中心');
        }
        assert.ok(m.pawnW < tileW * 1.2, label + '：角色寬度不超過約一格，不擋相鄰多格');
        return tileW;
      }
      const tw = await checkAlign(width + 'px 預設');
      assert.ok(tw >= 30, width + 'px：格子在手機上至少 30px 寬（實際 ' + tw.toFixed(1) + 'px）');
      await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'region-' + width + '.png') : path.join(require('os').tmpdir(), 'r.png') });
      // 縮放後仍對齊
      await q.click('[data-map=in]'); await q.waitForTimeout(100);
      await checkAlign(width + 'px 放大');
      await q.click('[data-map=out]'); await q.click('[data-map=out]'); await q.click('[data-map=out]'); await q.waitForTimeout(100);
      await checkAlign(width + 'px 縮小');
      // 拖曳地圖
      const vb = await q.locator('#map-view').boundingBox();
      await q.mouse.move(vb.x + vb.width / 2, vb.y + vb.height / 2); await q.mouse.down();
      await q.mouse.move(vb.x + vb.width / 2 + 40, vb.y + vb.height / 2 + 60, { steps: 4 }); await q.mouse.up();
      await checkAlign(width + 'px 拖曳後');

      if (width === 390) {
        // 逐格移動：擲 4 → 1、2、3、4（起點在第 1 格前的沙灘）
        await q.click('[data-map=follow]');
        await q.evaluate(() => { const seq = [3.5 / 6]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
        const seen = [];
        await q.exposeFunction('__seenTile', (v) => seen.push(v));
        await q.evaluate(() => new MutationObserver(() => window.__seenTile(document.getElementById('pawn').dataset.tile))
          .observe(document.getElementById('pawn'), { attributes: true, attributeFilter: ['data-tile'] }));
        await q.click('[data-action=roll][data-kind=d6]');
        await q.waitForFunction(() => document.querySelector('[data-testid=pos]').textContent.startsWith('4 '), null, { timeout: 8000 });
        assert.deepEqual(seen.slice(0, 4), ['gold-01-001', 'gold-01-002', 'gold-01-003', 'gold-01-004'], '依序逐格移動');
        if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
        await checkAlign('移動後');
        // 重新整理恢復位置（以穩定格子 ID 保存）
        const saved = await q.evaluate((cid) => JSON.parse(localStorage.getItem('cgp-data')).adventure.players[cid].tileId, id);
        assert.equal(saved, 'gold-01-004');
        await q.reload(); await q.waitForSelector('#pawn');
        assert.equal(await q.locator('#pawn').getAttribute('data-tile'), 'gold-01-004', '重新整理後恢復位置');
        assert.deepEqual(await q.$$eval('.map-world .here', (els) => els.map((e) => e.dataset.tile)), ['gold-01-004'], '只有角色所在格標記 here');
        await checkAlign('重新整理後');
        // 舊存檔只有整數格號 → 遷移成穩定 ID
        await q.evaluate((cid) => {
          const d = JSON.parse(localStorage.getItem('cgp-data'));
          delete d.adventure.players[cid].tileId; d.adventure.players[cid].pos = 12;
          localStorage.setItem('cgp-data', JSON.stringify(d));
        }, id);
        await q.reload(); await q.waitForSelector('#pawn');
        assert.equal(await q.locator('#pawn').getAttribute('data-tile'), 'gold-01-012', '舊整數格號遷移');
        assert.equal(await q.locator('[data-testid=pos]').innerText(), '12 / 100');
        // 第 100 格（全島終點）安全停止：從第 97 格擲 12，只走到 100，多餘步數捨棄
        await q.evaluate((cid) => { const s = window.__cgpStore; s.setPlayerTile(cid, 97); s.save(); }, id);
        await q.reload(); await q.waitForSelector('#pawn');
        await q.evaluate(() => { window.__cgpStore.random = () => 0.99; }); // 重新整理後才固定亂數（擲出 12）
        await q.click('[data-action=roll][data-kind=d12]');
        await q.waitForSelector('#clear-screen', { timeout: 8000 });
        assert.match(await q.locator('#clear-screen').innerText(), /恭喜通關金島/);
        await q.click('#clear-screen [data-clear-ok]');
        await q.waitForFunction(() => !document.getElementById('clear-screen'));
        assert.equal(await q.locator('#pawn').getAttribute('data-tile'), 'gold-04-100');
        assert.match(await q.locator('.map-hint').innerText(), /從起點開始新的一輪/);
        assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.d12, id), 1, '只扣一顆骰子');
        await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'region-end.png') : path.join(require('os').tmpdir(), 'r2.png') });
      }
      await cx.close();
      console.log('✔ 金島第一～四區地圖 ' + width + 'px：100 格對齊、縮放拖曳、不橫向溢出' + (width === 390 ? '、逐格移動、重新整理恢復、舊存檔遷移、第 100 格通關停止' : ''));
    }
  }

  // ---------- 金島劇情：第 5 格礦工求助、第 30 格礦車轉轍；機會卡礦車上車 ----------
  {
    const cs = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block', story: true });
    const q = await cs.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => { const s = window.__cgpStore; const a = s.addChild({ name: '波妞' }); const it = s.addItem({ kind: 'bonus', name: '大', points: 100 }); s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 5; s.setPlayerTile(a.id, 3); s.save(); return a.id; });
    await q.goto(url + '#map-' + id);
    await q.waitForSelector('.story-guide[data-story=ore] .story-bang');
    assert.equal(await q.locator('.story-guide[data-story=rail]').count(), 1, '兩個劇情點都有技師導遊');
    await q.click('.story-guide[data-story=ore]', { force: true });   // 點技師：提示要去哪一格
    await q.waitForSelector('#tech-bubble');
    assert.match(await q.locator('#tech-bubble').innerText(), /第 5 格/);
    const stars0 = await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id);
    // 擲 2 → 第 5 格：鏡頭移過去、技師說明、撿回 5 顆礦石
    await q.evaluate(() => { window.__cgpStore.random = () => 1.5 / 6; });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('.story-ore', { timeout: 15000 });
    assert.equal(await q.locator('.story-ore').count(), 5);
    assert.match(await q.locator('#story-panel').innerText(), /撿回金礦石[\s\S]*0 \/ 5/);
    // 回歸：撿到一半點商店 → 任務中商店不能開；切到別頁再回來，沒撿的礦石還在、可以接著撿完
    await q.locator('.story-ore').first().evaluate((o) => o.scrollIntoView({ block: 'center' }));   // 底部導覽列較高：先捲到畫面中間再點，避免點到導覽列
    await q.locator('.story-ore').first().click({ force: true });
    await q.click('.map-shop', { force: true });
    await q.waitForTimeout(300);
    assert.equal(await q.locator('#confirm[open]').count(), 0, '任務進行中商店不會打開');
    assert.equal(await q.locator('body.story-on').count(), 1);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    await q.waitForFunction(() => document.querySelectorAll('#map-world .story-ore:not(.got)').length === 4, null, { timeout: 5000 });
    assert.match(await q.locator('#story-panel').innerText(), /1 \/ 5/);
    for (const o of await q.$$('.story-ore:not(.got)')) { await o.evaluate((x) => x.scrollIntoView({ block: 'center' })); await o.click({ force: true }); }
    await q.waitForFunction(() => /礦石都找回來了[\s\S]*⭐3/.test((document.getElementById('tech-bubble') || {}).textContent || ''), null, { timeout: 8000 });
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 15000 });
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    assert.ok(await q.evaluate((cid) => !!window.__cgpStore.getPlayer(cid).story.ore, id));
    assert.ok(await q.evaluate(([cid, s0]) => window.__cgpStore.getStarBalance(cid) >= s0 + 3, [id, stars0]), '完成任務得到 ⭐3');
    assert.equal(await q.locator('.story-guide[data-story=ore]').count(), 0, '完成後導遊離開');
    // 第 30 格：拉下轉轍器
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, 27); s.save(); }, id);
    await q.reload(); await q.waitForSelector('.story-guide[data-story=rail]');
    await q.evaluate(() => { window.__cgpStore.random = () => 2.5 / 6; });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#pull-lever', { timeout: 15000 });
    assert.equal(await q.locator('#story-btn').count(), 0, '改成拖曳拉桿，不是按鈕');
    const lv = await q.locator('#pull-handle').boundingBox();
    const cx = lv.x + lv.width / 2, cy = lv.y + lv.height / 2;
    // 只拉一半就放開：彈回去、沒有觸發
    await q.mouse.move(cx, cy); await q.mouse.down(); await q.mouse.move(cx, cy + 40, { steps: 5 }); await q.mouse.up();
    await q.waitForTimeout(400);
    assert.equal(await q.locator('#pull-lever').getAttribute('aria-valuenow'), '0', '沒拉到底會彈回');
    assert.equal(await q.locator('#story-lever.pulled').count(), 0);
    // 拉到底：觸發礦車
    assert.match(await q.locator('#story-panel').innerText(), /礦車卡住了/);
    assert.equal(await q.locator('#scene-art.solved').count(), 0, '拉之前是「出問題」的圖');
    await q.mouse.move(cx, cy); await q.mouse.down(); await q.mouse.move(cx, cy + 130, { steps: 8 }); await q.mouse.up();
    await q.waitForSelector('#story-lever.pulled');
    await q.waitForSelector('#scene-art.solved', { timeout: 5000 });   // 同一個視窗換成「問題解決」的圖
    assert.match(await q.locator('#story-panel').innerText(), /軌道接通了[\s\S]*太好了/);
    assert.equal(await q.locator('.story-cart').count(), 0, '地圖上不再放礦車動畫');
    await q.click('#scene-ok');
    await q.waitForFunction(() => /軌道接通了/.test((document.getElementById('tech-bubble') || {}).textContent || ''), null, { timeout: 8000 });
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 15000 });
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    assert.ok(await q.evaluate((cid) => !!window.__cgpStore.getPlayer(cid).story.rail, id));
    // 劇情完成後再進地圖：導遊不再出現
    await q.reload(); await q.waitForSelector('#pawn');
    assert.equal(await q.locator('.story-guide').count(), 0);
    // 機會卡礦車：先按「上車！」才前進（第 3 格機會格：從第 1 格擲 2，機會卡抽到礦車）
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, 1); s.save(); }, id);
    await q.reload(); await q.waitForSelector('#pawn');
    await q.evaluate(() => { const seq = [1.5 / 6, 0]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#cart-panel', { timeout: 10000 });
    assert.match(await q.locator('#cart-panel').innerText(), /礦車來了[\s\S]*上車/);
    assert.equal(await q.locator('#pawn').getAttribute('data-pos'), '3', '按上車前還在機會格');
    await q.click('#cart-btn');
    await q.waitForFunction(() => document.getElementById('pawn').dataset.pos === '5', null, { timeout: 8000 });
    console.log('✔ 金島劇情：技師導遊提示、第 5 格撿礦石、第 30 格拉轉轍器、各 ⭐3、不重複；機會卡礦車按上車才前進');
    await cs.close();
  }

  // ---------- 木島劇情「森林派對」（用測試假地圖：複製金島格子當木島）：小精靈導遊、第 8 格找松果、第 40 格採花摘莓果、第 65 格邀請卡、第 92 格布置派對 ----------
  {
    const cw = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block', story: true });
    const q = await cw.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => {
      const G = window.CGPGame, g = G.buildGold(), s = window.__cgpStore;
      G.registerBoard('wood', { name: '木島', goalName: '精靈巨樹', totalTiles: 100, world: g.world, regions: g.regions,
        tiles: g.tiles.map((t) => Object.assign({}, t, { id: t.id.replace('gold', 'wood'), regionId: t.regionId.replace('gold', 'wood') })) });
      const a = s.addChild({ name: '波妞' }); const it = s.addItem({ kind: 'bonus', name: '大', points: 100 }); s.recordItem(a.id, it.id); s.settleToday(a.id);
      const p = s.getPlayer(a.id); p.island = 'wood'; p.tileId = 'wood-01-006'; p.bag.d6 = 5; s.save(); return a.id; });
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);   // 用 hash 換頁，保留假地圖
    await q.waitForSelector('.story-guide.wood-elf[data-story=pinecone] .story-bang');
    assert.match(await q.locator('.plaque h1').innerText(), /木島/);
    assert.equal(await q.locator('.wood-elf').count(), 4, '四個任務都有小精靈導遊');
    assert.equal(await q.locator('.gold-tech').count(), 0, '木島沒有金島技師');
    await q.click('.story-guide[data-story=pinecone]', { force: true });
    await q.waitForSelector('#tech-bubble');
    assert.match(await q.locator('#tech-bubble').innerText(), /第 8 格/);
    const stars0 = await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id);
    // 擲 2 → 第 8 格：落葉找松果（劇情版：25 堆、看 3 秒、找齊 5 顆，翻錯不會失敗）
    await q.evaluate(() => { window.__cgpStore.random = () => 1.5 / 6; });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#mg.leaf-mg [data-leaf=start]', { timeout: 15000 });
    assert.match(await q.locator('#mg-tip').innerText(), /找回松果/);
    assert.equal(await q.locator('#leaf-msg').isVisible(), false, '開始前提示框是空的，不顯示白色小圓點');
    assert.equal(await q.locator('#mg-tip [data-mg=later]').count(), 0, '劇情版不能稍後再玩');
    await q.click('[data-leaf=start]');
    assert.equal(await q.locator('.leaf-pile').count(), 25);
    assert.equal(await q.locator('.leaf-pile[data-pine]').count(), 5);
    assert.equal(await q.locator('.leaf-pile[data-squirrel]').count(), 2, '2 隻松鼠干擾物');
    assert.equal(await q.locator('.leaf-grid.peek').count(), 1, '先亮出松果位置');
    assert.ok(await q.evaluate(() => [...document.querySelectorAll('.leaf-pile')].every((p) => getComputedStyle(p.querySelector('.leaf-under')).opacity === '1')), '先看時 25 堆全部掀開（松果、松鼠、泥土都看得到）');
    assert.match(await q.locator('#leaf-msg').innerText(), /記住松果的位置/);
    await q.waitForSelector('.leaf-grid:not(.peek)', { timeout: 6000 });
    for (let k = 0; k < 4; k++) await q.locator('.leaf-pile:not([data-pine]):not([data-squirrel])').nth(k).click();   // 翻錯 4 次也不會失敗
    assert.equal(await q.locator('.leaf-pile.empty').count(), 4);
    await q.locator('.leaf-pile[data-squirrel]').first().click();   // 翻到松鼠：提示、劇情版不會失敗
    assert.match(await q.locator('#leaf-msg').innerText(), /松鼠在吃松果/);
    assert.equal(await q.locator('.leaf-pile.caught').count(), 1);
    for (const o of await q.$$('.leaf-pile[data-pine]')) await o.click();
    await q.waitForFunction(() => /松果都找回來了[\s\S]*⭐3/.test((document.getElementById('tech-bubble') || {}).textContent || ''), null, { timeout: 8000 });
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 15000 });
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    assert.ok(await q.evaluate(([cid, s0]) => window.__cgpStore.getStarBalance(cid) >= s0 + 3 && !!window.__cgpStore.getPlayer(cid).story.pinecone, [id, stars0]), '完成松果任務 ⭐3');
    assert.equal(await q.locator('.story-guide[data-story=pinecone]').count(), 0, '完成後小精靈離開');
    // 第 40 格：採花摘莓果（視窗：點 5 朵花＋5 顆莓果，飛進籃子）
    const SD = process.env.SHOT_DIR;
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, 38); s.random = () => 1.5 / 6; s.save(); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
    await q.waitForSelector('.story-guide.wood-elf[data-story=flowers] img');
    await q.click('.dice-btn.d6');
    await q.waitForSelector('.party-panel .meadow-item', { timeout: 15000 });
    assert.match(await q.locator('#story-panel').innerText(), /採花摘莓果[\s\S]*🌸 0 \/ 5[\s\S]*🍓 0 \/ 5/);
    assert.equal(await q.locator('.meadow-flower').count(), 5); assert.equal(await q.locator('.meadow-berries').count(), 5);
    if (SD) await q.locator('#story-panel').screenshot({ path: path.join(SD, 'party-40.png') });
    for (const it of await q.$$('.meadow-item')) await it.click({ force: true });
    await q.waitForSelector('#scene-ok', { timeout: 5000 });
    assert.match(await q.locator('#story-panel').innerText(), /籃子裝滿了/);
    await q.click('#scene-ok');
    await q.waitForFunction(() => /好漂亮的花和莓果/.test((document.getElementById('tech-bubble') || {}).textContent || ''), null, { timeout: 8000 });
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 15000 });
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    assert.ok(await q.evaluate((cid) => !!window.__cgpStore.getPlayer(cid).story.flowers, id));
    // 第 65 格：做邀請卡（拖曳花瓣、樹葉到卡片上，6 個以上）→ 送給兔子、刺蝟、貓頭鷹
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, 63); s.random = () => 1.5 / 6; s.save(); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
    await q.waitForSelector('.story-guide[data-story=invite]');
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#invite-area', { timeout: 15000 });
    assert.ok(await q.locator('#invite-done').isDisabled(), '還沒貼滿 6 個不能完成');
    const area = await q.locator('#invite-area').boundingBox();
    for (let k = 0; k < 4; k++) {   // 拖曳 4 個貼紙到卡片上
      const src = await q.locator(k % 2 ? '.sticker-src[data-sticker=leaf]' : '.sticker-src[data-sticker=petal]').boundingBox();
      await q.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await q.mouse.down();
      await q.mouse.move(area.x + area.width * (0.25 + k * 0.15), area.y + area.height * 0.5, { steps: 6 }); await q.mouse.up();
    }
    // 拖到卡片外面：不會貼上
    const src0 = await q.locator('.sticker-src[data-sticker=petal]').boundingBox();
    await q.mouse.move(src0.x + 20, src0.y + 20); await q.mouse.down(); await q.mouse.move(src0.x + 20, src0.y - 5, { steps: 4 }); await q.mouse.move(5, 5, { steps: 4 }); await q.mouse.up();
    assert.equal(await q.locator('.card-sticker').count(), 4, '拖到卡片外面不算');
    await q.click('.sticker-src[data-sticker=petal]'); await q.click('.sticker-src[data-sticker=leaf]');   // 點一下也會貼上
    assert.equal(await q.locator('.card-sticker').count(), 6);
    // 在白色內框畫圖：預設粉紅；換粉藍再畫一筆；上一步收回最後一筆；橡皮擦
    const inked = () => q.evaluate(() => { const c = document.getElementById('invite-draw'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; });
    const stroke = async (y0, y1) => { const b = await q.locator('#invite-draw').boundingBox(); await q.mouse.move(b.x + b.width * 0.2, b.y + b.height * y0); await q.mouse.down(); await q.mouse.move(b.x + b.width * 0.8, b.y + b.height * y1, { steps: 8 }); await q.mouse.up(); };
    assert.equal(await q.locator('.pen-color').count(), 6, '5 種粉彩顏色＋橡皮擦');
    await stroke(0.2, 0.25);
    const ink1 = await inked(); assert.ok(ink1 > 50, '畫得出線條');
    await q.click('.pen-color[data-color="#9fd3f5"]');
    await stroke(0.8, 0.85);
    const ink2 = await inked(); assert.ok(ink2 > ink1);
    await q.click('#invite-undo'); assert.ok(Math.abs(await inked() - ink1) < ink1 * 0.1, '上一步收回最後一筆');
    await q.click('.pen-eraser'); await stroke(0.22, 0.23);
    assert.ok(await inked() < ink1, '橡皮擦擦掉線條'); assert.equal(await q.locator('.card-sticker').count(), 6, '橡皮擦不影響貼紙');
    await q.click('#invite-undo'); assert.ok(Math.abs(await inked() - ink1) < ink1 * 0.1, '橡皮擦也能上一步');
    await q.click('.pen-color[data-color="#c9adf0"]'); await stroke(0.6, 0.5);
    // 最多 20 張貼紙
    for (let k = 0; k < 16; k++) await q.click('.sticker-src[data-sticker=' + (k % 2 ? 'leaf' : 'petal') + ']');
    assert.equal(await q.locator('.card-sticker').count(), 20);
    assert.equal(await q.locator('#invite-count').innerText(), '20 / 20');
    // 全部清除後還能用上一步復原
    await q.click('#invite-clear');
    assert.equal(await q.locator('.card-sticker').count(), 0); assert.equal(await inked(), 0);
    assert.ok(await q.locator('#invite-done').isDisabled());
    await q.click('#invite-undo');
    assert.equal(await q.locator('.card-sticker').count(), 20); assert.ok(await inked() > ink1);
    if (SD) await q.locator('#story-panel').screenshot({ path: path.join(SD, 'party-65-card.png') });
    await q.click('#invite-done');
    await q.waitForSelector('.invite-friend');
    // 做好後可以下載整張卡片（PNG）
    await q.evaluate(() => { window.__cgpNoShare = true; });
    await q.waitForTimeout(300);
    const [dl] = await Promise.all([q.waitForEvent('download'), q.click('#invite-save')]);
    assert.equal(dl.suggestedFilename(), 'forest-party-card.png');
    const dlPath = await dl.path();
    const png = fs.readFileSync(dlPath);
    assert.equal(png.slice(1, 4).toString(), 'PNG');
    if (SD) fs.copyFileSync(dlPath, path.join(SD, 'party-65-download.png'));
    for (const f of await q.$$('.invite-friend')) await f.click({ force: true });   // 動物有浮動動畫
    if (SD) await q.locator('#story-panel').screenshot({ path: path.join(SD, 'party-65-send.png') });
    await q.waitForSelector('#scene-ok', { timeout: 5000 });
    await q.click('#scene-ok');
    await q.waitForFunction(() => /大家都收到邀請卡了/.test((document.getElementById('tech-bubble') || {}).textContent || ''), null, { timeout: 8000 });
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 15000 });
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    // 第 92 格：布置森林派對（選裝飾再點 10 個空位）→ 換成派對完成的畫面 → 四個都完成解鎖「木島小英雄」
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, 90); s.random = () => 1.5 / 6; s.save(); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
    await q.waitForSelector('.story-guide[data-story=party]');
    await q.click('.dice-btn.d6');
    await q.waitForSelector('.party-slot', { timeout: 15000 });
    assert.equal(await q.locator('.party-slot').count(), 10);
    const decos = ['vase', 'pinecone', 'juice', 'basket', 'balloons'];
    for (let k = 0; k < 10; k++) {
      await q.click('.deco-src[data-deco=' + decos[k % 5] + ']');
      await q.locator('.party-slot:not(.filled)').first().click({ force: true });   // 空位有浮動動畫
      if (k === 6 && SD) await q.locator('#story-panel').screenshot({ path: path.join(SD, 'party-92.png') });
    }
    await q.waitForSelector('.party-art.party-done', { timeout: 5000 });
    assert.match(await q.locator('#party-bg').getAttribute('src'), /party_done/);
    assert.match(await q.locator('#story-panel').innerText(), /森林派對開始囉[\s\S]*謝謝大家/);
    if (SD) { await q.waitForTimeout(500); await q.locator('#story-panel').screenshot({ path: path.join(SD, 'party-92-done.png') }); }
    await q.click('#scene-ok');
    await q.waitForFunction(() => /謝謝你幫忙準備森林派對/.test((document.getElementById('tech-bubble') || {}).textContent || ''), null, { timeout: 8000 });
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 15000 });
    assert.ok(await q.evaluate((cid) => window.__cgpStore.getAchievements(cid).find((a) => a.id === 'woodHero').done, id), '解鎖木島小英雄');
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    assert.equal(await q.locator('.story-guide').count(), 0, '全部完成後沒有導遊');
    // 木島小遊戲格：落葉找松果計分版（3 回合 4／5／6 顆；每回合翻錯 3 次進下一回合；每 2 顆換 1 星）
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.setPlayerTile(cid, 4); s.random = () => 2.5 / 6; s.save(); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    await q.click('.dice-btn.d6');                     // 擲 3 → 第 7 格小遊戲
    await q.waitForSelector('#mg.leaf-mg [data-leaf=start]', { timeout: 15000 });
    assert.match(await q.locator('#mg-tip').innerText(), /落葉找松果[\s\S]*3 回合/);
    const starsMg = await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id);
    await q.click('[data-leaf=start]');
    const roundPlay = async (no, pine, wrongOnly) => {
      await q.waitForFunction((n) => (document.getElementById('leaf-round') || {}).textContent === '第 ' + n + ' / 3 回合' && !!document.querySelector('.leaf-grid:not(.peek)'), no, { timeout: 8000 });
      assert.equal(await q.locator('.leaf-pile[data-pine]').count(), pine);
      assert.equal(await q.locator('.leaf-pile[data-squirrel]').count(), 2);
      if (wrongOnly) {   // 翻到松鼠 1 次＋空地 2 次 = 翻錯 3 次
        await q.locator('.leaf-pile[data-squirrel]').first().click();
        assert.equal(await q.locator('.leaf-heart.off').count(), 1, '翻到松鼠算翻錯 1 次');
        for (let k = 0; k < 2; k++) await q.locator('.leaf-pile:not([data-pine]):not([data-squirrel]):not(.open)').first().click();
      }
      else for (const o of await q.$$('.leaf-pile[data-pine]')) await o.click();
    };
    await roundPlay(1, 4, true);                      // 第 1 回合翻錯 3 次：0 顆，沒找到的松果亮出來
    assert.equal(await q.locator('.leaf-pile.missed').count(), 4);
    assert.match(await q.locator('#leaf-msg').innerText(), /翻錯 3 次/);
    await roundPlay(2, 5, false);
    await roundPlay(3, 6, false);
    // 結算比照抓住星星：第 1 個視窗排出松果 → 換成能量星星 → 第 2 個視窗每 2 顆換 1 星
    await q.waitForSelector('.leaf-step1 [data-mg=merge]', { timeout: 8000 });
    assert.match(await q.locator('.leaf-step1').innerText(), /找到 11 \/ 15 顆松果[\s\S]*換成能量星星/);
    assert.equal(await q.locator('.leaf-step1 .leaf-pine').count(), 11, '一顆顆排出找到的松果');
    await q.click('.leaf-step1 [data-mg=merge]');
    await q.waitForSelector('.leaf-result [data-mg=claim]', { timeout: 8000 });
    assert.match(await q.locator('.leaf-result').innerText(), /換成能量星星[\s\S]*每 2 顆松果換 1 顆[\s\S]*\+6 能量星星/);
    assert.equal(await q.locator('.leaf-result .mg-group').count(), 6, '11 顆松果分成 6 組（最後一組 1 顆）');
    await q.click('[data-mg=claim]');
    await q.waitForFunction(() => !document.getElementById('mg'));
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id), starsMg + 6, '11 顆松果 → 6 星');
    assert.equal(await q.evaluate((cid) => window.__cgpStore.data.adventure.minigames.filter((m) => m.childId === cid && m.game === 'leaf' && m.status === 'done').pop().squirrels, id), 1, '這局翻到 1 隻松鼠（成就「怎麼都是松鼠」用）');
    // 家長試玩 #leaf-test：不給星星、不算次數
    const snapLeaf = await q.evaluate(() => localStorage.getItem('cgp-data'));
    await q.goto(url + '#leaf-test'); await q.reload();
    await q.waitForSelector('#mg.leaf-mg [data-leaf=start]');
    assert.match(await q.locator('#mg-tip').innerText(), /試玩模式/);
    await q.click('[data-mg=later]');
    await q.waitForFunction(() => !document.getElementById('mg') && location.hash === '#home');
    assert.equal(await q.evaluate(() => localStorage.getItem('cgp-data')), snapLeaf, '試玩不動存檔');
    console.log('✔ 木島小遊戲：落葉找松果 3 回合、翻錯 3 次進下一回合、11 顆換 6 星、家長試玩 #leaf-test');
    // 木島機會卡「前進 2 格」：藤蔓垂下來，按「抓住！」才前進（效果同金島礦車）
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.rolls = []; s.getPlayer(cid).bag.d6 = 2; s.setPlayerTile(cid, 1); s.save(); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    await q.evaluate(() => { const seq = [1.5 / 6, 0]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#cart-panel', { timeout: 10000 });
    assert.match(await q.locator('#cart-panel').innerText(), /藤蔓垂下來了[\s\S]*額外前進 2 格[\s\S]*抓住/);
    assert.equal(await q.locator('#pawn').getAttribute('data-pos'), '3', '按抓住前還在機會格');
    await q.click('#cart-btn');
    await q.waitForFunction(() => document.getElementById('pawn').dataset.pos === '5', null, { timeout: 8000 });
    console.log('✔ 木島機會卡：藤蔓「抓住！」才前進 2 格');
    console.log('✔ 木島劇情森林派對（假地圖）：小精靈導遊、第 8 格找松果、第 40 格採花摘莓果、第 65 格拖曳貼紙做邀請卡並送給 3 隻動物、第 92 格布置派對、各 ⭐3、木島小英雄');
    await cw.close();
  }

  // ---------- 擲骰後只拿到獎勵：也用一般冒險事件視窗（2026-11-09），獎勵依實際結果、按鈕不重複發放 ----------
  {
    const cr = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
    const q = await cr.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => { const s = window.__cgpStore; const a = s.addChild({ name: '波妞' }); const it = s.addItem({ kind: 'bonus', name: '大', points: 100 }); s.recordItem(a.id, it.id); s.settleToday(a.id);
      const p = s.getPlayer(a.id); p.bag.d6 = 3; s.setPlayerTile(a.id, 3); s.save(); return a.id; });
    await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    // 第 5 格寶箱得到 ⭐3：一張奶油黃卡，主圖是能量星星
    await q.evaluate(() => { const seq = [1.5 / 6, 0.1, 0.9]; window.__cgpStore.random = () => (seq.length ? seq.shift() : 0); });
    const s0 = await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id);
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#confirm [data-testid=event]', { timeout: 15000 });
    assert.match(await q.locator('#confirm .ev').innerText(), /^冒險新發現！\n+擲出 2・停在第 5 格[\s\S]*能量星星 ×3\n已存入能量星星[\s\S]*繼續冒險！$/);
    assert.equal(await q.locator('#confirm .ev-card.ev-reward').count(), 1);
    assert.match(await q.locator('#confirm .ev-art img').getAttribute('src'), /star\.webp/);
    const s1 = await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id);
    assert.equal(s1, s0 + 3, '顯示前就已發放');
    if (SHOT_DIR) await q.locator('#confirm .ev').screenshot({ path: path.join(SHOT_DIR, 'event-reward.png') });
    await q.click('#confirm [data-yes]');
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id), s1, '按「繼續冒險！」不會重複發放');
    // 好運金牌＋寶箱：主獎勵溜冰鞋、另一張 ⭐3；第一張註明好運金牌
    await q.evaluate((cid) => { const s = window.__cgpStore; const p = s.getPlayer(cid); p.bag.luckyMedal = 1; p.medalArmed = true; s.setPlayerTile(cid, 10); s.save(); const seq = [1.5 / 6, 0.1, 0.9, 0.6]; s.random = () => (seq.length ? seq.shift() : 0); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    const sk0 = await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.skates, id);
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#confirm [data-testid=event]', { timeout: 15000 });
    assert.match(await q.locator('#confirm .ev').innerText(), /冒險新發現！[\s\S]*停在第 12 格[\s\S]*溜冰鞋 ×1[\s\S]*好運金牌[\s\S]*能量星星 ×3/);
    assert.equal(await q.locator('#confirm .ev-card.ev-reward').count(), 2);
    assert.ok(await q.evaluate(() => { const b = document.querySelector('.ev-btn').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; }), '按鈕在畫面內');
    if (SHOT_DIR) await q.locator('#confirm .ev').screenshot({ path: path.join(SHOT_DIR, 'event-medal.png') });
    await q.click('#confirm [data-yes]');
    assert.equal(await q.locator('#confirm[open]').count(), 0);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.skates, id), sk0 + 1, '溜冰鞋只收 1 雙');
    console.log('✔ 擲骰只拿到獎勵：改用冒險事件視窗（每樣獎勵一張卡、好運金牌註明）、依實際結果顯示、按鈕不重複發放');
    await cr.close();
  }

  // ---------- 金島小遊戲（木島上線前）：也會出現落葉找松果 ----------
  {
    const cg = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block', goldGame: 'leaf' });
    const q = await cg.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => { const s = window.__cgpStore; const a = s.addChild({ name: '波妞' }); const it = s.addItem({ kind: 'bonus', name: '大', points: 100 }); s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 1; s.setPlayerTile(a.id, 4); s.random = () => 2.5 / 6; s.save(); return a.id; });
    await q.goto(url + '#map-' + id); await q.waitForSelector('#pawn');
    await q.click('.dice-btn.d6');                     // 擲 3 → 金島第 7 格小遊戲
    await q.waitForSelector('#mg.leaf-mg [data-leaf=start]', { timeout: 15000 });
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPendingMinigame(cid).game, id), 'leaf');
    // 松果躲躲：背包按一下 → 確認 → 馬上開始一局落葉找松果（不占今天的 1 次）
    await q.click('#mg [data-mg=later]');
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.minigames = s.data.adventure.minigames.filter((m) => m.childId !== cid); s.getPlayer(cid).bag.pineHide = 1; s.save(); }, id);
    await q.goto(url + '#child-' + id); await q.goto(url + '#map-' + id);
    await q.waitForSelector('.item-btn[data-kind=pineHide]');
    assert.match(await q.locator('.item-btn[data-kind=pineHide]').innerText(), /松果躲躲[\s\S]*×1・玩一局/);
    await q.click('.item-btn[data-kind=pineHide]');
    assert.match(await q.locator('#confirm').innerText(), /松果躲躲[\s\S]*落葉找松果[\s\S]*不占今天的 1 次小遊戲/);
    await q.click('#confirm [data-yes]');
    await q.waitForSelector('#mg.leaf-mg [data-leaf=start]');
    assert.match(await q.locator('#mg-tip').innerText(), /松果躲躲：額外一局/);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).bag.pineHide, id), 0);
    console.log('✔ 金島小遊戲：木島上線前也會出現落葉找松果；松果躲躲馬上玩一局');
    await cg.close();
  }

  // ---------- 2026-11-09：能量星星在現實生活的用途（加分另外給星星、冒險每日上限、用星星兌換獎勵） ----------
  {
    const cz = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
    const q = await cz.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => { const s = window.__cgpStore; const a = s.addChild({ name: '端端' }); s.save(); return a.id; });
    // 1. 2026-11-09 家長決定：拿掉「記錄時另外給能量星星」，加分清單上方只剩點數篩選
    await q.goto(url + '#child-' + id);
    await q.waitForSelector('.score-btn.bonus');
    assert.equal(await q.locator('[data-testid=extra-stars], .star-chip').count(), 0, '不再有另外給星星的選擇列');
    await q.locator('.score-btn.bonus').first().click();
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getStarBalance(cid), id), 0, '一般加分不給星星');
    // 2. 設定 → 冒險上限：要家長密碼；＋／－調整；恢復預設
    await q.goto(url + '#rules-limits');
    await passPin(q);
    await q.waitForSelector('[data-testid=limits]');
    assert.match(await q.locator('[data-testid=limits]').innerText(), /不會過度沉迷[\s\S]*每日擲骰次數[\s\S]*預設 3[\s\S]*松果躲躲/);
    await q.click('[data-action=limit-step][data-key=dice][data-d="1"]');
    await q.click('[data-action=limit-step][data-key=dice][data-d="1"]');
    assert.equal(await q.locator('[data-testid=limit-dice]').innerText(), '5');
    assert.equal(await q.evaluate(() => window.__cgpStore.getLimits().dice), 5);
    if (SHOT_DIR) await q.locator('[data-testid=limits]').screenshot({ path: path.join(SHOT_DIR, 'limits.png') });
    await q.click('[data-action=limits-reset]'); await q.click('#confirm [data-yes]');
    await q.waitForFunction(() => window.__cgpStore.getLimits().dice === 3);
    // 3. 兌換頁：用能量星星兌換「愛的飛高高／5 顆」（新安裝預設就有）
    await q.evaluate((cid) => { const s = window.__cgpStore; s.data.adventure.ledger.push({ id: 'gift', childId: cid, date: s.today(), delta: 8, reason: '測試', ts: 1 }); s.save(); }, id);
    await q.goto(url + '#shop-' + id);
    await q.waitForSelector('[data-testid=star-rewards]');
    assert.match(await q.locator('[data-testid=star-rewards]').innerText(), /用能量星星兌換[\s\S]*能量星星：\s*8[\s\S]*愛的飛高高[\s\S]*5 顆/);
    if (SHOT_DIR) await q.locator('[data-testid=star-rewards]').screenshot({ path: path.join(SHOT_DIR, 'star-rewards.png') });
    const total0 = await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id);
    await q.click('.star-reward [data-action=redeem]');
    assert.match(await q.locator('#confirm').innerText(), /⭐5 顆能量星星兌換「愛的飛高高」/);
    await q.click('#confirm [data-yes]');
    await q.waitForFunction((cid) => window.__cgpStore.getStarBalance(cid) === 3, id);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), total0, '生活點數不變');
    assert.match(await q.locator('.records').last().innerText(), /愛的飛高高[\s\S]*−⭐5/);
    console.log('✔ 能量星星：加分清單不再有另外給星星、冒險每日上限設定（家長密碼、＋－、恢復預設）、用星星兌換愛的飛高高');
    await cz.close();
  }

  // ---------- 金島第三區：能源主塔與技師 ----------
  {
    const ct = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block' });
    const q = await ct.newPage();
    q.on('pageerror', (e) => errors.push(e.message));
    await q.goto(url);
    const id = await q.evaluate(() => { const s = window.__cgpStore; const a = s.addChild({ name: '波妞' }); const it = s.addItem({ kind: 'bonus', name: '大', points: 100 }); s.recordItem(a.id, it.id); s.settleToday(a.id);
      s.getPlayer(a.id).bag.d6 = 1; s.setPlayerTile(a.id, 76); s.getPlayer(a.id).maxReached = 76; s.save(); return a.id; });
    await q.goto(url + '#map-' + id); await q.waitForSelector('#gold-tower');
    assert.equal(await q.locator('#gold-tower.lit').count(), 0, '還沒走到第 80 格：未通電');
    // 已在齒輪工坊、塔還沒通電：技師主動求助（只一次）
    await q.waitForSelector('#tech-bubble', { timeout: 5000 });
    assert.match(await q.locator('#tech-bubble').innerText(), /能源塔沒電了[\s\S]*第 80 格/);
    assert.equal(await q.locator('.mtile[data-n="80"].mt-switch .switch-ico').count(), 1, '第 80 格標示能源開關');
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting'), null, { timeout: 10000 });
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getPlayer(cid).towerIntro, id), true);
    await q.reload(); await q.waitForSelector('#gold-tower'); await q.waitForTimeout(1200);
    assert.equal(await q.locator('#tech-bubble').count(), 0, '技師求助只出現一次');
    await q.click('.gold-tech');
    await q.waitForSelector('#tech-bubble');
    assert.match(await q.locator('#tech-bubble').innerText(), /沒電[\s\S]*第 80 格/);
    // 擲 5：76 → 81，經過第 80 格 → 鏡頭移到主塔 → 孩子連點充電 → 通電
    await q.evaluate(() => { window.__cgpStore.random = () => 4.5 / 6; });
    await q.click('.dice-btn.d6');
    await q.waitForSelector('#charge-panel', { timeout: 10000 });
    assert.match(await q.locator('#charge-panel').innerText(), /快幫能源塔充電/);
    for (let k = 0; k < 9; k++) await q.click('#charge-btn');
    assert.equal(await q.locator('#gold-tower.just-lit').count(), 0, '還沒充滿不會通電');
    assert.match(await q.locator('#charge-count').innerText(), /9 \/ 10/);
    await q.click('#charge-btn');
    await q.waitForSelector('#gold-tower.just-lit', { timeout: 10000 });
    assert.equal(await q.locator('#charge-panel').count(), 0, '充滿後面板關閉');
    await q.waitForFunction(() => /通電了/.test(document.getElementById('toast').textContent), null, { timeout: 5000 });
    await q.waitForSelector('#tech-bubble', { timeout: 5000 });   // 通電時技師自動說台詞
    assert.match(await q.locator('#tech-bubble').innerText(), /謝謝你[\s\S]*能源塔亮起來了/);
    assert.ok(await q.evaluate(() => { const t = document.getElementById('gold-tower').getBoundingClientRect(), v = document.getElementById('map-view').getBoundingClientRect(); return t.left >= v.left - 20 && t.right <= v.right + 20 && t.top < v.bottom && t.bottom > v.top; }), '鏡頭移到主塔，整座塔在畫面內');
    assert.ok(await q.evaluate(() => document.body.classList.contains('pawn-acting')), '演出期間暫停骰子');
    await q.waitForFunction(() => !document.body.classList.contains('pawn-acting') && !!document.querySelector('#gold-tower.lit:not(.just-lit)'), null, { timeout: 10000 });
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    await q.reload(); await q.waitForSelector('#gold-tower');
    assert.equal(await q.locator('#gold-tower.lit').count(), 1, '重新整理後仍是通電');
    assert.equal(await q.locator('#gold-tower.just-lit').count(), 0, '通電動畫只播一次');
    await q.click('.gold-tech', { force: true });
    await q.waitForSelector('#tech-bubble');
    assert.match(await q.locator('#tech-bubble').innerText(), /謝謝你[\s\S]*金冠城堡/);
    console.log('✔ 能源主塔：技師主動求助一次、第 80 格開關標示、連點充電後通電、技師台詞、重新整理保持通電');
    await ct.close();
  }

  // ---------- 設定 → 備份：封存舊紀錄 ----------
  {
    const ca = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block', acceptDownloads: true });
    const q = await ca.newPage();
    await q.clock.setFixedTime(new Date('2026-11-07T10:00:00'));
    q.on('pageerror', (e) => errors.push(e.message));
    q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
    await q.goto(url);
    const id = await q.evaluate(() => {
      const s = window.__cgpStore, a = s.addChild({ name: '端端', startPoints: 100 });
      const it = s.addItem({ kind: 'bonus', name: '舊加分', points: 30 });
      ['2026-03-03', '2026-03-10', '2026-04-20'].forEach((d) => s.addRecordOn(a.id, it.id, d));
      s.addRecordOn(a.id, it.id, '2026-11-06');
      return a.id;
    });
    const total = await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id);
    await q.goto(url + '#rules-backup');
    await passPin(q);
    await q.waitForSelector('[data-testid=archive]');
    // 匯出目前規則表（CSV）
    const [rdl] = await Promise.all([q.waitForEvent('download'), q.click('[data-action=export-rules]')]);
    assert.equal(rdl.suggestedFilename(), 'child-points-rules-2026-11-07.csv');
    const rcsv = require('fs').readFileSync(await rdl.path(), 'utf8');
    assert.match(rcsv, /^\uFEFF規則ID,規則類型,適用對象,任務或行為,點數變動,計算頻率,額外獎勵\r\n/);
    assert.match(rcsv, /舊加分,30,每次/);
    assert.match(await q.locator('#toast').innerText(), /已匯出 \d+ 條規則/);
    assert.equal(await q.locator('#archive-date').inputValue(), '2026-05-01', '預設保留最近 6 個月');
    assert.equal(await q.locator('#archive-date').getAttribute('max'), '2026-11-01', '本週與本月不能封存');
    assert.match(await q.locator('[data-testid=archive-count]').innerText(), /會封存 3 筆/);
    await q.fill('#archive-date', '2026-04-01');
    await q.locator('#archive-date').dispatchEvent('change');
    await q.waitForFunction(() => /會封存 2 筆/.test(document.querySelector('[data-testid=archive-count]').textContent));
    await q.click('[data-action=archive]');
    assert.match(await q.locator('#confirm').innerText(), /封存 4\/1 以前的 2 筆[\s\S]*生活 2 筆、冒險 0 筆[\s\S]*點數、等級、能量星星、成就都不變/);
    const [dl] = await Promise.all([q.waitForEvent('download'), q.click('#confirm [data-yes]')]);
    assert.equal(dl.suggestedFilename(), 'child-points-archive-before-2026-04-01.json');
    const file = JSON.parse(require('fs').readFileSync(await dl.path(), 'utf8'));
    assert.deepEqual([file.type, file.records.length, file.cutoff, typeof file.adventure], ['cgp-archive', 2, '2026-04-01', 'object'], '封存檔包含被移除的生活與冒險紀錄');
    await q.waitForFunction(() => /已封存/.test(document.querySelector('[data-testid=archive]').textContent));
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), total, '目前點數不變');
    assert.equal(await q.evaluate(() => window.__cgpStore.data.records.length), 2, '只移除 4/1 以前的 2 筆');
    await q.reload(); await passPin(q);
    assert.equal(await q.evaluate((cid) => window.__cgpStore.getTotal(cid), id), total, '重新整理後點數仍不變');
    console.log('✔ 封存舊紀錄：預設 6 個月、本週本月不能封存、選日期更新筆數、下載封存檔、點數不變');
    await ca.close();
  }

  // ---------- 星光成就劇場：成就解鎖演出 ----------
  {
    async function unlockOn(opts, startPoints) {
      const c = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'block', theater: true, ...opts });
      const q = await c.newPage();
      q.on('pageerror', (e) => errors.push(e.message));
      q.on('dialog', (d) => { errors.push('不應出現原生對話框：' + d.message()); d.dismiss(); });
      await q.goto(url);
      const id = await q.evaluate((p) => window.__cgpStore.addChild({ name: '波妞', startPoints: p }).id, startPoints);
      await q.goto(url + '#report'); await q.goto(url + '#home');
      await q.waitForSelector('#ach-theater[open]');
      return { c, q, id };
    }
    const fitsScreen = (q) => q.evaluate(() => { const r = document.querySelector('.th-card').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; });
    // 單一成就：成就解鎖！主徽章、名稱、兩個按鈕；音效開關；按「繼續冒險」關閉
    {
      const { c, q, id } = await unlockOn({}, 1000);
      assert.match(await q.locator('#ach-theater h2').innerText(), /^🎉 成就解鎖！$/);
      assert.match(await q.locator('#ach-theater .th-name').innerText(), /獲得 1000 分/);
      assert.match(await q.locator('#ach-theater .th-main .badge-img img').getAttribute('src'), /images\/badges\/badge_earn1000\.webp$/, '主徽章用正式徽章圖');
      assert.ok(await q.locator('#ach-theater .th-main .badge-img img').evaluate((im) => im.complete && im.naturalWidth === 256), '徽章圖載入成功');
      assert.equal(await q.locator('#ach-theater .th-mini').count(), 0, '單一成就沒有小徽章列');
      assert.equal(await q.locator('#toast:not([hidden])').filter({ hasText: '解鎖成就' }).count(), 0, '不再用綠色提示');
      assert.ok(await fitsScreen(q), '直式不超出畫面');
      assert.ok(await q.evaluate(() => { const r = document.querySelector('.th-actions').getBoundingClientRect(); const n = document.querySelector('.bottom-nav').getBoundingClientRect(); return document.querySelector('#ach-theater').matches(':modal') && r.bottom <= innerHeight; }), '在底部導覽列之上');
      await q.click('[data-th=sound]');
      assert.equal(await q.locator('[data-th=sound]').getAttribute('aria-pressed'), 'false');
      assert.equal(await q.evaluate(() => localStorage.getItem('cgp-ach-sound')), 'off', '音效關閉會記住');
      await q.click('[data-th=close]');
      await q.waitForFunction(() => !document.getElementById('ach-theater'));
      assert.ok(await q.evaluate((cid) => window.__cgpStore.getAchievements(cid).find((a) => a.id === 'earn1000').done, id), '成就已記錄');
      // 重新整理：不再演出、不重複發放
      await q.reload(); await q.waitForTimeout(500);
      assert.equal(await q.locator('#ach-theater').count(), 0, '重新整理後不再演出');
      assert.equal(await q.evaluate(() => JSON.parse(localStorage.getItem('cgp-data')).achievements[Object.keys(JSON.parse(localStorage.getItem('cgp-data')).achievements)[0]].earn1000 ? 1 : 0), 1);
      await c.close();
    }
    // 同時 2 個：哇！一次解鎖 2 個成就！主徽章是最高階（2000），小徽章可點選切換
    {
      const { c, q } = await unlockOn({}, 2000);
      assert.match(await q.locator('#ach-theater h2').innerText(), /一次解鎖 2 個成就/);
      assert.match(await q.locator('#ach-theater .th-name').innerText(), /獲得 2000 分/, '主徽章是最高階');
      assert.equal(await q.locator('#ach-theater .th-mini').count(), 2);
      await q.click('.th-mini >> nth=1');
      assert.match(await q.locator('#ach-theater .th-name').innerText(), /獲得 1000 分/, '點小徽章查看');
      // 手機返回鍵：安全關閉，留在原頁
      await q.goBack();
      await q.waitForFunction(() => !document.getElementById('ach-theater'));
      assert.equal(new URL(q.url()).hash, '#home', '返回鍵只關閉劇場');
      await c.close();
    }
    // 同時 5 個、10 個：主徽章 5000／10000，其他橫向排列；直式與橫式都不超出畫面；查看收藏導向小孩頁面並展開
    {
      const { c, q, id } = await unlockOn({}, 5000);
      assert.match(await q.locator('#ach-theater h2').innerText(), /一次解鎖 5 個成就/);
      assert.match(await q.locator('#ach-theater .th-more-title').innerText(), /另外 4 個成就/);
      assert.ok(await fitsScreen(q));
      await q.click('[data-th=collection]');
      await q.waitForFunction((cid) => location.hash === '#child-' + cid, id);
      await q.waitForSelector('[data-testid=achievements][open]');
      assert.equal(await q.locator('[data-testid=achievements] .ach.is-new').count(), 5, '收藏頁標出這次的新成就');
      await c.close();
    }
    for (const dev of ['Pixel 5', 'Pixel 5 landscape']) {
      const { c, q } = await unlockOn({ ...devices[dev] }, 10000);
      assert.match(await q.locator('#ach-theater h2').innerText(), /一次解鎖 10 個成就/);
      assert.match(await q.locator('#ach-theater .th-name').innerText(), /獲得 10000 分/);
      assert.equal(await q.locator('#ach-theater .th-mini').count(), 10);
      assert.match(await q.locator('#ach-theater .th-main img').getAttribute('src'), /badge_earn10000\.webp$/, '分數金牌每個分數各一張圖');
      assert.ok(await q.evaluate(() => { const s = document.querySelector('.th-strip'); return s.scrollWidth > s.clientWidth; }), '數量多：橫向捲動');
      assert.ok(await fitsScreen(q), dev + '：不超出畫面');
      assert.ok(await q.evaluate(() => { const b = document.querySelector('[data-th=close]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; }), dev + '：按鈕不用捲動就看得到');
      await q.waitForTimeout(1600);   // 等主徽章彈出動畫跑完再截圖
      await q.screenshot({ path: SHOT_DIR ? path.join(SHOT_DIR, 'theater-' + (dev.includes('landscape') ? 'landscape' : 'portrait') + '.png') : path.join(require('os').tmpdir(), 'th.png') });
      await q.click('[data-th=close]');
      await q.waitForFunction(() => !document.getElementById('ach-theater'));
      await c.close();
    }
    // 減少動態效果：直接顯示最後畫面（沒有光柱與粒子）
    {
      const { c, q } = await unlockOn({ reducedMotion: 'reduce' }, 1000);
      assert.equal(await q.locator('#ach-theater.still').count(), 1);
      assert.equal(await q.locator('.th-burst').isVisible(), false);
      await c.close();
    }
    console.log('✔ 星光成就劇場：單一／2／5／10 個成就、主徽章最高階、小徽章點選、橫向捲動、直式橫式、音效開關、返回鍵、查看收藏、減少動態、重新整理不重複');
  }

  // ---------- 離線快取：圖片放在不跟版本走的快取，升版不重抓；離線時從快取開 ----------
  {
    const c = await browser.newContext({ ...devices['Pixel 5'], serviceWorkers: 'allow' });
    const q = await c.newPage();
    await q.goto(url);
    await q.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
    const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const ver = swSrc.match(/var CACHE = '([^']+)'/)[1];
    const imgCount = (swSrc.split('];')[0].match(/'images\/[^']+'/g) || []).length;
    const cached = () => q.evaluate(async () => { const keys = await caches.keys(); const out = {}; for (const k of keys) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname); return out; });
    await q.waitForFunction(async () => (await caches.keys()).includes('cgp-img-v1'), null, { timeout: 20000 });
    let cs = await cached();
    assert.ok(cs['cgp-img-v1'].includes('/images/gold/region01.webp'), '圖片放在圖片快取');
    assert.ok(cs['cgp-img-v1'].length >= imgCount, '安裝時所有 SHELL 圖片都進快取');
    assert.ok(!cs[ver].some((u) => /\.webp$/.test(u)), '版本快取只放程式與頁面');
    // 模擬升版：只換 CACHE 名稱 → 程式重抓、圖片不重抓
    REQ_LOG.length = 0;
    SW_OVERRIDE = swSrc.replace(ver, 'cgp-shell-test-next');
    await q.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await q.waitForFunction(async () => { const k = await caches.keys(); return k.length === 2 && k.includes('cgp-shell-test-next') && !!(await (await caches.open('cgp-shell-test-next')).match('js/app.js')); }, null, { timeout: 20000 });   // 新版安裝完成、舊版快取已刪
    await q.waitForTimeout(1500);   // 等伺服器把請求記完
    const imgReq = REQ_LOG.filter((p) => p.startsWith('/images/')).length;
    assert.ok(REQ_LOG.includes('/js/app.js'), '升版會重抓程式：' + REQ_LOG.join(' '));
    assert.ok(imgReq < imgCount / 3, '升版不重抓全部圖片（實際 ' + imgReq + ' / ' + imgCount + '）');
    SW_OVERRIDE = null;
    // 離線：重新整理仍能開，地圖背景從快取載入
    await q.waitForTimeout(500);
    await c.setOffline(true);
    await q.reload();
    await q.waitForFunction(() => document.getElementById('app').children.length > 0, null, { timeout: 10000 });
    const ok = await q.evaluate(() => new Promise((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = 'images/gold/region01.webp'; }));
    assert.equal(ok, 1080, '離線時圖片從快取載入');
    await c.close();
    console.log('✔ 離線快取：圖片獨立快取、升版只重抓程式（圖片請求 ' + imgReq + ' / ' + imgCount + '）、離線可開啟並顯示圖片');
  }

  assert.deepEqual(errors, [], '頁面不得出現 JS 錯誤或原生對話框');
  await browser.close();
  server.close();
  console.log('全部 E2E 測試通過');
}

main().catch((e) => { console.error(e); process.exit(1); });
