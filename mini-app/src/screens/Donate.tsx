import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import { Coffee, Cookie, Cake, Gift, Heart, Pencil } from "lucide-react";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { PageHeader } from "@/components/wallet/PageHeader";
import { WalletSection } from "@/components/wallet/WalletSection";
import { WalletRow } from "@/components/wallet/WalletRow";

const PLAN_ICONS: Record<string, any> = {
  donate_25: Coffee,
  donate_50: Cookie,
  donate_100: Cake,
  donate_500: Gift,
};

const dot = (Icon: any) => (
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

export function Donate() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  const [customOpen, setCustomOpen] = useState(false);
  const [amount, setAmount] = useState(50);

  const donate = async (planId: string, amt?: number) => {
    try {
      const inv = await getInvoice(planId, amt);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Katta rahmat! ❤️");
          setCustomOpen(false);
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  };

  const range = plans.data?.donate_custom_range;

  return (
    <div style={{ overflowX: "hidden" }}>
      <PageHeader title="Qo'llab-quvvatlash" />

      <div style={{ padding: "4px 12px 24px" }}>
        {plans.isLoading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
            <Spinner size="l" />
          </div>
        ) : (
          <>
            <div
              className="w-rise"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                textAlign: "center", padding: "12px 16px 24px",
              }}
            >
              <span
                style={{
                  width: 72, height: 72, borderRadius: "50%", marginBottom: 14,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "var(--accent-soft)", color: "var(--accent)",
                }}
              >
                <Heart size={34} strokeWidth={1.75} fill="currentColor" />
              </span>
              <div style={{ fontSize: 19, fontWeight: 800, color: "var(--text)" }}>
                Botni qo'llab-quvvatlang
              </div>
              <div style={{ fontSize: 14, color: "var(--hint)", marginTop: 4, maxWidth: 280 }}>
                Premium bermaydi — bu faqat loyihaning rivojiga yordam.
              </div>
            </div>

            <div className="w-rise" style={{ animationDelay: "0.05s" }}>
              <WalletSection>
                {plans.data?.donate.map(d => (
                  <WalletRow
                    key={d.id}
                    before={dot(PLAN_ICONS[d.id] ?? Gift)}
                    title={d.label}
                    after={<b style={{ fontVariantNumeric: "tabular-nums" }}>{d.stars} ⭐</b>}
                    onClick={() => donate(d.id)}
                  />
                ))}
                <WalletRow
                  before={dot(Pencil)}
                  title="Boshqa miqdor"
                  chevron
                  onClick={() => setCustomOpen(true)}
                />
              </WalletSection>
            </div>
          </>
        )}
      </div>

      {/* custom amount sheet */}
      {customOpen && (
        <div
          onClick={() => setCustomOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)",
            display: "flex", flexDirection: "column", justifyContent: "flex-end",
            animation: "w-fade-in 0.2s ease",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--card)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: "8px 16px 24px", animation: "w-sheet-in 0.28s cubic-bezier(0.22,1,0.36,1)",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", paddingBottom: 12 }}>
              <div style={{ width: 36, height: 5, borderRadius: 3, background: "var(--separator)" }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>Miqdorni tanlang</div>
            <div style={{ fontSize: 13.5, color: "var(--hint)", margin: "4px 0 16px" }}>
              Diapazon: {range?.min}–{range?.max} ⭐
            </div>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8, background: "var(--bg)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 16,
              }}
            >
              <input
                type="number"
                value={amount}
                min={range?.min}
                max={range?.max}
                onChange={e => setAmount(+e.target.value)}
                style={{ all: "unset", flex: 1, fontSize: 18, fontWeight: 600, color: "var(--text)" }}
              />
              <span style={{ fontSize: 18 }}>⭐</span>
            </div>
            <StickyButtonInline onClick={() => donate("donate_custom", amount)}>
              {amount} ⭐ bilan rahmat aytish
            </StickyButtonInline>
          </div>
        </div>
      )}
    </div>
  );
}

function StickyButtonInline({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className="w-press"
      onClick={onClick}
      style={{
        all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center",
        justifyContent: "center", width: "100%", height: 50, borderRadius: 14,
        fontSize: 16, fontWeight: 700, cursor: "pointer",
        background: "var(--accent)", color: "var(--accent-tx)",
      }}
    >
      {children}
    </button>
  );
}
