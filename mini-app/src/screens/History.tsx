import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@telegram-apps/telegram-ui";
import { Bell, CalendarDays, BellOff } from "lucide-react";

import { listSubscriptions } from "@/api/client";
import { PageHeader } from "@/components/wallet/PageHeader";
import { WalletSection } from "@/components/wallet/WalletSection";
import { WalletRow } from "@/components/wallet/WalletRow";

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "hozir";
  if (min < 60) return `${min} min oldin`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} soat oldin`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} kun oldin`;
  return d.toISOString().slice(0, 10);
}

export function History() {
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });

  const items = (subs.data?.subscriptions ?? []).filter(s => s.notif_count > 0);

  return (
    <div style={{ overflowX: "hidden" }}>
      <PageHeader title="Bildirishnoma tarixi" />
      <div style={{ padding: "4px 12px 24px" }}>
        {subs.isLoading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
            <Spinner size="l" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="w-rise">
            <WalletSection header={`${items.length} ta kuzatuv xabar yuborgan`}>
              {items.map(s => (
                <WalletRow
                  key={s.id}
                  before={
                    <span
                      style={{
                        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: "var(--accent-soft)", color: "var(--accent)",
                      }}
                    >
                      <Bell size={20} strokeWidth={2} />
                    </span>
                  }
                  title={`${s.dep_name} → ${s.arr_name}`}
                  subtitle={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <CalendarDays size={13} strokeWidth={2} />
                      {s.travel_date} · oxirgi: {formatRelative(s.last_notified_at)}
                    </span>
                  }
                  after={
                    <span
                      style={{
                        fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                        color: "var(--accent)", background: "var(--accent-soft)",
                        padding: "3px 9px", borderRadius: 999,
                      }}
                    >
                      {s.notif_count}
                    </span>
                  }
                />
              ))}
            </WalletSection>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="w-rise"
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "64px 24px", color: "var(--hint)",
      }}
    >
      <span
        style={{
          width: 72, height: 72, borderRadius: "50%", marginBottom: 16,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "var(--accent-soft)", color: "var(--accent)",
        }}
      >
        <BellOff size={32} strokeWidth={1.75} />
      </span>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
        Hozircha bildirishnoma yo'q
      </div>
      <div style={{ fontSize: 14, maxWidth: 260 }}>
        Kuzatuvlaringizdan birortasi joy topib xabar yuborganda, bu yerda ko'rinadi.
      </div>
    </div>
  );
}
