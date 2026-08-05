# 赤壁象棋 — app 本體

這個資料夾是遊戲本身。專案總覽、特色、操作方式、架構說明與貢獻流程請看
[根目錄 README](../README.md) 與 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 安裝與啟動

需要 **Node 20+**(npm / pnpm / bun 皆可,repo 附 `package-lock.json`)。

```bash
npm install
npm run dev       # http://localhost:8080
npm run build     # production bundle 輸出到 dist/
npm run preview   # 本機預覽 build 結果
```

## 環境變數(選配)

不設定任何環境變數就是純單機版(人機 / 雙人 / 自動演武),不需登入。

要開「鏈上對戰」才需要 Privy:複製 `.env.example` 為 `.env.local` 並填入:

```bash
VITE_PRIVY_APP_ID=你的-privy-app-id
```

Privy App ID 是公開識別碼,可以安全地曝露給瀏覽器;登入方式由
[Privy Dashboard](https://dashboard.privy.io) 控制。設定後選單會出現「鏈上對戰」
分頁:兩個 Solana 錢包各押 0.01 devSOL 開房,走棋經 MagicBlock Ephemeral Rollup
同步(Devnet 測試幣沒有真實金錢價值)。合約與流程見
[`../magicblock/README.md`](../magicblock/README.md)。

## 指令

| 指令 | 功能 |
| --- | --- |
| `npm run dev` | Vite dev server(HMR) |
| `npm run build` | production build 到 `dist/` |
| `npm run preview` | 本機預覽 build |
| `npm run lint` | ESLint |
| `npm test` | Node 單元測試 + 瀏覽器測試 |
| `npm run test:watch` | Vitest watch 模式 |
| `npm run test:browser` | 只跑瀏覽器模式測試 |

## 部署

`dist/` 是純靜態網站,任何靜態託管都能放。目前的正式站:

```bash
vercel deploy --prod --yes   # 在 web/ 下執行
```

線上版:https://chinese-chess-two.vercel.app
