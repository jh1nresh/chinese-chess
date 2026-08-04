# 貢獻指南

感謝你協助改善龍爭象棋。請讓每次變更只處理一個明確主題，避免順手重構無關程式。

## 開發環境

```bash
cd web
bun install
bun run dev
```

送出 Pull Request 前請執行：

```bash
bun run lint
bun run build
bun run test
```

若修改 `magicblock/`、IDL 或鏈上交易流程，還要執行：

```bash
bun run test:program
```

## Commit 格式

使用 Conventional Commits 前綴，摘要可使用中文：

```text
feat(ui): 加入鏈上對局結算狀態
fix(core): 修正將帥照面判定
test(magicblock): 補上和棋退款情境
docs: 整理專案首頁
```

常用前綴：`feat`、`fix`、`test`、`docs`、`refactor`、`perf`、`chore`。

## 程式原則

- `web/src/core` 不得依賴 Three.js；規則與畫面保持分離。
- 3D 資源要依品質設定降級，並在擁有它的模組中釋放。
- 搜尋與重運算放在 Worker，不阻塞主執行緒。
- 不使用無說明的 `any` 或 `@ts-ignore`。
- 鏈上資料視為不可信輸入；檢查 owner、長度、discriminator 與狀態值。
- 每筆錢包交易要求簽名前必須先模擬。
- 不提交私鑰、部署 keypair、助記詞或含機密的環境檔案。

## 素材

新增模型、圖片或音訊時，請在相同目錄留下作者、來源與授權。來源不明或沒有再散布
權利的素材不應加入專案。

## Pull Request

- 從 `main` 建立單一主題分支。
- 說明改了什麼、為什麼改，以及使用哪些指令驗證。
- 視覺變更附上桌面與行動版截圖。
- Solana 變更要列出 Program ID、目標網路與是否真的部署；本機測試不得寫成已上線。
