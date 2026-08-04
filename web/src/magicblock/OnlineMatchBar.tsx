import { CircleDollarSign, Flag, Handshake, Hourglass, RadioTower } from "lucide-react";

import { MATCH_STATUS, type MatchAccount } from "./matchClient";
import type { OnlineSession } from "./onlineTypes";

interface OnlineMatchBarProps {
  session: OnlineSession;
  account: MatchAccount;
  busy: boolean;
  message: string;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onClaimTimeout: () => void;
  onSettle: () => void;
}

const RED_SIDE = 0x10;
const BLACK_SIDE = 0x20;

export function OnlineMatchBar({
  session,
  account,
  busy,
  message,
  onOfferDraw,
  onAcceptDraw,
  onClaimTimeout,
  onSettle,
}: OnlineMatchBarProps) {
  const side = session.role === "red" ? RED_SIDE : BLACK_SIDE;
  const opponentOfferedDraw = account.drawOffer !== 0 && account.drawOffer !== side;
  const terminal = account.status >= MATCH_STATUS.redWon;
  const pot = account.stakeLamports.toNumber() * 2 / 1_000_000_000;
  const result = matchResult(account, session.role);

  return (
    <aside className="mc-online-bar pointer-events-auto" aria-label="鏈上對局狀態">
      <div className="flex items-center justify-between gap-3">
        <span className="mc-display flex items-center gap-2 text-[0.65rem] tracking-[0.2em] text-[#d8c49a]">
          <RadioTower size={14} /> MAGICBLOCK DEVNET
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#c9b27f]"><CircleDollarSign size={14} /> {pot.toFixed(2)} devSOL</span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[#9c8b6c]">
        <span>{session.role === "red" ? "紅方" : "黑方"} · {short(session.walletAddress.toBase58())}</span>
        <span>第 {account.ply.toString()} 手</span>
      </div>
      <p className="mt-2 min-h-5 text-xs text-[#b7a88a]" role="status">{message}</p>
      {terminal ? <p className="mt-1 text-xs font-semibold text-[#e0c78f]">{result}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {terminal ? (
          <button type="button" className="mc-btn mc-btn-primary col-span-2" disabled={busy || account.settled} onClick={onSettle}>
            <Flag size={14} /> {account.settled ? "獎池已結算" : "回寫並結算（2 次確認）"}
          </button>
        ) : opponentOfferedDraw ? (
          <button type="button" className="mc-btn mc-btn-primary" disabled={busy} onClick={onAcceptDraw}>
            <Handshake size={14} /> 接受和局
          </button>
        ) : (
          <button type="button" className="mc-btn" disabled={busy || account.drawOffer === side} onClick={onOfferDraw}>
            <Handshake size={14} /> {account.drawOffer === side ? "已提出和局" : "提出和局"}
          </button>
        )}
        {!terminal ? (
          <button type="button" className="mc-btn" disabled={busy} onClick={onClaimTimeout}>
            <Hourglass size={14} /> 對手逾時
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function short(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function matchResult(account: MatchAccount, role: OnlineSession["role"]): string {
  if (account.status === MATCH_STATUS.draw) return "本局和棋，雙方各退回 0.01 devSOL。";
  const won = (account.status === MATCH_STATUS.redWon && role === "red")
    || (account.status === MATCH_STATUS.blackWon && role === "black");
  return won ? "你已獲勝，結算後領取 0.02 devSOL。" : "對手獲勝，請完成鏈上結算。";
}
