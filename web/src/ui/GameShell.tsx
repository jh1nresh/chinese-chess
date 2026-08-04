import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { audio } from "../audio/audioManager";
import { GameController } from "../core/gameController";
import type { EndReason, LedgerMove } from "../core/types";
import { Clapperboard } from "lucide-react";
import { indexToSquare, MATCH_STATUS, type MatchAccount } from "../magicblock/matchClient";
import { OnlineMatchBar } from "../magicblock/OnlineMatchBar";
import type { OnlineSession } from "../magicblock/onlineTypes";
import { ARENA_LOOKS, DEFAULT_ARENA, type ArenaTheme } from "../scene/arena";
import { detectQualityPreset, type QualityPreset } from "../scene/quality";
import { SceneEngine, type CameraPreset, type ShowcaseCamera } from "../scene/sceneEngine";
import { GameOverModal } from "./GameOverModal";
import { Hud } from "./Hud";
import { MainMenu, type MatchConfig } from "./MainMenu";
import { SettingsPanel, type GameSettings } from "./SettingsPanel";
import { useGameSnapshot } from "./useGameSnapshot";
import "./medieval.css";

type Phase = "loading" | "menu" | "playing";

const ATTRACT_DELAY_MS = 30_000;
const RENDER_PREFS_KEY = "kg.render";

interface RenderPrefs {
  safeMode: boolean;
  brightness: number;
}

/**
 * Safe rendering and brightness are remembered across visits, and `?safe=1`
 * forces them on — a player whose driver blacks the hall out must not have to
 * find the toggle again on every reload.
 */
function loadRenderPrefs(): RenderPrefs {
  const fallback: RenderPrefs = { safeMode: false, brightness: 1 };
  if (typeof window === "undefined") return fallback;
  try {
    const forced = new URLSearchParams(window.location.search).has("safe");
    const raw = window.localStorage.getItem(RENDER_PREFS_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<RenderPrefs>) : {};
    return {
      safeMode: forced || stored.safeMode === true,
      brightness: typeof stored.brightness === "number" ? Math.min(1.8, Math.max(0.6, stored.brightness)) : 1,
    };
  } catch {
    return fallback;
  }
}

function saveRenderPrefs(prefs: RenderPrefs): void {
  try {
    window.localStorage.setItem(RENDER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing — the session still works, it just will not be remembered.
  }
}

export function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SceneEngine | null>(null);
  const attractTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const controller = useMemo(() => new GameController(), []);
  const snapshot = useGameSnapshot(controller);

  const detected = useMemo<QualityPreset>(() => detectQualityPreset(), []);
  const initialRender = useMemo<RenderPrefs>(() => loadRenderPrefs(), []);
  const [settings, setSettings] = useState<GameSettings>(() => ({
    quality: detected,
    arena: DEFAULT_ARENA,
    captureCinematics: true,
    rotateBoard: true,
    rankBadges: true,
    muted: false,
    safeMode: initialRender.safeMode,
    brightness: initialRender.brightness,
  }));
  const [gpu, setGpu] = useState<string>("");

  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [attract, setAttract] = useState(false);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [fps, setFps] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [cameraFlipped, setCameraFlipped] = useState(false);
  /** Flat overhead map: no 3D figure can hide a square. */
  const [tactical, setTactical] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Showcase recording: strips every panel so the capture is board-only. */
  const [cinema, setCinema] = useState(false);
  /** How the camera behaves during a showcase duel: held, orbiting or following. */
  const [showcaseCamera, setShowcaseCamera] = useState<ShowcaseCamera>("follow");
  const [onlineSession, setOnlineSession] = useState<OnlineSession | null>(null);
  const [onlineAccount, setOnlineAccount] = useState<MatchAccount | null>(null);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineMessage, setOnlineMessage] = useState("等待鏈上狀態同步…");

  // ------------------------------------------------------------ boot the scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Headless/blocked environments cannot create a WebGL context — fail loudly
    // with a readable message instead of a black screen.
    const probe = document.createElement("canvas");
    const supported = Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
    if (!supported) {
      setUnsupported(true);
      return;
    }

    let engine: SceneEngine;
    try {
      engine = new SceneEngine(
        canvas,
        controller,
        {
          onLoadProgress: (ratio) => setProgress(ratio),
          onReady: () => setPhase("menu"),
          onPromotionOpen: (open) => setPromotionOpen(open),
          onQualityAdjusted: (preset) => {
            setSettings((current) => ({ ...current, quality: preset }));
            const labels: Record<QualityPreset, string> = { low: "低", medium: "中", high: "高", ultra: "極高" };
            setNotice(`為維持順暢畫面，品質已調整為「${labels[preset]}」。`);
            setTimeout(() => setNotice(null), 5000);
          },
          onFps: (value) => setFps(value),
          onContextLost: () => setContextLost(true),
          onCameraFlipped: (flipped) => setCameraFlipped(flipped),
          onTacticalView: (active) => setTactical(active),
          onRenderFallback: (message, safe) => {
            if (safe) setSettings((current) => ({ ...current, safeMode: true }));
            setNotice(message);
            setTimeout(() => setNotice(null), 9000);
          },
        },
        detected,
        DEFAULT_ARENA,
      );
    } catch (error) {
      console.error("[ui] could not start the renderer", error);
      setUnsupported(true);
      return;
    }

    engineRef.current = engine;
    engine.setInteractive(false);
    engine.setSafeMode(initialRender.safeMode);
    engine.setBrightness(initialRender.brightness);
    setGpu(engine.getGpuSummary());
    engine.start();

    void engine.load().then(async () => {
      setIntroPlaying(true);
      await engine.playIntro();
      setIntroPlaying(false);
    });

    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, [controller, detected, initialRender]);

  useEffect(() => () => controller.dispose(), [controller]);

  // ----------------------------------------------------- audio unlock on input
  useEffect(() => {
    const unlock = (): void => {
      void audio.unlock();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ----------------------------------------------------------- apply settings
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setQuality(settings.quality);
    engine.setArena(settings.arena);
    engine.setCaptureCinematics(settings.captureCinematics);
    engine.setRotateBoard(settings.rotateBoard);
    engine.setRankBadges(settings.rankBadges);
    engine.setSafeMode(settings.safeMode);
    engine.setBrightness(settings.brightness);
    audio.setMuted(settings.muted);
    saveRenderPrefs({ safeMode: settings.safeMode, brightness: settings.brightness });
  }, [settings]);

  // ------------------------------------------------------------- attract mode
  const stopAttract = useCallback(() => {
    if (attractTimer.current) {
      clearTimeout(attractTimer.current);
      attractTimer.current = null;
    }
    if (!attract) return;
    setAttract(false);
    controller.stop();
    engineRef.current?.setAttract(false);
    engineRef.current?.resync();
  }, [attract, controller]);

  const scheduleAttract = useCallback(() => {
    if (attractTimer.current) clearTimeout(attractTimer.current);
    attractTimer.current = setTimeout(() => {
      if (phase !== "menu" || showSettings) return;
      setAttract(true);
      engineRef.current?.setAttract(true);
      controller.start({ mode: "attract", difficulty: "medium", playerColor: "w", clockMinutes: null });
    }, ATTRACT_DELAY_MS);
  }, [controller, phase, showSettings]);

  useEffect(() => {
    if (phase !== "menu" || attract || introPlaying) return;
    scheduleAttract();
    return () => {
      if (attractTimer.current) clearTimeout(attractTimer.current);
    };
  }, [phase, attract, introPlaying, scheduleAttract]);

  // ------------------------------------------------------------------ actions
  const startMatch = useCallback(
    (config: MatchConfig) => {
      stopAttract();
      void audio.unlock();
      audio.blip("press");
      const engine = engineRef.current;
      const showcase = config.mode === "demo";
      engine?.setAttract(false);
      engine?.setInteractive(true);
      // A showcase brings its own framing (and its own crisp grade) with it.
      engine?.setShowcase(showcase, showcaseCamera);
      if (!showcase) {
        engine?.setCameraPreset(config.mode === "ai" && config.playerColor === "b" ? "black" : "white");
      }
      controller.start({
        mode: config.mode,
        difficulty: config.difficulty,
        playerColor: config.playerColor,
        clockMinutes: config.clockMinutes,
        demo: config.demo,
      });
      setPhase("playing");
    },
    [controller, showcaseCamera, stopAttract],
  );

  const startOnlineMatch = useCallback(
    (session: OnlineSession) => {
      stopAttract();
      void audio.unlock();
      audio.blip("press");
      setOnlineSession(session);
      setOnlineAccount(session.account);
      setOnlineMessage(session.role === "red" ? "你是紅方，請先行。" : "你是黑方，等待紅方行棋。");
      controller.setOnlineMoveSubmitter(async (from, to) => {
        setOnlineBusy(true);
        setOnlineMessage(`模擬 ${from} → ${to}，請在錢包確認…`);
        try {
          await session.client.playMove(session.game, from, to);
          setOnlineMessage("走棋已由 MagicBlock 確認。");
          return true;
        } catch (error) {
          setOnlineMessage(readableOnlineError(error));
          audio.blip("deny");
          return false;
        } finally {
          setOnlineBusy(false);
        }
      });
      const engine = engineRef.current;
      engine?.setAttract(false);
      engine?.setInteractive(true);
      engine?.setShowcase(false);
      engine?.setCameraPreset(session.role === "red" ? "white" : "black");
      controller.start({
        mode: "online",
        difficulty: "medium",
        playerColor: session.role === "red" ? "w" : "b",
        clockMinutes: null,
      });
      setPhase("playing");
    },
    [controller, stopAttract],
  );

  useEffect(() => {
    if (!onlineSession) return;
    let disposed = false;
    let processedPly = onlineSession.account.ply;
    let queue = Promise.resolve();
    const subscription = onlineSession.client.onMatchChange(onlineSession.game, (account) => {
      if (disposed) return;
      setOnlineAccount(account);
      queue = queue.then(async () => {
        const ply = account.ply;
        if (ply > processedPly) {
          processedPly = ply;
          if (!account.lastPlayer.equals(onlineSession.walletAddress) && account.lastFrom < 90 && account.lastTo < 90) {
            await controller.applyOnlineMove(indexToSquare(account.lastFrom), indexToSquare(account.lastTo));
            setOnlineMessage("已同步對手走棋。");
          }
        }
        if (account.status === MATCH_STATUS.redWon) {
          controller.finishOnline({ winner: "w", reason: onlineEndReason(account.endReason) });
        } else if (account.status === MATCH_STATUS.blackWon) {
          controller.finishOnline({ winner: "b", reason: onlineEndReason(account.endReason) });
        } else if (account.status === MATCH_STATUS.draw) {
          controller.finishOnline({ winner: null, reason: "draw" });
        }
      }).catch((error) => setOnlineMessage(readableOnlineError(error)));
    });
    return () => {
      disposed = true;
      void onlineSession.client.removeMatchListener(subscription);
    };
  }, [controller, onlineSession]);

  const returnToMenu = useCallback(() => {
    controller.stop();
    controller.setOnlineMoveSubmitter(null);
    setOnlineSession(null);
    setOnlineAccount(null);
    const engine = engineRef.current;
    engine?.setTacticalView(false);
    engine?.setInteractive(false);
    engine?.setShowcase(false);
    engine?.setCameraPreset("cinematic");
    setCinema(false);
    setPhase("menu");
  }, [controller]);

  // -------------------------------------------------------- showcase controls
  const handleTogglePause = useCallback(() => {
    audio.blip("press");
    controller.togglePaused();
  }, [controller]);

  const handleDemoSpeed = useCallback(
    (speed: number) => {
      audio.blip("press");
      controller.setDemoSpeed(speed);
    },
    [controller],
  );

  const handleDemoLoop = useCallback(
    (loop: boolean) => {
      audio.blip("press");
      controller.setDemoAutoRematch(loop);
    },
    [controller],
  );

  const handleDemoRestart = useCallback(() => {
    audio.blip("press");
    controller.restartDemo();
  }, [controller]);

  const handleShowcaseCamera = useCallback((mode: ShowcaseCamera) => {
    audio.blip("press");
    setShowcaseCamera(mode);
    engineRef.current?.setShowcaseCamera(mode);
  }, []);

  const handleUndo = useCallback(() => {
    if (controller.undo()) {
      audio.blip("press");
      engineRef.current?.resync();
    } else {
      audio.blip("deny");
    }
  }, [controller]);

  const handleResign = useCallback(() => {
    audio.blip("deny");
    if (!onlineSession) {
      controller.resign();
      return;
    }
    setOnlineBusy(true);
    setOnlineMessage("模擬投降交易，請在錢包確認…");
    void onlineSession.client.resign(onlineSession.game)
      .then(() => setOnlineMessage("投降已由 MagicBlock 確認。"))
      .catch((error) => setOnlineMessage(readableOnlineError(error)))
      .finally(() => setOnlineBusy(false));
  }, [controller, onlineSession]);

  const handleRematch = useCallback(() => {
    const current = controller.getSnapshot();
    if (current.mode === "online") {
      returnToMenu();
      return;
    }
    startMatch({
      mode: current.mode === "hotseat" ? "hotseat" : "ai",
      difficulty: current.difficulty,
      playerColor: current.playerColor,
      clockMinutes: current.clock.enabled ? current.clock.initialMs / 60_000 : null,
    });
  }, [controller, returnToMenu, startMatch]);

  const runOnlineAction = useCallback(async (pending: string, action: () => Promise<unknown>, complete: string) => {
    setOnlineBusy(true);
    setOnlineMessage(pending);
    try {
      await action();
      setOnlineMessage(complete);
    } catch (error) {
      setOnlineMessage(readableOnlineError(error));
    } finally {
      setOnlineBusy(false);
    }
  }, []);

  const handleFullscreen = useCallback(() => {
    const element = document.documentElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen().catch((error) => console.warn("[ui] fullscreen refused", error));
  }, []);

  const handleCamera = useCallback((preset: CameraPreset) => {
    audio.blip("press");
    engineRef.current?.setCameraPreset(preset);
  }, []);

  const handleFlipCamera = useCallback(() => {
    audio.blip("press");
    engineRef.current?.flipCamera();
  }, []);

  const handleToggleTactical = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    audio.blip("press");
    engine.setTacticalView(!engine.isTacticalView());
  }, []);

  const handleArena = useCallback((theme: ArenaTheme) => {
    audio.blip("press");
    setSettings((current) => (current.arena === theme ? current : { ...current, arena: theme }));
  }, []);

  const handlePreviewMove = useCallback((move: LedgerMove | null) => {
    engineRef.current?.previewMove(move ? { from: move.from, to: move.to } : null);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setShowSettings(false);
      const target = event.target as HTMLElement | null;
      const typing = target ? /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable : false;
      if (typing || event.metaKey || event.ctrlKey || event.altKey || phase !== "playing") return;
      if (event.key === "f" || event.key === "F") handleFlipCamera();
      if (event.key === "t" || event.key === "T") handleToggleTactical();
      if (event.key === "c" || event.key === "C") setCinema((hidden) => !hidden);
      if (event.key === " " && snapshot.mode === "demo") {
        event.preventDefault();
        controller.togglePaused();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controller, handleFlipCamera, handleToggleTactical, phase, snapshot.mode]);

  const skipIntro = useCallback(() => {
    engineRef.current?.skipIntro();
  }, []);

  return (
    <div
      className="mc-root fixed inset-0 select-none overflow-hidden bg-[#05060a]"
      data-arena={settings.arena}
      style={{ "--mc-vignette": ARENA_LOOKS[settings.arena].screenVignette } as CSSProperties}
    >
      <div className="mc-canvas-wrap">
        <canvas ref={canvasRef} />
      </div>
      <div className="mc-vignette" />

      {/* Overlay layer */}
      <div className="pointer-events-none absolute inset-0">
        {phase === "loading" && !unsupported ? <LoadingScreen progress={progress} /> : null}

        {unsupported ? (
          <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center px-6 text-center">
            <div className="mc-slate mc-goldleaf max-w-sm p-6">
              <h2 className="mc-display text-lg text-[#f2e2bd]">此戰場需要 WebGL</h2>
              <p className="mt-2 text-sm text-[#b7a88a]">
                目前的瀏覽器或預覽環境無法開啟 3D 畫面。請改用已啟用硬體加速的桌面或平板瀏覽器。
              </p>
            </div>
          </div>
        ) : null}

        {phase === "menu" && !introPlaying ? (
          <MainMenu
            onStart={startMatch}
            onOnlineStart={startOnlineMatch}
            onOpenSettings={() => setShowSettings(true)}
            attract={attract}
            onInteract={stopAttract}
          />
        ) : null}

        {phase === "playing" && !cinema ? (
          <Hud
            snapshot={snapshot}
            muted={settings.muted}
            fps={fps}
            onNewGame={returnToMenu}
            onUndo={handleUndo}
            onResign={handleResign}
            onToggleSound={() => setSettings((current) => ({ ...current, muted: !current.muted }))}
            onFullscreen={handleFullscreen}
            onSettings={() => setShowSettings(true)}
            onCamera={handleCamera}
            onFlipCamera={handleFlipCamera}
            cameraFlipped={cameraFlipped}
            tactical={tactical}
            onToggleTactical={handleToggleTactical}
            arena={settings.arena}
            onArena={handleArena}
            onPreviewMove={handlePreviewMove}
            onTogglePause={handleTogglePause}
            onDemoSpeed={handleDemoSpeed}
            onDemoLoop={handleDemoLoop}
            onDemoRestart={handleDemoRestart}
            showcaseCamera={showcaseCamera}
            onShowcaseCamera={handleShowcaseCamera}
            onToggleCinema={() => setCinema(true)}
          />
        ) : null}

        {phase === "playing" && !cinema && onlineSession && onlineAccount ? (
          <OnlineMatchBar
            session={onlineSession}
            account={onlineAccount}
            busy={onlineBusy}
            message={onlineMessage}
            onOfferDraw={() => void runOnlineAction(
              "模擬和局提議，請在錢包確認…",
              () => onlineSession.client.offerDraw(onlineSession.game),
              "已提出和局，等待對手回覆。",
            )}
            onAcceptDraw={() => void runOnlineAction(
              "模擬接受和局，請在錢包確認…",
              () => onlineSession.client.acceptDraw(onlineSession.game),
              "雙方已和局，可回寫並退款。",
            )}
            onClaimTimeout={() => void runOnlineAction(
              "檢查對手是否逾時，請在錢包確認…",
              () => onlineSession.client.claimTimeout(onlineSession.game),
              "逾時結果已確認。",
            )}
            onSettle={() => void runOnlineAction(
              "回寫棋局並模擬獎池結算…",
              async () => {
                await onlineSession.client.settleAndClaim(onlineSession.game, onlineAccount.red, onlineAccount.black);
                setOnlineAccount(await onlineSession.client.fetchMatch(onlineSession.game));
              },
              "獎池已在 Solana Devnet 結算。",
            )}
          />
        ) : null}

        {phase === "playing" && cinema ? (
          <button
            type="button"
            className="mc-cinema-restore pointer-events-auto"
            onClick={() => setCinema(false)}
            title="重新顯示介面（C）"
            aria-label="重新顯示介面"
          >
            <Clapperboard size={15} />
          </button>
        ) : null}

        {promotionOpen ? (
          <div className="mc-fade pointer-events-none absolute inset-x-0 top-1/2 flex justify-center">
            <p className="mc-display mc-slate px-4 py-2 text-xs tracking-[0.28em] text-[#f0dfb6]">
              選擇升變棋子
            </p>
          </div>
        ) : null}

        {introPlaying ? (
          <button
            type="button"
            onClick={skipIntro}
            className="pointer-events-auto absolute inset-0 flex cursor-pointer items-end justify-center bg-transparent pb-10"
          >
            <span className="mc-display mc-pulse text-[0.68rem] tracking-[0.4em] text-[#c8ab74]">點擊跳過</span>
          </button>
        ) : null}

        {showSettings ? (
          <SettingsPanel
            settings={settings}
            autoDetected={detected}
            gpu={gpu}
            fps={fps}
            onChange={setSettings}
            onClose={() => setShowSettings(false)}
          />
        ) : null}

        {phase === "playing" && !cinema && snapshot.status === "over" && snapshot.result && !snapshot.demo?.autoRematch
          && (snapshot.mode !== "online" || onlineAccount?.settled) ? (
          <GameOverModal
            result={snapshot.result}
            pgn={snapshot.pgn}
            playerColor={snapshot.playerColor}
            versusComputer={snapshot.mode === "ai"}
            onRematch={handleRematch}
            onMenu={returnToMenu}
          />
        ) : null}

        {notice ? (
          <div className="mc-fade mc-slate pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 text-xs text-[#e4d3ac]">
            {notice}
          </div>
        ) : null}

        {contextLost ? (
          <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/80 px-6 text-center">
            <div className="mc-slate mc-goldleaf max-w-sm p-6">
              <h2 className="mc-display text-lg text-[#f2e2bd]">戰場畫面已中斷</h2>
              <p className="mt-2 text-sm text-[#b7a88a]">
                顯示環境已遺失，請重新載入以恢復戰場。
              </p>
              <button type="button" className="mc-btn mc-btn-primary mt-4 w-full" onClick={() => window.location.reload()}>
                重新載入
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="mc-fade absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#05060a]/85 px-6">
      <p className="mc-display text-[0.62rem] tracking-[0.5em] text-[#a89268]">列陣中</p>
      <h1 className="mc-display mc-title-glow text-4xl text-[#f4e3bd]">龍爭象棋</h1>
      <div className="h-[3px] w-64 overflow-hidden rounded-full bg-[#2a251c]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8a6522] via-[#f6dfa5] to-[#8a6522] transition-[width] duration-300"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <p className="text-xs italic text-[#7d6f57]">正在整備第 {Math.round(progress * 6)}／6 組兵種…</p>
    </div>
  );
}

function onlineEndReason(reason: number): EndReason {
  if (reason === 2) return "stalemate";
  if (reason === 3) return "resignation";
  if (reason === 4) return "timeout";
  if (reason === 5) return "draw";
  return "checkmate";
}

function readableOnlineError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/User rejected|rejected the request/i.test(message)) return "你已取消這筆交易。";
  if (/TurnNotTimedOut|not timed out/i.test(message)) return "對手的回合尚未逾時。";
  if (/AlreadySettled/i.test(message)) return "獎池已由另一位玩家完成結算。";
  return `鏈上操作未完成：${message.slice(0, 180)}`;
}
