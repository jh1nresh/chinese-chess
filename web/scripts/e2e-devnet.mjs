// Devnet end-to-end acceptance chains for the xiangqi_match program.
//
// Runs the five settlement chains required by docs/magicblock-onchain-xiangqi-spec.md §9:
//   1. cancel-refund   2. red-win   3. black-win   4. draw   5. timeout
// Each chain checks lamports conservation: the only allowed differences are
// transaction fees and the game PDA's retained rent.
//
// Usage (from web/):  node scripts/e2e-devnet.mjs [--only <chain>]
// Requires: deployed program (address in src/magicblock/xiangqi_match.json),
//           ~/.config/solana/id.json funded with ~0.5 devSOL.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import anchorPkg from "@coral-xyz/anchor";
import web3 from "@solana/web3.js";

const { AnchorProvider, BN, Program, Wallet } = anchorPkg;
const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } = web3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RPC_URL = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const STAKE = 10_000_000; // 0.01 SOL
const MATCH_SEED = Buffer.from("xiangqi");
const KEYS_DIR = path.resolve(__dirname, "../../magicblock/keys");
const EVIDENCE_PATH = path.resolve(__dirname, "../../docs/devnet-e2e-evidence.json");

const idl = JSON.parse(readFileSync(path.resolve(__dirname, "../src/magicblock/xiangqi_match.json"), "utf8"));
const PROGRAM_ID = new PublicKey(idl.address);

const STATUS = { waiting: 0, active: 1, redWon: 2, blackWon: 3, draw: 4, cancelled: 5 };

function loadKeypair(file) {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
}

function loadOrCreatePlayer(name) {
  if (!existsSync(KEYS_DIR)) mkdirSync(KEYS_DIR, { recursive: true });
  const file = path.join(KEYS_DIR, `${name}.json`);
  if (existsSync(file)) return loadKeypair(file);
  const keypair = Keypair.generate();
  writeFileSync(file, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

function randomMatchId() {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(words[0]) << 32n) | BigInt(words[1]);
}

function matchAddress(red, matchId) {
  const id = Buffer.from(new BN(matchId.toString()).toArrayLike(Uint8Array, "le", 8));
  return PublicKey.findProgramAddressSync([MATCH_SEED, red.toBytes(), id], PROGRAM_ID)[0];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
  const connection = new Connection(RPC_URL, "confirmed");
  const payer = loadKeypair(path.join(homedir(), ".config/solana/id.json"));
  const red = loadOrCreatePlayer("e2e-red");
  const black = loadOrCreatePlayer("e2e-black");
  console.log(`program  ${PROGRAM_ID.toBase58()}`);
  console.log(`payer    ${payer.publicKey.toBase58()}`);
  console.log(`red      ${red.publicKey.toBase58()}`);
  console.log(`black    ${black.publicKey.toBase58()}`);

  const info = await connection.getAccountInfo(PROGRAM_ID);
  if (!info?.executable) throw new Error("program is not deployed on this cluster");

  // Top up player wallets from the operator wallet (never leaves devnet).
  for (const player of [red, black]) {
    const balance = await connection.getBalance(player.publicKey);
    if (balance < 0.06 * LAMPORTS_PER_SOL) {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: player.publicKey,
          lamports: Math.round(0.08 * LAMPORTS_PER_SOL) - balance,
        }),
      );
      await web3.sendAndConfirmTransaction(connection, transaction, [payer]);
    }
  }

  const programFor = (signer) =>
    new Program(idl, new AnchorProvider(connection, new Wallet(signer), { commitment: "confirmed" }));
  const redProgram = programFor(red);
  const blackProgram = programFor(black);

  const evidence = existsSync(EVIDENCE_PATH) ? JSON.parse(readFileSync(EVIDENCE_PATH, "utf8")) : {};

  async function createAndJoin(chain, turnTimeoutSeconds = 600) {
    const matchId = randomMatchId();
    const game = matchAddress(red.publicKey, matchId);
    const now = Math.floor(Date.now() / 1000);
    chain.game = game.toBase58();
    chain.signatures.initialize_match = await redProgram.methods
      .initializeMatch(new BN(matchId.toString()), new BN(STAKE), new BN(now + 3600), new BN(turnTimeoutSeconds))
      .accountsPartial({ game, red: red.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    chain.signatures.join_match = await blackProgram.methods
      .joinMatch()
      .accountsPartial({ game, black: black.publicKey, systemProgram: SystemProgram.programId })
      .rpc();
    return game;
  }

  async function claimPayout(chain, game) {
    const before = {
      pda: await connection.getBalance(game),
      red: await connection.getBalance(red.publicKey),
      black: await connection.getBalance(black.publicKey),
    };
    chain.signatures.claim_payout = await redProgram.methods
      .claimPayout()
      .accountsPartial({ game, red: red.publicKey, black: black.publicKey, payer: red.publicKey })
      .rpc();
    const after = {
      pda: await connection.getBalance(game),
      red: await connection.getBalance(red.publicKey),
      black: await connection.getBalance(black.publicKey),
    };
    chain.lamports = { before, after };
    const paidOut = before.pda - after.pda;
    if (paidOut !== 2 * STAKE) throw new Error(`PDA paid out ${paidOut}, expected ${2 * STAKE}`);
    const account = await redProgram.account.xiangqiMatch.fetch(game);
    if (!account.settled) throw new Error("match not marked settled");
    return { before, after };
  }

  const FEE_TOLERANCE = 100_000; // generous bound for a couple of signatures

  const chains = {
    async "cancel-refund"(chain) {
      const matchId = randomMatchId();
      const game = matchAddress(red.publicKey, matchId);
      const now = Math.floor(Date.now() / 1000);
      chain.game = game.toBase58();
      const redBefore = await connection.getBalance(red.publicKey);
      chain.signatures.initialize_match = await redProgram.methods
        .initializeMatch(new BN(matchId.toString()), new BN(STAKE), new BN(now + 3600), new BN(600))
        .accountsPartial({ game, red: red.publicKey, systemProgram: SystemProgram.programId })
        .rpc();
      chain.signatures.cancel_waiting_match = await redProgram.methods
        .cancelWaitingMatch()
        .accountsPartial({ game, red: red.publicKey })
        .rpc();
      const account = await redProgram.account.xiangqiMatch.fetch(game);
      if (account.status !== STATUS.cancelled || !account.settled) throw new Error("cancel did not settle");
      const redAfter = await connection.getBalance(red.publicKey);
      const cost = redBefore - redAfter; // rent of the PDA + fees; the stake must have come back
      const pdaRent = await connection.getBalance(game);
      if (cost > pdaRent + FEE_TOLERANCE) throw new Error(`red lost ${cost} lamports, more than rent+fees`);
      chain.lamports = { redBefore, redAfter, pdaRent };
    },

    async "red-win"(chain) {
      const game = await createAndJoin(chain);
      // exercise play_move on-chain: red soldier a3 -> a4 (index 27 -> 36)
      chain.signatures.play_move = await redProgram.methods
        .playMove(27, 36)
        .accountsPartial({ game, player: red.publicKey })
        .rpc();
      chain.signatures.resign = await blackProgram.methods
        .resign()
        .accountsPartial({ game, player: black.publicKey })
        .rpc();
      const account = await redProgram.account.xiangqiMatch.fetch(game);
      if (account.status !== STATUS.redWon) throw new Error(`unexpected status ${account.status}`);
      const { before, after } = await claimPayout(chain, game);
      if (after.red - before.red < 2 * STAKE - FEE_TOLERANCE) throw new Error("red did not receive the pot");
    },

    async "black-win"(chain) {
      const game = await createAndJoin(chain);
      chain.signatures.resign = await redProgram.methods
        .resign()
        .accountsPartial({ game, player: red.publicKey })
        .rpc();
      const account = await redProgram.account.xiangqiMatch.fetch(game);
      if (account.status !== STATUS.blackWon) throw new Error(`unexpected status ${account.status}`);
      const { before, after } = await claimPayout(chain, game);
      if (after.black - before.black !== 2 * STAKE) throw new Error("black did not receive the pot");
    },

    async draw(chain) {
      const game = await createAndJoin(chain);
      chain.signatures.offer_draw = await redProgram.methods
        .offerDraw()
        .accountsPartial({ game, player: red.publicKey })
        .rpc();
      chain.signatures.accept_draw = await blackProgram.methods
        .acceptDraw()
        .accountsPartial({ game, player: black.publicKey })
        .rpc();
      const account = await redProgram.account.xiangqiMatch.fetch(game);
      if (account.status !== STATUS.draw) throw new Error(`unexpected status ${account.status}`);
      const { before, after } = await claimPayout(chain, game);
      if (after.black - before.black !== STAKE) throw new Error("black refund incorrect");
      if (after.red - before.red < STAKE - FEE_TOLERANCE) throw new Error("red refund incorrect");
    },

    async timeout(chain) {
      const game = await createAndJoin(chain, 60);
      console.log("  waiting 65s for the turn to time out…");
      await sleep(65_000);
      // it is red's turn at ply 0, so black is the claimant
      chain.signatures.claim_timeout = await blackProgram.methods
        .claimTimeout()
        .accountsPartial({ game, player: black.publicKey })
        .rpc();
      const account = await redProgram.account.xiangqiMatch.fetch(game);
      if (account.status !== STATUS.blackWon) throw new Error(`unexpected status ${account.status}`);
      const { before, after } = await claimPayout(chain, game);
      if (after.black - before.black < 2 * STAKE - FEE_TOLERANCE) throw new Error("black did not receive the pot");
    },
  };

  let failed = false;
  for (const [name, run] of Object.entries(chains)) {
    if (only && only !== name) continue;
    const chain = { cluster: RPC_URL, program: PROGRAM_ID.toBase58(), ranAt: new Date().toISOString(), signatures: {} };
    process.stdout.write(`\n▶ ${name}\n`);
    try {
      await run(chain);
      chain.result = "pass";
      console.log(`  ✅ pass  game=${chain.game}`);
    } catch (error) {
      chain.result = `fail: ${error.message}`;
      failed = true;
      console.error(`  ❌ ${error.message}`);
    }
    evidence[name] = chain;
    writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
  }

  console.log(`\nevidence written to ${path.relative(process.cwd(), EVIDENCE_PATH)}`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
