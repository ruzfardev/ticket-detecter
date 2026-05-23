import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

/** Sticky bottom CTA — replaces the native Telegram MainButton so we
 *  control styling and lifecycle (the native button leaked across pages). */
export function StickyButton({ children, onClick, disabled, loading }: Props) {
  const off = disabled || loading;
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 16px max(16px, env(safe-area-inset-bottom))",
        background:
          "linear-gradient(to top, var(--bg) 60%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={off}
        className="w-press"
        style={{
          all: "unset",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          height: 50,
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 700,
          cursor: off ? "not-allowed" : "pointer",
          background: off ? "var(--separator)" : "var(--accent)",
          color: off ? "var(--hint)" : "var(--accent-tx)",
          opacity: off && !loading ? 0.7 : 1,
          transition: "background 0.18s ease, opacity 0.18s ease",
        }}
      >
        {loading ? (
          <span
            style={{
              width: 18,
              height: 18,
              border: "2.5px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "w-spin 0.7s linear infinite",
              display: "inline-block",
            }}
          />
        ) : (
          children
        )}
      </button>
    </div>
  );
}
