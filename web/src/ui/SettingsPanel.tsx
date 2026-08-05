import { X } from "lucide-react";

import { ARENA_LOOKS, ARENA_ORDER, type ArenaTheme } from "../scene/arena";
import type { PieceStyle } from "../scene/pieces";
import type { QualityPreset } from "../scene/quality";

export interface GameSettings {
  quality: QualityPreset;
  /** Which map the board is staged in. */
  arena: ArenaTheme;
  /** 3D armies or traditional carved discs. */
  pieceStyle: PieceStyle;
  captureCinematics: boolean;
  rotateBoard: boolean;
  /** Floating rank crests over every figure. */
  rankBadges: boolean;
  muted: boolean;
  /**
   * Safe rendering: no composer, no reflection probe, no shadow maps. The way
   * out for drivers (mostly Linux/Mesa software rasterisers) that draw the hall
   * completely black.
   */
  safeMode: boolean;
  /** Exposure multiplier, 0.6–1.8. */
  brightness: number;
}

interface SettingsPanelProps {
  settings: GameSettings;
  autoDetected: QualityPreset;
  /** Driver line, e.g. `llvmpipe · WebGL2 · software`. */
  gpu: string;
  fps: number;
  onChange: (settings: GameSettings) => void;
  onClose: () => void;
}

const PRESETS: { key: QualityPreset; label: string; note: string }[] = [
  { key: "low", label: "低", note: "關閉後製與陰影，適合所有裝置" },
  { key: "medium", label: "中", note: "光暈、陰影、光束與少量塵埃" },
  { key: "high", label: "高", note: "加入景深、調色與 2K 陰影" },
  { key: "ultra", label: "極高", note: "環境光遮蔽、4K 陰影與密集粒子" },
];

const QUALITY_LABEL: Record<QualityPreset, string> = { low: "低", medium: "中", high: "高", ultra: "極高" };

export function SettingsPanel({ settings, autoDetected, gpu, fps, onChange, onClose }: SettingsPanelProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden bg-black/60 px-5 py-6 backdrop-blur-sm">
      <div className="mc-slate mc-goldleaf mc-rise flex max-h-full w-full min-h-0 max-w-lg flex-col p-5 sm:p-6">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="mc-display text-lg text-[#f2e2bd]">遊戲設定</h2>
          <button type="button" className="mc-btn mc-icon-btn" onClick={onClose} aria-label="關閉設定">
            <X size={16} />
          </button>
        </div>

        <div className="mc-scroll mc-scroll-shade -mr-2 min-h-0 flex-auto overflow-y-auto pb-1 pr-2">
        <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">戰場</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ARENA_ORDER.map((theme) => (
            <button
              key={theme}
              type="button"
              className="mc-arena-card"
              data-active={settings.arena === theme}
              onClick={() => onChange({ ...settings, arena: theme })}
            >
              <span className="mc-arena-swatch" data-arena={theme} />
              <span className="mc-display text-[0.68rem] leading-tight text-[#f0e0be]">{ARENA_LOOKS[theme].label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs italic text-[#9c8b6c]">{ARENA_LOOKS[settings.arena].note}</p>

        <div className="mc-rule my-5" />

        <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">棋子樣式</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="mc-chip py-2.5"
            data-active={settings.pieceStyle === "figures"}
            onClick={() => onChange({ ...settings, pieceStyle: "figures" })}
          >
            西幻軍團
          </button>
          <button
            type="button"
            className="mc-chip py-2.5"
            data-active={settings.pieceStyle === "chinese"}
            onClick={() => onChange({ ...settings, pieceStyle: "chinese" })}
          >
            漢甲軍團
          </button>
          <button
            type="button"
            className="mc-chip py-2.5"
            data-active={settings.pieceStyle === "traditional"}
            onClick={() => onChange({ ...settings, pieceStyle: "traditional" })}
          >
            傳統棋子
          </button>
        </div>
        <p className="mt-2 text-xs italic text-[#9c8b6c]">
          {settings.pieceStyle === "traditional"
            ? "木刻圓棋、楷體刻字，最傳統的象棋樣貌"
            : settings.pieceStyle === "chinese"
              ? "斗笠長槍、戰車火炮的中式軍陣，離線即時生成"
              : "AI 生成的西幻軍團，吃子有攻擊動畫"}
        </p>

        <div className="mc-rule my-5" />

        <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">畫面品質</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className="mc-chip py-2.5"
              data-active={settings.quality === preset.key}
              onClick={() => onChange({ ...settings, quality: preset.key })}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs italic text-[#9c8b6c]">
          {PRESETS.find((preset) => preset.key === settings.quality)?.note}
        </p>
        <p className="mt-1 text-[0.68rem] text-[#7d6f57]">
          裝置自動偵測：<span className="text-[#c8ab74]">{QUALITY_LABEL[autoDetected]}</span>
          {fps > 0 ? ` · 目前每秒 ${fps} 幀` : ""}
        </p>
        {gpu ? <p className="mt-0.5 text-[0.68rem] text-[#6d6149]">顯示裝置：{gpu}</p> : null}

        <div className="mc-rule my-5" />

        <p className="mc-display mb-2 text-[0.6rem] tracking-[0.3em] text-[#a89268]">影像</p>
        <div className="flex items-center gap-3 py-1">
          <span className="mc-display w-24 shrink-0 text-[0.72rem] text-[#efe0c0]">亮度</span>
          <input
            type="range"
            className="mc-slider flex-auto"
            min={0.6}
            max={1.8}
            step={0.05}
            value={settings.brightness}
            onChange={(event) => onChange({ ...settings, brightness: Number(event.target.value) })}
            aria-label="亮度"
          />
          <span className="w-10 shrink-0 text-right text-xs text-[#c8ab74]">
            {Math.round(settings.brightness * 100)}%
          </span>
        </div>
        <Toggle
          label="安全顯示模式"
          note="若戰場全黑或未照亮，可關閉特效、反射與陰影"
          value={settings.safeMode}
          onChange={(value) => onChange({ ...settings, safeMode: value })}
        />

        <div className="mc-rule my-5" />

        <Toggle
          label="吃子運鏡"
          note="鏡頭推進、攻擊、火花與碎裂，長度不超過 1.5 秒"
          value={settings.captureCinematics}
          onChange={(value) => onChange({ ...settings, captureCinematics: value })}
        />
        <Toggle
          label="每回合轉換鏡頭"
          note="僅用於雙人同機對戰"
          value={settings.rotateBoard}
          onChange={(value) => onChange({ ...settings, rotateBoard: value })}
        />
        <Toggle
          label="棋子中文旗號"
          note="在每名 3D 士兵上方顯示帥、將、車、馬等中文棋子旗號"
          value={settings.rankBadges}
          onChange={(value) => onChange({ ...settings, rankBadges: value })}
        />
        <Toggle
          label="聲音"
          note="原創五聲音階配樂、戰鼓、環境音與戰鬥音效"
          value={!settings.muted}
          onChange={(value) => onChange({ ...settings, muted: !value })}
        />
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-4 border-b border-[#8a652222] py-3 text-left last:border-b-0"
      onClick={() => onChange(!value)}
    >
      <span>
        <span className="mc-display block text-[0.78rem] text-[#efe0c0]">{label}</span>
        <span className="text-xs italic text-[#9c8b6c]">{note}</span>
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200"
        style={{
          background: value ? "linear-gradient(180deg,#d8b163,#8a6522)" : "rgba(20,18,15,0.8)",
          borderColor: value ? "rgba(246,223,165,0.8)" : "rgba(216,177,99,0.3)",
        }}
      >
        <span
          className="absolute top-0.5 h-4.5 w-4.5 rounded-full bg-[#1a1710] transition-all duration-200"
          style={{ left: value ? "1.55rem" : "0.15rem", width: "1.1rem", height: "1.1rem" }}
        />
      </span>
    </button>
  );
}
