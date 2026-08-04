/**
 * Shared, render-agnostic game types.
 * The chess core never imports anything from `src/scene` — the scene subscribes to it.
 */

export type Faction = "w" | "b";

/** Xiangqi ranks. Existing medieval sculpts are reused for every role. */
export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k" | "c";

export type SquareId = string;

export type Difficulty = "easy" | "medium" | "hard";

export type GameMode = "ai" | "hotseat" | "online" | "attract" | "demo";

/** Computer-vs-computer showcase settings (used for recording demos). */
export interface DemoOptions {
  /** Engine strength for the ivory army. */
  white: Difficulty;
  /** Engine strength for the obsidian army. */
  black: Difficulty;
  /** Pacing multiplier for the pause between moves (1 = normal, 2 = twice as fast). */
  speed: number;
  /** Start a fresh game a few seconds after the last one ends. */
  autoRematch: boolean;
}

export type GameStatus = "idle" | "playing" | "over";

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "resignation"
  | "timeout"
  | "threefold"
  | "insufficient"
  | "fiftymove"
  | "draw";

export interface GameResult {
  /** Winner, or null for a draw. */
  winner: Faction | null;
  reason: EndReason;
}

export interface ClockState {
  enabled: boolean;
  initialMs: number;
  whiteMs: number;
  blackMs: number;
}

export interface CapturedPiece {
  kind: PieceKind;
  /** Colour of the piece that was captured. */
  color: Faction;
}

export interface HistoryRow {
  number: number;
  white: string | null;
  black: string | null;
}

/** One played turn in compact Xiangqi notation, plus what it touched. */
export interface LedgerMove {
  /** 0-based half-move index. */
  ply: number;
  /** 1-based full-move number. */
  number: number;
  color: Faction;
  kind: PieceKind;
  san: string;
  from: SquareId;
  to: SquareId;
  capture: boolean;
  castle: boolean;
  promotion: PieceKind | null;
  check: boolean;
  mate: boolean;
}

export interface GameSnapshot {
  status: GameStatus;
  mode: GameMode;
  difficulty: Difficulty;
  /** Human player's colour in AI mode. */
  playerColor: Faction;
  turn: Faction;
  fen: string;
  pgn: string;
  inCheck: boolean;
  thinking: boolean;
  busy: boolean;
  result: GameResult | null;
  history: HistoryRow[];
  sanList: string[];
  /** Full move ledger in standard notation, oldest first. */
  moves: LedgerMove[];
  captured: CapturedPiece[];
  /** Positive = white is ahead by that many pawns. */
  materialDiff: number;
  lastMove: { from: SquareId; to: SquareId } | null;
  clock: ClockState;
  canUndo: boolean;
  /** Showcase settings when `mode === "demo"`. */
  demo: DemoOptions | null;
  /** Showcase playback is halted between moves. */
  paused: boolean;
  /** 1-based showcase game counter (auto-rematch increments it). */
  demoRound: number;
}

/** Everything the renderer needs to animate one played move. */
export interface MoveEvent {
  color: Faction;
  kind: PieceKind;
  from: SquareId;
  to: SquareId;
  san: string;
  /** Set when a piece leaves the board. */
  capture: { square: SquareId; kind: PieceKind; color: Faction } | null;
  /** Optional secondary trip kept for renderer compatibility. */
  rook: { from: SquareId; to: SquareId } | null;
  promotion: PieceKind | null;
  isCheck: boolean;
  isGameOver: boolean;
}

export type Animator = (event: MoveEvent) => Promise<void>;

export const PIECE_VALUE: Record<PieceKind, number> = {
  p: 1,
  n: 4,
  b: 2,
  r: 9,
  q: 2,
  k: 0,
  c: 4.5,
};

export const PIECE_LABEL: Record<PieceKind, string> = {
  p: "兵／卒",
  n: "馬",
  b: "相／象",
  r: "俥／車",
  q: "仕／士",
  k: "帥／將",
  c: "炮／砲",
};
