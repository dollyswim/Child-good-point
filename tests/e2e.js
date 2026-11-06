// 端對端測試（手機尺寸）：node tests/e2e.js
// 需要 Playwright；會自動啟動本機靜態伺服器。
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const SHOT_DIR = process.env.SHOT_DIR || null;

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
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
  await addChild('端端', 100);
  await addChild('波妞', 0);
  assert.equal(await page.locator('.child-card').count(), 2);
  assert.match(await text('.child-card >> nth=0'), /目前 100 點/);
  assert.match(await text('.child-card >> nth=0'), /今日 0/);
  await shot('02-home');

  // 設定：新增 +20 加分、共同任務（指定兩人）
  await page.click('a[aria-label="設定"]');
  await page.click('a[href="#rules-bonus"]');
  await page.click('[data-action="add-item"]');
  await page.fill('input[name="name"]', '超棒表現');
  await page.fill('input[name="points"]', '20');
  await page.click('#modal-form button[type="submit"]');
  await page.click('[data-action="add-item"]');
  await page.fill('input[name="name"]', '多做十分');
  await page.fill('input[name="points"]', '10');
  await page.click('#modal-form button[type="submit"]');

  await page.click('a[href="#rules-task"]');
  await page.click('[data-action="add-item"]');
  await page.fill('input[name="name"]', '共同閱讀');
  await page.fill('input[name="points"]', '8');
  await page.selectOption('select[name="freqType"]', 'daily');
  await page.check('input[name="scope"][value="some"]');
  await page.check('input[name="childIds"] >> nth=0');
  await page.check('input[name="childIds"] >> nth=1');
  await shot('03-task-form');
  await page.click('#modal-form button[type="submit"]');
  assert.match(await text('.rows'), /共同閱讀[\s\S]*端端、波妞/);
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
  assert.match(await text('.child-card >> nth=0'), /目前 123 點[\s\S]*今日 \+23/);
  await page.click('.child-card >> text=波妞');
  assert.equal(await page.locator('.task.done >> text=共同閱讀').count(), 0);
  assert.equal(await text('[data-testid=today]'), '0');
  console.log('✔ 案例 B：共同任務完成狀態各自獨立');

  // 案例 C：點錯 +10 後撤銷
  await page.click('a[aria-label="回首頁"]');
  await page.click('.child-card >> text=端端');
  const before = [await text('[data-testid=total]'), await text('[data-testid=today]')];
  const recCount = await page.locator('.rec').count();
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
  await page.click('.rewards summary');
  await page.click('[data-action=redeem] >> nth=0');
  await page.click('#confirm [data-yes]');
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
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action=export]')]);
  const backupPath = await download.path();
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  assert.equal(backup.children.length, 2);
  await page.evaluate(() => localStorage.clear());
  await page.goto(url + '#home');
  await page.reload();
  assert.equal(await page.locator('.child-card').count(), 0);
  await page.goto(url + '#rules-backup');
  await page.setInputFiles('input[data-action=import]', backupPath);
  await page.click('#confirm [data-yes]');
  await page.waitForSelector('.toast >> text=匯入完成');
  await page.goto(url + '#home');
  assert.equal(await page.locator('.child-card').count(), 2);
  assert.match(await text('.child-card >> nth=0'), new RegExp('目前 ' + afterRedeem + ' 點'));
  console.log('✔ 備份匯出與匯入還原');

  // 編輯與刪除孩子
  await page.goto(url + '#rules-children');
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

  // 舊版網址格式仍可使用
  const cid = await page.evaluate(() => window.__cgpStore.getChildren()[0].id);
  await page.goto(url + '#/child/' + cid);
  assert.equal(await text('[data-testid=total]'), afterCustom);
  console.log('✔ 相容舊版網址格式');

  assert.deepEqual(errors, [], '頁面不得出現 JS 錯誤或原生對話框');
  await browser.close();
  server.close();
  console.log('全部 E2E 測試通過');
}

main().catch((e) => { console.error(e); process.exit(1); });
