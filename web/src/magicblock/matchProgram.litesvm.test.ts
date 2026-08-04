import { existsSync } from "node:fs";

import { BN, BorshCoder, type Idl } from "@coral-xyz/anchor";
import {
  AccountRole,
  address,
  appendTransactionMessageInstruction,
  createTransactionMessage,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  lamports,
  pipe,
  setTransactionMessageFeePayerSigner,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type InstructionWithSigners,
  type TransactionSigner,
} from "@solana/kit";
import { FailedTransactionMetadata, LiteSVM, type TransactionMetadata } from "litesvm";
import { describe, expect, it } from "vitest";

import idl from "./xiangqi_match.json";

const PROGRAM_SO = process.env.XIANGQI_PROGRAM_SO ?? "/tmp/chinese-chess-magicblock-deploy/xiangqi_match.so";
const PROGRAM_ADDRESS = address(idl.address);
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
const MATCH_ID = 42n;
const NOW = 1_700_000_000n;
const STAKE = 10_000_000n;
const coder = new BorshCoder(idl as Idl);
const addressEncoder = getAddressEncoder();
const runWithProgram = existsSync(PROGRAM_SO) ? describe : describe.skip;

type TestAccount = {
  address: Address;
  role: AccountRole;
  signer?: TransactionSigner;
};

type TestInstruction = Omit<Instruction, "accounts"> & {
  accounts: readonly TestAccount[];
};

interface MatchState {
  matchId: BN;
  red: { toBase58(): string };
  black: { toBase58(): string };
  status: number;
  stake_lamports: BN;
  last_action_at: BN;
  settled: boolean;
}

interface Fixture {
  svm: LiteSVM;
  red: TransactionSigner;
  black: TransactionSigner;
  payer: TransactionSigner;
  game: Address;
}

runWithProgram("Xiangqi wager program in LiteSVM", () => {
  it("locks one stake at initialization and the second stake on join", async () => {
    const fixture = await createFixture();
    const initialized = getGameAccount(fixture.svm, fixture.game);
    const rent = fixture.svm.minimumBalanceForRentExemption(BigInt(initialized.data.length));

    expect(initialized.lamports - rent).toBe(STAKE);
    expect(readMatch(fixture.svm, fixture.game).status).toBe(0);

    await sendInstruction(fixture.svm, fixture.payer, joinInstruction(fixture.game, fixture.black));

    const joined = getGameAccount(fixture.svm, fixture.game);
    const state = readMatch(fixture.svm, fixture.game);
    expect(joined.lamports - rent).toBe(STAKE * 2n);
    expect(state.status).toBe(1);
    expect(state.black.toBase58()).toBe(fixture.black.address);
  });

  it("returns the complete waiting-room stake to Red when cancelled", async () => {
    const fixture = await createFixture();
    const redBefore = balance(fixture.svm, fixture.red.address);

    await sendInstruction(fixture.svm, fixture.payer, cancelInstruction(fixture.game, fixture.red));

    const game = getGameAccount(fixture.svm, fixture.game);
    const rent = fixture.svm.minimumBalanceForRentExemption(BigInt(game.data.length));
    expect(balance(fixture.svm, fixture.red.address) - redBefore).toBe(STAKE);
    expect(game.lamports).toBe(rent);
    expect(readMatch(fixture.svm, fixture.game).settled).toBe(true);
  });

  it("pays the full pot to Red after Black resigns and rejects replay", async () => {
    const fixture = await createActiveFixture();
    await sendInstruction(fixture.svm, fixture.payer, resignInstruction(fixture.game, fixture.black));
    expect(readMatch(fixture.svm, fixture.game).status).toBe(2);

    const redBefore = balance(fixture.svm, fixture.red.address);
    await sendInstruction(
      fixture.svm,
      fixture.payer,
      payoutInstruction(fixture.game, fixture.red.address, fixture.black.address, fixture.payer),
    );

    expect(balance(fixture.svm, fixture.red.address) - redBefore).toBe(STAKE * 2n);
    expect(readMatch(fixture.svm, fixture.game).settled).toBe(true);

    const replay = await simulateInstructionFailure(
      fixture.svm,
      fixture.payer,
      payoutInstruction(fixture.game, fixture.red.address, fixture.black.address, fixture.payer),
    );
    expect(replay).toBeInstanceOf(FailedTransactionMetadata);
  });

  it("refunds one stake to each player after an agreed draw", async () => {
    const fixture = await createActiveFixture();
    await sendInstruction(fixture.svm, fixture.payer, playerInstruction("offer_draw", fixture.game, fixture.red));
    await sendInstruction(fixture.svm, fixture.payer, playerInstruction("accept_draw", fixture.game, fixture.black));
    expect(readMatch(fixture.svm, fixture.game).status).toBe(4);

    const redBefore = balance(fixture.svm, fixture.red.address);
    const blackBefore = balance(fixture.svm, fixture.black.address);
    await sendInstruction(
      fixture.svm,
      fixture.payer,
      payoutInstruction(fixture.game, fixture.red.address, fixture.black.address, fixture.payer),
    );

    expect(balance(fixture.svm, fixture.red.address) - redBefore).toBe(STAKE);
    expect(balance(fixture.svm, fixture.black.address) - blackBefore).toBe(STAKE);
  });

  it("lets Black claim Red's timeout even if a draw offer was sent during the turn", async () => {
    const fixture = await createActiveFixture();
    setUnixTimestamp(fixture.svm, NOW + 590n);
    await sendInstruction(fixture.svm, fixture.payer, playerInstruction("offer_draw", fixture.game, fixture.black));
    expect(readMatch(fixture.svm, fixture.game).last_action_at.toString()).toBe(NOW.toString());

    setUnixTimestamp(fixture.svm, NOW + 601n);
    await sendInstruction(fixture.svm, fixture.payer, playerInstruction("claim_timeout", fixture.game, fixture.black));
    expect(readMatch(fixture.svm, fixture.game).status).toBe(3);

    const blackBefore = balance(fixture.svm, fixture.black.address);
    await sendInstruction(
      fixture.svm,
      fixture.payer,
      payoutInstruction(fixture.game, fixture.red.address, fixture.black.address, fixture.payer),
    );
    expect(balance(fixture.svm, fixture.black.address) - blackBefore).toBe(STAKE * 2n);
  });
});

async function createFixture(): Promise<Fixture> {
  const svm = new LiteSVM();
  svm.addProgramFromFile(PROGRAM_ADDRESS, PROGRAM_SO);
  setUnixTimestamp(svm, NOW);

  const [red, black, payer] = await Promise.all([
    generateKeyPairSigner(),
    generateKeyPairSigner(),
    generateKeyPairSigner(),
  ]);
  for (const signer of [red, black, payer]) {
    const airdrop = svm.airdrop(signer.address, lamports(2_000_000_000n));
    if (airdrop instanceof FailedTransactionMetadata) throw new Error(`LiteSVM airdrop failed: ${airdrop.err()}`);
  }

  const game = await matchAddress(red.address, MATCH_ID);
  await sendInstruction(svm, payer, initializeInstruction(game, red));
  return { svm, red, black, payer, game };
}

async function createActiveFixture(): Promise<Fixture> {
  const fixture = await createFixture();
  await sendInstruction(fixture.svm, fixture.payer, joinInstruction(fixture.game, fixture.black));
  return fixture;
}

function initializeInstruction(game: Address, red: TransactionSigner): TestInstruction {
  return anchorInstruction("initialize_match", {
    match_id: new BN(MATCH_ID.toString()),
    stake_lamports: new BN(STAKE.toString()),
    join_deadline: new BN((NOW + 3_600n).toString()),
    turn_timeout_seconds: new BN(600),
  }, [
    { address: game, role: AccountRole.WRITABLE },
    { address: red.address, role: AccountRole.WRITABLE_SIGNER, signer: red },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
  ]);
}

function joinInstruction(game: Address, black: TransactionSigner): TestInstruction {
  return anchorInstruction("join_match", {}, [
    { address: game, role: AccountRole.WRITABLE },
    { address: black.address, role: AccountRole.WRITABLE_SIGNER, signer: black },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
  ]);
}

function cancelInstruction(game: Address, red: TransactionSigner): TestInstruction {
  return anchorInstruction("cancel_waiting_match", {}, [
    { address: game, role: AccountRole.WRITABLE },
    { address: red.address, role: AccountRole.WRITABLE_SIGNER, signer: red },
  ]);
}

function resignInstruction(game: Address, player: TransactionSigner): TestInstruction {
  return playerInstruction("resign", game, player);
}

function playerInstruction(name: "offer_draw" | "accept_draw" | "claim_timeout" | "resign", game: Address, player: TransactionSigner): TestInstruction {
  return anchorInstruction(name, {}, [
    { address: game, role: AccountRole.WRITABLE },
    { address: player.address, role: AccountRole.READONLY_SIGNER, signer: player },
  ]);
}

function payoutInstruction(
  game: Address,
  red: Address,
  black: Address,
  payer: TransactionSigner,
): TestInstruction {
  return anchorInstruction("claim_payout", {}, [
    { address: game, role: AccountRole.WRITABLE },
    { address: red, role: AccountRole.WRITABLE },
    { address: black, role: AccountRole.WRITABLE },
    { address: payer.address, role: AccountRole.READONLY_SIGNER, signer: payer },
  ]);
}

function anchorInstruction(name: string, args: object, accounts: TestInstruction["accounts"]): TestInstruction {
  return {
    programAddress: PROGRAM_ADDRESS,
    accounts,
    data: new Uint8Array(coder.instruction.encode(name, args)),
  };
}

async function sendInstruction(
  svm: LiteSVM,
  feePayer: TransactionSigner,
  instruction: TestInstruction,
): Promise<TransactionMetadata> {
  const transaction = await signedTransaction(svm, feePayer, instruction);
  const simulation = svm.simulateTransaction(transaction);
  if (simulation instanceof FailedTransactionMetadata) throw new Error(`Simulation failed: ${simulation.toString()}`);
  const result = svm.sendTransaction(transaction);
  if (result instanceof FailedTransactionMetadata) throw new Error(`Transaction failed: ${result.toString()}`);
  return result;
}

async function simulateInstructionFailure(
  svm: LiteSVM,
  feePayer: TransactionSigner,
  instruction: TestInstruction,
): Promise<FailedTransactionMetadata> {
  const transaction = await signedTransaction(svm, feePayer, instruction);
  const result = svm.simulateTransaction(transaction);
  if (!(result instanceof FailedTransactionMetadata)) throw new Error("Expected transaction simulation to fail");
  return result;
}

async function signedTransaction(svm: LiteSVM, feePayer: TransactionSigner, instruction: TestInstruction) {
  svm.expireBlockhash();
  return pipe(
    createTransactionMessage({ version: 0 }),
    (message) => setTransactionMessageFeePayerSigner(feePayer, message),
    (message) => svm.setTransactionMessageLifetimeUsingLatestBlockhash(message),
    (message) => appendTransactionMessageInstruction(instruction as Instruction & InstructionWithSigners, message),
    (message) => signTransactionMessageWithSigners(message),
  );
}

async function matchAddress(red: Address, matchId: bigint): Promise<Address> {
  const [game] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ADDRESS,
    seeds: [new TextEncoder().encode("xiangqi"), addressEncoder.encode(red), u64le(matchId)],
  });
  return game;
}

function u64le(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function setUnixTimestamp(svm: LiteSVM, timestamp: bigint): void {
  const clock = svm.getClock();
  clock.unixTimestamp = timestamp;
  svm.setClock(clock);
}

function getGameAccount(svm: LiteSVM, game: Address) {
  const account = svm.getAccount(game);
  if (!account.exists) throw new Error("Match account was not created");
  expect(account.programAddress).toBe(PROGRAM_ADDRESS);
  return account;
}

function readMatch(svm: LiteSVM, game: Address): MatchState {
  const account = getGameAccount(svm, game);
  return coder.accounts.decode("XiangqiMatch", Buffer.from(account.data)) as MatchState;
}

function balance(svm: LiteSVM, owner: Address): bigint {
  const value = svm.getBalance(owner);
  if (value === null) throw new Error("Wallet account is missing");
  return value;
}
