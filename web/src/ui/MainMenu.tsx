import { useState } from "react";
import { Clapperboard, Crown, RadioTower, Settings as SettingsIcon, Swords, Users } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

import { PRIVY_APP_ID, PrivyLoginButton } from "../auth/PrivyLoginButton";
import type { DemoOptions, Difficulty, Faction } from "../core/types";
import { OnlineLobby } from "../magicblock/OnlineLobby";
import type { OnlineSession } from "../magicblock/onlineTypes";
import { Crest } from "./Heraldry";

export interface MatchConfig {
  mode: "ai" | "hotseat" | "demo";
  difficulty: Difficulty;
  playerColor: Faction;
  clockMinutes: number | null;
  demo?: DemoOptions;
}

interface MainMenuProps {
  onStart: (config: MatchConfig) => void;
  onOnlineStart: (session: OnlineSession) => void;
  onOpenSettings: () => void;
  attract: boolean;
  onInteract: () => void;
}

interface MainMenuContentProps extends MainMenuProps {
  authReady: boolean;
  authenticated: boolean;
  onLogin?: () => void;
}

const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: "新兵 — 反應快速，偏好吃子",
  medium: "軍師 — 預判兩步攻防",
  hard: "大將 — 深度搜尋，思考較久",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "簡單",
  medium: "普通",
  hard: "困難",
};

const DEMO_SPEEDS: { label: string; value: number }[] = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
];

const CLOCKS: { label: string; value: number | null }[] = [
  { label: "不限時", value: null },
  { label: "5 分", value: 5 },
  { label: "10 分", value: 10 },
  { label: "15 分", value: 15 },
];

export function MainMenu(props: MainMenuProps) {
  if (!PRIVY_APP_ID) return <MainMenuContent {...props} authReady authenticated={false} />;
  return <AuthenticatedMainMenu {...props} />;
}

function AuthenticatedMainMenu(props: MainMenuProps) {
  const { ready, authenticated, login } = usePrivy();
  return <MainMenuContent {...props} authReady={ready} authenticated={authenticated} onLogin={login} />;
}

function MainMenuContent({
  onStart,
  onOnlineStart,
  onOpenSettings,
  attract,
  onInteract,
  authReady,
  authenticated,
  onLogin,
}: MainMenuContentProps) {
  const [tab, setTab] = useState<"ai" | "hotseat" | "online" | "demo">("ai");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [playerColor, setPlayerColor] = useState<Faction>("w");
  const [clock, setClock] = useState<number | null>(null);
  const [demoWhite, setDemoWhite] = useState<Difficulty>("medium");
  const [demoBlack, setDemoBlack] = useState<Difficulty>("hard");
  const [demoSpeed, setDemoSpeed] = useState(1);
  const [demoLoop, setDemoLoop] = useState(true);

  const start = (): void => {
    if (!authReady) return;
    // Login is only enforceable when Privy is configured; without it the
    // local modes stay playable and only online play remains gated.
    if (!authenticated && onLogin) {
      onLogin();
      return;
    }
    onStart({
      mode: tab === "online" ? "hotseat" : tab,
      difficulty,
      playerColor,
      clockMinutes: tab === "demo" ? null : clock,
      demo: tab === "demo" ? { white: demoWhite, black: demoBlack, speed: demoSpeed, autoRematch: demoLoop } : undefined,
    });
  };

  return (
    <div
      className="mc-menu pointer-events-auto absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-5 py-6"
      onPointerDown={onInteract}
      onPointerMove={onInteract}
    >
      <div className="mc-unfurl mc-menu-hero mb-6 shrink-0 text-center">
        <p className="mc-display text-[0.68rem] tracking-[0.55em] text-[#c8ab74]">楚河 · 漢界</p>
        <h1 className="mc-display mc-title-glow mt-2 text-5xl font-bold text-[#f4e3bd] sm:text-6xl">
          龍爭象棋
        </h1>
        <div className="mc-rule mx-auto mt-3 w-64" />
        <p className="mt-3 text-sm italic text-[#c5b28d]">
          {attract ? "象棋演武進行中" : "華人象棋規則，奇幻中古軍陣"}
        </p>
      </div>

      <div className="mc-slate mc-goldleaf mc-rise flex w-full min-h-0 max-w-lg flex-col p-5 sm:p-6">
        <div className="mb-4 flex shrink-0 justify-end"><PrivyLoginButton /></div>
        {!authenticated ? (
          <p className="mb-4 text-center text-xs leading-relaxed text-[#c5b28d]" role="status">
            {onLogin ? "請先使用 Privy 登入，登入後才能進入戰場。" : "尚未設定 Privy；單機模式可直接進入，鏈上對戰需要登入。"}
          </p>
        ) : null}
        <div className="mb-5 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "ai"}
            onClick={() => setTab("ai")}
          >
            <Swords size={14} /> 人機對戰
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "hotseat"}
            onClick={() => setTab("hotseat")}
          >
            <Users size={14} /> 雙人對戰
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "online"}
            onClick={() => setTab("online")}
          >
            <RadioTower size={14} /> 鏈上對戰
          </button>
          <button
            type="button"
            className="mc-chip flex items-center justify-center gap-1.5 px-1 py-3"
            data-active={tab === "demo"}
            onClick={() => setTab("demo")}
          >
            <Clapperboard size={14} /> 自動演武
          </button>
        </div>

        <div className="mc-scroll -mr-2 min-h-0 flex-auto overflow-y-auto pr-2">
        {tab === "ai" ? (
          <div className="mc-fade space-y-5">
            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">對手強度</p>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={difficulty === level}
                    onClick={() => setDifficulty(level)}
                  >
                    {DIFFICULTY_LABEL[level]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs italic text-[#9c8b6c]">{DIFFICULTY_COPY[difficulty]}</p>
            </div>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">選擇陣營</p>
              <div className="grid grid-cols-2 gap-2">
                {(["w", "b"] as Faction[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="mc-chip flex items-center justify-center gap-2 py-2.5"
                    data-active={playerColor === color}
                    onClick={() => setPlayerColor(color)}
                  >
                    <Crest faction={color} size={18} active={playerColor === color} />
                    {color === "w" ? "紅方" : "黑方"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : tab === "hotseat" ? (
          <p className="mc-fade text-sm italic leading-relaxed text-[#b7a88a]">
            兩位將帥共用一副棋盤。每回合鏡頭會轉向執子方，也可在設定中關閉。
          </p>
        ) : tab === "online" ? (
          authenticated && onLogin ? (
            <OnlineLobby onStart={onOnlineStart} />
          ) : (
            <p className="mc-fade text-sm italic leading-relaxed text-[#b7a88a]">
              登入 Privy 並連接 Solana 錢包後，才能建立或加入 Devnet 對局。
            </p>
          )
        ) : (
          <div className="mc-fade space-y-5">
            <p className="text-sm italic leading-relaxed text-[#b7a88a]">
              兩名電腦棋手自動交鋒，鏡頭會巡遊戰場，適合錄製畫面。對局中按
              <span className="mc-display text-[#e2c98f]"> C </span>可隱藏全部介面。
            </p>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">紅方棋力</p>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={demoWhite === level}
                    onClick={() => setDemoWhite(level)}
                  >
                    {DIFFICULTY_LABEL[level]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">黑方棋力</p>
              <div className="grid grid-cols-3 gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={demoBlack === level}
                    onClick={() => setDemoBlack(level)}
                  >
                    {DIFFICULTY_LABEL[level]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">演武速度</p>
              <div className="grid grid-cols-4 gap-2">
                {DEMO_SPEEDS.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className="mc-chip py-2.5"
                    data-active={demoSpeed === option.value}
                    onClick={() => setDemoSpeed(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="mc-chip flex w-full items-center justify-between px-3 py-2.5"
              data-active={demoLoop}
              onClick={() => setDemoLoop((loop) => !loop)}
              aria-pressed={demoLoop}
            >
              <span>自動重開對局</span>
              <span className="mc-display text-[0.62rem] tracking-[0.24em]">{demoLoop ? "開" : "關"}</span>
            </button>
          </div>
        )}

        {tab === "demo" || tab === "online" ? null : (
          <div className="mt-5">
            <p className="mc-display mb-2 text-[0.62rem] tracking-[0.3em] text-[#a89268]">對局時限</p>
            <div className="grid grid-cols-4 gap-2">
              {CLOCKS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className="mc-chip py-2.5"
                  data-active={clock === option.value}
                  onClick={() => setClock(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
        </div>

        <div className="mc-panel-foot shrink-0">
        {tab === "online" ? null : <button
          type="button"
          className="mc-btn mc-btn-primary mt-5 flex w-full items-center justify-center gap-2 py-3.5 text-sm"
          onClick={start}
          disabled={!authReady}
        >
          {!authReady ? (
            <><Crown size={16} /> 確認登入狀態</>
          ) : !authenticated && onLogin ? (
            <><Crown size={16} /> 先登入再進入戰場</>
          ) : tab === "demo" ? (
            <>
              <Clapperboard size={16} /> 開始演武
            </>
          ) : (
            <>
              <Crown size={16} /> 進入戰場
            </>
          )}
        </button>}

        <button
          type="button"
          className="mc-btn mt-2 flex w-full items-center justify-center gap-2"
          onClick={onOpenSettings}
        >
          <SettingsIcon size={15} /> 遊戲設定
        </button>
        </div>
      </div>

      <p className="mc-menu-hint mt-5 shrink-0 text-[0.68rem] tracking-[0.2em] text-[#7d6f57]">
        拖曳旋轉鏡頭 · 滾輪縮放 · 點選棋子下令
      </p>
    </div>
  );
}
