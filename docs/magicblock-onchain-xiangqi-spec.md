# 龍爭象棋：MagicBlock 鏈上雙人對戰規格

- 文件狀態：Draft v0.1
- 目標網路：Solana Devnet
- 適用分支：`feat/magicblock-xiangqi`
- Program ID：`4EcbVv7UbxnTb8tDbRkb6iUmahhUav8ccv1dCSgE6VVW`
- 最後更新：2026-08-03

## 1. 目標

把目前的 3D 象棋從「本機與電腦／同機雙人」擴充成可由兩個真實玩家完成的
MagicBlock Devnet 對局。玩家登入後可以建立房間、分享連結、加入對局、各押入
0.01 devSOL，在 Ephemeral Rollup 上低延遲走棋，並依最終結果領獎或退款。

Devnet SOL 是測試幣，沒有真實金錢價值。本規格不包含 Mainnet 或真實資產。

## 2. v0 產品決策

| 項目 | v0 決策 |
| --- | --- |
| 登入 | Privy；登入方式由 Privy Dashboard 控制 |
| 錢包 | Privy Solana embedded wallet 或使用者已連接的 Solana wallet |
| 網路 | 只支援 Solana Devnet |
| 對局 | 邀請連結制，兩個不同錢包，一紅一黑 |
| 押注 | 每方固定 0.01 devSOL，獎池共 0.02 devSOL |
| 加入期限 | 建房後 1 小時 |
| 回合期限 | 每一步 10 分鐘 |
| 即時層 | MagicBlock Ephemeral Rollup |
| 最終層 | 對局結果回寫 Solana Devnet 後結算 |
| 觀戰／配對 | 不包含；v0 只做私房邀請 |

固定押注是刻意縮小的黑客松範圍。前端不得讓玩家自行輸入金額；鏈上程式仍需限制
最大押注，避免其他 client 傳入不合理數值。

## 3. 使用者流程

```mermaid
flowchart LR
  A["Privy 登入"] --> B["取得 Solana 錢包"]
  B --> C["紅方建立房間並押入 0.01 devSOL"]
  C --> D["分享邀請連結"]
  D --> E["黑方加入並押入 0.01 devSOL"]
  E --> F["紅方確認委派到 MagicBlock"]
  F --> G["雙方訂閱 PDA 並輪流走棋"]
  G --> H["勝負、和局或逾時"]
  H --> I["回寫 Solana 並解除委派"]
  I --> J["勝方領 0.02，或雙方各退 0.01 devSOL"]
```

### 3.1 登入門檻

- 未登入時只顯示登入入口，不能進入任何遊戲模式。
- 登入後如果沒有 Solana 錢包，顯示「建立 Solana 錢包」。
- UI 顯示縮寫錢包地址、Devnet 標籤與 devSOL 餘額。
- 登入方法不寫死在前端，由 Privy Dashboard 的最新設定決定。

### 3.2 建立房間

紅方按下「押入 0.01 devSOL 建立對局」後：

1. 前端顯示網路、金額、用途與退款條件。
2. client 先模擬 `initialize_match`。
3. 模擬成功才要求錢包簽名。
4. 建立 Match PDA，將紅方的 0.01 devSOL 存入該程式擁有的 PDA。
5. 顯示可複製的邀請 URL；URL 只包含公開的 Match PDA。
6. 在黑方加入前，紅方可以取消並取回完整押注。

### 3.3 分享與加入

- 邀請格式：`https://<host>/?match=<MATCH_PDA>`。
- 黑方可貼上完整 URL 或 Match PDA。
- 加入前必須讀取鏈上帳戶並驗證：狀態為 waiting、未過加入期限、押注正好為
  0.01 devSOL、紅黑不是同一個錢包。
- `join_match` 模擬成功後才簽名並轉入黑方押注。
- 紅方透過帳戶訂閱看到黑方加入，不依賴中心化後端。

### 3.4 啟用 MagicBlock 與走棋

- 黑方加入後，紅方按下「啟用即時戰場並開始」。
- `delegate_match` 必須是獨立且明確的錢包確認，不得在背景自動簽名。
- 委派完成後，雙方的走棋由 Magic Router 路由到 Ephemeral Rollup。
- 每步 `play_move` 都由目前回合的玩家簽署；程式驗證完整象棋規則與簽署者。
- client 訂閱 Match PDA。帳戶的 `last_from`、`last_to`、`last_player` 與 `ply`
  用來判斷是否為新的對手走棋，收到後才在本機播放 3D 移動／吃子動畫。
- 本機規則引擎用於即時提示與動畫；鏈上程式是勝負與資金結算的最終真相。

## 4. 鏈上狀態機

| 狀態 | 數值 | 可進入方式 | 下一步 |
| --- | ---: | --- | --- |
| `WAITING` | 0 | 紅方建立並押注 | 黑方加入，或紅方取消退款 |
| `ACTIVE` | 1 | 黑方加入並押注 | 走棋、認輸、提和、接受和局、主張逾時 |
| `RED_WON` | 2 | 紅方吃將、黑方無合法步、黑方認輸或逾時 | 回寫並支付紅方 |
| `BLACK_WON` | 3 | 黑方吃帥、紅方無合法步、紅方認輸或逾時 | 回寫並支付黑方 |
| `DRAW` | 4 | 一方提和且另一方接受 | 回寫並分別退款 |
| `CANCELLED` | 5 | 黑方加入前由紅方取消 | 紅方立即退款，結束 |

終局原因另行保存：吃將、無合法步、認輸、回合逾時、雙方同意和局。

### 4.1 主要 instructions

| Instruction | 簽署者 | 功能 |
| --- | --- | --- |
| `initialize_match` | 紅方 | 建立 PDA、寫入條件、存入紅方押注 |
| `join_match` | 黑方 | 驗證房間並存入黑方押注 |
| `delegate_match` | 紅方 | 委派 Match PDA 到 MagicBlock |
| `play_move` | 當前玩家 | 驗證並執行一步，必要時直接寫入終局狀態 |
| `resign` | 任一玩家 | 對手勝出 |
| `offer_draw` | 任一玩家 | 記錄提和方 |
| `accept_draw` | 對手 | 將狀態改為和局 |
| `claim_timeout` | 非當前回合玩家 | 回合期限過後取得勝利 |
| `cancel_waiting_match` | 紅方 | 候場時取消並退還紅方押注 |
| `commit_match` | 任一付費者 | 對局中檢查點回寫 |
| `commit_and_undelegate` | 任一付費者 | 終局回寫並解除委派 |
| `claim_payout` | 任一付費者 | 依固定收款地址支付獎池或退款 |

`claim_payout` 可以由任意簽署者觸發，但收款地址必須由 Match PDA 中的紅方與黑方
欄位約束，觸發者不能更改收款人，也不能抽走獎池。

## 5. Escrow 與結算規則

v0 不另建第二個 escrow 帳戶；程式擁有的 Match PDA 同時保存棋局資料與押注 lamports。
這仍是 non-custodial program escrow，因為只有程式規則可以移動其中的押注。

- 紅方勝：紅方收到 `stake × 2`。
- 黑方勝：黑方收到 `stake × 2`。
- 同意和局：紅黑各收到 `stake`。
- 候場取消：紅方收到 `stake`。
- 帳戶 rent-exempt 最低餘額不得當作獎池支付。
- `settled` 由 `false` 變為 `true` 後，不得再次付款。
- 所有加減法必須 checked；溢位或餘額不足時整筆 instruction 回滾。
- Active 對局沒有任意退款；掉線方必須回來續局，或由對手在回合逾時後主張勝利。
- 若雙方都不再回來，資金不會由伺服器自動移動，會停留在 Match PDA。

## 6. UI 規格

### 大廳

- 第四個模式：「鏈上對戰」。
- 顯示 `Solana Devnet`、錢包地址、餘額、每方押注與回合期限。
- 建立按鈕文字必須包含金額，不能只寫「開始」。
- 加入按鈕文字必須表達會押注。
- 提供 Solana Faucet 連結，但不在背景自動空投。
- 建房後顯示分享連結、複製結果、等待狀態與取消退款按鈕。

### 對局中

- 顯示玩家顏色、錢包縮寫、總獎池、手數與最新鏈上狀態。
- 非自己回合不能在本機送出走棋。
- 操作期間鎖定重複點擊，錢包拒簽後恢復 UI。
- 提供「提出和局／接受和局」、「對手逾時」與「認輸」。
- 終局但尚未結算時，必須優先顯示「回寫並結算獎池」。
- 結算成功後才顯示一般的終局／返回大廳流程。

## 7. 交易與錯誤 UX

每次簽名前至少顯示：

- 網路：Solana Devnet 或 MagicBlock Devnet。
- 動作：建立、押注、加入、委派、走棋、認輸、和局、逾時或結算。
- 金額：有資金移動時顯示 0.01 或 0.02 devSOL。
- 結果：成功後顯示可理解的中文，不只顯示 signature。

錯誤至少涵蓋：餘額不足、Program 未部署、房間不存在／已開始／已過期、同錢包加入、
不是自己的回合、非法走棋、錢包拒簽、Router 無法連線、尚未逾時、帳戶仍在解除委派、
獎池已被結算。失敗不得先改動本機棋盤。

## 8. 安全邊界

- 前端、Program 與文件不得包含使用者私鑰或助記詞。
- 公開 Privy App ID 由 `.env.local` 提供；secret 不得放入 Vite 環境變數。
- 所有交易先模擬再要求簽名；不得自動簽名或自動重送。
- 所有玩家／收款帳戶都要由 PDA 內資料、seed、`has_one` 或 address constraint 約束。
- 黑方必須與紅方不同；非玩家不得走棋、認輸、提和或主張逾時。
- 加入期限最長 24 小時；回合期限限制在 60 秒至 24 小時；單方押注上限 10 SOL。
- 最終付款只能在終局且已解除委派後執行。
- 部署前必須重新確認 cluster、Program ID、upgrade authority、fee payer、餘額與預估費用。

## 9. 驗收標準

### 程式

- Rust 單元測試覆蓋象棋關鍵規則、無合法步判定、勝方／和局付款守恆與溢位。
- Anchor IDL 含建立、加入、走棋、提和、逾時、取消、委派、回寫與付款 instructions。
- `cargo-build-sbf` 使用指定 platform-tools 成功產生 `.so`。
- Devnet 上 `getAccountInfo(Program ID)` 可讀到 executable program account。

### 前端

- TypeScript、單元測試與 production build 通過。
- 未登入無法進入遊戲；登入方式使用 Privy Dashboard 設定。
- 兩個不同錢包可用邀請 URL 完成建房、加入與開始。
- 紅方走一步後，黑方不重新整理頁面即可看到相同步驟與 3D 動畫，反向亦同。
- 非法走棋或交易失敗時，本機棋盤不前進。
- 候場取消、紅勝、黑勝、和局、逾時各至少完成一次 Devnet 端到端測試。
- 每個資金案例比對結算前後錢包與 PDA lamports，允許的差異只有交易費與 rent。

### 交付證據

- Devnet Program Explorer 連結與 deploy signature。
- 一組不含私密資訊的紅／黑測試錢包公開地址。
- 五條端到端交易鏈：取消退款、紅勝、黑勝、和局、逾時。
- 桌面與手機的登入、大廳、候場、對局中、終局結算截圖。
- README 清楚標示已部署或尚未部署，不得把本機編譯成功寫成 Devnet 已上線。

## 10. 非目標

- Mainnet、真實 SOL 或代幣押注。
- 可調押注、抽水、平台手續費、排行榜與 NFT 獎勵。
- 公開自動配對、聊天室、觀戰、錦標賽。
- 多裝置無縫復原完整棋譜；v0 先保證同一場線上訂閱期間的狀態同步。
- 把 Privy 使用者資料或棋局資料存入新的中心化資料庫。

## 11. 實作與上線順序

1. 鎖定此規格與固定參數。
2. 完成並測試 Anchor 狀態機、escrow 與 settlement。
3. 產生 IDL，完成 Privy wallet adapter、鏈上大廳與對局訂閱。
4. 在本機完成 Rust、SBF、TypeScript、單元測試、build 與瀏覽器 QA。
5. 列出 Devnet 部署摘要，取得操作者當下確認。
6. 部署 Program，讀回 executable account 後才標記為已部署。
7. 用兩個 Devnet 錢包跑完五條端到端驗收鏈並保存交易證據。

## 12. 部署前需要確認的決策

- 固定 0.01 devSOL 是否維持。
- 加入期限 1 小時、回合期限 10 分鐘是否維持。
- Program upgrade authority 使用哪個公開地址。
- 部署 fee payer 使用哪個公開地址。
- 黑客松 demo 是否接受「邀請連結制」，或必須再加公開配對。
