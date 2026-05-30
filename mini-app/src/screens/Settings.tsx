import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle, Megaphone, Heart, Monitor, Sun, Moon,
  Train, LinkIcon, Users, Unlink,
} from "lucide-react";

import { getRailwayStatus, unlinkRailway } from "@/api/client";
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
  const qc = useQueryClient();
  const { openLink, haptic, showConfirm } = useTelegram();
  const mode = useTheme(s => s.mode);
  const setMode = useTheme(s => s.setMode);

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const unlink = useMutation({
    mutationFn: unlinkRailway,
    onSuccess: () => {
      toast.success("Akkount uzildi");
      qc.invalidateQueries({ queryKey: ["railwayAccount"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["subs"] });
    },
    onError: () => toast.error("Uzishda xato"),
  });

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

      <ListGroup
        label="Railway akkauntim"
        footer={
          accountQ.data?.link_status === "login_failed"
            ? "Parol o'zgargan ko'rinadi — qaytadan ulang"
            : accountQ.data?.last_sync_at
              ? `Oxirgi yangilash: ${new Date(accountQ.data.last_sync_at).toLocaleString()}`
              : undefined
        }
      >
        {!accountQ.data?.linked ? (
          <ListRow
            before={<Train className="h-5 w-5 text-coral" strokeWidth={1.75} />}
            title="eticket.railway.uz'ni ulash"
            subtitle="Hamrohlar va auto-buy uchun"
            onClick={() => navigate("/railway-link")}
            chevron
          />
        ) : (
          <>
            <ListRow
              before={<LinkIcon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
              title={accountQ.data.masked_username ?? "Ulangan"}
              subtitle="eticket akkounti"
            />
            <ListRow
              before={<Users className="h-5 w-5 text-ink" strokeWidth={1.75} />}
              title="Hamrohlarim"
              onClick={() => navigate("/friends")}
              chevron
            />
            <ListRow
              before={<Unlink className="h-5 w-5 text-error" strokeWidth={1.75} />}
              title="Ulashni bekor qilish"
              destructive
              disabled={unlink.isPending}
              onClick={async () => {
                if (await showConfirm("Akkountni uzishni xohlaysizmi? Auto-buy o'chiriladi.")) {
                  unlink.mutate();
                }
              }}
            />
          </>
        )}
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
