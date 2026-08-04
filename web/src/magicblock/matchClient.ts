import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { ConnectionMagicRouter } from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  type Commitment,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";

import type { SquareId } from "../core/types";
import idl from "./xiangqi_match.json";
import type { XiangqiMatch } from "./xiangqi_match";

export const XIANGQI_PROGRAM_ID = new PublicKey(idl.address);
export const MAGIC_ROUTER_DEVNET = "https://devnet-router.magicblock.app";
export const MAGIC_ROUTER_DEVNET_WS = "wss://devnet-router.magicblock.app";
export const SOLANA_DEVNET = "https://api.devnet.solana.com";
export const MAGICBLOCK_US_VALIDATOR = new PublicKey("MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd");
export const DEFAULT_STAKE_LAMPORTS = 10_000_000;
export const DEFAULT_JOIN_WINDOW_SECONDS = 3_600;
export const DEFAULT_TURN_TIMEOUT_SECONDS = 600;

export const MATCH_STATUS = {
  waiting: 0,
  active: 1,
  redWon: 2,
  blackWon: 3,
  draw: 4,
  cancelled: 5,
} as const;

const MATCH_SEED = new TextEncoder().encode("xiangqi");
const COMMITMENT: Commitment = "confirmed";

export interface BrowserWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
}

export interface MatchAccount {
  matchId: BN;
  red: PublicKey;
  black: PublicKey;
  board: number[];
  turn: number;
  status: number;
  ply: number;
  bump: number;
  stakeLamports: BN;
  createdAt: BN;
  joinDeadline: BN;
  lastActionAt: BN;
  turnTimeoutSeconds: BN;
  drawOffer: number;
  settled: boolean;
  lastFrom: number;
  lastTo: number;
  lastPlayer: PublicKey;
  endReason: number;
}

export interface CreateMatchOptions {
  stakeLamports?: bigint | number;
  joinDeadline?: number;
  turnTimeoutSeconds?: number;
}

export interface MagicBlockClientOptions {
  routerUrl?: string;
  websocketUrl?: string;
  validator?: PublicKey;
  baseLayerUrl?: string;
  onSimulation?: (logs: string[]) => void;
}

export class MagicBlockMatchClient {
  readonly connection: ConnectionMagicRouter;
  readonly program: Program<XiangqiMatch>;
  readonly validator: PublicKey;
  readonly baseConnection: Connection;
  private readonly onSimulation?: (logs: string[]) => void;

  constructor(
    private readonly wallet: BrowserWallet,
    options: MagicBlockClientOptions = {},
  ) {
    this.connection = new ConnectionMagicRouter(options.routerUrl ?? MAGIC_ROUTER_DEVNET, {
      commitment: COMMITMENT,
      wsEndpoint: options.websocketUrl ?? MAGIC_ROUTER_DEVNET_WS,
    });
    const provider = new AnchorProvider(this.connection, wallet, { commitment: COMMITMENT });
    this.program = new Program(idl as unknown as XiangqiMatch, provider);
    this.validator = options.validator ?? MAGICBLOCK_US_VALIDATOR;
    this.baseConnection = new Connection(options.baseLayerUrl ?? SOLANA_DEVNET, COMMITMENT);
    this.onSimulation = options.onSimulation;
  }

  matchAddress(red: PublicKey, matchId: bigint | number): PublicKey {
    const id = new BN(matchId.toString()).toArrayLike(Uint8Array, "le", 8);
    return PublicKey.findProgramAddressSync([MATCH_SEED, red.toBytes(), id], XIANGQI_PROGRAM_ID)[0];
  }

  async createMatch(
    matchId: bigint | number,
    options: CreateMatchOptions = {},
  ): Promise<{ game: PublicKey; signature: string }> {
    const game = this.matchAddress(this.wallet.publicKey, matchId);
    const now = Math.floor(Date.now() / 1_000);
    const stakeLamports = options.stakeLamports ?? DEFAULT_STAKE_LAMPORTS;
    const joinDeadline = options.joinDeadline ?? now + DEFAULT_JOIN_WINDOW_SECONDS;
    const turnTimeoutSeconds = options.turnTimeoutSeconds ?? DEFAULT_TURN_TIMEOUT_SECONDS;
    const transaction = await this.program.methods
      .initializeMatch(
        new BN(matchId.toString()),
        new BN(stakeLamports.toString()),
        new BN(joinDeadline),
        new BN(turnTimeoutSeconds),
      )
      .accountsPartial({
        game,
        red: this.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .transaction();
    return { game, signature: await this.send(transaction) };
  }

  async joinMatch(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .joinMatch()
      .accountsPartial({ game, black: this.wallet.publicKey, systemProgram: SystemProgram.programId })
      .transaction();
    return this.send(transaction);
  }

  async delegateMatch(matchId: bigint | number): Promise<string> {
    const game = this.matchAddress(this.wallet.publicKey, matchId);
    const transaction = await this.program.methods
      .delegateMatch(new BN(matchId.toString()))
      .accountsPartial({ payer: this.wallet.publicKey, pda: game })
      .remainingAccounts([{ pubkey: this.validator, isSigner: false, isWritable: false }])
      .transaction();
    return this.send(transaction);
  }

  async playMove(game: PublicKey, from: SquareId, to: SquareId): Promise<string> {
    const transaction = await this.program.methods
      .playMove(squareToIndex(from), squareToIndex(to))
      .accountsPartial({ game, player: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async claimVictory(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .claimVictory()
      .accountsPartial({ game, player: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async resign(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .resign()
      .accountsPartial({ game, player: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async offerDraw(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .offerDraw()
      .accountsPartial({ game, player: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async acceptDraw(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .acceptDraw()
      .accountsPartial({ game, player: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async claimTimeout(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .claimTimeout()
      .accountsPartial({ game, player: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async cancelWaitingMatch(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .cancelWaitingMatch()
      .accountsPartial({ game, red: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async claimPayout(game: PublicKey, red: PublicKey, black: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .claimPayout()
      .accountsPartial({ game, red, black, payer: this.wallet.publicKey })
      .transaction();
    return this.send(transaction);
  }

  async settleAndClaim(game: PublicKey, red: PublicKey, black: PublicKey): Promise<string> {
    await this.settle(game);
    await this.waitForUndelegated(game);
    return this.claimPayout(game, red, black);
  }

  async commit(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .commitMatch()
      .accountsPartial({ payer: this.wallet.publicKey, game })
      .transaction();
    return this.send(transaction);
  }

  async settle(game: PublicKey): Promise<string> {
    const transaction = await this.program.methods
      .commitAndUndelegate()
      .accountsPartial({ payer: this.wallet.publicKey, game })
      .transaction();
    return this.send(transaction);
  }

  async fetchMatch(game: PublicKey): Promise<MatchAccount> {
    return (await this.program.account.xiangqiMatch.fetch(game)) as MatchAccount;
  }

  onMatchChange(game: PublicKey, listener: (match: MatchAccount) => void): number {
    return this.connection.onAccountChange(
      game,
      (account) => listener(this.program.coder.accounts.decode("XiangqiMatch", account.data) as MatchAccount),
      COMMITMENT,
    );
  }

  removeMatchListener(id: number): Promise<void> {
    return this.connection.removeAccountChangeListener(id);
  }

  private async send(transaction: Transaction): Promise<string> {
    transaction.feePayer = this.wallet.publicKey;
    const prepared = await this.connection.prepareTransaction(transaction, { commitment: COMMITMENT });
    const simulation = await this.connection.simulateTransaction(prepared);
    this.onSimulation?.(simulation.value.logs ?? []);
    if (simulation.value.err) {
      throw new Error(`交易模擬失敗：${JSON.stringify(simulation.value.err)}`);
    }
    const signed = await this.wallet.signTransaction(prepared);
    const signature = await this.connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
    await this.connection.confirmTransaction(signature, COMMITMENT);
    return signature;
  }

  private async waitForUndelegated(game: PublicKey): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const info = await this.baseConnection.getAccountInfo(game, COMMITMENT);
      if (info?.owner.equals(XIANGQI_PROGRAM_ID)) return;
      await sleep(1_000);
    }
    throw new Error("對局狀態尚未回寫 Solana Devnet，請稍後再結算。");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function squareToIndex(square: SquareId): number {
  if (!/^[a-i][0-9]$/.test(square)) throw new Error(`無效的象棋座標：${square}`);
  return Number(square[1]) * 9 + square.charCodeAt(0) - 97;
}

export function indexToSquare(index: number): SquareId {
  if (!Number.isInteger(index) || index < 0 || index >= 90) throw new Error(`無效的象棋索引：${index}`);
  return `${String.fromCharCode(97 + (index % 9))}${Math.floor(index / 9)}`;
}
