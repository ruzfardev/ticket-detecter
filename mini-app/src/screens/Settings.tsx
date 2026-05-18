import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check, MessageCircle, Megaphone, Heart, User,
} from "lucide-react";

import { getMe, updateLang } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { ListGroup, ListRow } from "@/components/ui/list";

// Flag emojis are content (language identity), not chrome.
const LANGS = [
  { code: "uz", flag: "🇺🇿", label: "O'zbekcha" },
  { code: "ru", flag: "🇷🇺", label: "Русский" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

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
  const userId = me.data.user.tg_user_id?.toString();

  return (
    <Screen tabbed padded title="Sozlamalar">
      <ListGroup label="Til">
        {LANGS.map(l => (
          <ListRow
            key={l.code}
            before={<span className="text-[22px] leading-none">{l.flag}</span>}
            title={l.label}
            after={
              currentLang === l.code ? (
                <Check className="h-5 w-5 text-coral" strokeWidth={2} />
              ) : null
            }
            onClick={() => mutateLang.mutate(l.code)}
          />
        ))}
      </ListGroup>

      <ListGroup label="Aloqa">
        <ListRow
          before={<MessageCircle className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title="Support"
          onClick={() => openLink("https://t.me/TicketDetectorSupport")}
        />
        <ListRow
          before={<Megaphone className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title="Yangiliklar kanali"
          onClick={() => openLink("https://t.me/TicketTips")}
        />
      </ListGroup>

      <ListGroup label="Boshqa">
        <ListRow
          before={<Heart className="h-5 w-5 text-coral" strokeWidth={1.75} />}
          title="Loyihani qo'llab-quvvatlash"
          subtitle="Telegram Stars orqali"
          onClick={() => navigate("/donate")}
          chevron
        />
      </ListGroup>

      <ListGroup footer="v0.1.0">
        <ListRow
          before={<User className="h-5 w-5 text-muted" strokeWidth={1.75} />}
          title="Foydalanuvchi ID"
          subtitle={userId}
        />
      </ListGroup>
    </Screen>
  );
}
