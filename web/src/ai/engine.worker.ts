/// <reference lib="webworker" />

import { Xiangqi, type XiangqiMove } from "../core/xiangqi";
import type { Difficulty, PieceKind } from "../core/types";

interface SearchRequest {
  id: number;
  fen: string;
  difficulty: Difficulty;
}

interface SearchResponse {
  id: number;
  from: string;
  to: string;
  promotion: null;
  score: number;
  depth: number;
}

const VALUE: Record<PieceKind, number> = { p: 100, n: 400, b: 200, r: 900, q: 200, k: 20_000, c: 450 };

function evaluate(game: Xiangqi): number {
  let score = 0;
  for (const piece of game.board()) {
    const rank = Number(piece.square[1]);
    const file = piece.square.charCodeAt(0) - 97;
    let value = VALUE[piece.kind];
    if (piece.kind === "p") {
      const advance = piece.color === "w" ? rank : 9 - rank;
      value += advance * 12 + (advance >= 5 ? 35 : 0);
    }
    if (piece.kind === "n" || piece.kind === "c") value += 12 - Math.abs(4 - file) * 3;
    score += piece.color === "w" ? value : -value;
  }
  return score;
}

function movePriority(move: XiangqiMove): number {
  return move.captured ? VALUE[move.captured] * 10 - VALUE[move.piece] : move.check ? 80 : 0;
}

class Search {
  private game: Xiangqi;
  private deadline: number;
  private nodes = 0;
  private aborted = false;

  constructor(fen: string, budgetMs: number) {
    this.game = new Xiangqi(fen);
    this.deadline = performance.now() + budgetMs;
  }

  private outOfTime(): boolean {
    if ((this.nodes & 127) === 0 && performance.now() > this.deadline) this.aborted = true;
    return this.aborted;
  }

  private orderedMoves(): XiangqiMove[] {
    return this.game.moves().sort((left, right) => movePriority(right) - movePriority(left));
  }

  private negamax(depth: number, alpha: number, beta: number): number {
    this.nodes += 1;
    if (this.outOfTime()) return (this.game.turn() === "w" ? 1 : -1) * evaluate(this.game);
    const moves = this.orderedMoves();
    if (moves.length === 0) return -100_000 - depth;
    if (depth === 0) return (this.game.turn() === "w" ? 1 : -1) * evaluate(this.game);

    let best = -Infinity;
    for (const move of moves) {
      this.game.move(move.from, move.to);
      const score = -this.negamax(depth - 1, -beta, -alpha);
      this.game.undo();
      if (this.outOfTime()) return best === -Infinity ? alpha : best;
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  run(maxDepth: number): { move: XiangqiMove; score: number; depth: number } | null {
    const rootMoves = this.orderedMoves();
    if (rootMoves.length === 0) return null;
    let bestMove = rootMoves[0];
    let bestScore = -Infinity;
    let reachedDepth = 1;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      let localMove = bestMove;
      let localScore = -Infinity;
      for (const move of rootMoves) {
        this.game.move(move.from, move.to);
        const score = -this.negamax(depth - 1, -Infinity, Infinity);
        this.game.undo();
        if (this.outOfTime()) break;
        if (score > localScore) {
          localScore = score;
          localMove = move;
        }
      }
      if (this.aborted) break;
      bestMove = localMove;
      bestScore = localScore;
      reachedDepth = depth;
      rootMoves.sort((left, right) => (left === bestMove ? -1 : right === bestMove ? 1 : 0));
      if (Math.abs(bestScore) > 90_000) break;
    }
    return { move: bestMove, score: bestScore, depth: reachedDepth };
  }
}

function pickEasyMove(fen: string): XiangqiMove | null {
  const game = new Xiangqi(fen);
  const moves = game.moves();
  if (moves.length === 0) return null;
  const captures = moves.filter((move) => move.captured);
  const pool = captures.length > 0 && Math.random() < 0.65 ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  const { id, fen, difficulty } = event.data;
  try {
    const easy = difficulty === "easy" ? pickEasyMove(fen) : null;
    const result =
      difficulty === "easy"
        ? easy && { move: easy, score: 0, depth: 1 }
        : new Search(fen, difficulty === "medium" ? 500 : 1800).run(difficulty === "medium" ? 2 : 3);
    if (!result) {
      self.postMessage(null);
      return;
    }
    const response: SearchResponse = {
      id,
      from: result.move.from,
      to: result.move.to,
      promotion: null,
      score: result.score,
      depth: result.depth,
    };
    self.postMessage(response);
  } catch (error) {
    console.error("[xiangqi-engine] search failed", error);
    self.postMessage(null);
  }
};
