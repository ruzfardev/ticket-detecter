import { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  tabbed?: boolean;
  center?: boolean;
};

export function Screen({ children, tabbed, center }: Props) {
  const style: CSSProperties = {
    minHeight: "100vh",
    paddingBottom: tabbed
      ? `calc(var(--tabbar-h) + var(--safe-bottom))`
      : `var(--safe-bottom)`,
    ...(center
      ? {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }
      : null),
  };
  return <div style={style}>{children}</div>;
}
