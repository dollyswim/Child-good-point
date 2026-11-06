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
  assert.match(await text('.child-card >> nth=0'), /100 點/);
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
  await page.click('.bottom-nav a >> text=任務');
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
  assert.match(await text('.child-card >> nth=0'), new RegExp(afterRedeem + ' 點'));
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
  await page.click('[data-action=edit-child] >> nth=0');
  await page.fill('input[name="title"]', '小小店長');
  await page.check('input[name="badge"][value="🏪"]', { force: true });
  await page.fill('input[name="weeklyGoal"]', '500');
  await page.click('#modal-form button[type="submit"]');
  await page.goto(url + '#home');
  assert.match(await text('.child-card >> nth=0'), /小小店長\s*Lv\.\d+/);
  assert.match(await text('.week-card'), /\/ 500 點/);
  await shot('13-home-new');
  await noHScroll('新首頁');
  await page.click('.tile >> text=本週挑戰');
  await page.waitForSelector('#confirm .pick-kid');
  await page.click('#confirm .pick-kid >> nth=0');
  await page.waitForSelector('.challenges');
  assert.ok(await page.locator('.bottom-nav .nav-item.active >> text=挑戰').isVisible());
  // 新增一個容易達成的挑戰並領取
  await page.goto(url + '#rules-challenge');
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
    await page.click('.bottom-nav a >> text=任務');
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
    assert.equal(await q.locator('[data-testid=stars]').innerText(), '⭐ 4');
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
    assert.equal(await q2.locator('[data-testid=stars]').innerText(), '⭐ 7');
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
    assert.equal(await q.locator('[data-testid=stars]').innerText(), '⭐ 20');

    // 案例 A：購買 6 面骰扣 5 星、進背包
    await q.click('[data-action=open-shop]');
    await q.click('#confirm [data-buy=d6]');
    assert.match(await q.locator('.shop-bal').innerText(), /⭐ 15/);
    await q.click('#confirm [data-buy=d6]');
    await q.click('#confirm [data-buy=d6]');
    await q.click('#confirm [data-buy=d6]');
    await q.click('#confirm [data-no]');
    assert.equal(await q.locator('[data-testid=stars]').innerText(), '⭐ 0');
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
    if (await q.locator('#confirm[open]').count()) await q.click('#confirm [data-yes]');
    console.log('✔ Phase 3 案例 B：擲出 4 逐格移動 1→2→3→4');

    // 案例 C：3 次後不能第 4 次
    await q.evaluate(() => { window.__cgpStore.random = () => 0; });
    for (let i = 0; i < 2; i++) {
      await q.click('[data-action=roll][data-kind=d6]');
      await q.waitForFunction((n) => document.querySelector('[data-testid=rolls]').textContent.startsWith(n + ' '), i + 2, { timeout: 8000 });
      await q.waitForFunction(() => !document.querySelector('.dice-btn.d6[disabled]') || document.querySelector('[data-testid=rolls]').textContent.startsWith('3'), null, { timeout: 8000 });
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

  assert.deepEqual(errors, [], '頁面不得出現 JS 錯誤或原生對話框');
  await browser.close();
  server.close();
  console.log('全部 E2E 測試通過');
}

main().catch((e) => { console.error(e); process.exit(1); });
