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
