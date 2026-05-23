import { LucideIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTelegram } from "@/hooks/useTelegram";

export type FloatingTab = {
  path: string;
  label: string;
  Icon: LucideIcon;
};

type Props = {
  tabs: FloatingTab[];
};

export function FloatingTabbar({ tabs }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { haptic } = useTelegram();

  const onClick = (path: string) => {
    if (location.pathname === path) return;
    haptic?.impactOccurred?.("light");
    navigate(path);
  };

  return (
    <nav
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: "max(12px, env(safe-area-inset-bottom))",
        display: "flex",
        padding: 6,
        gap: 4,
        background: "var(--fab-bg)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderRadius: 26,
        boxShadow: "var(--shadow-fab)",
        border: "1px solid var(--separator)",
        zIndex: 100,
      }}
    >
      {tabs.map(({ path, label, Icon }) => {
        const selected = location.pathname === path;
        return (
          <button
            key={path}
            type="button"
            onClick={() => onClick(path)}
            style={{
              all: "unset",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "8px 4px",
              borderRadius: 20,
              cursor: "pointer",
              background: selected ? "var(--accent)" : "transparent",
              color: selected ? "var(--accent-tx)" : "var(--hint)",
              transition: "background 0.22s ease, color 0.22s ease",
            }}
          >
            <Icon size={22} strokeWidth={selected ? 2.25 : 1.9} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
