import { CSSProperties, ReactNode } from "react";

type GapStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Props = {
  direction?: "row" | "column";
  gap?: GapStep;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
  inline?: boolean;
  children: ReactNode;
  className?: string;
};

export function Stack({
  direction = "row",
  gap = 2,
  align = "center",
  justify,
  wrap,
  inline,
  children,
  className,
}: Props) {
  const style: CSSProperties = {
    display: inline ? "inline-flex" : "flex",
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    flexWrap: wrap ? "wrap" : "nowrap",
    gap: `var(--sp-${gap})`,
  };
  return <div className={className} style={style}>{children}</div>;
}
