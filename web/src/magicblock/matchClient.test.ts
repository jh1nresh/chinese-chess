import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";

import idl from "./xiangqi_match.json";
import {
  DEFAULT_STAKE_LAMPORTS,
  DEFAULT_TURN_TIMEOUT_SECONDS,
  XIANGQI_PROGRAM_ID,
  indexToSquare,
  squareToIndex,
} from "./matchClient";

describe("MagicBlock Xiangqi client", () => {
  it("uses the deployed-program address encoded in the generated IDL", () => {
    expect(XIANGQI_PROGRAM_ID.toBase58()).toBe("4EcbVv7UbxnTb8tDbRkb6iUmahhUav8ccv1dCSgE6VVW");
    expect(() => new PublicKey(XIANGQI_PROGRAM_ID)).not.toThrow();
  });

  it("round-trips every 9x10 board coordinate", () => {
    for (let index = 0; index < 90; index += 1) {
      expect(squareToIndex(indexToSquare(index))).toBe(index);
    }
    expect(squareToIndex("a0")).toBe(0);
    expect(squareToIndex("i9")).toBe(89);
  });

  it("rejects squares outside the Xiangqi board", () => {
    expect(() => squareToIndex("j0")).toThrow();
    expect(() => indexToSquare(90)).toThrow();
  });

  it("ships the wager, refund and settlement instructions in the generated IDL", () => {
    const instructions = idl.instructions.map((instruction) => instruction.name);
    expect(instructions).toEqual(expect.arrayContaining([
      "initialize_match",
      "join_match",
      "offer_draw",
      "accept_draw",
      "claim_timeout",
      "cancel_waiting_match",
      "claim_payout",
      "delegate_match",
      "commit_and_undelegate",
    ]));
    expect(DEFAULT_STAKE_LAMPORTS).toBe(10_000_000);
    expect(DEFAULT_TURN_TIMEOUT_SECONDS).toBe(600);
  });
});
