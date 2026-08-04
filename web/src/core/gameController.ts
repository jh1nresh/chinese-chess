import { Emitter } from "./emitter";
import { Xiangqi, type XiangqiMove } from "./xiangqi";
import {
  type Animator,
  type CapturedPiece,
  type ClockState,
  type DemoOptions,
  type Difficulty,
  type Faction,
  type GameMode,
  type GameResult,
  type GameSnapshot,
  type HistoryRow,
  type LedgerMove,
  type MoveEvent,
  type PieceKind,
  type SquareId,
  PIECE_VALUE,
} from "./types";
import { AiClient } from "../ai/aiClient";

export interface StartOptions {
  mode: GameMode;
  difficulty: Difficulty;
  playerColor: Faction;
  clockMinutes: number | null;
  /** Only read when `mode === "demo"`. */
  demo?: DemoOptions;
}

export const DEFAULT_DEMO: DemoOptions = {
  white: "medium",
  black: "medium",
  speed: 1,
  autoRematch: true,
};

/** How long the board sits on the final position before the next showcase game. */
const DEMO_REMATCH_DELAY_MS = 6500;

interface ControllerEvents {
  state: GameSnapshot;
  move: MoveEvent;
  check: Faction;
  gameover: GameResult;
  reset: StartOptions;
  illegal: { from: SquareId; to: SquareId };
}

const CLOCK_TICK_MS = 100;

/**
 * Owns all Xiangqi state. Rendering, audio and UI subscribe to it; it knows
 * nothing about three.js or the DOM.
 */
export class GameController extends Emitter<ControllerEvents> {
  private chess = new Xiangqi();
  private ai = new AiClient();
  private animator: Animator | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private rematchTimer: ReturnType<typeof setTimeout> | null = null;
  private lastTickAt = 0;
  private generation = 0;
  private paused = false;
  private demoRound = 1;
  /** Resolvers waiting for the showcase to leave the paused state. */
  private resumeWaiters: (() => void)[] = [];

  private status: GameSnapshot["status"] = "idle";
  private options: StartOptions = {
    mode: "ai",
    difficulty: "medium",
    playerColor: "w",
    clockMinutes: null,
  };
  private clock: ClockState = { enabled: false, initialMs: 0, whiteMs: 0, blackMs: 0 };
  private result: GameResult | null = null;
  private thinking = false;
  private busy = false;
  private onlineMoveSubmitter: ((from: SquareId, to: SquareId) => Promise<boolean>) | null = null;
  private snapshot: GameSnapshot = this.buildSnapshot();

  /** The renderer registers an async animator; moves wait for it to finish. */
  setAnimator(animator: Animator | null): void {
    this.animator = animator;
  }

  setOnlineMoveSubmitter(submitter: ((from: SquareId, to: SquareId) => Promise<boolean>) | null): void {
    this.onlineMoveSubmitter = submitter;
  }

  getSnapshot(): GameSnapshot {
    return this.snapshot;
  }

  getBoard(): { square: SquareId; kind: PieceKind; color: Faction }[] {
    return this.chess.board();
  }

  /**
   * Legal Xiangqi destinations, tagged so captures remain visually distinct.
   */
  legalTargets(from: SquareId): { to: SquareId; capture: boolean; castle: boolean; promotion: boolean }[] {
    return this.chess.moves(from).map((move) => ({
      to: move.to,
      capture: move.captured !== null,
      castle: false,
      promotion: false,
    }));
  }

  isPromotion(from: SquareId, to: SquareId): boolean {
    void from;
    void to;
    return false;
  }

  pieceAt(square: SquareId): { kind: PieceKind; color: Faction } | null {
    const piece = this.chess.get(square);
    if (!piece) return null;
    return piece;
  }

  isHumanTurn(): boolean {
    if (this.status !== "playing" || this.busy) return false;
    if (this.options.mode === "attract" || this.options.mode === "demo") return false;
    if (this.options.mode === "hotseat") return true;
    if (this.options.mode === "online") return this.chess.turn() === this.options.playerColor;
    return this.chess.turn() === this.options.playerColor;
  }

  start(options: StartOptions): void {
    this.generation += 1;
    this.ai.cancel();
    this.clearRematchTimer();
    this.releasePause();
    this.paused = false;
    if (options.mode !== "demo" || this.options.mode !== "demo") this.demoRound = 1;
    this.options = options.mode === "demo" ? { ...options, demo: options.demo ?? DEFAULT_DEMO } : options;
    this.chess = new Xiangqi();
    this.status = "playing";
    this.result = null;
    this.thinking = false;
    this.busy = false;
    const ms = options.clockMinutes ? options.clockMinutes * 60_000 : 0;
    this.clock = {
      enabled: options.clockMinutes !== null,
      initialMs: ms,
      whiteMs: ms,
      blackMs: ms,
    };
    this.emit("reset", options);
    this.publish();
    this.startClock();
    void this.maybeRunEngine();
  }

  stop(): void {
    this.generation += 1;
    this.ai.cancel();
    this.clearRematchTimer();
    this.stopClock();
    this.status = "idle";
    this.thinking = false;
    this.busy = false;
    this.paused = false;
    this.releasePause();
    this.publish();
  }

  // ------------------------------------------------------- showcase controls

  /**
   * Halts the showcase between plies. A search already in flight is allowed to
   * finish, but its move is held back until playback resumes.
   */
  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.stopClock();
    } else {
      this.releasePause();
      this.startClock();
    }
    this.publish();
    if (!paused) void this.maybeRunEngine();
  }

  togglePaused(): void {
    this.setPaused(!this.paused);
  }

  isPaused(): boolean {
    return this.paused;
  }

  /** Live pacing change — takes effect on the next ply. */
  setDemoSpeed(speed: number): void {
    if (!this.options.demo) return;
    this.options = { ...this.options, demo: { ...this.options.demo, speed: clamp(speed, 0.25, 4) } };
    this.publish();
  }

  setDemoAutoRematch(autoRematch: boolean): void {
    if (!this.options.demo) return;
    this.options = { ...this.options, demo: { ...this.options.demo, autoRematch } };
    if (!autoRematch) this.clearRematchTimer();
    this.publish();
  }

  /** Restart the showcase immediately with the same settings. */
  restartDemo(): void {
    if (this.options.mode !== "demo") return;
    this.demoRound += 1;
    this.start({ ...this.options });
  }

  private releasePause(): void {
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    for (const resolve of waiters) resolve();
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.paused && this.status === "playing") {
      await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
    }
  }

  private clearRematchTimer(): void {
    if (this.rematchTimer !== null) {
      clearTimeout(this.rematchTimer);
      this.rematchTimer = null;
    }
  }

  async tryMove(from: SquareId, to: SquareId, promotion?: PieceKind): Promise<boolean> {
    if (!this.isHumanTurn()) return false;
    if (this.options.mode === "online") {
      const legal = this.chess.moves(from).some((move) => move.to === to);
      if (!legal || !this.onlineMoveSubmitter) {
        this.emit("illegal", { from, to });
        return false;
      }
      this.busy = true;
      this.publish();
      try {
        if (!(await this.onlineMoveSubmitter(from, to))) return false;
      } finally {
        this.busy = false;
        this.publish();
      }
    }
    return this.play(from, to, promotion);
  }

  async applyOnlineMove(from: SquareId, to: SquareId): Promise<boolean> {
    if (this.options.mode !== "online" || this.status !== "playing") return false;
    return this.play(from, to);
  }

  finishOnline(result: GameResult): void {
    if (this.options.mode !== "online" || this.status !== "playing") return;
    this.finish(result);
  }

  private async play(from: SquareId, to: SquareId, promotion?: PieceKind): Promise<boolean> {
    void promotion;
    const move = this.chess.move(from, to);
    if (!move) {
      this.emit("illegal", { from, to });
      return false;
    }
    await this.commit(move);
    return true;
  }

  private async commit(move: XiangqiMove): Promise<void> {
    const generation = this.generation;
    this.busy = true;

    const capture = this.buildCapture(move);
    const inCheck = this.chess.isCheck();
    const gameOver = this.chess.isGameOver()
      && !(this.options.mode === "online" && this.chess.isThreefoldRepetition());

    const event: MoveEvent = {
      color: move.color,
      kind: move.piece,
      from: move.from,
      to: move.to,
      san: move.notation,
      capture,
      rook: null,
      promotion: null,
      isCheck: inCheck,
      isGameOver: gameOver,
    };

    this.publish();
    this.emit("move", event);
    if (inCheck) this.emit("check", this.chess.turn() as Faction);

    if (this.animator) {
      try {
        await this.animator(event);
      } catch (error) {
        console.error("[game] animator failed", error);
      }
    }
    if (generation !== this.generation) return;

    this.busy = false;
    this.publish();

    if (this.checkEnd()) return;
    void this.maybeRunEngine();
  }

  private buildCapture(move: XiangqiMove): MoveEvent["capture"] {
    if (move.captured) {
      return {
        square: move.to,
        kind: move.captured,
        color: move.color === "w" ? "b" : "w",
      };
    }
    return null;
  }

  private checkEnd(): boolean {
    if (!this.chess.isGameOver()) return false;
    // The on-chain program does not retain full position history. Online
    // repetition therefore continues until the players use the signed draw flow.
    if (this.options.mode === "online" && this.chess.isThreefoldRepetition()) return false;
    const loser = this.chess.turn() as Faction;
    if (this.chess.isThreefoldRepetition()) {
      this.finish({ winner: null, reason: "threefold" });
      return true;
    }
    if (this.chess.isCheckmate()) {
      this.finish({ winner: loser === "w" ? "b" : "w", reason: "checkmate" });
      return true;
    }
    if (this.chess.isStalemate()) {
      // In Xiangqi, having no legal move is a loss even without check.
      this.finish({ winner: loser === "w" ? "b" : "w", reason: "stalemate" });
      return true;
    }
    this.finish({ winner: null, reason: "draw" });
    return true;
  }

  private finish(result: GameResult): void {
    this.generation += 1;
    this.ai.cancel();
    this.stopClock();
    this.releasePause();
    this.status = "over";
    this.thinking = false;
    this.busy = false;
    this.result = result;
    this.publish();
    this.emit("gameover", result);
    this.scheduleDemoRematch();
  }

  /** Keeps a recording session rolling: a new duel starts on its own. */
  private scheduleDemoRematch(): void {
    if (this.options.mode !== "demo" || !this.options.demo?.autoRematch) return;
    this.clearRematchTimer();
    this.rematchTimer = setTimeout(() => {
      this.rematchTimer = null;
      if (this.status !== "over" || this.options.mode !== "demo") return;
      this.demoRound += 1;
      this.start({ ...this.options });
    }, DEMO_REMATCH_DELAY_MS);
  }

  resign(): void {
    if (this.status !== "playing") return;
    const loser = this.options.mode === "ai" ? this.options.playerColor : (this.chess.turn() as Faction);
    this.finish({ winner: loser === "w" ? "b" : "w", reason: "resignation" });
  }

  /** Undo one ply (hotseat) or a full move pair (vs computer). */
  undo(): boolean {
    if (this.status === "over") {
      this.status = "playing";
      this.result = null;
    }
    if (this.status !== "playing" || this.busy || this.thinking) return false;
    if (this.chess.history().length === 0) return false;
    this.generation += 1;
    this.ai.cancel();
    this.chess.undo();
    if (this.options.mode === "ai" && this.chess.turn() !== this.options.playerColor) {
      this.chess.undo();
    }
    this.thinking = false;
    this.busy = false;
    this.publish();
    return true;
  }

  private async maybeRunEngine(): Promise<void> {
    if (this.status !== "playing" || this.paused) return;
    const mode = this.options.mode;
    if (mode === "hotseat" || mode === "online") return;
    const turn = this.chess.turn() as Faction;
    if (mode === "ai" && turn === this.options.playerColor) return;
    if (this.thinking) return;

    const generation = this.generation;
    this.thinking = true;
    this.publish();

    const demo = mode === "demo" ? (this.options.demo ?? DEFAULT_DEMO) : null;
    const difficulty: Difficulty =
      mode === "attract" ? "medium" : demo ? (turn === "w" ? demo.white : demo.black) : this.options.difficulty;
    const started = performance.now();
    const best = await this.ai.bestMove(this.chess.fen(), difficulty);
    if (generation !== this.generation || this.status !== "playing") {
      this.thinking = false;
      return;
    }

    // A tiny floor on think time keeps instant replies from feeling robotic;
    // the showcase lingers longer so captures and camera work land on camera.
    const elapsed = performance.now() - started;
    const base = mode === "attract" ? 900 : demo ? 1150 : 420;
    const floor = demo ? clamp(base / demo.speed, 120, 6000) : base;
    if (elapsed < floor) await wait(floor - elapsed);
    if (generation !== this.generation || this.status !== "playing") {
      this.thinking = false;
      return;
    }

    // Pausing holds the finished move back instead of throwing the search away.
    if (this.paused) {
      this.thinking = false;
      this.publish();
      await this.waitWhilePaused();
      if (generation !== this.generation || this.status !== "playing") return;
    }

    this.thinking = false;
    if (!best) {
      this.checkEnd();
      this.publish();
      return;
    }
    await this.play(best.from, best.to, best.promotion ?? undefined);
  }

  private startClock(): void {
    this.stopClock();
    if (!this.clock.enabled || this.paused || this.status !== "playing") return;
    this.lastTickAt = performance.now();
    this.clockTimer = setInterval(() => this.tickClock(), CLOCK_TICK_MS);
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private tickClock(): void {
    if (this.status !== "playing" || this.paused) return;
    const now = performance.now();
    const delta = now - this.lastTickAt;
    this.lastTickAt = now;
    const turn = this.chess.turn() as Faction;
    if (turn === "w") this.clock.whiteMs = Math.max(0, this.clock.whiteMs - delta);
    else this.clock.blackMs = Math.max(0, this.clock.blackMs - delta);

    if (this.clock.whiteMs === 0 || this.clock.blackMs === 0) {
      const loser: Faction = this.clock.whiteMs === 0 ? "w" : "b";
      this.finish({ winner: loser === "w" ? "b" : "w", reason: "timeout" });
      return;
    }
    this.publish();
  }

  private buildSnapshot(): GameSnapshot {
    const verbose = this.chess.history();
    const sanList = verbose.map((move) => move.notation);
    const history: HistoryRow[] = [];
    for (let i = 0; i < sanList.length; i += 2) {
      history.push({
        number: i / 2 + 1,
        white: sanList[i] ?? null,
        black: sanList[i + 1] ?? null,
      });
    }

    const moves: LedgerMove[] = verbose.map((move, index) => ({
      ply: index,
      number: Math.floor(index / 2) + 1,
      color: move.color,
      kind: move.piece,
      san: move.notation,
      from: move.from,
      to: move.to,
      capture: move.captured !== null,
      castle: false,
      promotion: null,
      check: move.check,
      mate: move.mate,
    }));

    const captured: CapturedPiece[] = [];
    let diff = 0;
    for (const move of verbose) {
      if (!move.captured) continue;
      const kind = move.captured;
      const color: Faction = move.color === "w" ? "b" : "w";
      captured.push({ kind, color });
      diff += color === "b" ? PIECE_VALUE[kind] : -PIECE_VALUE[kind];
    }
    const last = verbose.length > 0 ? verbose[verbose.length - 1] : null;

    return {
      status: this.status,
      mode: this.options.mode,
      difficulty: this.options.difficulty,
      playerColor: this.options.playerColor,
      turn: this.chess.turn() as Faction,
      fen: this.chess.fen(),
      pgn: history.map((row) => `${row.number}. ${row.white ?? ""} ${row.black ?? ""}`.trim()).join("\n"),
      inCheck: this.chess.isCheck(),
      thinking: this.thinking,
      busy: this.busy,
      result: this.result,
      history,
      sanList,
      moves,
      captured,
      materialDiff: diff,
      lastMove: last ? { from: last.from, to: last.to } : null,
      clock: { ...this.clock },
      canUndo:
        verbose.length > 0 &&
        !this.thinking &&
        !this.busy &&
        this.options.mode !== "attract" &&
        this.options.mode !== "demo" &&
        this.options.mode !== "online",
      demo: this.options.mode === "demo" ? { ...(this.options.demo ?? DEFAULT_DEMO) } : null,
      paused: this.paused,
      demoRound: this.demoRound,
    };
  }

  private publish(): void {
    this.snapshot = this.buildSnapshot();
    this.emit("state", this.snapshot);
  }

  dispose(): void {
    this.stopClock();
    this.clearRematchTimer();
    this.releasePause();
    this.ai.dispose();
    this.clear();
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
