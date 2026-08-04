# 龍爭象棋

華人風格的 3D 中國象棋網頁遊戲。棋盤規則由 TypeScript 原生實作，戰場使用
Three.js 呈現；MagicBlock 開發分支另外提供 Privy 登入、Solana 錢包、雙人房間與
devSOL 押注對局。

## 目前狀態

| 功能 | 狀態 |
| --- | --- |
| 中國象棋完整走法與勝負判定 | 已完成 |
| 玩家對電腦、本機雙人、展示模式 | 已完成 |
| 華人風 3D 戰場、中文棋子與古箏配樂 | 已完成 |
| Privy 登入與 Solana 錢包 | 已整合 |
| MagicBlock 雙人房間與即時走棋 | 開發分支已整合 |
| devSOL 押注、和棋退款、勝方領獎 | 本機 SBF／LiteSVM 已驗證 |
| Devnet Program 部署 | 尚未部署，請勿視為正式上線 |

Devnet 測試幣沒有真實金錢價值。本專案不會保存使用者私鑰，也不會在建置時自動部署
Program 或送出交易。

## 快速開始

需要 Node.js 20 以上版本，建議使用 [Bun](https://bun.sh)。

```bash
git clone https://github.com/jh1nresh/chinese-chess.git
cd chinese-chess/web
bun install
cp .env.example .env.local
bun run dev
```

開啟 [http://localhost:8080](http://localhost:8080)。

在 `.env.local` 設定 Privy 公開 App ID：

```dotenv
VITE_PRIVY_APP_ID=你的_PRIVY_APP_ID
```

登入是進入遊戲的必要條件；實際可用的登入方式由 Privy Dashboard 控制。

## 遊戲模式

- 玩家對電腦：三種強度，可選紅方或黑方。
- 本機雙人：兩位玩家在同一台裝置輪流走棋。
- 鏈上對局：兩個 Privy Solana 錢包建立或加入房間，透過 MagicBlock 同步走棋。
- 展示模式：由兩個電腦棋手自動對弈，適合錄影或展示 3D 場景。

象棋規則包含馬腳、象眼、九宮、過河兵、炮架、將帥照面、將軍、將死、困斃與重複局面。

## 常用指令

前端：

```bash
cd web
bun run dev
bun run lint
bun run build
bun run test
bun run test:program
```

Solana Program：

```bash
cd magicblock
NO_DNA=1 CARGO_TARGET_DIR=/tmp/chinese-chess-magicblock-target cargo test --workspace
NO_DNA=1 CARGO_TARGET_DIR=/tmp/chinese-chess-magicblock-sbf-target \
  cargo-build-sbf \
  --tools-version v1.54 \
  --manifest-path programs/xiangqi_match/Cargo.toml \
  --sbf-out-dir /tmp/chinese-chess-magicblock-deploy
```

## MagicBlock 對局流程

1. 紅方建立 Match PDA，押入 0.01 devSOL。
2. 黑方用另一個錢包加入，押入 0.01 devSOL。
3. Match PDA 委派至 MagicBlock Ephemeral Rollup。
4. 雙方透過 Magic Router 送出走棋，Program 驗證身分、回合與棋規。
5. 終局後把狀態寫回 Solana base layer。
6. 第二次錢包確認後領取獎池；和棋各退回原押注。

完整規格請見 [鏈上象棋規格](docs/magicblock-onchain-xiangqi-spec.md) 與
[MagicBlock 開發說明](magicblock/README.md)。

## 專案結構

```text
.
├── docs/                         產品與鏈上規格
├── magicblock/                   Anchor／MagicBlock Program
│   └── programs/xiangqi_match/   象棋狀態、走法、押注與結算
└── web/                          Vite + React 19 前端
    ├── public/                   圖示與已授權音樂
    └── src/
        ├── core/                 純 TypeScript 象棋規則
        ├── ai/                   Web Worker 電腦棋手
        ├── scene/                Three.js 戰場與動畫
        ├── magicblock/           錢包、房間與鏈上交易
        └── ui/                   中文遊戲介面
```

規則層不依賴 Three.js；場景只訂閱遊戲事件，因此棋規可獨立測試，3D 動畫也不會改變
鏈上狀態判定。

## 素材與授權

- 專案程式碼採用 [MIT License](LICENSE)。
- 古箏背景音樂的來源與授權記錄在 `web/public/audio/LICENSE.md`。
- 外部模型與音訊應保留來源及授權資訊，不應直接提交來源不明的素材。

貢獻方式請見 [CONTRIBUTING.md](CONTRIBUTING.md)。
