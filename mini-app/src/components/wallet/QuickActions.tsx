import { LucideIcon } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";

export type QuickAction = {
  id: string;
  label: string;
  Icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  items: QuickAction[];
};

/** Wallet-style quick actions: monochrome icons on plain cards. */
export function QuickActions({ items }: Props) {
  const { haptic } = useTelegram();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        gap: 8,
        marginBottom: "var(--gap)",
      }}
    >
      {items.map(({ id, label, Icon, onClick, disabled }) => (
        <button
          key={id}
          type="button"
          className="w-press"
          disabled={disabled}
          onClick={() => {
            haptic?.impactOccurred?.("light");
            onClick();
          }}
          style={{
            all: "unset",
            boxSizing: "border-box",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "14px 4px",
            background: "var(--card)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
            textAlign: "center",
          }}
        >
          <Icon size={25} strokeWidth={1.9} color="var(--text)" />
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text)",
              lineHeight: 1.15,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
