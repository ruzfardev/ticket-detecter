import { useNavigate } from "react-router-dom";
import { MessageCircle, Megaphone, Heart, Monitor, Sun, Moon } from "lucide-react";

import { useTelegram } from "@/hooks/useTelegram";
import { useTheme, type ThemeMode } from "@/store/theme";
import { Screen } from "@/components/Screen";
import { ListGroup, ListRow } from "@/components/ui/list";
import { cn } from "@/lib/utils";

const THEME_OPTS: { value: ThemeMode; label: string; Icon: typeof Monitor }[] = [
  { value: "system", label: "Tizim", Icon: Monitor },
  { value: "light", label: "Yorug'", Icon: Sun },
  { value: "dark", label: "Tungi", Icon: Moon },
];

export function Settings() {
  const navigate = useNavigate();
  const { openLink, haptic } = useTelegram();
  const mode = useTheme(s => s.mode);
  const setMode = useTheme(s => s.setMode);

  return (
    <Screen tabbed padded title="Sozlamalar">
      <div className="space-y-2">
        <div className="px-4 text-caption-upper uppercase text-muted">Ko'rinish</div>
        <div className="flex gap-1 rounded-lg bg-surface-card p-1">
          {THEME_OPTS.map(({ value, label, Icon }) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  haptic?.selectionChanged?.();
                  setMode(value);
                }}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-md py-2.5 text-caption transition-colors",
                  active ? "bg-canvas text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Icon
                  width={18}
                  height={18}
                  strokeWidth={1.75}
                  className={active ? "text-coral" : ""}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

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

      <ListGroup label="Boshqa" footer="v0.1.0">
        <ListRow
          before={<Heart className="h-5 w-5 text-coral" strokeWidth={1.75} />}
          title="Loyihani qo'llab-quvvatlash"
          subtitle="Telegram Stars orqali"
          onClick={() => navigate("/donate")}
          chevron
        />
      </ListGroup>
    </Screen>
  );
}
