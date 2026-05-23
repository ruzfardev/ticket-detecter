import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  before?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  after?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export function WalletRow({
  before, title, subtitle, after, chevron, onClick, disabled,
}: Props) {
  const interactive = !!onClick && !disabled;
  const Tag: any = interactive ? "button" : "div";
  return (
    <Tag
      className={interactive ? "w-row w-press" : "w-row"}
      onClick={interactive ? onClick : undefined}
      disabled={interactive ? false : undefined}
      style={{
        all: interactive ? "unset" : undefined,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 16px",
        minHeight: 56,
        cursor: interactive ? "pointer" : "default",
        color: "var(--text)",
      }}
    >
      {before && <div style={{ flexShrink: 0, display: "flex" }}>{before}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        {subtitle != null && (
          <div
            style={{
              fontSize: 13.5,
              color: "var(--hint)",
              marginTop: 2,
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {after != null && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
          {after}
        </div>
      )}
      {chevron && (
        <ChevronRight size={18} strokeWidth={2} color="var(--hint)" style={{ flexShrink: 0 }} />
      )}
    </Tag>
  );
}
