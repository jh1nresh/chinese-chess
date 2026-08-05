# 赤壁象棋 — 3D 楚漢戰場象棋

在瀏覽器裡開打的電影感 3D 中國象棋。紅方漢軍(劉邦)與藍方楚軍(項羽)在山寺大殿裡
隔著楚河漢界對峙 —— 一整面木刻棋盤、墨線縱橫、帥旗獵獵。

線上試玩:**https://chinese-chess-two.vercel.app**

技術棧:**Vite + React 19 + TypeScript + three.js**,自寫的 TypeScript 象棋規則引擎,
AI 對手跑在 **Web Worker** 裡不卡渲染。另附 MagicBlock/Solana 鏈上押注對戰的完整程式
(Anchor program + 前端接線,Devnet 尚未部署)。

```bash
cd web && npm install && npm run dev   # http://localhost:8080
```

---

## 目錄

- [特色](#特色)
- [快速開始](#快速開始)
- [操作方式](#操作方式)
- [遊戲模式](#遊戲模式)
- [棋子樣式](#棋子樣式)
- [戰場場景](#戰場場景)
- [專案結構](#專案結構)
- [架構](#架構)
- [電腦對手](#電腦對手)
- [畫質預設](#畫質預設)
- [黑畫面救援](#黑畫面救援)
- [音效](#音效)
- [鏈上對戰MagicBlock](#鏈上對戰magicblock)
- [指令](#指令)
- [瀏覽器支援](#瀏覽器支援)
- [貢獻](#貢獻)
- [授權](#授權)

---

## 特色

- **完整象棋規則** — 九宮將帥士、象眼與過河限制、蹩馬腿、炮打隔子、兵過河橫走、
  白臉將、將軍、絕殺、困斃判負與三次重複。
- **楚漢相爭軍陣** — 程序化生成的 3D 軍團:紅方漢軍劉邦(長冠佩劍)、藍方楚軍項羽
  (鶡冠雙羽持戟),兵卒髮髻幘巾、札甲圓盾,戰車軍旗、投石車,主帥各插「漢」「楚」
  字大纛。全部離線即時生成,不依賴外部模型。
- **傳統棋子模式** — 一鍵切回木刻圓棋:楷體刻字、紅朱藍墨,雙方刻字各對自己正立。
- **中式棋盤** — 單一木板棋面配傳統線圖:直線過河中斷、九宮斜線、炮兵位準星記號、
  楚河漢界楷書題字。
- **電影感吃子** — 鏡頭推進、火花、震屏,被吃的棋子從腳底燒蝕成飛灰;將軍時被將的
  主帥發出紅光警示。
- **2D 戰術視角** — 一鍵拉到正上方俯瞰,棋子攤平成印章棋標,盤面一目了然。
- **自動演武** — 兩個引擎自動對弈:各自難度、0.5×–4× 倍速、自動再戰、跟拍/環繞
  鏡頭,介面可全部收起來錄影。閒置主選單 30 秒會自動開演。
- **不擋棋盤的介面** — 純圖示控制列,每顆按鈕都有主題化 tooltip(名稱、一句說明、
  快捷鍵),棋譜收在角落印記裡,`C` 鍵一鍵全隱藏。
- **自動偵測畫質**(低 → 極高),偵測到掉幀自動降檔,WebGL context 遺失可復原。
- **對局時鐘**(沙漏呈現)、悔棋、認輸、翻轉棋盤、可複製的中文棋譜、被吃棋子清單
  與子力比較。

## 快速開始

需要 **Node 20+**。npm / pnpm / bun 都可以(repo 內附 `package-lock.json`)。

```bash
git clone <your-fork-url>
cd <repo>/web

npm install
npm run dev        # http://localhost:8080
npm run build      # production bundle 輸出到 web/dist/
npm run preview    # 本機預覽 build 結果
```

`web/dist/` 是純靜態網站 — 丟上 Vercel、GitHub Pages、Netlify、Cloudflare Pages 都行。

**登入是選配的**:不設定任何環境變數就是乾淨的單機版(人機/雙人/演武),完全不需要
登入。想開鏈上對戰才需要把 `web/.env.example` 複製成 `web/.env.local` 並填入 Privy
app ID — 此時選單會多出「鏈上對戰」分頁與登入按鈕。

## 操作方式

| 動作 | 輸入 |
| --- | --- |
| 旋轉 / 縮放鏡頭 | 拖曳、滾輪(觸控:單指拖曳、雙指縮放) |
| 選取棋子 | 點擊 — 合法落點亮綠、可吃的亮紅 |
| 走棋 | 點高亮的格子(再點一次棋子取消選取) |
| 鏡頭與場景 | 頂欄相機圖示 — 紅方 / 藍方 / 俯瞰 / 電影視角、翻轉、戰術視角、四個場景 |
| 看按鈕功能 | 滑過或聚焦(觸控:輕點)— 每顆圖示都有 tooltip |
| 跳過開場 | 開場運鏡中點擊任意處 |
| 遊戲設定 | 齒輪圖示 — 場景、棋子樣式、畫質、吃子運鏡、音效 |

沒有拖放走棋:按住移動超過 8px 視為轉鏡頭,所以從棋子上開始轉視角不會誤走。
選取與落子都在放開時判定。

鍵盤快捷鍵(輸入框聚焦時停用):

| 鍵 | 動作 |
| --- | --- |
| `F` | 鏡頭翻到對面 |
| `T` | 切換 2D 戰術視角 |
| `H` | 展開 / 收合棋譜 |
| `C` | 電影模式(隱藏整個介面) |
| `Space` | 演武模式暫停 / 繼續 |
| `Esc` | 關閉設定、相機選單、棋譜或 tooltip |

## 遊戲模式

| 模式 | 說明 |
| --- | --- |
| **人機對戰** | 選陣營、AI 強度與時限 |
| **雙人對戰** | 同螢幕輪流;換手時鏡頭自動轉到該方(可關) |
| **鏈上對戰** | 兩個 Privy Solana 錢包各押 0.01 devSOL 開房對戰(需設定 Privy,見下方 MagicBlock 章節) |
| **自動演武** | 引擎互毆 — 各自難度、倍速、自動再戰、三種鏡頭 |
| **待機演武** | 主選單放著不動 30 秒,背景自動開打 |

時限:不限時、5、10、15 分鐘。

## 棋子樣式

遊戲設定 → 棋子樣式:

| 樣式 | 說明 |
| --- | --- |
| **漢甲軍團**(預設) | 楚漢相爭 3D 軍陣,`src/scene/chineseFigures.ts` 手寫程序化生成 |
| **傳統棋子** | 木刻圓餅 + 楷體刻字,最傳統的樣貌 |

樣式記在 `localStorage`,切換即時生效。程式碼裡仍保留載入外部 rigged GLB 模型的完整
管線(`src/scene/pieces.ts` + `src/assets/generated.ts`),想接自己的 3D 角色模型:
把 GLB 丟進 `web/public/models/`、URL 填進 `PIECE_MODEL_URLS`,並恢復對應的
`PieceStyle` 分支即可 — loader 會自動置中、縮放、落地,載入失敗會退回程序化棋子,
**遊戲永遠玩得下去**。

## 戰場場景

相機選單或設定隨時切換;每個場景是整套重新打光。

| Id | 名稱 | 氛圍 |
| --- | --- | --- |
| `jungle` | **蒼龍山寺**(預設) | 松林山寺、飄散花粉、朱紅殿宇與金色屋簷 |
| `dawn` | **金闕晨庭** | 晨光越過朱柱宮燈 — 可讀性最高 |
| `frost` | **塞北雪關** | 陰天雪原冷平光 — 棋子對比最銳利 |
| `dusk` | **赤壁夜營** | 宮燈、烽火與最重的光暈 |

## 專案結構

```
.
├── rork.json               workspace manifest(一個 app:web/)
├── docs/                   MagicBlock 鏈上對戰規格
├── magicblock/             Anchor 合約(xiangqi_match program)
│   ├── programs/xiangqi_match/   狀態機、押注 escrow、結算、Ephemeral Rollup 委派
│   └── keys/               program keypair 備份(gitignored)
├── scripts/
└── web/
    ├── index.html
    ├── public/             icon、favicon、音檔(可放本機 .glb 模型)
    ├── scripts/e2e-devnet.mjs    Devnet 五條驗收鏈 e2e 腳本
    └── src/
        ├── core/           象棋規則 — 絕不 import three.js
        │   ├── gameController.ts   狀態、時鐘、悔棋、AI 回合、快照
        │   ├── xiangqi.ts          合法步、將軍與勝負判定
        │   └── types.ts / emitter.ts
        ├── ai/
        │   ├── engine.worker.ts    negamax + alpha-beta + 迭代加深
        │   └── aiClient.ts         主執行緒握把,過期搜尋自動取消
        ├── scene/          只有這裡碰 three.js
        │   ├── sceneEngine.ts      renderer、鏡頭、互動、走棋動畫、運鏡
        │   ├── chineseFigures.ts   楚漢軍團程序化棋子
        │   ├── board.ts            木板棋面、傳統線圖、楚河漢界、高亮池
        │   ├── pieces.ts           棋子工廠、樣式切換、GLB 管線(遺留)
        │   ├── environment / arena / battlefield / jungle   大殿、場景、戰場、山林
        │   ├── effects / strikes / spells    粒子、打擊、法術特效
        │   ├── rankBadges.ts       浮空徽章與戰術棋標
        │   ├── postfx.ts           bloom、SSAO、DOF、調色、SMAA
        │   ├── textures.ts         程序化木紋、石材、布料
        │   └── quality.ts          畫質預設 + 自動偵測
        ├── magicblock/     鏈上對戰(matchClient、大廳、IDL)
        ├── ui/             React 覆蓋層(GameShell、選單、HUD、設定、棋譜)
        ├── audio/          Web Audio 混音器
        └── assets/         外部資源 URL 清單
```

## 架構

渲染與規則完全解耦:**象棋核心發事件,場景訂閱事件。** `src/core` 不 import
three.js,遊戲邏輯可以 headless 測試,渲染器可以整個換掉。

走棋流程:

1. 玩家(或 worker)產生一步 → `GameController.tryMove`
2. `Xiangqi` 驗證合法性,controller 帶著吃子/將軍旗標發出 `MoveEvent`
3. controller **await 場景註冊的動畫器**,棋子還在走路時引擎不會搶跑
4. React 從每次變更後發布的 immutable `GameSnapshot` 重繪

單一資料源(`GameController`),React 經 `useGameSnapshot` hook 訂閱 — 沒有全域
store,遊戲狀態也不會 prop-drill 進場景。

## 電腦對手

| 難度 | 搜尋 | 時間 |
| --- | --- | --- |
| **簡單** — 新兵 | 隨機合法步,偏好吃子 | 即時 |
| **普通** — 軍師 | 深度 2 negamax + alpha-beta,子力評估 | 0.5 s |
| **困難** — 大將 | 深度 3 negamax + alpha-beta,吃子排序 | 1.8 s |

搜尋全部在 `engine.worker.ts` 裡跑;局面一變,`aiClient.ts` 就取消過期搜尋,
所以悔棋、認輸都是即時的。

## 畫質預設

| 預設 | 後製 | 陰影貼圖 | 粒子 |
| --- | --- | --- | --- |
| 低 | 無(直接渲染) | 關 | 無 |
| 中 | 光暈、調色、SMAA | 1024 | 少量 |
| 高 | + 運鏡景深 | 2048 | 完整 |
| 極高 | + SSAO | 4096 | 密集 |

首次載入依 GPU 字串、核心數與記憶體自動選檔;實測幀率持續低於 40 FPS 自動降一檔。
Pixel ratio 上限 2(低檔為 1),WebGL context 遺失會顯示重載提示而不是黑畫面。

## 黑畫面救援

部分驅動(尤其 Linux 無硬體加速時退回的 Mesa 軟體光柵器)會在介面正常的情況下把
場景畫全黑。引擎自動處理三種已知成因:

- **反射探針自檢**(`scene/diagnostics.ts`)— 開機時用探針獨立照亮一顆白球渲染到
  8×8 buffer 讀回,全黑就棄用探針、改用同色環境光。
- **幀看門狗** — 開頭八秒取樣五次(中央 + 四象限),全黑才逐層剝除:後製 →
  反射探針 → 安全渲染,並用通知說明發生了什麼;退到安全渲染的選擇會記住。
- 手動控制在 **設定 → 影像**:亮度(曝光 60–180%)與安全顯示模式;網址帶 `?safe=1`
  可從第一幀強制安全渲染。

## 音效

背景配樂為 **Chinese Guzheng 1**(作者 `u_ej49m6thqx`,
[Pixabay](https://pixabay.com/music/china-chinese-guzheng-1-308264/),依
[Pixabay Content License](https://pixabay.com/service/license-summary/) 使用,
出處記錄在 `web/public/audio/LICENSE.md`);將軍與終盤會疊入本地生成的戰鼓聲部。

腳步聲、落子木響、倒地與 UI 音全部用 oscillator 與 noise buffer 合成 — 不需音檔。
所有聲音走同一個 master gain(靜音開關),並遵守瀏覽器 autoplay 政策在首次互動後
才出聲。

> **外部資源注意**:部分取樣音效仍從 `src/assets/generated.ts` 列的遠端 URL 串流。
> 要正式營運請鏡像到 `web/public/` 並改掉常數,別依賴別人的 CDN。

## 鏈上對戰(MagicBlock)

`magicblock/` 內含完整的 Anchor 合約:建房押注(SOL escrow)、加入、鏈上走棋驗證
(完整象棋規則在鏈上重跑)、提和、逾時判負、取消退款、終局結算,以及 MagicBlock
Ephemeral Rollup 的 delegate / commit / undelegate 流程。前端 `src/magicblock/`
有對應的 client、大廳與對局 UI。

狀態:**程式完成、本地測試全過(cargo test + IDL 驗證),Devnet 尚未部署**。
部署與五條端到端驗收鏈(取消退款、紅勝、黑勝、和局、逾時)的腳本在
`web/scripts/e2e-devnet.mjs`,流程見 [`magicblock/README.md`](magicblock/README.md)
與 [`docs/magicblock-onchain-xiangqi-spec.md`](docs/magicblock-onchain-xiangqi-spec.md)。

## 指令

在 `web/` 下執行:

| 指令 | 功能 |
| --- | --- |
| `npm run dev` | Vite dev server(HMR) |
| `npm run build` | production build 到 `dist/` |
| `npm run preview` | 本機預覽 build |
| `npm run lint` | 全專案 ESLint |
| `npm test` | Node 單元測試 + 瀏覽器測試 |
| `npm run test:watch` | Vitest watch 模式 |

## 瀏覽器支援

任何支援 **WebGL 2** 與 **Web Audio** 的瀏覽器:現行 Chrome、Edge、Firefox 與
Safari 16+,桌機與平板皆可。支援觸控旋轉、雙指縮放與點擊走棋;窄螢幕時棋譜收進
角落按鈕,棋盤佔滿整個視口。

Linux 使用者先查 `chrome://gpu` / `about:support`:沒有硬體加速會退回 llvmpipe
軟渲染 — 遊戲仍可玩(見[黑畫面救援](#黑畫面救援)),但請預期低檔幀率。

## 貢獻

歡迎 issue 與 pull request — 流程、程式慣例與 **英文 Conventional Commits** 訊息
格式見 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 授權

[MIT](LICENSE) © the King's Gambit contributors.

隨附相依套件保留各自授權:three.js(MIT)、React(MIT)、Tailwind CSS(MIT)、
Radix UI / shadcn/ui(MIT)、lucide(ISC)。

專案內生成的 3D 資源與音效可依相同條款重用;若你替換了它們,請在此標註新作者。
