import "./lib/polyfills";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { PRIVY_APP_ID } from "./auth/PrivyLoginButton.tsx";
import "./index.css";

const app = <App />;

createRoot(document.getElementById("root")!).render(
  PRIVY_APP_ID ? (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#b83a2e",
          logo: "/icon.png",
          showWalletLoginFirst: true,
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {app}
    </PrivyProvider>
  ) : app,
);
