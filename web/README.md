# 龍爭象棋前端

這個目錄包含 Vite、React 19、TypeScript 與 Three.js 前端，包括中文介面、3D 戰場、
本機象棋規則、電腦棋手、Privy 登入及 MagicBlock 房間 UI。

## 開發

```bash
bun install
cp .env.example .env.local
bun run dev
```

預設網址為 [http://localhost:8080](http://localhost:8080)。

`.env.local` 至少需要：

```dotenv
VITE_PRIVY_APP_ID=你的_PRIVY_APP_ID
```

## 驗證

```bash
bun run lint
bun run build
bun run test
bun run test:program
```

`test:program` 會編譯 Anchor SBF，並使用 LiteSVM 驗證建房、加入、押注、認輸、和棋、
逾時與領獎流程；它不會連接 Devnet 或要求真實錢包簽名。

## 主要目錄

```text
src/
├── core/          象棋狀態、合法走法與勝負判定
├── ai/            Web Worker 搜尋引擎
├── scene/         Three.js 場景、角色、棋盤與特效
├── magicblock/    Solana／MagicBlock 用戶端
├── auth/          Privy 登入
├── audio/         音樂與音效控制
└── ui/            遊戲選單與 HUD
```

建置輸出位於 `dist/`。Privy App ID 是瀏覽器端公開設定，但登入方法仍應在 Privy
Dashboard 管理；請勿把私鑰、部署 keypair 或其他機密寫入 `.env.local`。
