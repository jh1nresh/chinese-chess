# MagicBlock 鏈上象棋

這個目錄把 3D 象棋接到 Solana Devnet 與 MagicBlock Ephemeral Rollup。3D 場景仍由
`web/` 負責；鏈上程式驗證玩家身分、回合順序、90 格棋盤、勝負和 0.02 devSOL
獎池。Devnet 測試幣沒有真實金錢價值。

## 對局流程

1. 紅方登入 Privy Solana 錢包，建立 Match PDA 並押入 0.01 devSOL。
2. 紅方分享邀請連結；黑方用另一個錢包加入並押入 0.01 devSOL。
3. 紅方明確確認 `delegate_match`，將 Match PDA 委派到 MagicBlock。
4. 雙方的 `play_move` 經 Magic Router 傳送；程式會驗證馬腳、象眼、九宮、過河、
   炮架、將帥照面、回合與簽署者。
5. 瀏覽器訂閱 Match PDA，收到對手的最後一步後同步 3D 動畫。
6. 將死、認輸、無合法步或回合逾時會產生勝方；雙方也可以提議並接受和局。
7. 任一玩家明確確認後，`commit_and_undelegate` 把最終狀態寫回 Solana，接著
   `claim_payout` 將 0.02 devSOL 支付勝方；和局則各退 0.01 devSOL。
8. 黑方尚未加入前，紅方可取消房間並立即取回 0.01 devSOL。

每個瀏覽器交易在要求錢包簽名前都會先模擬。程式把每方押注限制在 10 SOL 以下、
加入期限限制在 24 小時內，回合逾時限制在 60 秒至 24 小時。前端目前固定使用
0.01 devSOL、1 小時加入期限和 10 分鐘回合逾時。

## 網路與程式

- Solana：Devnet
- Magic Router：`https://devnet-router.magicblock.app`
- Program ID：`4EcbVv7UbxnTb8tDbRkb6iUmahhUav8ccv1dCSgE6VVW`

Program ID 是開發用身分，deploy keypair 不會提交到 Git。這個分支含可編譯的程式、
IDL、前端大廳與錢包接法，但在 Devnet Explorer 查到程式帳戶之前，不應宣稱已部署。

## 驗證

MagicBlock SDK 需要較新的 Solana SBF 工具鏈。本專案固定使用 Anza platform-tools
`v1.54`，不會修改全域 Solana CLI 設定。

```bash
cd magicblock
NO_DNA=1 CARGO_TARGET_DIR=/tmp/chinese-chess-magicblock-target cargo test --workspace
NO_DNA=1 CARGO_TARGET_DIR=/tmp/chinese-chess-magicblock-sbf-target \
  cargo-build-sbf \
  --tools-version v1.54 \
  --manifest-path programs/xiangqi_match/Cargo.toml \
  --sbf-out-dir /tmp/chinese-chess-magicblock-deploy
NO_DNA=1 CARGO_TARGET_DIR=/tmp/chinese-chess-magicblock-target \
  anchor idl build -p xiangqi_match \
  -o ../web/src/magicblock/xiangqi_match.json \
  -t ../web/src/magicblock/xiangqi_match.ts
```

前端驗證：

```bash
cd ../web
npx tsc -b --pretty false
npx vitest run
npm run build
```

## 瀏覽器接法

`web/src/magicblock/matchClient.ts` 使用
`ConnectionMagicRouter.prepareTransaction` 取得正確的 blockhash 與執行層，模擬通過後
才交給 Privy 錢包簽署。建立與加入使用 Solana base layer；PDA 委派後，走棋會由
Magic Router 路由到 Ephemeral Rollup。

部署和測試交易都必須由操作者在當下確認錢包、Devnet 網路、Program ID 與預估費用；
專案不會儲存使用者私鑰，也不會在建置時自動部署。
