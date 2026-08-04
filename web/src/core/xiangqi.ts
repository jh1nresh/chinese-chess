import type { Faction, PieceKind, SquareId } from "./types";

export const XIANGQI_FILES = "abcdefghi";
export const XIANGQI_RANKS = 10;
export const INITIAL_XIANGQI_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";

export interface XiangqiPiece {
  kind: PieceKind;
  color: Faction;
}

export interface XiangqiMove {
  color: Faction;
  piece: PieceKind;
  from: SquareId;
  to: SquareId;
  captured: PieceKind | null;
  notation: string;
  check: boolean;
  mate: boolean;
}

interface Position {
  file: number;
  rank: number;
}

interface HistoryEntry {
  board: Map<SquareId, XiangqiPiece>;
  turn: Faction;
  move: XiangqiMove;
}

const FEN_TO_KIND: Record<string, PieceKind> = {
  p: "p",
  n: "n",
  h: "n",
  b: "b",
  e: "b",
  r: "r",
  a: "q",
  k: "k",
  c: "c",
};

const KIND_TO_FEN: Record<PieceKind, string> = {
  p: "p",
  n: "n",
  b: "b",
  r: "r",
  q: "a",
  k: "k",
  c: "c",
};

const PIECE_NAMES: Record<Faction, Record<PieceKind, string>> = {
  w: { k: "帥", q: "仕", b: "相", n: "馬", r: "俥", c: "炮", p: "兵" },
  b: { k: "將", q: "士", b: "象", n: "馬", r: "車", c: "砲", p: "卒" },
};

const ORTHOGONAL: Position[] = [
  { file: 1, rank: 0 },
  { file: -1, rank: 0 },
  { file: 0, rank: 1 },
  { file: 0, rank: -1 },
];

export class Xiangqi {
  private pieces = new Map<SquareId, XiangqiPiece>();
  private side: Faction = "w";
  private played: HistoryEntry[] = [];
  private positionCounts = new Map<string, number>();

  constructor(fen = INITIAL_XIANGQI_FEN) {
    this.load(fen);
  }

  load(fen: string): void {
    const [placement, side = "w"] = fen.trim().split(/\s+/);
    const rows = placement.split("/");
    if (rows.length !== XIANGQI_RANKS || (side !== "w" && side !== "b")) {
      throw new Error("Invalid Xiangqi FEN");
    }

    const board = new Map<SquareId, XiangqiPiece>();
    rows.forEach((row, rowIndex) => {
      let file = 0;
      for (const token of row) {
        if (/\d/.test(token)) {
          file += Number(token);
          continue;
        }
        const kind = FEN_TO_KIND[token.toLowerCase()];
        if (!kind || file >= XIANGQI_FILES.length) throw new Error("Invalid Xiangqi FEN");
        const color: Faction = token === token.toUpperCase() ? "w" : "b";
        board.set(square(file, XIANGQI_RANKS - 1 - rowIndex), { kind, color });
        file += 1;
      }
      if (file !== XIANGQI_FILES.length) throw new Error("Invalid Xiangqi FEN");
    });

    this.pieces = board;
    this.side = side;
    this.played = [];
    this.positionCounts = new Map([[this.positionKey(), 1]]);
  }

  turn(): Faction {
    return this.side;
  }

  get(squareId: SquareId): XiangqiPiece | null {
    const piece = this.pieces.get(squareId);
    return piece ? { ...piece } : null;
  }

  board(): { square: SquareId; kind: PieceKind; color: Faction }[] {
    return [...this.pieces.entries()].map(([squareId, piece]) => ({ square: squareId, ...piece }));
  }

  history(): XiangqiMove[] {
    return this.played.map((entry) => ({ ...entry.move }));
  }

  fen(): string {
    const rows: string[] = [];
    for (let rank = XIANGQI_RANKS - 1; rank >= 0; rank -= 1) {
      let row = "";
      let empty = 0;
      for (let file = 0; file < XIANGQI_FILES.length; file += 1) {
        const piece = this.pieces.get(square(file, rank));
        if (!piece) {
          empty += 1;
          continue;
        }
        if (empty > 0) row += String(empty);
        empty = 0;
        const token = KIND_TO_FEN[piece.kind];
        row += piece.color === "w" ? token.toUpperCase() : token;
      }
      if (empty > 0) row += String(empty);
      rows.push(row);
    }
    return `${rows.join("/")} ${this.side}`;
  }

  moves(from?: SquareId): XiangqiMove[] {
    const candidates: { from: SquareId; to: SquareId; piece: XiangqiPiece; captured: PieceKind | null }[] = [];
    // Legal filtering temporarily moves pieces on the Map. Iterate a snapshot so
    // restoring an entry cannot append it to the live iterator indefinitely.
    for (const [squareId, piece] of [...this.pieces.entries()]) {
      if (piece.color !== this.side || (from && squareId !== from)) continue;
      for (const target of this.pseudoTargets(squareId, piece)) {
        const captured = this.pieces.get(target);
        if (captured?.color === piece.color) continue;
        if (this.leavesGeneralInCheck(squareId, target, piece.color)) continue;
        candidates.push({ from: squareId, to: target, piece, captured: captured?.kind ?? null });
      }
    }
    return candidates.map((candidate) => ({
      color: candidate.piece.color,
      piece: candidate.piece.kind,
      from: candidate.from,
      to: candidate.to,
      captured: candidate.captured,
      notation: this.notation(candidate.piece, candidate.from, candidate.to, false, false),
      check: false,
      mate: false,
    }));
  }

  move(from: SquareId, to: SquareId): XiangqiMove | null {
    const legal = this.moves(from).find((candidate) => candidate.to === to);
    if (!legal) return null;

    const before = cloneBoard(this.pieces);
    const moving = this.pieces.get(from);
    if (!moving) return null;
    this.pieces.delete(from);
    this.pieces.set(to, moving);
    this.side = opposite(this.side);

    const check = this.isCheck();
    const mate = this.moves().length === 0;
    const played: XiangqiMove = {
      ...legal,
      check,
      mate,
      notation: this.notation(moving, from, to, check, mate),
    };
    this.played.push({ board: before, turn: moving.color, move: played });
    const key = this.positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) ?? 0) + 1);
    return { ...played };
  }

  undo(): XiangqiMove | null {
    const previous = this.played.pop();
    if (!previous) return null;
    const key = this.positionKey();
    const count = this.positionCounts.get(key) ?? 0;
    if (count <= 1) this.positionCounts.delete(key);
    else this.positionCounts.set(key, count - 1);
    this.pieces = previous.board;
    this.side = previous.turn;
    return { ...previous.move };
  }

  isCheck(color = this.side): boolean {
    const general = [...this.pieces.entries()].find(([, piece]) => piece.color === color && piece.kind === "k");
    if (!general) return true;
    const [generalSquare] = general;
    for (const [from, piece] of this.pieces) {
      if (piece.color === color) continue;
      if (this.pseudoTargets(from, piece).includes(generalSquare)) return true;
    }
    return false;
  }

  isCheckmate(): boolean {
    return this.isCheck() && this.moves().length === 0;
  }

  isStalemate(): boolean {
    return !this.isCheck() && this.moves().length === 0;
  }

  isThreefoldRepetition(): boolean {
    return (this.positionCounts.get(this.positionKey()) ?? 0) >= 3;
  }

  isGameOver(): boolean {
    return this.moves().length === 0 || this.isThreefoldRepetition();
  }

  private notation(piece: XiangqiPiece, from: SquareId, to: SquareId, check: boolean, mate: boolean): string {
    return `${PIECE_NAMES[piece.color][piece.kind]} ${from}→${to}${mate ? "#" : check ? "+" : ""}`;
  }

  private leavesGeneralInCheck(from: SquareId, to: SquareId, color: Faction): boolean {
    const moving = this.pieces.get(from);
    const captured = this.pieces.get(to);
    if (!moving) return true;
    this.pieces.delete(from);
    this.pieces.set(to, moving);
    const checked = this.isCheck(color);
    this.pieces.set(from, moving);
    if (captured) this.pieces.set(to, captured);
    else this.pieces.delete(to);
    return checked;
  }

  private pseudoTargets(from: SquareId, piece: XiangqiPiece): SquareId[] {
    const origin = parseSquare(from);
    if (!origin) return [];
    switch (piece.kind) {
      case "r":
        return this.slidingTargets(origin, piece.color, false);
      case "c":
        return this.slidingTargets(origin, piece.color, true);
      case "n":
        return this.horseTargets(origin, piece.color);
      case "b":
        return this.elephantTargets(origin, piece.color);
      case "q":
        return this.advisorTargets(origin, piece.color);
      case "k":
        return this.generalTargets(origin, piece.color);
      case "p":
        return this.soldierTargets(origin, piece.color);
    }
  }

  private slidingTargets(origin: Position, color: Faction, cannon: boolean): SquareId[] {
    const targets: SquareId[] = [];
    for (const direction of ORTHOGONAL) {
      let position = add(origin, direction);
      let screenFound = false;
      while (inside(position)) {
        const target = square(position.file, position.rank);
        const occupant = this.pieces.get(target);
        if (!cannon) {
          if (!occupant) targets.push(target);
          else {
            if (occupant.color !== color) targets.push(target);
            break;
          }
        } else if (!screenFound) {
          if (!occupant) targets.push(target);
          else screenFound = true;
        } else if (occupant) {
          if (occupant.color !== color) targets.push(target);
          break;
        }
        position = add(position, direction);
      }
    }
    return targets;
  }

  private horseTargets(origin: Position, color: Faction): SquareId[] {
    const patterns = [
      { leg: { file: 1, rank: 0 }, end: { file: 2, rank: 1 } },
      { leg: { file: 1, rank: 0 }, end: { file: 2, rank: -1 } },
      { leg: { file: -1, rank: 0 }, end: { file: -2, rank: 1 } },
      { leg: { file: -1, rank: 0 }, end: { file: -2, rank: -1 } },
      { leg: { file: 0, rank: 1 }, end: { file: 1, rank: 2 } },
      { leg: { file: 0, rank: 1 }, end: { file: -1, rank: 2 } },
      { leg: { file: 0, rank: -1 }, end: { file: 1, rank: -2 } },
      { leg: { file: 0, rank: -1 }, end: { file: -1, rank: -2 } },
    ];
    return patterns.flatMap(({ leg, end }) => {
      const legSquare = add(origin, leg);
      const target = add(origin, end);
      if (!inside(target) || this.pieces.has(square(legSquare.file, legSquare.rank))) return [];
      return this.acceptTarget(target, color);
    });
  }

  private elephantTargets(origin: Position, color: Faction): SquareId[] {
    const diagonals = [
      { file: 2, rank: 2 },
      { file: 2, rank: -2 },
      { file: -2, rank: 2 },
      { file: -2, rank: -2 },
    ];
    return diagonals.flatMap((offset) => {
      const target = add(origin, offset);
      const eye = add(origin, { file: offset.file / 2, rank: offset.rank / 2 });
      const staysHome = color === "w" ? target.rank <= 4 : target.rank >= 5;
      if (!inside(target) || !staysHome || this.pieces.has(square(eye.file, eye.rank))) return [];
      return this.acceptTarget(target, color);
    });
  }

  private advisorTargets(origin: Position, color: Faction): SquareId[] {
    return [
      { file: 1, rank: 1 },
      { file: 1, rank: -1 },
      { file: -1, rank: 1 },
      { file: -1, rank: -1 },
    ].flatMap((offset) => {
      const target = add(origin, offset);
      return inPalace(target, color) ? this.acceptTarget(target, color) : [];
    });
  }

  private generalTargets(origin: Position, color: Faction): SquareId[] {
    const targets = ORTHOGONAL.flatMap((offset) => {
      const target = add(origin, offset);
      return inPalace(target, color) ? this.acceptTarget(target, color) : [];
    });

    const enemyGeneral = [...this.pieces.entries()].find(([, piece]) => piece.color !== color && piece.kind === "k");
    if (enemyGeneral) {
      const [enemySquare] = enemyGeneral;
      const enemy = parseSquare(enemySquare);
      if (enemy && enemy.file === origin.file) {
        let clear = true;
        for (let rank = Math.min(origin.rank, enemy.rank) + 1; rank < Math.max(origin.rank, enemy.rank); rank += 1) {
          if (this.pieces.has(square(origin.file, rank))) clear = false;
        }
        if (clear) targets.push(enemySquare);
      }
    }
    return targets;
  }

  private soldierTargets(origin: Position, color: Faction): SquareId[] {
    const forward = color === "w" ? 1 : -1;
    const crossedRiver = color === "w" ? origin.rank >= 5 : origin.rank <= 4;
    const offsets: Position[] = [{ file: 0, rank: forward }];
    if (crossedRiver) offsets.push({ file: 1, rank: 0 }, { file: -1, rank: 0 });
    return offsets.flatMap((offset) => this.acceptTarget(add(origin, offset), color));
  }

  private acceptTarget(position: Position, color: Faction): SquareId[] {
    if (!inside(position)) return [];
    const target = square(position.file, position.rank);
    return this.pieces.get(target)?.color === color ? [] : [target];
  }

  private positionKey(): string {
    return this.fen();
  }
}

function square(file: number, rank: number): SquareId {
  return `${XIANGQI_FILES[file]}${rank}`;
}

function parseSquare(value: SquareId): Position | null {
  if (value.length !== 2) return null;
  const file = XIANGQI_FILES.indexOf(value[0]);
  const rank = Number(value[1]);
  return file >= 0 && Number.isInteger(rank) && rank >= 0 && rank < XIANGQI_RANKS ? { file, rank } : null;
}

function inside(position: Position): boolean {
  return position.file >= 0 && position.file < XIANGQI_FILES.length && position.rank >= 0 && position.rank < XIANGQI_RANKS;
}

function inPalace(position: Position, color: Faction): boolean {
  if (position.file < 3 || position.file > 5) return false;
  return color === "w" ? position.rank >= 0 && position.rank <= 2 : position.rank >= 7 && position.rank <= 9;
}

function add(left: Position, right: Position): Position {
  return { file: left.file + right.file, rank: left.rank + right.rank };
}

function opposite(color: Faction): Faction {
  return color === "w" ? "b" : "w";
}

function cloneBoard(board: Map<SquareId, XiangqiPiece>): Map<SquareId, XiangqiPiece> {
  return new Map([...board.entries()].map(([squareId, piece]) => [squareId, { ...piece }]));
}
