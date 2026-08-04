import { LogIn, LogOut, ShieldAlert, UserRound } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID?.trim() ?? "";

export function PrivyLoginButton() {
  if (!PRIVY_APP_ID) {
    return (
      <span
        className="mc-chip flex cursor-help items-center gap-1.5 px-3 py-2 text-[0.68rem] text-[#a89268]"
        title="在 web/.env.local 設定 VITE_PRIVY_APP_ID 即可啟用登入"
      >
        <ShieldAlert size={13} /> 登入尚未設定
      </span>
    );
  }

  return <ConfiguredPrivyButton />;
}

function ConfiguredPrivyButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const identity = user?.email?.address ?? user?.wallet?.address;
  const label = identity ? shortenIdentity(identity) : "已登入";

  return (
    <button
      type="button"
      className="mc-btn flex items-center gap-1.5 px-3 py-2 text-[0.68rem]"
      disabled={!ready}
      onClick={() => {
        if (authenticated) void logout();
        else login();
      }}
      aria-label={authenticated ? `登出 ${label}` : "使用 Privy 登入"}
    >
      {!ready ? (
        <><UserRound size={13} /> 連接中</>
      ) : authenticated ? (
        <><LogOut size={13} /> {label}</>
      ) : (
        <><LogIn size={13} /> Privy 登入</>
      )}
    </button>
  );
}

function shortenIdentity(identity: string): string {
  if (identity.includes("@")) {
    const [name, domain] = identity.split("@");
    return `${name.slice(0, 2)}…@${domain}`;
  }
  return identity.length > 12 ? `${identity.slice(0, 4)}…${identity.slice(-4)}` : identity;
}
