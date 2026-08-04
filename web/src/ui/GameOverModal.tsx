import { useState } from "react";
import { Check, Copy, Home, Swords } from "lucide-react";

import type { EndReason, Faction, GameResult } from "../core/types";
import { Crest } from "./Heraldry";

interface GameOverModalProps {
  result: GameResult;
  pgn: string;
  playerColor: Faction;
  versusComputer: boolean;
  onRematch: () => void;
  onMenu: () => void;
}

const REASON_COPY: Record<EndReason, string> = {
  checkmate: "將死",
  stalemate: "無子可走，依象棋規則判負",
  resignation: "一方認輸",
  timeout: "對局時間耗盡",
  threefold: "三次重複局面",
  insufficient: "子力不足，判定和棋",
  fiftymove: "達到回合上限，判定和棋",
  draw: "雙方和棋",
};

export function GameOverModal({ result, pgn, playerColor, versusComputer, onRematch, onMenu }: GameOverModalProps) {
  const [copied, setCopied] = useState(false);

  const draw = result.winner === null;
  const playerWon = versusComputer && result.winner === playerColor;
  const headline = draw ? "和棋" : playerWon ? "大獲全勝" : versusComputer ? "敗陣" : result.winner === "w" ? "紅方獲勝" : "黑方獲勝";

  const copyPgn = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("[ui] clipboard unavailable", error);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/65 px-5 backdrop-blur-[3px]">
      <div className="mc-parchment mc-goldleaf mc-rise w-full max-w-md overflow-hidden">
        <div className="px-6 pb-6 pt-7 text-center">
          <div className="flex justify-center gap-3">
            {result.winner ? (
              <Crest faction={result.winner} size={44} active />
            ) : (
              <>
                <Crest faction="w" size={34} />
                <Crest faction="b" size={34} />
              </>
            )}
          </div>

          <h2 className="mc-display mt-4 text-3xl font-bold tracking-[0.14em] text-[#43301a]">{headline}</h2>
          <div className="mc-rule mx-auto mt-2 w-40 opacity-70" />
          <p className="mt-2 text-sm italic text-[#6a5334]">{REASON_COPY[result.reason]}</p>

          <div className="mt-5 max-h-24 overflow-y-auto rounded-sm border border-[#8a652255] bg-[#00000010] p-3 text-left font-mono text-[0.7rem] leading-relaxed text-[#4a3a24]">
            {pgn.length > 0 ? pgn : "尚無走棋紀錄"}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="mc-btn mc-btn-primary flex items-center justify-center gap-2" onClick={onRematch}>
              <Swords size={15} /> 再戰一局
            </button>
            <button type="button" className="mc-btn flex items-center justify-center gap-2" onClick={onMenu}>
              <Home size={15} /> 返回大廳
            </button>
          </div>
          <button
            type="button"
            className="mc-btn mt-2 flex w-full items-center justify-center gap-2"
            onClick={() => void copyPgn()}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "已複製" : "複製象棋棋譜"}
          </button>
        </div>
      </div>
    </div>
  );
}
