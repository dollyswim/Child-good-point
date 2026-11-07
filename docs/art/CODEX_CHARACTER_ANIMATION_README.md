# 八隻冒險夥伴：2.5D 棋子動畫

解壓縮後直接開啟 `preview.html`。預覽內已嵌入原圖，可離線使用。
正式遊戲使用 `characters.js` 與 `assets/`，無套件、無 CDN、無付費 API。

這是原圖搭配 Web Animations API 的程式動畫，不是重繪表情、逐幀精靈圖或骨架動畫。原圖不變，維持每隻約 18 KB。此套件尚未接入你的遊戲專案。

## 五種動作

| 呼叫值 | 動作 | 呈現 |
| --- | --- | --- |
| idle | 待機 | 循環呼吸、輕微擺動 |
| jump | 跳格 | 蹲下蓄力、騰空、落地回彈、陰影縮放 |
| happy | 開心 | 左右彈跳，粉紅小愛心依序冒出、向上飄散 |
| surprised | 驚訝 | 快速彈起、後仰、驚嘆號 |
| openChest | 開寶箱 | 俯身、指定寶箱彈出、金光、開心彈起 |

八隻角色均有五種動作。依體型調整速度及跳高；長耳、小翼較輕盈，石球較沉穩。表情沿用原圖。

## 接入遊戲

```html
<div id="piece" style="position:absolute;left:100px;top:100px"></div>
<script src="characters.js"></script>
<script>
const pawn = new CharacterAnimations.CharacterAnimator(
  document.getElementById('piece'),
  { character: 'round', assetBase: 'assets/', size: 90 }
);
async function moveThreeTiles() {
  for (let n = 0; n < 3; n++) {
    const result = await pawn.play('jump', { dx: 60, dy: 0 });
    if (!result.completed) return;
  }
  await pawn.play('openChest');
}
</script>
```

角色 ID：`round`、`ears`、`dragon`、`wings`、`water`、`leaf`、`flame`、`stone`。

`play()` 回傳 Promise，完成後自動待機。新的動作會取消上一個；被取消的動作回傳 `{completed:false}`。移動成功才保存新位置，避免取消時累加未完成的位移。`dx`、`dy` 是棋子內部座標，`size` 縮放也會縮放它們；若地圖用螢幕像素，請除以 `size/150` 換算。外部地圖可自行管理 host 的座標，僅呼叫零位移 jump。

每個孩子建立獨立實例。卸載時呼叫 `pawn.destroy()`。計分、道具消耗與獎勵發放由遊戲資料層負責，勿依動畫重播發獎。跳格應逐格 await。

支援系統減少動態效果；也可傳入 `reducedMotion:true`。套件只呈現動畫，不新增任何養成或戰鬥系統。

## 寶箱素材更新
使用使用者指定貼紙組最右邊的金邊紅寶石寶箱。`treasure-sticker-sheet.png` 保留完整原始圖片，CSS 視窗只顯示右側寶箱，不顯示機器貓或城堡，未重繪原圖。原圖本身是已開啟狀態，因此採「俯身 → 寶箱彈出 → 金光 → 開心」；不假裝已有閉合箱蓋的逐幀素材。可用 `sources.chest` 覆寫完整貼紙組的來源。
