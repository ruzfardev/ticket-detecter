import { ReactNode } from "react";
import { Check } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";

type Props = {
  label: ReactNode;
  selected: boolean;
  onClick: () => void;
};

export function Chip({ label, selected, onClick }: Props) {
  const { haptic } = useTelegram();
  return (
    <button
      type="button"
      onClick={() => {
        haptic?.selectionChanged?.();
        onClick();
      }}
      style={{
        all: "unset",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        color: selected ? "var(--accent-tx)" : "var(--text)",
        background: selected ? "var(--accent)" : "var(--bg)",
        border: selected ? "1px solid var(--accent)" : "1px solid var(--separator)",
        transition: "background 0.16s ease, color 0.16s ease, border-color 0.16s ease",
      }}
    >
      {selected && <Check size={15} strokeWidth={2.5} />}
      {label}
    </button>
  );
}
