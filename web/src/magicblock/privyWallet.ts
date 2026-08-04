import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

import type { BrowserWallet } from "./matchClient";

const DEVNET_CHAIN = "solana:devnet";

export function toAnchorWallet(wallet: ConnectedStandardSolanaWallet): BrowserWallet {
  const signTransaction = async <T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> => {
    const bytes =
      transaction instanceof Transaction
        ? transaction.serialize({ requireAllSignatures: false, verifySignatures: false })
        : transaction.serialize();
    const result = await wallet.signTransaction({ transaction: bytes, chain: DEVNET_CHAIN });
    return (transaction instanceof Transaction
      ? Transaction.from(result.signedTransaction)
      : VersionedTransaction.deserialize(result.signedTransaction)) as T;
  };

  return {
    publicKey: new PublicKey(wallet.address),
    signTransaction,
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> => {
      const signed: T[] = [];
      for (const transaction of transactions) signed.push(await signTransaction(transaction));
      return signed;
    },
  };
}
