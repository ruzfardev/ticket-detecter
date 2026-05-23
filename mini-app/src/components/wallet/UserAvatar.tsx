import { useState } from "react";
import { User } from "lucide-react";

type TgUser = {
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

type Props = {
  user?: TgUser;
  size?: number;
};

export function UserAvatar({ user, size = 32 }: Props) {
  const [errored, setErrored] = useState(false);

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  } as const;

  if (user?.photo_url && !errored) {
    return (
      <img
        src={user.photo_url}
        alt=""
        onError={() => setErrored(true)}
        style={{ ...baseStyle, objectFit: "cover" }}
      />
    );
  }

  const initials = ((user?.first_name?.[0] ?? "") + (user?.last_name?.[0] ?? ""))
    .toUpperCase()
    .trim();

  if (initials) {
    return (
      <span
        style={{
          ...baseStyle,
          background: "var(--tg-theme-button-color, #2481cc)",
          color: "#fff",
          fontWeight: 600,
          fontSize: Math.round(size * 0.4),
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    <span
      style={{
        ...baseStyle,
        background: "var(--tg-theme-secondary-bg-color, #efeff4)",
        color: "var(--tg-theme-hint-color, #999)",
      }}
    >
      <User size={Math.round(size * 0.6)} strokeWidth={1.75} />
    </span>
  );
}
