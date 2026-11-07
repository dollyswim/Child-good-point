// 資料層單元測試：node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { Store, memoryStorage, migrate, STORAGE_KEY } = require('../js/store.js');

/** 建立可控制時間的 Store */
function makeStore(dateStr = '2026-11-06T10:00:00', storage = memoryStorage()) {
  const clock = { t: new Date(dateStr).getTime() };
  const store = new Store({ storage, seed: false, now: () => new Date(clock.t) });
  return { store, clock, storage, setDate: (s) => { clock.t = new Date(s).getTime(); } };
}

test('案例 A：起始 100，今日 +20、-5 → 總點數 115、今日 +15', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: '端端', startPoints: 100 });
  const plus = store.addItem({ kind: 'bonus', name: '大加分', points: 20 });
  const minus = store.addItem({ kind: 'penalty', name: '違反約定', points: 5 });
  assert.equal(store.getTotal(c.id), 100);
  assert.equal(store.getTodayNet(c.id), 0, '起始點數不算今日得分');
  store.recordItem(c.id, plus.id);
  const r = store.recordItem(c.id, minus.id);
  assert.equal(r.points, -5, '扣分以負數保存');
  assert.equal(store.getTotal(c.id), 115);
  assert.equal(store.getTodayNet(c.id), 15);
});

test('今日淨得分：+20、+10、-5 → +25，昨天的紀錄不算', () => {
  const { store, setDate } = makeStore('2026-11-05T20:00:00');
  const c = store.addChild({ name: 'A' });
  const p20 = store.addItem({ kind: 'bonus', name: 'p20', points: 20 });
  const p10 = store.addItem({ kind: 'bonus', name: 'p10', points: 10 });
  const m5 = store.addItem({ kind: 'penalty', name: 'm5', points: -5 });
  store.recordItem(c.id, p10.id); // 昨天
  setDate('2026-11-06T08:00:00');
  store.recordItem(c.id, p20.id);
  store.recordItem(c.id, p10.id);
  store.recordItem(c.id, m5.id);
  assert.equal(store.getTodayNet(c.id), 25);
  assert.equal(store.getTotal(c.id), 35);
});

test('案例 B：共同任務 A 完成，B 不得同步完成', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: '端端' });
  const b = store.addChild({ name: '波妞' });
  const task = store.addItem({ kind: 'task', name: '刷牙', points: 5, childIds: [a.id, b.id], frequency: { type: 'daily' } });
  assert.equal(store.getItems('task').length, 1, '任務只建立一次');
  assert.equal(store.getTodayTasks(a.id).length, 1);
  assert.equal(store.getTodayTasks(b.id).length, 1);

  store.completeTask(a.id, task.id);
  assert.equal(store.getTaskStatus(a.id, task).doneToday, true);
  assert.equal(store.getTaskStatus(b.id, task).doneToday, false);
  assert.equal(store.getTodayNet(a.id), 5);
  assert.equal(store.getTodayNet(b.id), 0);
  assert.throws(() => store.completeTask(a.id, task.id), /今天已完成/);
});

test('專屬任務只出現在指定孩子；全部孩子任務包含之後新增的孩子', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A' });
  const b = store.addChild({ name: 'B' });
  store.addItem({ kind: 'task', name: '只給A', points: 3, childIds: [a.id] });
  store.addItem({ kind: 'task', name: '全部', points: 3, childIds: 'all' });
  const c = store.addChild({ name: 'C' });
  assert.deepEqual(store.getTodayTasks(a.id).map(x => x.task.name), ['只給A', '全部']);
  assert.deepEqual(store.getTodayTasks(b.id).map(x => x.task.name), ['全部']);
  assert.deepEqual(store.getTodayTasks(c.id).map(x => x.task.name), ['全部']);
  assert.throws(() => store.addItem({ kind: 'task', name: 'x', points: 1, childIds: [] }), /至少選擇一位/);
});

test('案例 C：點錯 +10 後撤銷，總點數與今日得分恢復，紀錄同步', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: '端端', startPoints: 50 });
  const p5 = store.addItem({ kind: 'bonus', name: '整理書包', points: 5 });
  const p10 = store.addItem({ kind: 'bonus', name: '完成功課', points: 10 });
  store.recordItem(c.id, p5.id);
  const before = { total: store.getTotal(c.id), net: store.getTodayNet(c.id), n: store.getRecords(c.id).length };
  store.recordItem(c.id, p10.id);
  assert.equal(store.getTotal(c.id), 65);
  const undone = store.undoLast(c.id);
  assert.equal(undone.name, '完成功課');
  assert.equal(store.getTotal(c.id), before.total);
  assert.equal(store.getTodayNet(c.id), before.net);
  assert.equal(store.getRecords(c.id).length, before.n);
});

test('撤銷只影響該孩子；撤銷任務會讓任務恢復未完成', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A' });
  const b = store.addChild({ name: 'B' });
  const t = store.addItem({ kind: 'task', name: '刷牙', points: 5 });
  const p = store.addItem({ kind: 'bonus', name: 'p', points: 3 });
  store.completeTask(a.id, t.id);
  store.recordItem(b.id, p.id);
  store.undoLast(a.id);
  assert.equal(store.getTaskStatus(a.id, t).doneToday, false);
  assert.equal(store.getTotal(b.id), 3);
  assert.equal(store.undoLast(a.id), null);
});

test('案例 D：重新載入（同一 storage）資料保留', () => {
  const storage = memoryStorage();
  const { store } = makeStore('2026-11-06T10:00:00', storage);
  const c = store.addChild({ name: '端端', startPoints: 100 });
  const p = store.addItem({ kind: 'bonus', name: 'p', points: 20 });
  store.recordItem(c.id, p.id);
  const reopened = new Store({ storage, seed: false, now: () => new Date('2026-11-06T12:00:00') });
  assert.equal(reopened.getChildren().length, 1);
  assert.equal(reopened.getTotal(c.id), 120);
  assert.equal(reopened.getTodayNet(c.id), 20);
});

test('任務頻率：每日、平日、週末、指定星期', () => {
  const { store, setDate } = makeStore('2026-11-06T10:00:00'); // 2026-11-06 是週五
  const c = store.addChild({ name: 'A' });
  store.addItem({ kind: 'task', name: '每日', points: 1, frequency: { type: 'daily' } });
  store.addItem({ kind: 'task', name: '平日', points: 1, frequency: { type: 'weekdays' } });
  store.addItem({ kind: 'task', name: '週末', points: 1, frequency: { type: 'weekends' } });
  store.addItem({ kind: 'task', name: '一三', points: 1, frequency: { type: 'days', days: [1, 3] } });
  const names = () => store.getTodayTasks(c.id).map(x => x.task.name);
  assert.deepEqual(names(), ['每日', '平日']);
  setDate('2026-11-07T10:00:00'); // 週六
  assert.deepEqual(names(), ['每日', '週末']);
  setDate('2026-11-09T10:00:00'); // 週一
  assert.deepEqual(names(), ['每日', '平日', '一三']);
});

test('任務頻率：每週 N 次（每天最多一次、週一重置）', () => {
  const { store, setDate } = makeStore('2026-11-02T10:00:00'); // 週一
  const c = store.addChild({ name: 'A' });
  const t = store.addItem({ kind: 'task', name: '運動', points: 5, frequency: { type: 'weeklyN', n: 2 } });
  store.completeTask(c.id, t.id);
  assert.equal(store.getTaskStatus(c.id, t).label, '本週 1/2');
  setDate('2026-11-03T10:00:00');
  assert.equal(store.getTaskStatus(c.id, t).canComplete, true);
  store.completeTask(c.id, t.id);
  setDate('2026-11-04T10:00:00');
  const s = store.getTaskStatus(c.id, t);
  assert.equal(s.canComplete, false);
  assert.equal(s.visible, true);
  assert.throws(() => store.completeTask(c.id, t.id));
  setDate('2026-11-09T10:00:00'); // 下週一
  assert.equal(store.getTaskStatus(c.id, t).canComplete, true);
  assert.equal(store.getTaskStatus(c.id, t).weekCount, 0);
});

test('任務頻率：單次（完成後隔天消失）', () => {
  const { store, setDate } = makeStore();
  const c = store.addChild({ name: 'A' });
  const t = store.addItem({ kind: 'task', name: '打預防針', points: 20, frequency: { type: 'once' } });
  store.completeTask(c.id, t.id);
  assert.equal(store.getTodayTasks(c.id).length, 1, '當天仍顯示已完成');
  setDate('2026-11-07T10:00:00');
  assert.equal(store.getTodayTasks(c.id).length, 0);
});

test('取消今日任務完成', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: 'A' });
  const t = store.addItem({ kind: 'task', name: '刷牙', points: 5 });
  store.completeTask(c.id, t.id);
  store.uncompleteTask(c.id, t.id);
  assert.equal(store.getTodayNet(c.id), 0);
  assert.equal(store.getTaskStatus(c.id, t).doneToday, false);
});

test('現實獎勵：扣總點數、不影響今日淨得分、留下紀錄、點數不足不可兌換', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: 'A', startPoints: 40 });
  const p = store.addItem({ kind: 'bonus', name: 'p', points: 10 });
  const r = store.addReward({ name: '看卡通', cost: 30 });
  const big = store.addReward({ name: '玩具', cost: 999 });
  store.recordItem(c.id, p.id);
  const rec = store.redeemReward(c.id, r.id);
  assert.equal(rec.type, 'reward');
  assert.equal(rec.points, -30);
  assert.equal(rec.name, '看卡通');
  assert.equal(rec.date, '2026-11-06');
  assert.equal(store.getTotal(c.id), 20);
  assert.equal(store.getTodayNet(c.id), 10);
  assert.throws(() => store.redeemReward(c.id, big.id), /點數不足/);
});

test('刪除孩子：一併刪除其紀錄並從指定任務移除', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A' });
  const b = store.addChild({ name: 'B' });
  const t = store.addItem({ kind: 'task', name: 't', points: 1, childIds: [a.id, b.id] });
  store.completeTask(a.id, t.id);
  store.completeTask(b.id, t.id);
  store.deleteChild(a.id);
  assert.deepEqual(store.getItem(t.id).childIds, [b.id]);
  assert.equal(store.data.records.length, 1);
  assert.equal(store.getTotal(b.id), 1);
});

test('刪除規則項目後，歷史紀錄保留', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: 'A' });
  const p = store.addItem({ kind: 'bonus', name: '幫忙', points: 5 });
  store.recordItem(c.id, p.id);
  store.deleteItem(p.id);
  assert.equal(store.getRecords(c.id)[0].name, '幫忙');
  assert.equal(store.getTotal(c.id), 5);
});

test('備份與還原：匯出後匯入可完整還原', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: '端端', startPoints: 100 });
  const p = store.addItem({ kind: 'bonus', name: 'p', points: 20 });
  store.recordItem(c.id, p.id);
  const json = store.exportJSON();

  const other = makeStore().store;
  other.importJSON(json);
  assert.equal(other.getTotal(c.id), 120);
  assert.equal(other.getTodayNet(c.id), 20);
  assert.throws(() => other.importJSON('not json'), /有效的 JSON/);
  assert.throws(() => other.importJSON('{"foo":1}'), /備份檔/);
  assert.equal(other.getTotal(c.id), 120, '匯入失敗不影響現有資料');
});

test('遷移：無版本號的舊資料可讀入；較新版本會拒絕；損毀資料會保留備份', () => {
  const d = migrate({ children: [{ id: 'c1', name: 'A', startPoints: '7' }], records: [{ id: 'r', childId: 'c1', type: 'bonus', points: 3, date: '2026-11-06', ts: 1 }] });
  assert.equal(d.schemaVersion, 1);
  assert.equal(d.children[0].startPoints, 7);
  assert.deepEqual(d.items, []);
  assert.throws(() => migrate({ schemaVersion: 99, children: [] }), /較新版本/);

  const saved = {};
  const storage = memoryStorage();
  const spy = { getItem: storage.getItem, removeItem: storage.removeItem,
    setItem: (k, v) => { saved[k] = v; storage.setItem(k, v); } };
  spy.setItem(STORAGE_KEY, '{broken');
  const s = new Store({ storage: spy, seed: false });
  assert.equal(s.getChildren().length, 0);
  const backupKey = Object.keys(saved).find(k => k.startsWith(STORAGE_KEY + '-corrupt-'));
  assert.ok(backupKey, '損毀資料另存備份');
  assert.equal(saved[backupKey], '{broken');
});

test('首次使用會放入範例規則', () => {
  const s = new Store({ storage: memoryStorage() });
  assert.ok(s.getItems('bonus').length > 0);
  assert.ok(s.getItems('penalty').every(i => i.points < 0));
});

test('自填點數：加分自填正數、扣分自動轉負數、未輸入會拒絕', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: 'A' });
  const b = store.addItem({ kind: 'bonus', name: '英文課', points: 0, custom: true });
  const p = store.addItem({ kind: 'penalty', name: '其他', points: 5, custom: true });
  assert.equal(store.recordItem(c.id, b.id, '12').points, 12);
  assert.equal(store.recordItem(c.id, p.id, 7).points, -7);
  assert.throws(() => store.recordItem(c.id, b.id, ''), /請輸入點數/);
  assert.equal(store.getTodayNet(c.id), 5);
});

test('額外能量星星：記錄在規則與紀錄上，不影響生活點數', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: 'A' });
  const b = store.addItem({ kind: 'bonus', name: '表達心情', points: 0, stars: 10 });
  const rec = store.recordItem(c.id, b.id);
  assert.equal(rec.stars, 10);
  assert.equal(rec.points, 0);
  assert.equal(store.getTotal(c.id), 0);
});

test('舊資料沒有 custom / stars 欄位時自動補預設值', () => {
  const d = migrate({ children: [{ id: 'c1', name: 'A' }], items: [{ id: 'i', kind: 'bonus', name: 'x', points: 3 }],
    records: [{ id: 'r', childId: 'c1', type: 'bonus', points: 3, date: '2026-11-06', ts: 1 }] });
  assert.equal(d.items[0].custom, false);
  assert.equal(d.items[0].stars, 0);
  assert.equal(d.records[0].stars, 0);
});

test('匯入規則：保留現有資料、孩子依名稱對應、相同規則不重複、新孩子自動新增', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: '端端', startPoints: 50 });
  const p = store.addItem({ kind: 'bonus', name: '主動幫忙', points: 5 });
  store.recordItem(a.id, p.id);
  const file = JSON.stringify({
    children: [{ id: 'x1', name: '端端' }, { id: 'x2', name: '波妞' }],
    items: [
      { id: 'i1', kind: 'bonus', name: '主動幫忙', points: 5, childIds: 'all' },          // 重複
      { id: 'i2', kind: 'task', name: '說好話', points: 10, childIds: ['x1'], frequency: { type: 'daily' } },
      { id: 'i3', kind: 'task', name: '說好話', points: 5, childIds: ['x2'], frequency: { type: 'daily' } }
    ],
    rewards: [{ id: 'r1', name: '看卡通', cost: 30 }],
    records: [{ id: 'z', childId: 'x1', type: 'bonus', points: 999, date: '2026-11-06', ts: 1 }]
  });
  const r = store.mergeRules(file);
  assert.deepEqual(r, { childrenAdded: ['波妞'], itemsAdded: 2, itemsUpdated: 0, itemsUnchanged: 1, itemsSkipped: 0,
    rewardsAdded: 1, rewardsUpdated: 0, rewardsUnchanged: 0 });
  assert.equal(store.getTotal(a.id), 55, '原本的紀錄保留，檔案紀錄不匯入');
  const bo = store.getChildren().find(c => c.name === '波妞');
  assert.deepEqual(store.getTodayTasks(a.id).map(t => t.task.points), [10]);
  assert.deepEqual(store.getTodayTasks(bo.id).map(t => t.task.points), [5]);
  // 再匯入一次全部略過
  const again = store.mergeRules(file);
  assert.equal(again.itemsAdded, 0);
  assert.equal(again.itemsUnchanged, 3);
  assert.equal(again.rewardsUnchanged, 1);
  assert.throws(() => store.mergeRules('{"children":[]}'), /沒有規則/);
});

// ---------- CSV 規則表 ----------
const { csvToRules, parseCSV, parseFrequency } = require('../js/rules-csv.js');
const fsT = require('node:fs');
const pathT = require('node:path');

test('CSV 解析：引號、逗號、換行、BOM', () => {
  const rows = parseCSV('﻿a,b\r\n"x,1","he said ""hi"""\n"多\n行",3\n\n');
  assert.deepEqual(rows, [['a', 'b'], ['x,1', 'he said "hi"'], ['多\n行', '3']]);
});

test('頻率文字對應', () => {
  assert.deepEqual(parseFrequency('每天（上學日）'), { type: 'weekdays' });
  assert.deepEqual(parseFrequency('每天'), { type: 'daily' });
  assert.deepEqual(parseFrequency('每次／每天'), { type: 'daily' });
  assert.deepEqual(parseFrequency('每週'), { type: 'weeklyN', n: 1 });
  assert.deepEqual(parseFrequency('每週3次'), { type: 'weeklyN', n: 3 });
  assert.deepEqual(parseFrequency('每週三次'), { type: 'weeklyN', n: 3 });
  assert.deepEqual(parseFrequency('每週一三五'), { type: 'days', days: [1, 3, 5] });
  assert.deepEqual(parseFrequency('達成一次'), { type: 'once' });
  assert.equal(parseFrequency('每餐'), null);
  assert.equal(parseFrequency('每次（30分鐘）'), null);
  assert.equal(parseFrequency('每頁'), null);
});

test('CSV 轉規則：類型、對象、自填、星星、另扣錢、競賽冠軍、警告', () => {
  const text = fsT.readFileSync(pathT.join(__dirname, 'fixtures/sample-rules.csv'), 'utf8');
  const { data, warnings } = csvToRules(text);
  const by = (sid) => data.items.find(i => i.sourceId === sid);
  assert.equal(by('R001').kind, 'bonus');
  assert.equal(by('R001').childIds, 'all');
  assert.deepEqual(by('R009').frequency, { type: 'weekdays' });
  assert.equal(by('R016').kind, 'bonus');
  assert.deepEqual(by('R029').frequency, { type: 'daily' });
  assert.deepEqual(by('R032').frequency, { type: 'daily' });
  assert.equal(by('R033').stars, 5);
  assert.equal(by('R038').points, 0);
  assert.equal(by('R038').stars, 10);
  assert.deepEqual(by('R044').frequency, { type: 'once' });
  assert.equal(by('R047').custom, true);
  assert.deepEqual(by('R053').frequency, { type: 'weeklyN', n: 1 });
  assert.equal(by('R055').points, -20);
  assert.equal(by('R061').name, '破壞家裡物品（另扣錢）');
  assert.equal(by('R067').kind, 'bonus', '競賽冠軍是加分按鈕');
  assert.equal(by('R090').name, '練習3次,每次10分鐘');
  assert.equal(by('R090').childIds.length, 2);
  assert.deepEqual(by('R091').frequency, { type: 'days', days: [1, 3, 5] });
  assert.deepEqual(data.children.map(c => c.name), ['小美', '小明']);
  assert.equal(data.items.length, 16, '空名稱與錯誤類型的列略過');
  assert.ok(warnings.some(w => w.includes('第 19 列') && w.includes('奇怪類型')));
});

test('CSV 匯入後再修改：依規則ID更新分數、改名、改適用孩子，紀錄保留', () => {
  const { store } = makeStore();
  const ming = store.addChild({ name: '小明' });
  store.addChild({ name: '小美' });
  const text = fsT.readFileSync(pathT.join(__dirname, 'fixtures/sample-rules.csv'), 'utf8');
  const r1 = store.mergeRules(csvToRules(text).data);
  assert.equal(r1.itemsAdded, 16);
  assert.deepEqual(r1.childrenAdded, []);
  const helpMing = store.getItemsFor(ming.id, 'bonus').filter(i => i.name === '主動幫忙');
  assert.equal(helpMing.length, 1, '每個孩子只看到自己的主動幫忙');
  store.recordItem(ming.id, helpMing[0].id);

  const edited = text
    .replace('R001,加分,用餐,兩位孩子,30分鐘內吃完,3', 'R001,加分,用餐,兩位孩子,20分鐘內吃完,4')
    .replace('R055,扣分,改正,兩位孩子,大吼大叫,-20', 'R055,扣分,改正,小明,大吼大叫,-15');
  const r2 = store.mergeRules(csvToRules(edited).data);
  assert.equal(r2.itemsAdded, 0);
  assert.equal(r2.itemsUpdated, 2);
  assert.equal(r2.itemsUnchanged, 14);
  const eat = store.getItems('bonus').find(i => i.sourceId === 'R001');
  assert.equal(eat.name, '20分鐘內吃完');
  assert.equal(eat.points, 4);
  const yell = store.getItems('penalty').find(i => i.sourceId === 'R055');
  assert.equal(yell.points, -15);
  assert.deepEqual(yell.childIds, [ming.id]);
  assert.equal(store.getTotal(ming.id), 5, '紀錄保留');
});

test('先用 JSON 匯入合併規則（無規則ID），之後改用 CSV 匯入不會重複', () => {
  const { store } = makeStore();
  const ming = store.addChild({ name: '小明' });
  const mei = store.addChild({ name: '小美' });
  store.addItem({ kind: 'bonus', name: '主動幫忙', points: 5, stars: 5, childIds: 'all' });
  const text = fsT.readFileSync(pathT.join(__dirname, 'fixtures/sample-rules.csv'), 'utf8');
  store.mergeRules(csvToRules(text).data);
  const help = (cid) => store.getItemsFor(cid, 'bonus').filter(i => i.name === '主動幫忙');
  assert.equal(help(ming.id).length, 1);
  assert.equal(help(mei.id).length, 1);
  assert.equal(store.getItems('bonus').filter(i => i.name === '主動幫忙').length, 2);
});

test('使用者實際規則表可完整轉換（若有提供）', { skip: !process.env.FAMILY_CSV }, () => {
  const { data, warnings } = csvToRules(fsT.readFileSync(process.env.FAMILY_CSV, 'utf8'));
  console.log('  items:', data.items.length, 'warnings:', warnings);
  assert.equal(data.items.length, 48);
});

test('CSV 只指定部分孩子的同名規則，不會把原本給全部孩子的規則搶走', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: '端端' });
  const b = store.addChild({ name: '波妞' });
  store.addItem({ kind: 'bonus', name: '主動幫忙', points: 5, childIds: 'all' });
  const csv = '規則ID,規則類型,適用對象,任務或行為,點數變動,計算頻率\nR1,加分,小美,主動幫忙,8,每次\n';
  const r = store.mergeRules(csvToRules(csv).data);
  assert.equal(r.itemsAdded, 1);
  const mei = store.getChildren().find(c => c.name === '小美');
  for (const c of [a, b]) {
    const it = store.getItemsFor(c.id, 'bonus').filter(i => i.name === '主動幫忙');
    assert.equal(it.length, 1); assert.equal(it[0].points, 5);
  }
  const m = store.getItemsFor(mei.id, 'bonus').filter(i => i.name === '主動幫忙');
  assert.equal(m.length, 1); assert.equal(m[0].points, 8);
});

// ---------- 更正紀錄 ----------
test('修改紀錄：點數（扣分自動負數）、日期、孩子；總點數與今日得分同步', () => {
  const { store } = makeStore('2026-11-06T10:00:00');
  const a = store.addChild({ name: 'A' });
  const b = store.addChild({ name: 'B' });
  const p = store.addItem({ kind: 'penalty', name: '大叫', points: 10 });
  const r = store.recordItem(a.id, p.id);
  store.updateRecord(r.id, { points: 5 });
  assert.equal(store.getRecord(r.id).points, -5);
  assert.equal(store.getTodayNet(a.id), -5);
  store.updateRecord(r.id, { date: '2026-11-05' });
  assert.equal(store.getTodayNet(a.id), 0);
  assert.equal(store.getNetForDate(a.id, '2026-11-05'), -5);
  assert.equal(store.getTotal(a.id), -5);
  store.updateRecord(r.id, { childId: b.id });
  assert.equal(store.getTotal(a.id), 0);
  assert.equal(store.getTotal(b.id), -5);
  assert.throws(() => store.updateRecord(r.id, { date: '2026-11-07' }), /未來/);
  assert.throws(() => store.updateRecord(r.id, { date: '2026-02-30' }), /日期格式/);
});

test('修改日期後「撤銷上一筆」仍依時間順序', () => {
  const { store, setDate } = makeStore('2026-11-06T09:00:00');
  const a = store.addChild({ name: 'A' });
  const p = store.addItem({ kind: 'bonus', name: 'p', points: 1 });
  const first = store.recordItem(a.id, p.id);
  setDate('2026-11-06T10:00:00');
  const second = store.recordItem(a.id, p.id);
  store.updateRecord(second.id, { date: '2026-11-01' });
  assert.equal(store.getLastRecord(a.id).id, first.id);
});

test('刪除任一筆紀錄', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A', startPoints: 10 });
  const p = store.addItem({ kind: 'bonus', name: 'p', points: 3 });
  const r1 = store.recordItem(a.id, p.id);
  store.recordItem(a.id, p.id);
  store.deleteRecord(r1.id);
  assert.equal(store.getTotal(a.id), 13);
  assert.equal(store.getRecords(a.id).length, 1);
});

test('補登過去日期：加分、任務（不可同日重複）、自填需輸入點數', () => {
  const { store } = makeStore('2026-11-06T10:00:00');
  const a = store.addChild({ name: 'A' });
  const b = store.addItem({ kind: 'bonus', name: '幫忙', points: 5 });
  const t = store.addItem({ kind: 'task', name: '刷牙', points: 3 });
  const c = store.addItem({ kind: 'penalty', name: '其他', points: 0, custom: true });
  store.addRecordOn(a.id, b.id, '2026-11-04');
  store.addRecordOn(a.id, b.id, '2026-11-04', 8);
  store.addRecordOn(a.id, t.id, '2026-11-04');
  assert.throws(() => store.addRecordOn(a.id, t.id, '2026-11-04'), /已經完成/);
  assert.throws(() => store.addRecordOn(a.id, c.id, '2026-11-04'), /請輸入點數/);
  assert.equal(store.addRecordOn(a.id, c.id, '2026-11-04', 4).points, -4);
  assert.equal(store.getNetForDate(a.id, '2026-11-04'), 5 + 8 + 3 - 4);
  assert.equal(store.getTodayNet(a.id), 0);
  assert.equal(store.getTaskStatus(a.id, t).doneToday, false, '補登昨天不影響今天任務');
  assert.throws(() => store.addRecordOn(a.id, b.id, '2026-11-10'), /未來/);
  // 補登不會變成「上一筆」
  const today = store.recordItem(a.id, b.id);
  store.addRecordOn(a.id, b.id, '2026-11-01');
  assert.equal(store.getLastRecord(a.id).id, today.id);
});

// ---------- 總覽統計 ----------
const R = require('../js/report.js');

test('期間範圍：日、週（週一開始）、月', () => {
  assert.deepEqual([R.periodRange('day', '2026-11-06').start, R.periodRange('day', '2026-11-06').end], ['2026-11-06', '2026-11-06']);
  const w = R.periodRange('week', '2026-11-06');
  assert.deepEqual([w.start, w.end, w.prev, w.next], ['2026-11-02', '2026-11-08', '2026-10-26', '2026-11-09']);
  const m = R.periodRange('month', '2026-02-15');
  assert.deepEqual([m.start, m.end, m.prev, m.next], ['2026-02-01', '2026-02-28', '2026-01-01', '2026-03-01']);
});

test('期間合計與規則排行', () => {
  const { store } = makeStore('2026-11-06T10:00:00');
  const a = store.addChild({ name: 'A', startPoints: 100 });
  const b = store.addItem({ kind: 'bonus', name: '幫忙', points: 5, stars: 2 });
  const p = store.addItem({ kind: 'penalty', name: '大叫', points: 10 });
  const t = store.addItem({ kind: 'task', name: '刷牙', points: 3 });
  const rw = store.addReward({ name: '卡通', cost: 30 });
  store.addRecordOn(a.id, b.id, '2026-11-02');
  store.addRecordOn(a.id, b.id, '2026-11-03');
  store.addRecordOn(a.id, p.id, '2026-11-03');
  store.addRecordOn(a.id, t.id, '2026-11-04');
  store.addRecordOn(a.id, b.id, '2026-10-30'); // 上週
  store.redeemReward(a.id, rw.id);
  const s = R.summarize(store, a.id, '2026-11-02', '2026-11-08');
  assert.deepEqual([s.bonus, s.penalty, s.task, s.net, s.reward, s.stars, s.days], [13, -10, 3, 3, 30, 4, 3], '每日任務併入加分');
  const top = R.ranking(store, a.id, '2026-11-02', '2026-11-08', 'bonus');
  assert.deepEqual(top, [{ name: '幫忙', count: 2, points: 10 }, { name: '刷牙', count: 1, points: 3 }]);
});

test('任務完成率：每日、平日、每週 N 次，只算到今天且不算任務建立前', () => {
  const { store, setDate } = makeStore('2026-11-01T08:00:00'); // 週日建立
  const a = store.addChild({ name: 'A' });
  const daily = store.addItem({ kind: 'task', name: '刷牙', points: 1 });
  const wk = store.addItem({ kind: 'task', name: '上學', points: 1, frequency: { type: 'weekdays' } });
  const n = store.addItem({ kind: 'task', name: '運動', points: 1, frequency: { type: 'weeklyN', n: 3 } });
  setDate('2026-11-05T20:00:00'); // 週四
  store.addRecordOn(a.id, daily.id, '2026-11-02');
  store.addRecordOn(a.id, daily.id, '2026-11-03');
  store.addRecordOn(a.id, wk.id, '2026-11-02');
  store.addRecordOn(a.id, n.id, '2026-11-04');
  const rows = R.taskCompletion(store, a.id, '2026-11-02', '2026-11-08');
  const by = Object.fromEntries(rows.map(r => [r.task.name, r]));
  assert.equal(by['刷牙'].label, '2/4 天');   // 一～四
  assert.equal(by['上學'].label, '1/4 天');
  assert.equal(by['運動'].label, '1/3 次');
  const month = R.taskCompletion(store, a.id, '2026-11-01', '2026-11-30');
  assert.equal(month.find(r => r.task.name === '刷牙').target, 5, '11/1～11/5');
});

test('加分與每日任務可互相切換；扣分不能改成加分；紀錄保留', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A' });
  const b = store.addItem({ kind: 'bonus', name: '刷牙', points: 5, custom: true });
  store.updateItem(b.id, { kind: 'task', frequency: { type: 'weekdays' } });
  assert.equal(store.getItem(b.id).kind, 'task');
  assert.equal(store.getItem(b.id).custom, false, '每日任務不可自填');
  store.completeTask(a.id, b.id);
  store.updateItem(b.id, { kind: 'bonus' });
  assert.equal(store.getItem(b.id).kind, 'bonus');
  assert.equal(store.getTotal(a.id), 5);
  const p = store.addItem({ kind: 'penalty', name: 'x', points: 3 });
  assert.throws(() => store.updateItem(p.id, { kind: 'bonus' }), /扣分/);
});

// ---------- 頭銜、等級、每週目標、本週挑戰 ----------
test('孩子頭銜、代表圖示、每週目標；舊資料自動補預設值', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A', title: ' 小小店長 ', badge: '🏪', weeklyGoal: 500 });
  assert.equal(a.title, '小小店長');
  store.updateChild(a.id, { weeklyGoal: -3 });
  assert.equal(store.getChild(a.id).weeklyGoal, 0);
  const d = migrate({ children: [{ id: 'c', name: 'B' }] });
  assert.deepEqual([d.children[0].title, d.children[0].badge, d.children[0].weeklyGoal], ['', '', 0]);
  assert.deepEqual(d.challenges, []);
});

test('等級：起始點數＋累計得分，每 1000 分升 1 級；扣分抵銷、兌換不影響', () => {
  const { store } = makeStore();
  const a = store.addChild({ name: 'A', startPoints: 2500 });
  assert.deepEqual([store.getLevel(a.id).level, store.getLevel(a.id).earned], [3, 2500], '起始點數計入等級');
  const b = store.addItem({ kind: 'bonus', name: 'b', points: 500 });
  const p = store.addItem({ kind: 'penalty', name: 'p', points: 200 });
  store.recordItem(a.id, b.id);
  let lv = store.getLevel(a.id);
  assert.deepEqual([lv.level, lv.earned, lv.current, lv.next], [4, 3000, 3000, 4000], '剛好 3000 升 Lv.4');
  store.recordItem(a.id, p.id);
  assert.deepEqual([store.getLevel(a.id).level, store.getLevel(a.id).earned], [3, 2800], '扣分抵銷');
  const r = store.addReward({ name: '冰淇淋', cost: 2000 });
  store.redeemReward(a.id, r.id);
  assert.equal(store.getLevel(a.id).earned, 2800, '兌換獎勵不影響等級');
  const c = store.addChild({ name: 'C' });
  lv = store.getLevel(c.id);
  assert.deepEqual([lv.level, lv.current, lv.next], [1, 0, 1000], '新孩子 Lv.1，1000 分升 Lv.2');
  const big = store.addItem({ kind: 'bonus', name: 'big', points: 999 });
  store.recordItem(c.id, big.id);
  assert.equal(store.getLevel(c.id).level, 1, '999 分仍是 Lv.1');
  const pen = store.addItem({ kind: 'penalty', name: 'pen', points: 5000 });
  store.recordItem(c.id, pen.id);
  assert.deepEqual([store.getLevel(c.id).level, store.getLevel(c.id).earned], [1, 0], '總分不會低於 0');
});

test('每週淨得分：週一開始，不含上週', () => {
  const { store, setDate } = makeStore('2026-11-01T10:00:00'); // 週日
  const a = store.addChild({ name: 'A' });
  const b = store.addItem({ kind: 'bonus', name: 'b', points: 10 });
  store.recordItem(a.id, b.id);
  setDate('2026-11-03T10:00:00');
  store.recordItem(a.id, b.id);
  store.recordItem(a.id, b.id);
  assert.equal(store.getWeekNet(a.id), 20);
});

test('本週挑戰：規則次數、每日任務以天數計、淨得分；達成才能領、一週一次、撤銷可重領', () => {
  const { store, setDate } = makeStore('2026-11-02T10:00:00'); // 週一
  const a = store.addChild({ name: 'A' });
  const b = store.addChild({ name: 'B' });
  const help = store.addItem({ kind: 'bonus', name: '幫忙', points: 5 });
  const brush = store.addItem({ kind: 'task', name: '刷牙', points: 2 });
  const pen = store.addItem({ kind: 'penalty', name: 'x', points: 5 });
  assert.throws(() => store.addChallenge({ name: 'bad', metric: 'item', itemId: pen.id, target: 1 }), /加分/);
  const c1 = store.addChallenge({ name: '幫忙 2 次', metric: 'item', itemId: help.id, target: 2, rewardPoints: 20, rewardStars: 3 });
  const c2 = store.addChallenge({ name: '刷牙 2 天', metric: 'item', itemId: brush.id, target: 2, rewardPoints: 10, childIds: [a.id] });
  const c3 = store.addChallenge({ name: '淨得分 12', metric: 'net', target: 12, rewardPoints: 50 });
  assert.equal(store.getChallengesFor(b.id).length, 2);

  store.recordItem(a.id, help.id);
  assert.throws(() => store.claimChallenge(a.id, c1.id), /還沒達成/);
  store.recordItem(a.id, help.id);
  assert.equal(store.getChallengeStatus(b.id, c1).progress, 0, '孩子各自計算');
  const rec = store.claimChallenge(a.id, c1.id);
  assert.deepEqual([rec.points, rec.stars, rec.type], [20, 3, 'bonus']);
  assert.throws(() => store.claimChallenge(a.id, c1.id), /已經領取/);
  // 淨得分挑戰不含自己的獎勵，但含其他挑戰獎勵：5+5+20 = 30 ≥ 12
  assert.equal(store.getChallengeStatus(a.id, c3).progress, 30);
  store.undoLast(a.id);
  assert.equal(store.getChallengeStatus(a.id, c1).claimed, false, '撤銷後可重領');

  store.completeTask(a.id, brush.id);
  setDate('2026-11-03T10:00:00');
  store.completeTask(a.id, brush.id);
  assert.equal(store.getChallengeStatus(a.id, c2).progress, 2);
  setDate('2026-11-09T10:00:00'); // 下週一
  assert.equal(store.getChallengeStatus(a.id, c2).progress, 0, '每週重新計算');
  store.deleteItem(help.id);
  assert.equal(store.getChallenge(c1.id).itemId, null);
});

test('預設資料含範例挑戰，備份還原包含挑戰', () => {
  const s = new Store({ storage: memoryStorage() });
  assert.equal(s.getChallenges().length, 2);
  const other = new Store({ storage: memoryStorage(), seed: false });
  other.importJSON(s.exportJSON());
  assert.equal(other.getChallenges().length, 2);
});

// ---------- Phase 2：冒險解鎖與能量星星 ----------
const { starsForNet } = require('../js/store.js');

test('能量星星換算：ceil(淨得分 / 5)', () => {
  assert.deepEqual([1, 5, 6, 10, 35, 50, 100].map(starsForNet), [1, 1, 2, 2, 7, 10, 20]);
  assert.equal(starsForNet(0), 0);
  assert.equal(starsForNet(-7), 0);
});

function p2Store() {
  const ctx = makeStore('2026-11-06T10:00:00');
  const a = ctx.store.addChild({ name: 'A' });
  const b20 = ctx.store.addItem({ kind: 'bonus', name: '+20', points: 20 });
  const b50 = ctx.store.addItem({ kind: 'bonus', name: '+50', points: 50 });
  const m20 = ctx.store.addItem({ kind: 'penalty', name: '-20', points: 20 });
  const m15 = ctx.store.addItem({ kind: 'penalty', name: '-15', points: 15 });
  return Object.assign(ctx, { a, b20, b50, m20, m15 });
}

test('Phase 2 案例 A：今日 +20 → 解鎖、取得 4 星', () => {
  const { store, a, b20 } = p2Store();
  store.recordItem(a.id, b20.id);
  const st = store.getAdventureStatus(a.id);
  assert.equal(st.unlocked, true);
  assert.equal(st.previewStars, 4);
  assert.equal(store.settleToday(a.id).stars, 4);
  assert.equal(store.getStarBalance(a.id), 4);
});

test('Phase 2 案例 B：+20、-20 淨得分 0 → 不解鎖、不得星', () => {
  const { store, a, b20, m20 } = p2Store();
  store.recordItem(a.id, b20.id);
  store.recordItem(a.id, m20.id);
  const st = store.getAdventureStatus(a.id);
  assert.equal(st.unlocked, false);
  assert.equal(st.previewStars, 0);
  assert.throws(() => store.settleToday(a.id), /尚未解鎖/);
  assert.equal(store.getStarBalance(a.id), 0);
});

test('Phase 2 案例 C：+50、-15 淨得分 35 → 7 星', () => {
  const { store, a, b50, m15 } = p2Store();
  store.recordItem(a.id, b50.id);
  store.recordItem(a.id, m15.id);
  assert.equal(store.settleToday(a.id).stars, 7);
});

test('Phase 2 案例 D：取得 7 星後重新載入、重複進入，不得再次增加', () => {
  const storage = memoryStorage();
  const now = () => new Date('2026-11-06T10:00:00');
  const s1 = new Store({ storage, seed: false, now });
  const a = s1.addChild({ name: 'A' });
  const b = s1.addItem({ kind: 'bonus', name: 'b', points: 50 });
  const m = s1.addItem({ kind: 'penalty', name: 'm', points: 15 });
  s1.recordItem(a.id, b.id);
  s1.recordItem(a.id, m.id);
  s1.settleToday(a.id);
  const s2 = new Store({ storage, seed: false, now }); // 重新整理／重新開啟
  assert.equal(s2.settleToday(a.id).stars, 7);
  s2.settleToday(a.id);
  assert.equal(s2.getStarBalance(a.id), 7);
  assert.equal(s2.data.adventure.settlements.length, 1);
  // 結算後再加分，今天不會再發星
  s2.recordItem(a.id, b.id);
  assert.equal(s2.settleToday(a.id).stars, 7);
  assert.equal(s2.getStarBalance(a.id), 7);
  // 匯入含重複結算的資料也只保留一筆
  const raw = JSON.parse(s2.exportJSON());
  raw.adventure.settlements.push(Object.assign({}, raw.adventure.settlements[0], { id: 'dup' }));
  s2.importJSON(JSON.stringify(raw));
  assert.equal(s2.getStarBalance(a.id), 7);
});

test('Phase 2：每個孩子獨立；結算後淨得分變 0 仍維持今日解鎖；隔天重新判斷；過去未結算不補', () => {
  const { store, setDate, a, b20, m20 } = p2Store();
  const c = store.addChild({ name: 'C' });
  store.recordItem(a.id, b20.id);
  store.settleToday(a.id);
  assert.equal(store.getAdventureStatus(c.id).unlocked, false, '孩子各自判斷');
  assert.equal(store.getStarBalance(c.id), 0);
  store.recordItem(a.id, m20.id);
  assert.equal(store.getAdventureStatus(a.id).unlocked, true, '今天已結算維持解鎖');
  store.recordItem(c.id, b20.id); // C 今天沒結算
  setDate('2026-11-07T09:00:00');
  assert.equal(store.getAdventureStatus(a.id).unlocked, false, '隔天重新判斷');
  assert.equal(store.getAdventureStatus(c.id).previewStars, 0, '昨天沒結算就沒了');
  store.addRecordOn(c.id, b20.id, '2026-11-06'); // 補登昨天也不會給星
  assert.equal(store.getAdventureStatus(c.id).previewStars, 0);
  assert.equal(store.getStarBalance(a.id), 4);
});

test('Phase 2：額外星星結算時一併發放；結算後才記的留到下次結算', () => {
  const { store, setDate, a, b20 } = p2Store();
  const help = store.addItem({ kind: 'bonus', name: '幫忙', points: 5, stars: 5 });
  const feel = store.addItem({ kind: 'bonus', name: '表達心情', points: 0, stars: 10 });
  store.recordItem(a.id, help.id);       // +5 點、⭐5
  const st = store.getAdventureStatus(a.id);
  assert.deepEqual([st.previewBase, st.previewBonus, st.previewStars], [1, 5, 6]);
  const x = store.settleToday(a.id);
  assert.deepEqual([x.baseStars, x.bonusStars, x.stars], [1, 5, 6]);
  store.recordItem(a.id, feel.id);       // 結算後才記：⭐10 留到明天
  assert.equal(store.getAdventureStatus(a.id).previewBonus, 10);
  setDate('2026-11-07T09:00:00');
  store.recordItem(a.id, b20.id);
  const y = store.settleToday(a.id);
  assert.deepEqual([y.baseStars, y.bonusStars], [4, 10]);
  assert.equal(store.getStarBalance(a.id), 20);
  assert.equal(store.getTotal(a.id), 25, '星星不影響生活點數');
});

// ---------- Phase 3：最小可玩金島 ----------
const G = require('../js/game.js');

/** 可控制骰子結果的 Store：rolls 依序給 random() 的值 */
function p3Store(randoms, dateStr = '2026-11-06T10:00:00') {
  const ctx = makeStore(dateStr);
  const seq = randoms ? randoms.slice() : [];
  ctx.store.random = () => (seq.length ? seq.shift() : 0);
  const a = ctx.store.addChild({ name: 'A' });
  const big = ctx.store.addItem({ kind: 'bonus', name: '大', points: 100 });
  ctx.store.recordItem(a.id, big.id);   // 淨得分 100 → 20 星
  ctx.store.settleToday(a.id);
  return Object.assign(ctx, { a, big, push: (...v) => seq.push(...v) });
}
/** 讓 rint(1,6) 回傳 n 的 random 值 */
const face = (n, sides = 6) => (n - 1 + 0.5) / sides;

test('金島第一區資料：30 格、起點與區域邊界、穩定 ID', () => {
  const b = G.BOARDS.gold;
  assert.equal(b.tiles.length, 31, '0 = 起點，1～30 共 30 格');
  assert.equal(b.tiles[0].type, 'start');
  assert.equal(b.tiles[30].type, 'boundary', '第 30 格是第一區的暫時邊界，不是全島終點');
  assert.ok(['chest', 'chance', 'minigame', 'normal'].every(t => b.tiles.some(x => x.type === t)));
  const keys = new Set(b.tiles.map(t => t.id));
  assert.equal(keys.size, 31, '格子 ID 唯一');
});

test('Phase 3 案例 A：購買 6 面骰扣 5 星、進背包', () => {
  const { store, a } = p3Store();
  assert.equal(store.getStarBalance(a.id), 20);
  store.buyItem(a.id, 'd6');
  assert.equal(store.getStarBalance(a.id), 15);
  assert.equal(store.getPlayer(a.id).bag.d6, 1);
  store.buyItem(a.id, 'd12');
  store.buyItem(a.id, 'skates');
  assert.equal(store.getStarBalance(a.id), 1);
  assert.throws(() => store.buyItem(a.id, 'd6'), /不夠/);
  assert.equal(store.getTotal(a.id), 100, '生活點數不受影響');
});

test('Phase 3 案例 B：擲出 4 逐格移動 1→2→3→4', () => {
  const { store, a, push } = p3Store();
  store.buyItem(a.id, 'd6');
  push(face(4));
  const r = store.rollDice(a.id, 'd6');
  assert.equal(r.value, 4);
  assert.deepEqual(r.path, [1, 2, 3, 4]);
  assert.equal(store.getPlayer(a.id).pos >= 4, true);
});

test('Phase 3 案例 C：每天最多 3 次骰子（6 面、12 面都算），溜冰鞋不算', () => {
  const { store, a } = p3Store();
  store.random = () => 0; // 都擲 1，停在一般格或事件格皆可
  store.buyItem(a.id, 'd6'); store.buyItem(a.id, 'd6'); store.buyItem(a.id, 'd6');
  store.getPlayer(a.id).bag.d12 = 2;
  store.rollDice(a.id, 'd6');
  store.rollDice(a.id, 'd12');
  store.rollDice(a.id, 'd6');
  assert.equal(store.getRollsToday(a.id), 3);
  assert.throws(() => store.rollDice(a.id, 'd6'), /今天已經擲了 3 次/);
  assert.throws(() => store.rollDice(a.id, 'd12'), /今天已經擲了 3 次/);
  store.getPlayer(a.id).bag.skates = 1;
  assert.doesNotThrow(() => store.useSkates(a.id), '溜冰鞋不受擲骰上限限制');
});

test('Phase 3 案例 D：剩餘骰子隔天仍存在；隔天擲骰次數重新計算；未出發不能玩', () => {
  const storage = memoryStorage();
  let t = new Date('2026-11-06T10:00:00').getTime();
  const s1 = new Store({ storage, seed: false, now: () => new Date(t) });
  s1.random = () => 0;
  const a = s1.addChild({ name: 'A' });
  const b = s1.addItem({ kind: 'bonus', name: 'b', points: 100 });
  s1.recordItem(a.id, b.id); s1.settleToday(a.id);
  for (let i = 0; i < 4; i++) s1.buyItem(a.id, 'd6');
  for (let i = 0; i < 3; i++) s1.rollDice(a.id, 'd6');
  assert.equal(s1.getPlayer(a.id).bag.d6, 1);
  t = new Date('2026-11-07T09:00:00').getTime();
  const s2 = new Store({ storage, seed: false, now: () => new Date(t) }); // 隔天重新開啟
  assert.equal(s2.getPlayer(a.id).bag.d6, 1, '剩餘骰子保留');
  assert.throws(() => s2.rollDice(a.id, 'd6'), /尚未出發/, '當天沒出發不能玩');
  assert.throws(() => s2.buyItem(a.id, 'd6'), /尚未出發/);
  s2.recordItem(a.id, b.id); s2.settleToday(a.id);
  assert.equal(s2.getRollsToday(a.id), 0, '隔天重新計算');
  s2.random = () => 0;
  assert.doesNotThrow(() => s2.rollDice(a.id, 'd6'));
});

test('區域邊界：停在第 30 格，多的步數捨棄；在木門前不能再擲、不扣骰子', () => {
  const { store, a } = p3Store();
  store.setPlayerTile(a.id, 27);
  store.getPlayer(a.id).bag.d12 = 2;
  store.random = () => 0.99; // 擲 12
  const r = store.rollDice(a.id, 'd12');
  assert.deepEqual(r.path, [28, 29, 30]);
  assert.equal(r.event.type, 'boundary');
  assert.throws(() => store.rollDice(a.id, 'd12'), /木門/);
  assert.equal(store.getPlayer(a.id).bag.d12, 1);
  assert.equal(store.getRollsToday(a.id), 1);
});

test('寶箱格：星星或道具；機會格：前進 2 格、得 2 星、得 6 面骰', () => {
  const { store, a, push } = p3Store();
  const bag = store.getPlayer(a.id).bag;
  bag.d6 = 10;
  // 寶箱在第 5 格：擲 5，寶箱給星（roll<0.55，再擲 1～3 → 3）
  push(face(5), 0.1, 0.99);
  let r = store.rollDice(a.id, 'd6');
  assert.equal(r.event.type, 'chest');
  assert.equal(r.event.stars, 3);
  assert.equal(store.getStarBalance(a.id), 23);
  // 機會在第 9 格：擲 4，機會選 1（得 2 星）
  push(face(4), 0.5);
  r = store.rollDice(a.id, 'd6');
  assert.equal(r.event.type, 'chance');
  assert.equal(r.event.stars, 2);
  // 機會「前進 2 格」：放在第 3 格前一格
  store.setPlayerTile(a.id, 0);
  store.getPlayer(a.id).bag.skates = 1;
  push(0.0, 0.0);           // 溜冰鞋到 3（機會），選 0 → 前進 2 到 5（寶箱，roll 0 → 星 1）
  r = store.useSkates(a.id);
  assert.deepEqual(r.path, [1, 2, 3]);
  assert.deepEqual(r.event.extraPath, [4, 5]);
  assert.equal(r.event.then.type, 'chest');
  assert.equal(store.getPlayer(a.id).pos, 5);
});

test('角色：8 種冒險夥伴可選，每個孩子獨立；匯出入保留遊戲進度', () => {
  const { store, a } = p3Store();
  const b2 = store.addChild({ name: 'B' });
  store.setCharacter(a.id, 'horn');
  store.setCharacter(b2.id, 'flame');
  assert.throws(() => store.setCharacter(a.id, 'dragon'));
  assert.equal(G.CHARACTERS.length, 8, '8 種冒險夥伴');
  assert.deepEqual(G.CHARACTERS.map(c => c.name), ['圓耳獸', '長耳獸', '小角龍獸', '小翼獸', '水滴獸', '葉芽獸', '火苗獸', '石球獸']);
  store.buyItem(a.id, 'd6');
  const other = makeStore().store;
  other.importJSON(store.exportJSON());
  assert.equal(other.getPlayer(a.id).character, 'horn');
  assert.equal(other.getPlayer(b2.id).character, 'flame');
  assert.equal(other.getPlayer(a.id).bag.d6, 1);
  assert.equal(other.getStarBalance(a.id), 15);
});

test('頭像改為 8 種冒險夥伴：舊版表情符號自動轉換、與冒險棋子同步', () => {
  // 舊資料：表情符號頭像；第二位孩子已選過冒險夥伴
  const d = migrate({
    children: [{ id: 'a', name: 'A', avatar: '🐻' }, { id: 'b', name: 'B', avatar: '🐰' }, { id: 'c', name: 'C', avatar: 'flame' }],
    adventure: { players: { b: { pos: 3, character: 'stone', bag: {} } } }
  });
  assert.equal(d.children[0].avatar, 'roundear', '沒選過 → 依順序分配');
  assert.equal(d.children[1].avatar, 'stone', '已選過的冒險夥伴當頭像');
  assert.equal(d.children[2].avatar, 'flame', '已是夥伴代號就保留');
  assert.equal(d.adventure.players.b.character, 'stone');

  const { store } = makeStore();
  const x = store.addChild({ name: 'X' });
  const y = store.addChild({ name: 'Y' });
  assert.notEqual(x.avatar, y.avatar, '新孩子預設不同夥伴');
  store.setCharacter(x.id, 'wing');
  assert.equal(store.getChild(x.id).avatar, 'wing', '換冒險夥伴 → 頭像同步');
  store.updateChild(y.id, { avatar: 'drop' });
  assert.equal(store.getPlayer(y.id).character, 'drop', '換頭像 → 冒險夥伴同步');
  assert.throws(() => store.updateChild(y.id, { avatar: '🐶' }), /冒險夥伴/);
});

// ---------- 金島第一區：JSON 座標、穩定格子 ID、舊存檔遷移 ----------
const REGION01 = require('../js/board-gold.js');
const REGION_JSON = JSON.parse(fsT.readFileSync(pathT.join(__dirname, '../data/gold_region01_tiles.json'), 'utf8'));

test('金島第一區：地圖資料與 JSON 完全一致（30 格、ID 唯一、座標 0～1、事件依規格）', () => {
  assert.equal(REGION_JSON.referenceSize.width, 1080);
  assert.equal(REGION_JSON.referenceSize.height, 1350);
  assert.deepEqual(REGION01.tiles, REGION_JSON.tiles.map(t => ({ id: t.id, order: t.order, x: t.x, y: t.y, eventType: t.eventType })), 'board-gold.js 由 JSON 產生');
  const tiles = G.BOARDS.gold.tiles;
  for (let n = 1; n <= 30; n++) {
    assert.equal(tiles[n].id, REGION_JSON.tiles[n - 1].id);
    assert.equal(tiles[n].x, REGION_JSON.tiles[n - 1].x);
    assert.equal(tiles[n].y, REGION_JSON.tiles[n - 1].y);
  }
  assert.deepEqual([5, 12, 19, 26].map(n => tiles[n].type), ['chest', 'chest', 'chest', 'chest']);
  assert.deepEqual([3, 9, 15, 22, 28].map(n => tiles[n].type), ['chance', 'chance', 'chance', 'chance', 'chance']);
  assert.deepEqual([7, 17, 24].map(n => tiles[n].type), ['minigame', 'minigame', 'minigame']);
  assert.equal(tiles[30].type, 'boundary');
  assert.deepEqual(G.REGIONS.map(r => [r.id, r.from, r.to, r.available]),
    [['gold-01', 1, 30, true], ['gold-02', 31, 55, false], ['gold-03', 56, 80, false], ['gold-04', 81, 100, false]], '只預留其他三區');
});

test('金島第一區：位置存成穩定格子 ID；舊存檔整數格號自動遷移；重新開啟恢復', () => {
  const storage = memoryStorage();
  const now = () => new Date('2026-11-07T10:00:00');
  // 舊存檔：只有整數 pos
  storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, children: [{ id: 'k', name: 'K', avatar: 'flame' }],
    adventure: { players: { k: { pos: 7, bag: { d6: 1 } } } } }));
  const s1 = new Store({ storage, seed: false, now });
  assert.equal(s1.getPlayer('k').tileId, 'gold-01-007', '第 7 格 → gold-01-007');
  assert.equal(s1.getPlayer('k').bag.d6, 1, '背包保留');
  s1.setPlayerTile('k', 11); s1.save();
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(raw.adventure.players.k.tileId, 'gold-01-011');
  const s2 = new Store({ storage, seed: false, now });
  assert.equal(s2.getPlayer('k').pos, 11, '重新開啟依格子 ID 恢復');
  // 格子 ID 優先於整數（未來即使順序調整也以 ID 為準）
  const raw2 = JSON.parse(storage.getItem(STORAGE_KEY));
  raw2.adventure.players.k.pos = 3;
  storage.setItem(STORAGE_KEY, JSON.stringify(raw2));
  assert.equal(new Store({ storage, seed: false, now }).getPlayer('k').pos, 11);
  // 新玩家在起點（第 1 格前）
  const s3 = makeStore().store; const c = s3.addChild({ name: 'C' });
  assert.equal(s3.getPlayer(c.id).tileId, 'gold-01-start');
  assert.equal(s3.getPlayer(c.id).pos, 0);
});

test('移動途中不重複觸發事件、不重複扣道具：一次擲骰只結算一次', () => {
  const { store, a } = p3Store();
  store.getPlayer(a.id).bag.d6 = 1;
  const seq = [face(5), 0.1, 0.99]; // 擲 5 到寶箱格 → 給星 → 3 星
  store.random = () => (seq.length ? seq.shift() : 0);
  const before = store.getStarBalance(a.id);
  const r = store.rollDice(a.id, 'd6');
  assert.equal(r.event.type, 'chest');
  const after = store.getStarBalance(a.id);
  // 重新載入（模擬動畫中斷、重新整理）不會再次觸發
  const again = new Store({ storage: store.storage, seed: false, now: store.now });
  assert.equal(again.getStarBalance(a.id), after);
  assert.equal(again.getPlayer(a.id).bag.d6, 0);
  assert.equal(again.getPlayer(a.id).tileId, 'gold-01-005');
  assert.ok(after > before);
});

// ---------- Phase 4 第 1 步：命運格與特殊任務 ----------
test('Phase 4：命運格在第 11、14、21、27 格', () => {
  const b = G.BOARDS.gold;
  assert.deepEqual(b.tiles.filter(t => t.type === 'fate').map(t => t.n), [11, 14, 21, 27]);
  assert.equal(b.tiles[30].type, 'boundary');
});

test('Phase 4：命運卡抽到特殊任務 → 明天起 3 天內有效，完成 +20 點，撤銷恢復未完成', () => {
  const { store, a, push, setDate } = p3Store();
  store.buyItem(a.id, 'd6');
  store.setPlayerTile(a.id, 8);
  push(face(3), 0.1);                       // 擲 3 → 第 11 格命運格；0.1 → 指定家務
  const r = store.rollDice(a.id, 'd6');
  assert.equal(r.event.type, 'fate');
  assert.equal(r.event.special.kind, 'chore');
  let t = store.getSpecialTasks(a.id)[0];
  assert.deepEqual([t.status, t.startDate, t.endDate, t.points], ['upcoming', '2026-11-07', '2026-11-09', 20]);
  assert.throws(() => store.completeSpecialTask(t.id), /明天才開始/);
  setDate('2026-11-07T09:00:00');
  assert.equal(store.getSpecialTasks(a.id)[0].status, 'active');
  const total = store.getTotal(a.id);
  const rec = store.completeSpecialTask(t.id);
  assert.deepEqual([rec.type, rec.points, rec.name], ['bonus', 20, '特殊任務：完成指定家務']);
  assert.equal(store.getTotal(a.id), total + 20, '生活點數 +20');
  assert.equal(store.getTodayNet(a.id), 20, '計入今日淨得分');
  assert.equal(store.getStarBalance(a.id), 15, '不影響能量星星');
  assert.equal(store.getSpecialTasks(a.id)[0].status, 'done');
  assert.throws(() => store.completeSpecialTask(t.id), /已經完成/);
  store.undoLast(a.id);
  assert.equal(store.getSpecialTasks(a.id)[0].status, 'active', '撤銷紀錄 → 恢復未完成');
  setDate('2026-11-10T09:00:00');
  assert.equal(store.getSpecialTasks(a.id)[0].status, 'expired', '第 4 天過期');
  assert.throws(() => store.completeSpecialTask(t.id), /過期/);
  assert.equal(store.getTotal(a.id), total, '過期不扣分');
});

test('Phase 4：三種特殊任務、同一種進行中不重複新增、可取消', () => {
  const { store, a } = p3Store();
  assert.equal(store.addSpecialTask(a.id, 'chore').duplicate, false);
  assert.equal(store.addSpecialTask(a.id, 'praise').duplicate, false);
  assert.equal(store.addSpecialTask(a.id, 'helper').duplicate, false);
  const dup = store.addSpecialTask(a.id, 'chore');
  assert.equal(dup.duplicate, true);
  assert.equal(store.getSpecialTasks(a.id).length, 3);
  assert.deepEqual(store.getSpecialTasks(a.id).map(t => t.name), ['完成指定家務', '和所有家人說一句讚美的話和感謝的話', '幫忙大師：幫家人做 3 件事']);
  store.cancelSpecialTask(dup.task.id);
  assert.equal(store.getSpecialTasks(a.id).find(t => t.kind === 'chore').status, 'cancelled');
  assert.equal(store.addSpecialTask(a.id, 'chore').duplicate, false, '取消後可再抽到同一種');
  assert.throws(() => store.addSpecialTask(a.id, 'nope'), /沒有這種/);
});

test('Phase 4：命運卡後退 1～2 格（不觸發落點事件）、路障沒有影響', () => {
  const { store, a, push } = p3Store();
  store.buyItem(a.id, 'd6'); store.buyItem(a.id, 'd6');
  store.setPlayerTile(a.id, 11);
  push(face(3), 0.8, 0.9);                   // 擲 3 → 第 14 格；0.8 → 後退；0.9 → 退 2 格
  const r = store.rollDice(a.id, 'd6');
  assert.equal(r.event.card, 'back');
  assert.deepEqual(r.event.backPath, [13, 12]);
  assert.equal(store.getPlayer(a.id).pos, 12, '退到第 12 格（寶箱格）');
  assert.equal(store.getStarBalance(a.id), 10, '落點寶箱不觸發');
  assert.equal(store.getPlayer(a.id).tileId, 'gold-01-012');
  store.setPlayerTile(a.id, 18);
  push(face(3), 0.95, 0);                    // 擲 3 → 第 21 格；0.95 → 路障
  const r2 = store.rollDice(a.id, 'd6');
  assert.equal(r2.event.card, 'roadblock');
  assert.match(r2.event.text, /^路障：/);
  assert.equal(store.getPlayer(a.id).pos, 21);
  assert.equal(store.getSpecialTasks(a.id).length, 0);
});

test('Phase 4：命運卡後退不會退到起點之前；機率 75／10／15', () => {
  const total = G.FATE_CARDS.reduce((s, c) => s + c.weight, 0);
  const w = Object.fromEntries(G.FATE_CARDS.map(c => [c.id, c.weight]));
  assert.equal(total, 100);
  assert.deepEqual([w.chore + w.praise + w.helper, w.back, w.roadblock], [75, 10, 15]);
  const { store, a } = p3Store();
  store.setPlayerTile(a.id, 1);
  store.random = () => 0.8;                  // 後退、退 2 格
  // 暫時把第 1 格當成命運格：從第 1 格退 2 格，只能退到起點
  const tiles = store.getBoard(a.id).tiles; const orig = tiles[1].type; tiles[1].type = 'fate';
  try {
    const ev = store._resolveTile(a.id, 0);
    assert.deepEqual(ev.backPath, [0]);
    assert.equal(store.getPlayer(a.id).tileId, 'gold-01-start');
  } finally { tiles[1].type = orig; }
});

test('Phase 4：特殊任務存檔遷移、刪除孩子一併刪除', () => {
  const d = migrate({ children: [{ id: 'c', name: 'B' }], specialTasks: [
    { id: 's1', childId: 'c', kind: 'praise', startDate: '2026-11-07', endDate: '2026-11-09' },
    { id: 's2', childId: 'x', kind: 'praise', startDate: '2026-11-07', endDate: '2026-11-09' },
    { id: 's3', childId: 'c', kind: 'bad', startDate: '2026-11-07', endDate: '2026-11-09' }] });
  assert.deepEqual(d.specialTasks.map(t => [t.id, t.points, t.cancelled]), [['s1', 20, false]]);
  assert.deepEqual(migrate({ children: [] }).specialTasks, [], '舊存檔沒有此欄位 → 空陣列');
  const { store, a } = p3Store();
  store.addSpecialTask(a.id, 'chore');
  store.deleteChild(a.id);
  assert.equal(store.data.specialTasks.length, 0);
});

// ---------- Phase 4 第 2 步：小遊戲「抓住星星」 ----------
test('Phase 4：停在小遊戲格 → 產生今天的小遊戲；完成後每抓 1 顆得 1 星、只能領一次', () => {
  const { store, a, push } = p3Store();
  store.buyItem(a.id, 'd6'); store.buyItem(a.id, 'd6');
  store.setPlayerTile(a.id, 4);
  push(face(3));                                // 擲 3 → 第 7 格小遊戲
  const r = store.rollDice(a.id, 'd6');
  assert.equal(r.event.type, 'minigame');
  assert.ok(r.event.minigame, '可以開始小遊戲');
  assert.equal(store.getPendingMinigame(a.id).tile, 7);
  const bal = store.getStarBalance(a.id);
  const m = store.finishMinigame(a.id, 5);
  assert.deepEqual([m.status, m.caught, m.stars], ['done', 5, 5]);
  assert.equal(store.getStarBalance(a.id), bal + 5);
  assert.throws(() => store.finishMinigame(a.id, 5), /沒有可以玩/, '只能領一次');
  assert.equal(store.getTotal(a.id), 100, '不影響生活點數');
});

test('Phase 4：小遊戲每天 1 次、獎勵上限 15、隔天可再玩、重新整理後可繼續', () => {
  const { store, a, push, setDate, storage } = p3Store();
  store.buyItem(a.id, 'd6'); store.buyItem(a.id, 'd12');
  store.setPlayerTile(a.id, 4);
  push(face(3));
  store.rollDice(a.id, 'd6');
  // 重新載入（模擬重新整理）：未完成的小遊戲仍在
  const s2 = new Store({ storage, seed: false, now: () => store.now() });
  assert.ok(s2.getPendingMinigame(a.id), '重新整理後可繼續');
  const bal = store.getStarBalance(a.id);
  const done = store.finishMinigame(a.id, 22);
  assert.deepEqual([done.caught, done.stars], [22, 15], '抓到 22 顆、獎勵最多 15 星');
  assert.equal(store.getStarBalance(a.id), bal + 15);
  // 同一天再停到小遊戲格：不能再玩
  store.setPlayerTile(a.id, 7);
  push(face(10, 12));                          // 擲 10 → 第 17 格小遊戲
  const r = store.rollDice(a.id, 'd12');
  assert.equal(r.event.type, 'minigame');
  assert.ok(!r.event.minigame && r.event.minigameOverflow, '今天已玩過');
  assert.match(r.event.text, /明天再來/);
  assert.equal(store.getPendingMinigame(a.id), null);
  // 隔天：可以再玩
  setDate('2026-11-07T10:00:00');
  const it = store.addItem({ kind: 'bonus', name: 'x', points: 10 });
  store.recordItem(a.id, it.id); store.settleToday(a.id);
  store.buyItem(a.id, 'd6');
  store.setPlayerTile(a.id, 21);
  push(face(3));                                // 第 24 格小遊戲
  assert.ok(store.rollDice(a.id, 'd6').event.minigame, '隔天可以再玩');
  assert.equal(store.finishMinigame(a.id, 0).stars, 0, '抓到 0 顆得 0 星');
});

test('Phase 4：小遊戲存檔遷移（同一孩子同一天只留一筆）、刪除孩子一併刪除', () => {
  const d = migrate({ children: [{ id: 'c', name: 'B' }], adventure: { minigames: [
    { id: 'm1', childId: 'c', date: '2026-11-06', status: 'done', caught: 3, stars: 3 },
    { id: 'm2', childId: 'c', date: '2026-11-06', status: 'pending' },
    { id: 'm3', childId: 'x', date: '2026-11-06', status: 'pending' }] } });
  assert.deepEqual(d.adventure.minigames.map(m => [m.id, m.status, m.stars]), [['m1', 'done', 3]]);
  assert.deepEqual(migrate({ children: [] }).adventure.minigames, []);
  const { store, a } = p3Store();
  store.data.adventure.minigames.push({ id: 'z', childId: a.id, date: store.today(), status: 'pending', caught: 0, stars: 0, ts: 1 });
  store.deleteChild(a.id);
  assert.equal(store.data.adventure.minigames.length, 0);
});

// ---------- 寶物商店 Phase 2：冒險寶物商店（生活點數） ----------
function tsStore(startPoints = 1000, dateStr = '2026-11-06T10:00:00') {   // 2026-11-06 是週五
  const ctx = makeStore(dateStr);
  const a = ctx.store.addChild({ name: '端端', startPoints });
  const b = ctx.store.addChild({ name: '波妞', startPoints });
  return Object.assign(ctx, { a, b });
}

test('寶物商店：6 款商品與價格', () => {
  assert.deepEqual(G.TREASURES.map(t => [t.id, t.price]),
    [['skates', 10], ['shield', 20], ['magicDice', 10], ['luckyMedal', 100], ['wings', 100], ['door', 100]]);
  assert.ok(!G.TREASURES.some(t => t.id === 'airplane'), '呼叫專機不放商店');
  assert.deepEqual([G.TREASURE_WEEKLY_LIMIT, G.TREASURE_HOLD_LIMIT], [3, 2]);
});

test('寶物商店：扣生活點數、放進背包，不動能量星星與等級，兩位孩子互不影響', () => {
  const { store, a, b } = tsStore(1000);
  const lv = store.getLevel(a.id).level;
  const rec = store.buyTreasure(a.id, 'shield');
  assert.deepEqual([rec.type, rec.points, rec.refId, rec.name], ['reward', -20, 'treasure:shield', '寶物：防護罩']);
  assert.equal(store.getTotal(a.id), 980);
  assert.equal(store.getPlayer(a.id).bag.shield, 1);
  assert.equal(store.getStarBalance(a.id), 0, '不消耗也不增加能量星星');
  assert.equal(store.getLevel(a.id).level, lv, '兌換不影響等級');
  assert.equal(store.getTodayNet(a.id), 0, '不影響今日淨得分');
  assert.equal(store.getPlayer(b.id).bag.shield, 0, '另一位孩子不受影響');
  assert.equal(store.getTotal(b.id), 1000);
});

test('寶物商店：每週最多 3 件、下週重新計算；點數不足不能買', () => {
  const { store, a, setDate } = tsStore(1000);
  store.buyTreasure(a.id, 'skates'); store.buyTreasure(a.id, 'shield'); store.buyTreasure(a.id, 'magicDice');
  assert.equal(store.getTreasureBoughtThisWeek(a.id), 3);
  assert.deepEqual(store.canBuyTreasure(a.id, 'wings'), { ok: false, reason: '本週已兌換 3 件' });
  assert.throws(() => store.buyTreasure(a.id, 'wings'), /本週已兌換 3 件/);
  assert.equal(store.getTotal(a.id), 960, '被擋下時不扣點');
  setDate('2026-11-09T09:00:00');           // 下週一
  assert.equal(store.getTreasureBoughtThisWeek(a.id), 0);
  assert.ok(store.canBuyTreasure(a.id, 'wings').ok);
  const { store: s2, a: poor } = tsStore(50);
  assert.deepEqual(s2.canBuyTreasure(poor.id, 'luckyMedal'), { ok: false, reason: '還差 50 點' });
  assert.throws(() => s2.buyTreasure(poor.id, 'luckyMedal'), /點數不足/);
  assert.equal(s2.getPlayer(poor.id).bag.luckyMedal, 0);
  assert.equal(s2.getTotal(poor.id), 50);
});

test('寶物商店：同款最多持有 2 件（只限寶物商店；星星商店的溜冰鞋不受限）', () => {
  const { store, a, setDate } = tsStore(1000);
  store.buyTreasure(a.id, 'skates'); store.buyTreasure(a.id, 'skates');
  assert.deepEqual(store.canBuyTreasure(a.id, 'skates'), { ok: false, reason: '已持有 2 件' });
  setDate('2026-11-09T09:00:00');
  assert.throws(() => store.buyTreasure(a.id, 'skates'), /已持有 2 件/, '換週仍受持有上限限制');
  // 星星商店照舊可買
  const it = store.addItem({ kind: 'bonus', name: '大', points: 100 });
  store.recordItem(a.id, it.id); store.settleToday(a.id);
  store.buyItem(a.id, 'skates');
  assert.equal(store.getPlayer(a.id).bag.skates, 3, '星星商店不受持有上限');
});

test('寶物商店：撤銷或刪除購買紀錄一併收回道具；道具用掉則不能撤銷；不能改成其他孩子', () => {
  const { store, a, b } = tsStore(1000);
  store.buyTreasure(a.id, 'wings');
  store.undoLast(a.id);
  assert.deepEqual([store.getTotal(a.id), store.getPlayer(a.id).bag.wings], [1000, 0], '撤銷：退點並收回道具');
  const r = store.buyTreasure(a.id, 'door');
  assert.throws(() => store.updateRecord(r.id, { childId: b.id }), /不能改成其他孩子/);
  store.getPlayer(a.id).bag.door = 0;      // 模擬已用掉
  assert.throws(() => store.undoLast(a.id), /已經用掉了/);
  assert.throws(() => store.deleteRecord(r.id), /已經用掉了/);
  assert.equal(store.getTotal(a.id), 900, '擋下時紀錄仍在');
  store.getPlayer(a.id).bag.door = 1;
  store.deleteRecord(r.id);
  assert.deepEqual([store.getTotal(a.id), store.getPlayer(a.id).bag.door], [1000, 0], '刪除：退點並收回道具');
  // 一般獎勵兌換的撤銷不受影響
  const rw = store.addReward({ name: '冰淇淋', cost: 30 });
  store.redeemReward(a.id, rw.id);
  store.undoLast(a.id);
  assert.equal(store.getTotal(a.id), 1000);
});

test('寶物商店：舊存檔背包自動補上新道具欄位', () => {
  const d = migrate({ children: [{ id: 'c', name: 'B' }], adventure: { players: { c: { pos: 3, bag: { d6: 2, d12: 1, skates: 1 } } } } });
  const bag = d.adventure.players.c.bag;
  assert.deepEqual([bag.d6, bag.d12, bag.skates, bag.shield, bag.magicDice, bag.luckyMedal, bag.wings, bag.door], [2, 1, 1, 0, 0, 0, 0, 0]);
});

// ---------- 寶物商店 Phase 3：家長密碼、寶箱庫存、神諭祝福 ----------
test('家長密碼：4 位數、只存雜湊、解鎖與上鎖、已有密碼時需解鎖才能更換、忘記密碼可重設', () => {
  const { store, storage } = tsStore();
  assert.equal(store.hasParentPin(), false);
  assert.throws(() => store.setParentPin('12a4'), /4 位數字/);
  store.setParentPin('1234');
  assert.ok(store.isParentUnlocked(), '設定後立即解鎖');
  assert.ok(!JSON.stringify(store.data.parentPin).includes('1234'), '不存密碼原文');
  store.lockParent();
  assert.equal(store.unlockParent('0000'), false);
  assert.throws(() => store.setParentPin('5678'), /需要先輸入家長密碼/, '上鎖時不能改密碼');
  assert.equal(store.unlockParent('1234'), true);
  // 重新載入：密碼保留、預設上鎖
  const s2 = new Store({ storage, seed: false, now: () => store.now() });
  assert.ok(s2.hasParentPin() && !s2.isParentUnlocked());
  assert.ok(s2.checkParentPin('1234'));
  s2.allowPinReset();                      // 通過「忘記密碼」驗證題
  s2.setParentPin('9999');
  assert.ok(s2.checkParentPin('9999') && !s2.checkParentPin('1234'));
});

test('神諭祝福：只有解鎖後才能發送（寫入端檢查），數量 1～5', () => {
  const { store, a } = tsStore();
  assert.throws(() => store.sendBlessing(a.id, 'chest', 1), /需要家長密碼/);
  store.setParentPin('1234');
  assert.throws(() => store.sendBlessing(a.id, 'chest', 0), /數量/);
  assert.throws(() => store.sendBlessing(a.id, 'chest', 6), /數量/);
  assert.throws(() => store.sendBlessing(a.id, 'nope', 1), /沒有這種祝福/);
  assert.equal(store.getPlayer(a.id).bag.chest, 0, '失敗時不發獎');
});

test('神諭祝福：5 種獎勵入庫、幸運星直接 +10 星、發送紀錄、不算寶物商店件數、不扣點與星星', () => {
  const { store, a, b } = tsStore(500);
  store.setParentPin('1234');
  store.sendBlessing(a.id, 'chest', 2, '主動收玩具');
  store.sendBlessing(a.id, 'mysteryChest', 1);
  store.sendBlessing(a.id, 'rerollTicket', 1);
  store.sendBlessing(a.id, 'bonusPlay', 1);
  const ls = store.sendBlessing(a.id, 'luckyStar', 2, '好棒！');
  const bag = store.getPlayer(a.id).bag;
  assert.deepEqual([bag.chest, bag.giftMysteryChest, bag.rerollTicket, bag.bonusPlay], [2, 1, 1, 1]);
  assert.equal(store.getStarBalance(a.id), 20, '幸運星 ×2 = +20 能量星星（不經每日結算）');
  assert.ok(store.data.adventure.ledger.some(x => x.reason === '神諭祝福：幸運星' && x.delta === 20));
  assert.deepEqual([ls.kind, ls.qty, ls.message, ls.seen], ['luckyStar', 2, '好棒！', false]);
  assert.equal(store.getTotal(a.id), 500, '不扣生活點數');
  assert.equal(store.getTreasureBoughtThisWeek(a.id), 0, '不算寶物商店每週件數');
  assert.equal(store.getUnseenBlessings(a.id).length, 5);
  assert.equal(store.getUnseenBlessings(b.id).length, 0, '另一位孩子不受影響');
  store.markBlessingsSeen(a.id);
  assert.equal(store.getUnseenBlessings(a.id).length, 0);
  assert.equal(store.getBlessings().length, 5);
  assert.equal(store.data.adventure.itemLog.filter(x => x.action === 'grant' && x.source === '神諭祝福').length, 5);
});

test('寶箱庫存：一般寶箱沿用地圖寶箱內容；神諭祝福的神秘寶箱免鑰匙、開出特殊道具；紀錄開箱結果', () => {
  const { store, a } = tsStore();
  store.setParentPin('1234');
  store.sendBlessing(a.id, 'chest', 3);
  store.sendBlessing(a.id, 'mysteryChest', 2);
  const seq = [0.1, 0.5, 0.7, 0.9, 0.0, 0.999];
  store.random = () => seq.shift();
  let r = store.openChest(a.id, 'chest');              // 0.1 → 星星，0.5 → 2 星
  assert.equal(r.stars, 2); assert.equal(store.getStarBalance(a.id), 2);
  r = store.openChest(a.id, 'chest');                  // 0.7 → 溜冰鞋
  assert.deepEqual(r.items, { skates: 1 });
  r = store.openChest(a.id, 'chest');                  // 0.9 → 6 面骰
  assert.deepEqual(r.items, { d6: 1 });
  assert.throws(() => store.openChest(a.id, 'chest'), /沒有這種寶箱/);
  assert.equal(store.openChest(a.id, 'giftMysteryChest').item, 'skates');    // 0.0 → 第一項
  assert.equal(store.openChest(a.id, 'giftMysteryChest').item, 'airplane');  // 0.999 → 最後一項（稀有）
  assert.equal(store.getPlayer(a.id).bag.airplane, 1);
  assert.equal(store.getPlayer(a.id).bag.goldenKey, 0, '沒有用到鑰匙');
  assert.equal(store.data.adventure.itemLog.filter(x => x.action === 'open').length, 5);
  assert.deepEqual(G.MYSTERY_POOL.map(x => x.weight).reduce((s, w) => s + w, 0), 100);
});

test('神諭祝福／寶箱紀錄：存檔遷移、刪除孩子一併刪除', () => {
  const d = migrate({ children: [{ id: 'c', name: 'B' }], parentPin: { salt: 'x', hash: 'zz' }, adventure: {
    blessings: [{ id: 'b1', childId: 'c', kind: 'chest', qty: 2, message: '讚' }, { id: 'b2', childId: 'x', kind: 'chest' }],
    itemLog: [{ id: 'l1', childId: 'c', action: 'open', item: 'chest' }] } });
  assert.deepEqual(d.adventure.blessings.map(x => [x.id, x.qty, x.message, x.seen]), [['b1', 2, '讚', false]]);
  assert.equal(d.adventure.itemLog.length, 1);
  assert.equal(d.parentPin, null, '格式不對的密碼資料不採用');
  const { store, a } = tsStore();
  store.setParentPin('1234');
  store.sendBlessing(a.id, 'chest', 1);
  store.deleteChild(a.id);
  assert.deepEqual([store.data.adventure.blessings.length, store.data.adventure.itemLog.length], [0, 0]);
});

// ---------- 設定：自動備份與還原 ----------
test('自動備份：每天第一次開啟存一份、同一天不重複、保留最近 7 天', () => {
  const storage = memoryStorage();
  const clock = { t: new Date('2026-11-01T09:00:00').getTime() };
  const open = () => new Store({ storage, seed: false, now: () => new Date(clock.t) });
  let s = open();
  s.addChild({ name: '端端' });
  assert.equal(s.getSnapshots().length, 1, '第一次開啟有 1 份');
  open(); open();
  assert.equal(open().getSnapshots().length, 1, '同一天不重複');
  for (let d = 2; d <= 10; d++) { clock.t = new Date('2026-11-' + String(d).padStart(2, '0') + 'T09:00:00').getTime(); s = open(); }
  const snaps = s.getSnapshots();
  assert.equal(snaps.length, 7, '只保留 7 天');
  assert.deepEqual(snaps.map(x => x.date), ['2026-11-10', '2026-11-09', '2026-11-08', '2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04']);
  assert.ok(!('data' in snaps[0]), '清單不含資料本體');
  assert.equal(snaps[0].summary.children, 1);
});

test('還原到前一天：整個 App 回到那天開始時；需家長密碼；還原前自動備份，可再還原回來', () => {
  const storage = memoryStorage();
  const clock = { t: new Date('2026-11-06T09:00:00').getTime() };
  const open = () => new Store({ storage, seed: false, now: () => new Date(clock.t) });
  let s = open();
  const c = s.addChild({ name: '端端', startPoints: 100 });
  const it = s.addItem({ kind: 'bonus', name: '加', points: 20 });
  s.recordItem(c.id, it.id);                                  // 11/6：120 點
  clock.t = new Date('2026-11-07T09:00:00').getTime();
  s = open();                                                 // 11/7 開始時備份（120 點）
  s.recordItem(c.id, it.id); s.recordItem(c.id, it.id);      // 11/7：160 點
  s.getPlayer(c.id).bag.shield = 2; s.save();
  const snap7 = s.getSnapshots().find(x => x.date === '2026-11-07');
  assert.throws(() => s.restoreSnapshot(snap7.id), /需要家長密碼/);
  s.setParentPin('1234');
  s.restoreSnapshot(snap7.id);
  assert.equal(s.getTotal(c.id), 120, '回到 11/7 開始時');
  assert.equal(s.getPlayer(c.id).bag.shield, 0, '背包也回去');
  const before = s.getSnapshots().find(x => x.kind === 'before');
  assert.ok(before, '還原前自動備份');
  s.restoreSnapshot(before.id);
  assert.equal(s.getTotal(c.id), 160, '可以再還原回來');
  assert.equal(s.getSnapshots().filter(x => x.kind === 'before').length, 1, '還原前只保留最新一份');
  // 重新開啟後仍是還原後的資料
  assert.equal(open().getTotal(c.id), 160);
});

test('載入備份檔覆蓋前，自動備份目前狀態', () => {
  const { store } = makeStore();
  const c = store.addChild({ name: '端端', startPoints: 77 });
  const json = JSON.stringify({ children: [{ id: 'z', name: '新的' }] });
  store.importJSON(json);
  assert.equal(store.getChildren()[0].name, '新的');
  const before = store.getSnapshots().find(x => x.kind === 'before');
  assert.ok(before);
  store.setParentPin('1234');
  store.restoreSnapshot(before.id);
  assert.equal(store.getTotal(c.id), 77, '覆蓋前的資料可以找回');
});

test('自動備份：空間不足時先刪最舊的每日備份，主資料不受影響', () => {
  const inner = memoryStorage();
  let limit = Infinity;
  const storage = { getItem: (k) => inner.getItem(k), setItem: (k, v) => { if (k.endsWith('-snapshots') && v.length > limit) throw new Error('QuotaExceeded'); inner.setItem(k, v); }, removeItem: (k) => inner.removeItem && inner.removeItem(k) };
  const clock = { t: new Date('2026-11-01T09:00:00').getTime() };
  const open = () => new Store({ storage, seed: false, now: () => new Date(clock.t) });
  let s = open(); s.addChild({ name: '端端' });
  for (let d = 2; d <= 4; d++) { clock.t = new Date('2026-11-0' + d + 'T09:00:00').getTime(); s = open(); }
  assert.equal(s.getSnapshots().length, 4);
  limit = JSON.stringify(s._readSnaps()).length;              // 剛好放得下 4 份
  clock.t = new Date('2026-11-05T09:00:00').getTime(); s = open();
  const dates = s.getSnapshots().map(x => x.date);
  assert.equal(dates[0], '2026-11-05', '最新的有存進去');
  assert.ok(!dates.includes('2026-11-01'), '最舊的被刪掉');
  assert.equal(s.getChildren().length, 1, '主資料不受影響');
});
