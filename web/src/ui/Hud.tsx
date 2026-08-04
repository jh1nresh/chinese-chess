import { useEffect, useRef, useState } from "react";
import {
  Box,
  Camera,
  ChevronRight,
  Clapperboard,
  Crosshair,
  EyeOff,
  Flag,
  LayoutGrid,
  Maximize,
  Orbit,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  RotateCw,
  ScrollText,
  Settings as SettingsIcon,
  Swords,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import type { GameSnapshot, LedgerMove, PieceKind } from "../core/types";
import { ARENA_LOOKS, ARENA_ORDER, type ArenaTheme } from "../scene/arena";
import type { CameraPreset, ShowcaseCamera } from "../scene/sceneEngine";
import { Crest, Hourglass, pieceGlyph } from "./Heraldry";
import { MoveLedger } from "./MoveLedger";
import { Tooltip, type TooltipSide } from "./Tooltip";

interface HudProps {
  snapshot: GameSnapshot;
  muted: boolean;
  fps: number;
  onNewGame: () => void;
  onUndo: () => void;
  onResign: () => void;
  onToggleSound: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onCamera: (preset: CameraPreset) => void;
  onFlipCamera: () => void;
  cameraFlipped: boolean;
  tactical: boolean;
  onToggleTactical: () => void;
  arena: ArenaTheme;
  onArena: (theme: ArenaTheme) => void;
  onPreviewMove: (move: LedgerMove | null) => void;
  onTogglePause: () => void;
  onDemoSpeed: (speed: number) => void;
  onDemoLoop: (loop: boolean) => void;
  onDemoRestart: () => void;
  showcaseCamera: ShowcaseCamera;
  onShowcaseCamera: (mode: ShowcaseCamera) => void;
  onToggleCinema: () => void;
}

const DEMO_SPEEDS: { label: string; value: number }[] = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "4×", value: 4 },
];

/** Showcase camera behaviours, in the order they appear on the transport. */
const SHOWCASE_CAMERAS: { key: ShowcaseCamera; label: string; hint: string; icon: typeof Camera }[] = [
  { key: "still", label: "固定", hint: "固定單一視角，鏡頭不會自行移動", icon: Camera },
  { key: "follow", label: "跟隨", hint: "跟隨正在移動的棋子，並拉近觀看交鋒", icon: Crosshair },
  { key: "orbit", label: "環繞", hint: "鏡頭緩慢環繞棋盤", icon: Orbit },
];

const DIFFICULTY_SHORT: Record<string, string> = {
  easy: "新兵",
  medium: "軍師",
  hard: "大將",
};

const CAMERA_BUTTONS: { key: CameraPreset; label: string }[] = [
  { key: "white", label: "紅方視角" },
  { key: "black", label: "黑方視角" },
  { key: "top", label: "俯視" },
  { key: "cinematic", label: "戰場全景" },
];

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Hud({
  snapshot,
  muted,
  fps,
  onNewGame,
  onUndo,
  onResign,
  onToggleSound,
  onFullscreen,
  onSettings,
  onCamera,
  onFlipCamera,
  cameraFlipped,
  tactical,
  onToggleTactical,
  arena,
  onArena,
  onPreviewMove,
  onTogglePause,
  onDemoSpeed,
  onDemoLoop,
  onDemoRestart,
  showcaseCamera,
  onShowcaseCamera,
  onToggleCinema,
}: HudProps) {
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [transportOpen, setTransportOpen] = useState(true);
  const [activePreset, setActivePreset] = useState<CameraPreset>(() =>
    snapshot.mode === "ai" && snapshot.playerColor === "b" ? "black" : "white",
  );
  const cameraMenuRef = useRef<HTMLDivElement | null>(null);
  const chronicleRef = useRef<HTMLDivElement | null>(null);

  // Dismiss the camera menu on outside taps / Escape without laying an
  // invisible backdrop over the board (that would eat the next board click).
  useEffect(() => {
    if (!cameraMenuOpen) return;
    const onPointerDown = (event: PointerEvent): void => {
      const node = cameraMenuRef.current;
      if (node && !node.contains(event.target as Node)) setCameraMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setCameraMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [cameraMenuOpen]);

  // The chronicle is a corner button by default so the board keeps the whole
  // screen. Escape closes it anywhere; on narrow screens the open panel covers
  // a good part of the board, so a tap outside folds it back down as well.
  useEffect(() => {
    if (!chronicleOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setChronicleOpen(false);
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (window.innerWidth >= 1024) return;
      const node = chronicleRef.current;
      if (node && !node.contains(event.target as Node)) setChronicleOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [chronicleOpen]);

  // "H" toggles the record without reaching for the corner.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "h" && event.key !== "H") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const typing = target ? /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable : false;
      if (typing) return;
      setChronicleOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pickCamera = (preset: CameraPreset): void => {
    setActivePreset(preset);
    setCameraMenuOpen(false);
    onCamera(preset);
  };

  const demo = snapshot.demo;
  const whiteTaken = snapshot.captured.filter((piece) => piece.color === "b");
  const blackTaken = snapshot.captured.filter((piece) => piece.color === "w");
  const diff = snapshot.materialDiff;

  const ledger = (
    <MoveLedger
      moves={snapshot.moves}
      pgn={snapshot.pgn}
      result={snapshot.result}
      turn={snapshot.turn}
      thinking={snapshot.thinking}
      playing={snapshot.status === "playing"}
      onPreview={onPreviewMove}
    />
  );

  const spoils = (
    <div className="mc-slate mc-goldleaf px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="mc-display text-[0.6rem] tracking-[0.34em] text-[#a89268]">已吃棋子</p>
        <span className="mc-display text-[0.72rem] text-[#e2c98f]">
          {diff === 0 ? "子力相當" : diff > 0 ? `紅方 +${diff}` : `黑方 +${-diff}`}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        <CapturedRow label="w" pieces={whiteTaken.map((piece) => piece.kind)} />
        <CapturedRow label="b" pieces={blackTaken.map((piece) => piece.kind)} />
      </div>
    </div>
  );

  return (
    <>
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="mc-slate mc-goldleaf pointer-events-auto flex items-center gap-3 px-3 py-2.5">
          <Crest faction={snapshot.turn} size={26} active />
          <div>
            <p className="mc-display text-[0.58rem] tracking-[0.3em] text-[#a89268]">
              {demo
                ? `自動演武 · 第 ${snapshot.demoRound} 局`
                : snapshot.status === "over"
                  ? "對局結束"
                  : snapshot.thinking
                    ? "運籌帷幄"
                    : "輪到走棋"}
            </p>
            <p className="mc-display text-sm text-[#f2e2bd]">
              {snapshot.status === "over"
                ? "—"
                : snapshot.thinking
                  ? "思考中…"
                  : snapshot.turn === "w"
                    ? "紅方"
                    : "黑方"}
            </p>
          </div>
          {snapshot.inCheck && snapshot.status === "playing" ? (
            <span className="mc-danger-flash mc-display rounded-sm border border-[#a8342a] px-2 py-1 text-[0.6rem] tracking-[0.24em] text-[#ff9a8a]">
              將軍
            </span>
          ) : null}
          {snapshot.thinking ? (
            <span className="mc-pulse ml-1 h-2 w-2 rounded-full bg-[#d8b163]" aria-hidden="true" />
          ) : null}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          {snapshot.clock.enabled ? (
            <div className="mc-slate flex items-center gap-3 px-3 py-1.5">
              <ClockFace
                ms={snapshot.clock.whiteMs}
                initial={snapshot.clock.initialMs}
                active={snapshot.turn === "w" && snapshot.status === "playing"}
                faction="w"
              />
              <div className="h-6 w-px bg-[#8a652244]" />
              <ClockFace
                ms={snapshot.clock.blackMs}
                initial={snapshot.clock.initialMs}
                active={snapshot.turn === "b" && snapshot.status === "playing"}
                faction="b"
              />
            </div>
          ) : null}

          {demo ? (
            <IconButton
              label="純棋盤畫面"
              hint="隱藏全部介面，只保留棋盤以便錄影。"
              keys="C"
              onClick={onToggleCinema}
            >
              <EyeOff size={16} />
            </IconButton>
          ) : (
            <>
              <IconButton
                label="悔棋"
                hint={
                  snapshot.canUndo
                    ? "撤回你上一手與對手的回應。"
                    : "目前沒有可撤回的走法。"
                }
                onClick={onUndo}
                disabled={!snapshot.canUndo}
              >
                <RotateCcw size={16} />
              </IconButton>
              <IconButton
                label="認輸"
                hint={
                  snapshot.status === "playing"
                    ? "承認敗局，對手立即獲勝。"
                    : "對局已經結束。"
                }
                onClick={onResign}
                disabled={snapshot.status !== "playing"}
                danger
              >
                <Flag size={16} />
              </IconButton>
            </>
          )}
          <IconButton label="新對局" hint="離開目前戰局並重新擺盤。" onClick={onNewGame}>
            <Swords size={16} />
          </IconButton>
          <IconButton
            label={muted ? "聲音已關" : "聲音已開"}
            hint={muted ? "恢復配樂、攻擊與腳步聲。" : "靜音配樂與全部戰鬥音效。"}
            onClick={onToggleSound}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </IconButton>
          <IconButton label="全螢幕" hint="讓戰場填滿整個畫面。" onClick={onFullscreen}>
            <Maximize size={16} />
          </IconButton>
          <IconButton
            label="翻轉視角"
            hint="將鏡頭旋轉 180°，從另一端觀戰。"
            keys="F"
            onClick={onFlipCamera}
            active={cameraFlipped}
          >
            <Repeat size={16} />
          </IconButton>
          <IconButton
            label={tactical ? "返回 3D" : "戰術棋盤"}
            hint={
              tactical
                ? "返回具有士兵模型的 3D 戰場。"
                : "切換平面俯視棋盤，一眼看清所有位置。"
            }
            keys="T"
            onClick={onToggleTactical}
            active={tactical}
          >
            {tactical ? <Box size={16} /> : <LayoutGrid size={16} />}
          </IconButton>

          {/* Camera views live in a dropdown so nothing floats over the board */}
          <div className="relative" ref={cameraMenuRef}>
            <IconButton
              label="鏡頭與戰場"
              hint="選擇觀戰視角與交鋒場景。"
              onClick={() => setCameraMenuOpen((open) => !open)}
              active={cameraMenuOpen}
            >
              <Video size={16} />
            </IconButton>
            {cameraMenuOpen ? (
              <div className="mc-cam-menu mc-slate absolute right-0 top-[calc(100%+0.4rem)] z-30 w-44 p-2">
                <p className="mc-display px-1 pb-1.5 text-[0.52rem] tracking-[0.3em] text-[#a89268]">鏡頭</p>
                <div className="flex flex-col gap-1">
                  {CAMERA_BUTTONS.map((button) => (
                    <button
                      key={button.key}
                      type="button"
                      className="mc-chip w-full text-left"
                      data-active={!tactical && activePreset === button.key}
                      onClick={() => pickCamera(button.key)}
                    >
                      {button.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="mc-chip flex w-full items-center gap-1.5 text-left"
                    data-active={tactical}
                    onClick={() => {
                      setCameraMenuOpen(false);
                      onToggleTactical();
                    }}
                    title="平面俯視棋盤，不受士兵模型遮擋（T）"
                    aria-pressed={tactical}
                  >
                    <LayoutGrid size={13} />
                    2D 戰術棋盤
                  </button>
                  <div className="mc-rule my-1 opacity-60" />
                  <button
                    type="button"
                    className="mc-chip mc-chip-flip flex w-full items-center gap-1.5"
                    data-active={cameraFlipped}
                    onClick={onFlipCamera}
                    title="將鏡頭翻轉至另一方（F）"
                    aria-pressed={cameraFlipped}
                  >
                    <Repeat
                      size={13}
                      className="mc-flip-icon"
                      style={{ transform: cameraFlipped ? "rotate(180deg)" : "none" }}
                    />
                    翻轉 180°
                  </button>
                </div>

                <p className="mc-display px-1 pb-1.5 pt-3 text-[0.52rem] tracking-[0.3em] text-[#a89268]">
                  戰場
                </p>
                <div className="flex flex-col gap-1">
                  {ARENA_ORDER.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className="mc-chip flex w-full items-center gap-2 text-left"
                      data-active={arena === theme}
                      onClick={() => onArena(theme)}
                      title={ARENA_LOOKS[theme].note}
                    >
                      <span className="mc-arena-dot" data-arena={theme} />
                      {ARENA_LOOKS[theme].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <IconButton
            label="遊戲設定"
            hint="調整畫面、聲音、計時與對手強度。"
            onClick={onSettings}
          >
            <SettingsIcon size={16} />
          </IconButton>
        </div>
      </div>

      {/* Spoils tucks under the top bar on desktop — it is short and clear of
          the board. */}
      <div className="mc-rise pointer-events-auto absolute right-4 top-24 hidden w-56 lg:block xl:w-60">{spoils}</div>

      {/* Chronicle: a small corner sigil that unfurls the record on demand. The
          wrapper stays click-through so the board keeps every tap that is not
          aimed at the button or the open panel. */}
      <div
        ref={chronicleRef}
        className="pointer-events-none absolute bottom-0 left-0 z-30 flex flex-col items-start gap-2 p-3 sm:p-4"
      >
        {chronicleOpen ? (
          <div className="mc-chronicle-panel pointer-events-auto flex h-[min(56vh,460px)] w-[min(84vw,18.5rem)] flex-col gap-2 lg:w-64">
            <div className="min-h-0 flex-1">{ledger}</div>
            <div className="lg:hidden">{spoils}</div>
          </div>
        ) : null}

        <Tooltip
          label={chronicleOpen ? "關閉棋譜" : "棋譜"}
          hint={chronicleOpen ? "將棋譜收回畫面角落。" : "查看完整走棋紀錄與已吃棋子。"}
          keys="H"
          side="top"
        >
          <button
            type="button"
            className="mc-chronicle-fab pointer-events-auto"
            data-open={chronicleOpen || undefined}
            onClick={() => setChronicleOpen((open) => !open)}
            aria-label="開關棋譜"
            aria-expanded={chronicleOpen}
          >
            {chronicleOpen ? <X size={16} /> : <ScrollText size={16} />}
            {!chronicleOpen && snapshot.moves.length > 0 ? (
              <span key={snapshot.moves.length} className="mc-chronicle-badge">
                {snapshot.moves.length}
              </span>
            ) : null}
          </button>
        </Tooltip>
      </div>

      {/* Showcase transport — a slim rail tucked into the bottom-right corner,
          icon-only, and foldable down to a single sigil so the board is never
          covered. */}
      {demo ? (
        <div className="mc-demo-dock pointer-events-auto">
          {transportOpen ? (
            <div className="mc-demo-bar">
              <Tooltip
                label={snapshot.paused ? "繼續" : "暫停"}
                hint={snapshot.paused ? "繼續自動演武。" : "暫停目前的自動演武。"}
                keys="空白鍵"
                side="top"
              >
                <button
                  type="button"
                  className="mc-demo-play"
                  data-paused={snapshot.paused || undefined}
                  onClick={onTogglePause}
                  aria-label={snapshot.paused ? "繼續自動演武" : "暫停自動演武"}
                >
                  {snapshot.paused ? <Play size={13} /> : <Pause size={13} />}
                </button>
              </Tooltip>

              <div className="mc-demo-sep" />

              <div className="flex items-center gap-[0.15rem]">
                {DEMO_SPEEDS.map((option) => (
                  <Tooltip key={option.label} label={`速度 ${option.label}`} hint="調整自動演武的行棋速度。" side="top">
                    <button
                      type="button"
                      className="mc-chip mc-demo-speed"
                      data-active={demo.speed === option.value}
                      onClick={() => onDemoSpeed(option.value)}
                    >
                      {option.label}
                    </button>
                  </Tooltip>
                ))}
              </div>

              <div className="mc-demo-sep" />

              {/* Camera behaviour: the duel is watched, so how it is shot matters
                  as much as how fast it is played. Icons only — the label lives
                  in the tooltip. */}
              <div className="flex items-center gap-[0.15rem]">
                {SHOWCASE_CAMERAS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <Tooltip key={option.key} label={`鏡頭：${option.label}`} hint={option.hint} side="top">
                      <button
                        type="button"
                        className="mc-chip mc-demo-icon"
                        data-active={showcaseCamera === option.key}
                        onClick={() => onShowcaseCamera(option.key)}
                        aria-label={`鏡頭：${option.label}`}
                        aria-pressed={showcaseCamera === option.key}
                      >
                        <Icon size={13} />
                      </button>
                    </Tooltip>
                  );
                })}
              </div>

              <div className="mc-demo-sep" />

              <Tooltip label="循環對局" hint="本局結束後自動開始新對局。" side="top">
                <button
                  type="button"
                  className="mc-chip mc-demo-icon"
                  data-active={demo.autoRematch}
                  onClick={() => onDemoLoop(!demo.autoRematch)}
                  aria-label="循環對局"
                  aria-pressed={demo.autoRematch}
                >
                  <Repeat size={13} />
                </button>
              </Tooltip>
              <Tooltip
                label="新對局"
                hint={`重新擺盤：${DIFFICULTY_SHORT[demo.white] ?? demo.white} 對 ${
                  DIFFICULTY_SHORT[demo.black] ?? demo.black
                }。`}
                side="top"
              >
                <button
                  type="button"
                  className="mc-chip mc-demo-icon"
                  onClick={onDemoRestart}
                  aria-label="重新開始對局"
                >
                  <RotateCw size={13} />
                </button>
              </Tooltip>

              <Tooltip label="隱藏控制列" hint="將控制列收合成單一圖示。" side="left">
                <button
                  type="button"
                  className="mc-demo-fold"
                  onClick={() => setTransportOpen(false)}
                  aria-label="隱藏演武控制列"
                >
                  <ChevronRight size={13} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip
              label="演武控制"
              hint={`${DIFFICULTY_SHORT[demo.white] ?? demo.white} 對 ${
                DIFFICULTY_SHORT[demo.black] ?? demo.black
              }${snapshot.paused ? " — 已暫停" : ""}。可調整速度、鏡頭與循環。`}
              side="top"
            >
              <button
                type="button"
                className="mc-demo-tab"
                data-paused={snapshot.paused || undefined}
                onClick={() => setTransportOpen(true)}
                aria-label="顯示演武控制列"
              >
                <Clapperboard size={14} />
              </button>
            </Tooltip>
          )}

          {snapshot.paused ? <span className="mc-demo-flag mc-pulse">已暫停</span> : null}
          {snapshot.status === "over" && demo.autoRematch ? (
            <span className="mc-demo-flag mc-pulse">準備下一局…</span>
          ) : null}
        </div>
      ) : null}

      {fps > 0 ? (
        <span className="pointer-events-none absolute bottom-2 right-3 hidden text-[0.62rem] tracking-widest text-[#5f5747] lg:block">
          每秒 {fps} 幀
        </span>
      ) : null}
    </>
  );
}

function CapturedRow({ label, pieces }: { label: "w" | "b"; pieces: PieceKind[] }) {
  return (
    <div className="flex items-center gap-2">
      <Crest faction={label} size={14} />
      <div className="flex flex-wrap gap-0.5 text-lg leading-none" style={{ color: label === "w" ? "#f0e3c6" : "#b9838a" }}>
        {pieces.length === 0 ? <span className="text-xs italic text-[#7d6f57]">—</span> : null}
        {pieces.map((kind, index) => (
          <span key={`${kind}-${index}`}>{pieceGlyph(kind, label === "w" ? "b" : "w")}</span>
        ))}
      </div>
    </div>
  );
}

function ClockFace({
  ms,
  initial,
  active,
  faction,
}: {
  ms: number;
  initial: number;
  active: boolean;
  faction: "w" | "b";
}) {
  const urgent = ms < 30_000;
  return (
    <div className="flex items-center gap-1.5" style={{ opacity: active ? 1 : 0.55 }}>
      <Hourglass ratio={initial > 0 ? ms / initial : 0} urgent={urgent} />
      <div>
        <p className="mc-display text-[0.5rem] tracking-[0.2em] text-[#a89268]">{faction === "w" ? "紅方" : "黑方"}</p>
        <p className={`mc-display text-sm ${urgent ? "text-[#ff8f7d]" : "text-[#f2e2bd]"}`}>{formatClock(ms)}</p>
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  hint,
  keys,
  side = "bottom",
  onClick,
  disabled,
  danger,
  active,
}: {
  children: React.ReactNode;
  /** Short name shown on the tooltip's first line and read by screen readers. */
  label: string;
  /** One sentence explaining what the control does. */
  hint?: string;
  /** Keyboard shortcut, rendered as a key cap. */
  keys?: string;
  side?: TooltipSide;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip label={label} hint={hint} keys={keys} side={side}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        data-active={active ? "true" : undefined}
        className={`mc-btn mc-icon-btn ${danger ? "mc-btn-danger" : ""}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
