import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, List, Section } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  Check, MessageCircle, Megaphone, Heart, User,
} from "lucide-react";

import { getMe, updateLang } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { StatusView } from "@/ui";

// Flag emojis are content (language identity), not UI decoration.
const LANGS = [
  { code: "uz", flag: "🇺🇿", label: "O'zbekcha" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

const icon = (Icon: any) => <Icon size={20} strokeWidth={1.75} />;

export function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openLink } = useTelegram();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const mutateLang = useMutation({
    mutationFn: (lang: string) => updateLang(lang),
    onSuccess: () => {
      toast.success("Saqlandi");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (me.isLoading) return <StatusView kind="loading" />;
  if (!me.data) return <StatusView kind="error" />;

  const currentLang = me.data.user.lang;

  return (
    <List>
      <Section header="Til">
        {LANGS.map(l => (
          <Cell
            key={l.code}
            before={<span style={{ fontSize: 22, lineHeight: 1 }}>{l.flag}</span>}
            after={
              currentLang === l.code
                ? <Check size={20} strokeWidth={2} color="var(--tg-accent)" />
                : null
            }
            onClick={() => mutateLang.mutate(l.code)}
          >
            {l.label}
          </Cell>
        ))}
      </Section>

      <Section header="Aloqa">
        <Cell
          before={icon(MessageCircle)}
          onClick={() => openLink("https://t.me/TicketDetectorSupport")}
        >
          Support
        </Cell>
        <Cell
          before={icon(Megaphone)}
          onClick={() => openLink("https://t.me/TicketTips")}
        >
          Yangiliklar kanali
        </Cell>
      </Section>

      <Section header="Boshqa">
        <Cell
          before={icon(Heart)}
          onClick={() => navigate("/donate")}
        >
          Loyihani qo'llab-quvvatlash
        </Cell>
      </Section>

      <Section footer="v0.1.0">
        <Cell
          before={icon(User)}
          subtitle={me.data.user.tg_user_id?.toString()}
        >
          Foydalanuvchi ID
        </Cell>
      </Section>
    </List>
  );
}
