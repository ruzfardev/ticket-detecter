import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  before?: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
};

export function FeatureCard({ title, value, subtitle, before, onClick, style }: Props) {
  const interactive = !!onClick;
  const Tag: any = interactive ? "button" : "div";
  return (
    <Tag
      className={interactive ? "w-press" : undefined}
      onClick={onClick}
      style={{
        all: interactive ? "unset" : undefined,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        background: "var(--card)",
        borderRadius: "var(--radius)",
        padding: "16px 18px",
        marginBottom: "var(--gap)",
        boxShadow: "var(--shadow)",
        cursor: interactive ? "pointer" : "default",
        color: "var(--text)",
        ...style,
      }}
    >
      {before}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>{title}</div>
        {subtitle && (
          <div
            style={{
              fontSize: 13.5,
              color: "var(--hint)",
              marginTop: 3,
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
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {interactive && (
        <ChevronRight size={18} strokeWidth={2} color="var(--hint)" />
      )}
    </Tag>
  );
}
