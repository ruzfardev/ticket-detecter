import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTelegram } from "@/hooks/useTelegram";

type Props = {
  /** Selected date as YYYY-MM-DD. */
  value?: string;
  onChange: (iso: string) => void;
  /** Inclusive range. Defaults: today .. today+60d. */
  minDate?: Date;
  maxDate?: Date;
};

const DOW = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]; // Mon-first
const MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function Calendar({ value, onChange, minDate, maxDate }: Props) {
  const { haptic } = useTelegram();
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(minDate) : today;
  const max = maxDate ? startOfDay(maxDate) : startOfDay(new Date(Date.now() + 60 * 864e5));

  const selected = value ? startOfDay(new Date(value)) : undefined;
  const [view, setView] = useState<Date>(
    new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1),
  );

  const year = view.getFullYear();
  const month = view.getMonth();

  // Mon-first offset: JS getDay() => 0=Sun..6=Sat
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const canPrev = new Date(year, month, 1) > new Date(min.getFullYear(), min.getMonth(), 1);
  const canNext = new Date(year, month, 1) < new Date(max.getFullYear(), max.getMonth(), 1);

  const shift = (delta: number) => {
    haptic?.selectionChanged?.();
    setView(new Date(year, month + delta, 1));
  };

  const navBtn = (dir: "prev" | "next", enabled: boolean) => (
    <button
      type="button"
      className="w-press"
      disabled={!enabled}
      onClick={() => shift(dir === "prev" ? -1 : 1)}
      style={{
        all: "unset",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: "50%",
        cursor: enabled ? "pointer" : "default",
        color: enabled ? "var(--accent)" : "var(--hint)",
        opacity: enabled ? 1 : 0.35,
      }}
    >
      {dir === "prev"
        ? <ChevronLeft size={22} strokeWidth={2.25} />
        : <ChevronRight size={22} strokeWidth={2.25} />}
    </button>
  );

  return (
    <div style={{ padding: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        {navBtn("prev", canPrev)}
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
          {MONTHS[month]} {year}
        </div>
        {navBtn("next", canNext)}
      </div>

      <div className="cal-grid" style={{ marginBottom: 4 }}>
        {DOW.map(d => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const iso = ymd(d);
          const disabled = d < min || d > max;
          const isSel = selected && ymd(selected) === iso;
          const isToday = ymd(today) === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              className={[
                "cal-cell",
                isSel ? "cal-selected" : "",
                isToday ? "cal-today" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => {
                haptic?.selectionChanged?.();
                onChange(iso);
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
