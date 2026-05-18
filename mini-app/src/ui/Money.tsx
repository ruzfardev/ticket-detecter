type Props = {
  stars: number;
  bold?: boolean;
};

export function Money({ stars, bold = true }: Props) {
  const text = `${stars.toLocaleString()} ⭐`;
  const style = { fontVariantNumeric: "tabular-nums" as const };
  return bold ? <b style={style}>{text}</b> : <span style={style}>{text}</span>;
}
