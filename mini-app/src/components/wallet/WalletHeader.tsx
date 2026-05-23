import { BadgeCheck } from "lucide-react";
import { UserAvatar } from "./UserAvatar";

type TgUser = {
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type Props = {
  user?: TgUser;
  premium?: boolean;
};

export function WalletHeader({ user, premium }: Props) {
  const displayName = user?.first_name || "Foydalanuvchi";
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 4px 16px",
      }}
    >
      <UserAvatar user={user} size={32} />
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--tg-theme-text-color, #000)",
        }}
      >
        Salom, {displayName}
      </span>
      {premium && (
        <BadgeCheck
          size={20}
          strokeWidth={2}
          color="#fff"
          fill="var(--tg-theme-button-color, #2481cc)"
        />
      )}
    </header>
  );
}
