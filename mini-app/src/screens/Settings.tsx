import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  Check, ChevronRight, MessageCircle, Megaphone, Heart, User,
} from "lucide-react";

import { getMe, updateLang } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";

// Flag emojis intentionally kept — they ARE the content (language identity).
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

  if (me.isLoading) return <Spinner size="l" />;

  return (
    <List>
      <Section header="Til">
        {LANGS.map(l => (
          <Cell
            key={l.code}
            before={<span style={{ fontSize: 22 }}>{l.flag}</span>}
            after={
              me.data?.user.lang === l.code
                ? <Check size={20} strokeWidth={2} color="var(--tg-theme-button-color)" />
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
          after={icon(ChevronRight)}
          onClick={() => openLink("https://t.me/TicketDetectorSupport")}
        >
          Support
        </Cell>
        <Cell
          before={icon(Megaphone)}
          after={icon(ChevronRight)}
          onClick={() => openLink("https://t.me/TicketTips")}
        >
          Yangiliklar kanali
        </Cell>
        <Cell
          before={icon(Heart)}
          after={icon(ChevronRight)}
          onClick={() => navigate("/donate")}
        >
          Donate
        </Cell>
      </Section>

      <Section footer="v0.1.0">
        <Cell
          before={icon(User)}
          subtitle={me.data?.user.tg_user_id?.toString()}
        >
          Foydalanuvchi ID
        </Cell>
      </Section>
    </List>
  );
}
