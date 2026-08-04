import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCreateWallet, useWallets } from "@privy-io/react-auth/solana";
import { Copy, Link2, LoaderCircle, ShieldCheck, WalletCards } from "lucide-react";
import { PublicKey } from "@solana/web3.js";

import {
  DEFAULT_STAKE_LAMPORTS,
  MATCH_STATUS,
  MagicBlockMatchClient,
  type MatchAccount,
} from "./matchClient";
import type { OnlineSession } from "./onlineTypes";
import { toAnchorWallet } from "./privyWallet";

interface OnlineLobbyProps {
  onStart: (session: OnlineSession) => void;
}

interface HostedMatch {
  game: PublicKey;
  matchId: bigint;
  account: MatchAccount;
  shareUrl: string;
}

const STAKE_SOL = DEFAULT_STAKE_LAMPORTS / 1_000_000_000;

export function OnlineLobby({ onStart }: OnlineLobbyProps) {
  const { ready, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const wallet = wallets[0];
  const client = useMemo(
    () => (wallet ? new MagicBlockMatchClient(toAnchorWallet(wallet)) : null),
    [wallet],
  );
  const [joinValue, setJoinValue] = useState(() => new URLSearchParams(window.location.search).get("match") ?? "");
  const [hosted, setHosted] = useState<HostedMatch | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Devnet 對局；每位玩家押入 0.01 devSOL。");
  const [balance, setBalance] = useState<number | null>(null);
  const subscriptionRef = useRef<number | null>(null);

  const refreshBalance = useCallback(async (): Promise<void> => {
    if (!client || !wallet) return;
    const lamports = await client.baseConnection.getBalance(new PublicKey(wallet.address), "confirmed");
    setBalance(lamports / 1_000_000_000);
  }, [client, wallet]);

  useEffect(() => {
    void refreshBalance().catch(() => setBalance(null));
  }, [refreshBalance]);

  useEffect(() => {
    return () => {
      if (client && subscriptionRef.current !== null) void client.removeMatchListener(subscriptionRef.current);
    };
  }, [client]);

  const watchHostedMatch = async (next: HostedMatch): Promise<void> => {
    if (!client) return;
    if (subscriptionRef.current !== null) await client.removeMatchListener(subscriptionRef.current);
    subscriptionRef.current = client.onMatchChange(next.game, (account) => {
      setHosted((current) => (current ? { ...current, account } : current));
      if (account.status === MATCH_STATUS.active) {
        setOpponentJoined(true);
        setMessage("黑方已押注加入。請確認啟用 MagicBlock 即時戰場。");
      }
    });
  };

  const handleCreate = async (): Promise<void> => {
    if (!client || !wallet) return;
    setBusy(true);
    setMessage("先模擬建立與押注交易…");
    try {
      const matchId = randomMatchId();
      const created = await client.createMatch(matchId);
      const account = await client.fetchMatch(created.game);
      const shareUrl = new URL(window.location.href);
      shareUrl.searchParams.set("match", created.game.toBase58());
      const next = { game: created.game, matchId, account, shareUrl: shareUrl.toString() };
      setHosted(next);
      setJoinValue(created.game.toBase58());
      setMessage("房間已建立並押入 0.01 devSOL；把連結交給黑方。");
      await refreshBalance();
      await watchHostedMatch(next);
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (): Promise<void> => {
    if (!client || !wallet) return;
    setBusy(true);
    setMessage("驗證房間並模擬加入押注交易…");
    try {
      const game = parseGameAddress(joinValue);
      const account = await client.fetchMatch(game);
      if (account.status !== MATCH_STATUS.waiting) throw new Error("這個房間已開始或已關閉。");
      if (!account.stakeLamports.eqn(DEFAULT_STAKE_LAMPORTS)) throw new Error("房間押注金額不是 0.01 devSOL。");
      await client.joinMatch(game);
      const active = await client.fetchMatch(game);
      await refreshBalance();
      setMessage("已押注加入，等待紅方啟用 MagicBlock 即時戰場。");
      onStart({
        client,
        game,
        matchId: BigInt(active.matchId.toString()),
        role: "black",
        walletAddress: new PublicKey(wallet.address),
        account: active,
      });
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDelegateAndStart = async (): Promise<void> => {
    if (!client || !wallet || !hosted || !opponentJoined) return;
    setBusy(true);
    setMessage("模擬後送出 MagicBlock delegate 交易…");
    try {
      await client.delegateMatch(hosted.matchId);
      const account = await client.fetchMatch(hosted.game);
      onStart({
        client,
        game: hosted.game,
        matchId: hosted.matchId,
        role: "red",
        walletAddress: new PublicKey(wallet.address),
        account,
      });
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (!client || !hosted) return;
    setBusy(true);
    setMessage("模擬退款交易…");
    try {
      await client.cancelWaitingMatch(hosted.game);
      await refreshBalance();
      setHosted(null);
      setMessage("房間已取消，0.01 devSOL 已退回紅方錢包。");
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <LobbyNotice icon={<LoaderCircle className="animate-spin" size={16} />} text="正在讀取 Solana 錢包…" />;

  if (!wallet) {
    return (
      <div className="mc-fade space-y-3 text-sm text-[#b7a88a]">
        <p>需要一個 Solana 錢包才能簽署 Devnet 對局。</p>
        <button type="button" className="mc-btn mc-btn-primary w-full" onClick={() => void createWallet()}>
          <WalletCards size={15} /> 建立 Solana 錢包
        </button>
      </div>
    );
  }

  return (
    <div className="mc-fade space-y-4 text-sm text-[#b7a88a]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[#d8c49a]"><ShieldCheck size={15} /> Solana Devnet</span>
        <div className="text-right">
          <code className="block text-[0.68rem] text-[#a89268]">{shortAddress(wallet.address)}</code>
          <span className="text-[0.65rem] text-[#7f735d]">餘額 {balance === null ? "—" : `${balance.toFixed(3)} devSOL`}</span>
        </div>
      </div>

      <div className="mc-online-terms">
        <span>每位押注</span><strong>{STAKE_SOL.toFixed(2)} devSOL</strong>
        <span>回合逾時</span><strong>10 分鐘</strong>
      </div>

      {hosted ? (
        <div className="space-y-3">
          <label className="block">
            <span className="mc-display mb-2 block text-[0.62rem] tracking-[0.25em] text-[#a89268]">邀請黑方</span>
            <div className="flex gap-2">
              <input className="mc-online-input min-w-0 flex-1" readOnly value={hosted.shareUrl} aria-label="對局邀請連結" />
              <button type="button" className="mc-btn px-3" onClick={() => void copyInvite(hosted.shareUrl, setMessage)} aria-label="複製邀請連結">
                <Copy size={15} />
              </button>
            </div>
          </label>
          {opponentJoined ? (
            <button type="button" className="mc-btn mc-btn-primary w-full" disabled={busy} onClick={() => void handleDelegateAndStart()}>
              啟用即時戰場並開始
            </button>
          ) : (
            <button type="button" className="mc-btn w-full" disabled={busy} onClick={() => void handleCancel()}>
              取消房間並退款
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" className="mc-btn mc-btn-primary w-full" disabled={busy} onClick={() => void handleCreate()}>
            押入 0.01 devSOL 建立對局
          </button>
          <div className="mc-online-divider"><span>或加入房間</span></div>
          <label className="block">
            <span className="sr-only">房間連結或地址</span>
            <div className="flex gap-2">
              <input
                className="mc-online-input min-w-0 flex-1"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="貼上邀請連結或 Match PDA"
                aria-label="房間連結或地址"
              />
              <button type="button" className="mc-btn shrink-0 px-3" disabled={busy || !joinValue.trim()} onClick={() => void handleJoin()} aria-label="加入鏈上對局並押注">
                <Link2 size={15} /> 加入並押注
              </button>
            </div>
          </label>
        </div>
      )}

      <p className="min-h-10 text-xs leading-relaxed text-[#9c8b6c]" role="status">{busy ? "請在錢包確認交易。" : message}</p>
      <a className="block text-center text-xs text-[#b69a62] underline underline-offset-4" href="https://faucet.solana.com/" target="_blank" rel="noreferrer">
        devSOL 不足？前往 Solana Faucet
      </a>
    </div>
  );
}

function LobbyNotice({ icon, text }: { icon: ReactNode; text: string }) {
  return <p className="mc-fade flex items-center gap-2 text-sm text-[#b7a88a]">{icon}{text}</p>;
}

function randomMatchId(): bigint {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]) << 32n) | BigInt(words[1]);
}

function parseGameAddress(value: string): PublicKey {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return new PublicKey(url.searchParams.get("match") ?? "");
  } catch {
    return new PublicKey(trimmed);
  }
}

function shortAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

async function copyInvite(url: string, setMessage: (message: string) => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    setMessage("邀請連結已複製。");
  } catch {
    setMessage("瀏覽器無法存取剪貼簿，請手動複製連結。");
  }
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/User rejected|rejected the request/i.test(message)) return "你已取消這筆交易。";
  if (/Attempt to debit an account but found no record of a prior credit/i.test(message)) return "Devnet 餘額不足，請先領取 devSOL。";
  return `交易未完成：${message.slice(0, 180)}`;
}
