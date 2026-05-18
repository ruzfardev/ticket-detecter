import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, List, Section, Spinner } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";

import { getMe, updateLang } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";

const LANGS = [
  { code: "uz", flag: "🇺🇿", label: "O'zbekcha" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

export function Settings() {
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
            before={l.flag}
            after={me.data?.user.lang === l.code ? "✓" : null}
            onClick={() => mutateLang.mutate(l.code)}
          >
            {l.label}
          </Cell>
        ))}
      </Section>

      <Section header="Aloqa">
        <Cell before="📞" onClick={() => openLink("https://t.me/TicketDetectorSupport")}>
          Support
        </Cell>
        <Cell before="📢" onClick={() => openLink("https://t.me/TicketTips")}>
          Yangiliklar kanali
        </Cell>
      </Section>

      <Section footer="v0.1.0">
        <Cell subtitle={me.data?.user.tg_user_id?.toString()}>
          Foydalanuvchi ID
        </Cell>
      </Section>
    </List>
  );
}
