import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, X } from "lucide-react";
import { listStations, Station } from "@/api/client";

type Props = {
  open: boolean;
  title: string;
  /** Code to exclude (can't pick same station for both ends). */
  excludeCode?: string;
  onClose: () => void;
  onPick: (s: Station) => void;
};

export function StationSheet({ open, title, excludeCode, onClose, onPick }: Props) {
  const [q, setQ] = useState("");

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations", q],
    queryFn: () => listStations(q),
    staleTime: 30_000,
    enabled: open,
  });

  // Reset query text when reopened.
  useEffect(() => { if (open) setQ(""); }, [open]);

  if (!open) return null;

  const list = (stations ?? []).filter(s => s.code !== excludeCode).slice(0, 40);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        animation: "w-fade-in 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--card)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          animation: "w-sheet-in 0.28s cubic-bezier(0.22,1,0.36,1)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* grabber */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 36, height: 5, borderRadius: 3, background: "var(--separator)" }} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px 4px",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-press"
            style={{
              all: "unset", cursor: "pointer", display: "inline-flex",
              width: 32, height: 32, borderRadius: "50%",
              alignItems: "center", justifyContent: "center", color: "var(--hint)",
            }}
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        {/* search input */}
        <div style={{ padding: "8px 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--bg)",
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            <Search size={18} strokeWidth={2} color="var(--hint)" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Stantsiya nomi..."
              style={{
                all: "unset",
                flex: 1,
                fontSize: 16,
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        {/* results */}
        <div style={{ overflowY: "auto", flex: 1, paddingBottom: 8 }}>
          {isLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--hint)" }}>
              Yuklanmoqda…
            </div>
          ) : list.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--hint)" }}>
              Topilmadi
            </div>
          ) : (
            list.map(s => (
              <button
                key={s.code}
                type="button"
                className="w-row w-press"
                onClick={() => { onPick(s); onClose(); }}
                style={{
                  all: "unset",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  padding: "12px 16px",
                  cursor: "pointer",
                  color: "var(--text)",
                }}
              >
                <span
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: "var(--accent-soft)", color: "var(--accent)", flexShrink: 0,
                  }}
                >
                  <MapPin size={18} strokeWidth={2} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, fontWeight: 500 }}>{s.name}</span>
                  {s.city && (
                    <span style={{ display: "block", fontSize: 13, color: "var(--hint)" }}>
                      {s.city}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
