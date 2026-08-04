import { describe, expect, it } from "vitest";

import { INITIAL_XIANGQI_FEN, Xiangqi } from "./xiangqi";

describe("Xiangqi", () => {
  it("loads the standard 32-piece position", () => {
    const game = new Xiangqi();
    expect(game.board()).toHaveLength(32);
    expect(game.fen()).toBe(INITIAL_XIANGQI_FEN);
    expect(game.get("e0")).toEqual({ kind: "k", color: "w" });
    expect(game.get("b2")).toEqual({ kind: "c", color: "w" });
  });

  it("enforces palace, river, horse-leg and elephant-eye restrictions", () => {
    const game = new Xiangqi("3k5/9/9/9/9/9/9/9/3P5/2BAK4 w");
    expect(game.moves("e0").map((move) => move.to)).not.toContain("f1");
    expect(game.moves("d0").map((move) => move.to)).toEqual(["e1"]);
    expect(game.moves("c0").map((move) => move.to)).not.toContain("e2");

    const horse = new Xiangqi("3k5/9/9/9/9/9/9/9/9/4KPN2 w");
    expect(horse.moves("g0").map((move) => move.to)).not.toContain("e1");
  });

  it("requires exactly one screen for a cannon capture", () => {
    const game = new Xiangqi("4k4/9/4r4/9/4p4/9/9/9/4C4/4K4 w");
    const targets = game.moves("e1").map((move) => move.to);
    expect(targets).toContain("e7");
    expect(targets).not.toContain("e5");
  });

  it("lets soldiers move sideways only after crossing the river", () => {
    const game = new Xiangqi("3k5/9/9/9/4P4/9/4P4/9/9/4K4 w");
    expect(game.moves("e3").map((move) => move.to)).toEqual(["e4"]);
    expect(game.moves("e5").map((move) => move.to)).toEqual(expect.arrayContaining(["e6", "d5", "f5"]));
  });

  it("prevents a move that exposes facing generals", () => {
    const game = new Xiangqi("4k4/9/9/9/9/9/9/9/4R4/4K4 w");
    expect(game.moves("e1").map((move) => move.to)).not.toContain("d1");
  });

  it("supports move, check notation and undo", () => {
    const game = new Xiangqi("4k4/9/9/9/9/9/9/9/R8/4K4 w");
    const move = game.move("a1", "e1");
    expect(move?.check).toBe(true);
    expect(move?.notation).toContain("+");
    expect(game.turn()).toBe("b");
    expect(game.undo()?.from).toBe("a1");
    expect(game.turn()).toBe("w");
    expect(game.get("a1")?.kind).toBe("r");
  });
});
