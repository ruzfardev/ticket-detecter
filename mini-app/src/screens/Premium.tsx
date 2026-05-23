import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import { Gauge, Layers, Zap, Sparkles, Check } from "lucide-react";

import { getInvoice, getMe, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { WalletSection } from "@/components/wallet/WalletSection";
import { WalletRow } from "@/components/wallet/WalletRow";

const BENEFITS = [
  { Icon: Gauge, text: "Har 10 sekundda tekshirish", sub: "Oddiy: 30 sekund" },
  { Icon: Layers, text: "3 ta aktiv kuzatuv", sub: "Oddiy: 1 ta" },
  { Icon: Zap, text: "3 baravar tezroq topish", sub: "Bo'sh joyni birinchi bo'lib ushlang" },
];

export function Premium() {
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();

  const buy = async (planId: string) => {
    try {
      const inv = await getInvoice(planId);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Premium aktivlashtirildi ✨");
          me.refetch();
        } else if (status === "failed" || status === "cancelled") {
          toast.error("To'lov bekor qilindi");
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  };

  if (me.isLoading || plans.isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
        <Spinner size="l" />
      </div>
    );
  }

  const isPremium = me.data?.user.tier === "premium";
  const until = me.data?.user.premium_until?.slice(0, 10);

  return (
    <div style={{ padding: "12px 12px", overflowX: "hidden" }}>
      {/* hero */}
      <div
        className="w-rise"
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          padding: "16px 16px 24px",
        }}
      >
        <span
          style={{
            width: 76, height: 76, borderRadius: 22, marginBottom: 14,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--accent)", color: "var(--accent-tx)",
            boxShadow: "var(--shadow-fab)",
          }}
        >
          <Sparkles size={36} strokeWidth={1.9} />
        </span>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>Premium</div>
        <div style={{ fontSize: 14.5, color: "var(--hint)", marginTop: 4 }}>
          {isPremium ? `Aktiv · ${until} gacha` : "Tezroq toping, ko'proq kuzating"}
        </div>
      </div>

      <div className="w-rise" style={{ animationDelay: "0.05s" }}>
        <WalletSection header="Afzalliklari">
          {BENEFITS.map(b => (
            <WalletRow
              key={b.text}
              before={
                <span
                  style={{
                    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: "var(--accent-soft)", color: "var(--accent)",
                  }}
                >
                  <b.Icon size={19} strokeWidth={2} />
                </span>
              }
              title={b.text}
              subtitle={b.sub}
            />
          ))}
        </WalletSection>
      </div>

      <div className="w-rise" style={{ animationDelay: "0.1s" }}>
        <WalletSection header="Tarif tanlang">
          {plans.data?.premium.map(p => (
            <WalletRow
              key={p.id}
              before={
                p.badge ? (
                  <span
                    style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: "var(--accent)", color: "var(--accent-tx)",
                    }}
                  >
                    💎
                  </span>
                ) : (
                  <span
                    style={{
                      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700,
                    }}
                  >
                    {p.days}
                  </span>
                )
              }
              title={`${p.days} kun`}
              subtitle={p.badge ? "Eng tejamli" : `${(p.stars / p.days).toFixed(1)} ⭐/kun`}
              after={<b style={{ fontVariantNumeric: "tabular-nums" }}>{p.stars} ⭐</b>}
              onClick={() => buy(p.id)}
            />
          ))}
        </WalletSection>
      </div>

      {isPremium && (
        <div
          className="w-rise"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "8px 0 4px", color: "var(--accent)", fontSize: 14, fontWeight: 600,
          }}
        >
          <Check size={16} strokeWidth={2.5} /> Premium aktiv
        </div>
      )}
    </div>
  );
}
