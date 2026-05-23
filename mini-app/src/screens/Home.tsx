import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Placeholder, Spinner } from "@telegram-apps/telegram-ui";
import {
  Plus, Sparkles, Heart, TrainFront, CalendarDays, Activity, Wallet, Pause,
} from "lucide-react";

import { getMe, listSubscriptions } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { WalletHeader } from "@/components/wallet/WalletHeader";
import { QuickActions } from "@/components/wallet/QuickActions";
import { FeatureCard } from "@/components/wallet/FeatureCard";
import { WalletSection } from "@/components/wallet/WalletSection";
import { WalletRow } from "@/components/wallet/WalletRow";

export function Home() {
  const navigate = useNavigate();
  const tg = useTelegram();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });

  if (me.isLoading || subs.isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
        <Spinner size="l" />
      </div>
    );
  }

  const used = me.data?.slot.used ?? 0;
  const max = me.data?.slot.max ?? 0;
  const slotFull = used >= max;
  const isFree = me.data?.user.tier === "free";
  const isPremium = me.data?.user.tier === "premium";
  const premiumUntil = me.data?.user.premium_until?.slice(0, 10);
  const list = subs.data?.subscriptions ?? [];

  const handleNew = () => {
    if (slotFull && isFree) navigate("/premium");
    else navigate("/new");
  };

  const iconCircle = (Icon: typeof Wallet) => (
    <span
      style={{
        width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "var(--accent-soft)", color: "var(--accent)",
      }}
    >
      <Icon size={20} strokeWidth={2} />
    </span>
  );

  return (
    <div style={{ padding: "4px 12px", overflowX: "hidden" }}>
      <div className="w-rise">
        <WalletHeader user={tg.user} premium={isPremium} />
      </div>

      <div className="w-rise" style={{ animationDelay: "0.04s" }}>
        <QuickActions
          items={[
            { id: "new", label: slotFull && isFree ? "Premium" : "Yangi", Icon: Plus, onClick: handleNew },
            { id: "premium", label: "Premium", Icon: Sparkles, onClick: () => navigate("/premium") },
            { id: "history", label: "Tarix", Icon: Activity, onClick: () => navigate("/history") },
            { id: "donate", label: "Donat", Icon: Heart, onClick: () => navigate("/donate") },
          ]}
        />
      </div>

      <div className="w-rise" style={{ animationDelay: "0.08s" }}>
        <FeatureCard
          before={
            <span
              style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "var(--accent)", color: "var(--accent-tx)",
              }}
            >
              <Wallet size={22} strokeWidth={2} />
            </span>
          }
          title="Kuzatuvlar"
          subtitle={
            isPremium
              ? premiumUntil ? `Premium · ${premiumUntil} gacha` : "Premium tarif"
              : "Free tarif"
          }
          value={`${used}/${max}`}
        />
      </div>

      <div className="w-rise" style={{ animationDelay: "0.12s" }}>
        <WalletSection
          header="Aktiv kuzatuvlar"
          headerRight={
            <span
              style={{
                fontSize: 12, fontWeight: 700, color: "var(--accent)",
                background: "var(--accent-soft)", padding: "3px 9px", borderRadius: 999,
              }}
            >
              {used}/{max}
            </span>
          }
        >
          {list.length === 0 ? (
            <Placeholder header="Hozircha kuzatuv yo'q" description="“Yangi” tugmasi orqali boshlang." />
          ) : (
            list.map(s => (
              <WalletRow
                key={s.id}
                before={iconCircle(s.is_active ? TrainFront : Pause)}
                title={`${s.dep_name} → ${s.arr_name}`}
                subtitle={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <CalendarDays size={13} strokeWidth={2} />
                    {s.travel_date} · {s.train_number || "har qanday"}
                  </span>
                }
                after={
                  <span
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
                      color: s.is_active ? "var(--accent)" : "var(--hint)",
                      background: s.is_active ? "var(--accent-soft)" : "var(--bg)",
                    }}
                  >
                    {s.is_active ? "Aktiv" : "Pauza"}
                  </span>
                }
                chevron
                onClick={() => navigate(`/sub/${s.id}`)}
              />
            ))
          )}
        </WalletSection>
      </div>

      {isFree && (
        <div className="w-rise" style={{ animationDelay: "0.16s" }}>
          <WalletSection>
            <WalletRow
              before={iconCircle(Sparkles)}
              title="Premium oling"
              subtitle="3 ta slot + har 10s tekshirish"
              chevron
              onClick={() => navigate("/premium")}
            />
          </WalletSection>
        </div>
      )}
    </div>
  );
}
