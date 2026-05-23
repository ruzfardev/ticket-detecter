import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import { Check, MessageCircle, Megaphone, Heart } from "lucide-react";

import { getMe, updateLang } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { UserAvatar } from "@/components/wallet/UserAvatar";
import { WalletSection } from "@/components/wallet/WalletSection";
import { WalletRow } from "@/components/wallet/WalletRow";

const LANGS = [
  { code: "uz", flag: "🇺🇿", label: "O'zbekcha" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

const dot = (Icon: any) => (
  <span
    style={{
      width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: "var(--accent-soft)", color: "var(--accent)",
    }}
  >
    <Icon size={19} strokeWidth={2} />
  </span>
);

export function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openLink, user: tgUser } = useTelegram();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const mutateLang = useMutation({
    mutationFn: (lang: string) => updateLang(lang),
    onSuccess: () => {
      toast.success("Saqlandi");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (me.isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 60 }}>
        <Spinner size="l" />
      </div>
    );
  }

  const isPremium = me.data?.user.tier === "premium";
  const premiumUntil = me.data?.user.premium_until?.slice(0, 10);
  const fullName = [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") || "Foydalanuvchi";

  return (
    <div style={{ padding: "12px 12px", overflowX: "hidden" }}>
      {/* profile */}
      <div className="w-rise">
        <WalletSection>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px" }}>
            <UserAvatar user={tgUser} size={60} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 18, fontWeight: 700, color: "var(--text)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {fullName}
              </div>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap",
                }}
              >
                {tgUser?.username && (
                  <span style={{ fontSize: 13.5, color: "var(--hint)" }}>@{tgUser.username}</span>
                )}
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                    background: isPremium ? "var(--accent)" : "var(--bg)",
                    color: isPremium ? "var(--accent-tx)" : "var(--hint)",
                  }}
                >
                  {isPremium ? `Premium${premiumUntil ? ` · ${premiumUntil}` : ""}` : "Free"}
                </span>
              </div>
            </div>
          </div>
        </WalletSection>
      </div>

      {/* language */}
      <div className="w-rise" style={{ animationDelay: "0.05s" }}>
        <WalletSection header="Til">
          {LANGS.map(l => (
            <WalletRow
              key={l.code}
              before={<span style={{ fontSize: 26, width: 38, textAlign: "center" }}>{l.flag}</span>}
              title={l.label}
              after={
                me.data?.user.lang === l.code
                  ? <Check size={20} strokeWidth={2.5} color="var(--accent)" />
                  : null
              }
              onClick={() => mutateLang.mutate(l.code)}
            />
          ))}
        </WalletSection>
      </div>

      {/* contact */}
      <div className="w-rise" style={{ animationDelay: "0.1s" }}>
        <WalletSection header="Aloqa" footer={`Foydalanuvchi ID: ${me.data?.user.tg_user_id} · v0.1.0`}>
          <WalletRow
            before={dot(MessageCircle)}
            title="Support"
            chevron
            onClick={() => openLink("https://t.me/TicketDetectorSupport")}
          />
          <WalletRow
            before={dot(Megaphone)}
            title="Yangiliklar kanali"
            chevron
            onClick={() => openLink("https://t.me/TicketTips")}
          />
          <WalletRow
            before={dot(Heart)}
            title="Donate"
            chevron
            onClick={() => navigate("/donate")}
          />
        </WalletSection>
      </div>
    </div>
  );
}
