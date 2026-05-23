import { ReactNode } from "react";

type Props = {
  header?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
};

export function WalletSection({ header, headerRight, footer, children, style }: Props) {
  return (
    <div style={{ marginBottom: "var(--gap)", ...style }}>
      {(header || headerRight) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 6px 8px",
            minHeight: 22,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.2,
              textTransform: "uppercase",
              color: "var(--hint)",
            }}
          >
            {header}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
          boxShadow: "var(--shadow)",
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            padding: "8px 6px 0",
            fontSize: 12.5,
            lineHeight: 1.4,
            color: "var(--hint)",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
