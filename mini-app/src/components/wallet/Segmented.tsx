import { useTelegram } from "@/hooks/useTelegram";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const { haptic } = useTelegram();
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        background: "var(--bg)",
        borderRadius: 12,
        margin: "0 16px 16px",
      }}
    >
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              if (!active) haptic?.selectionChanged?.();
              onChange(opt.value);
            }}
            style={{
              all: "unset",
              flex: 1,
              textAlign: "center",
              padding: "8px 6px",
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 9,
              cursor: "pointer",
              color: active ? "var(--accent-tx)" : "var(--text)",
              background: active ? "var(--accent)" : "transparent",
              transition: "background 0.18s ease, color 0.18s ease",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
