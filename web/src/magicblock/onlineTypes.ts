import type { PublicKey } from "@solana/web3.js";

import type { MagicBlockMatchClient, MatchAccount } from "./matchClient";

export type OnlineRole = "red" | "black";

export interface OnlineSession {
  client: MagicBlockMatchClient;
  game: PublicKey;
  matchId: bigint;
  role: OnlineRole;
  walletAddress: PublicKey;
  account: MatchAccount;
}
