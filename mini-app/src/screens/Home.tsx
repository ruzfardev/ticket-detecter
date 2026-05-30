import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, Sparkles, Heart, Settings, Bell, TrainFront, CalendarDays, ChevronRight,
  Train, CheckCircle2, AlertCircle,
} from "lucide-react";

import { getMe, getRailwayStatus, listSubscriptions } from "@/api/client";
import { useWizard } from "@/store/wizard";
import { useHaptic } from "@/hooks/useHaptic";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";

/* ── Small building blocks (Wallet-style) ──────────────────────────── */

function Avatar({ url, name }: { url?: string; name: string }) {
  if (url) {
    return <img src={url} alt="" className="h-12 w-12 rounded-pill object-cover" />;
  }
  const initial = (name.trim()[0] ?? "T").toUpperCase();
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-coral/15 font-display text-title-lg text-coral">
      {initial}
    </div>
  );
}

type ActionProps = {
  Icon: typeof Plus;
  label: string;
  onClick: () => void;
  accent?: boolean;
};

/** A square quick-action tile — icon on top, label below (Wallet pattern). */
function QuickAction({ Icon, label, onClick, accent }: ActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-hairline bg-canvas py-3.5 transition-colors hover:bg-surface-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
    >
      <Icon
        width={22}
        height={22}
        strokeWidth={1.75}
        className={accent ? "text-coral" : "text-ink"}
      />
      <span className="text-caption text-body">{label}</span>
    </button>
  );
}

export function Home() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { user: tgUser } = useTelegram();
  const reset = useWizard(s => s.reset);
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });
  const railway = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });

  if (me.isLoading || subs.isLoading) return <StatusView kind="loading" />;
  if (!me.data || !subs.data) {
    return <StatusView kind="error" description="Ma'lumotni yuklab bo'lmadi." />;
  }

  const { slot, user } = me.data;
  const isFree = user.tier === "free";
  const slotFull = slot.used >= slot.max;
  const blocked = slotFull && isFree;
  const all = subs.data.subscriptions;
  const active = all.filter(s => s.is_active);
  const paused = all.filter(s => !s.is_active);

  const subRow = (s: (typeof all)[number]) => (
    <ListRow
      key={s.id}
      before={
        <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-canvas">
          <TrainFront className="text-ink" width={20} height={20} strokeWidth={1.75} />
        </div>
      }
      title={`${s.dep_name} → ${s.arr_name}`}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays width={14} height={14} strokeWidth={1.75} />
          {s.travel_date} · {s.train_numbers.length ? s.train_numbers.join(", ") : "har qanday"}
        </span>
      }
      after={
        <span
          className={`h-2 w-2 rounded-pill ${s.is_active ? "bg-coral" : "bg-muted-soft"}`}
          aria-hidden
        />
      }
      chevron
      onClick={() => navigate(`/sub/${s.id}`)}
    />
  );

  const name =
    [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") || "Mehmon";
  const handle = tgUser?.username ? `@${tgUser.username}` : "Xush kelibsiz";

  const go = (path: string) => () => { haptic.selection(); navigate(path); };

  const handleNew = () => {
    haptic.impact("light");
    if (blocked) {
      navigate("/premium");
      return;
    }
    reset();
    navigate("/new");
  };

  return (
    <Screen tabbed padded>
      {/* User header */}
      <header className="flex items-center gap-3">
        <Avatar url={tgUser?.photo_url} name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-display-sm text-ink">{name}</div>
          <div className="truncate text-caption text-muted">{handle}</div>
        </div>
        <Badge variant={isFree ? "outline" : "coral"}>
          {isFree ? "Free" : "Premium"}
        </Badge>
      </header>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        <QuickAction Icon={Plus}      label="Yangi"    accent onClick={handleNew} />
        <QuickAction Icon={Sparkles}  label="Premium"  onClick={go("/premium")} />
        <QuickAction Icon={Heart}     label="Donate"   onClick={go("/donate")} />
        <QuickAction Icon={Settings}  label="Sozlama"  onClick={go("/settings")} />
      </div>

      {/* Railway account link block */}
      {railway.data && !railway.data.linked && (
        <button
          type="button"
          onClick={go("/railway-link")}
          className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-canvas p-4 text-left transition-colors hover:bg-surface-soft active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-coral/12">
            <Train className="text-coral" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm text-ink">eticket akkauntni ulang</div>
            <div className="text-caption text-muted">
              Hamrohlar va auto-buy uchun
            </div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}

      {railway.data?.link_status === "login_failed" && (
        <button
          type="button"
          onClick={go("/railway-link")}
          className="flex w-full items-center gap-3 rounded-lg border border-error/40 bg-error/5 p-4 text-left transition-colors hover:bg-error/10 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-error/15">
            <AlertCircle className="text-error" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm text-ink">Parol eskirgan</div>
            <div className="text-caption text-muted">eticket akkauntni qayta ulang</div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}

      {railway.data?.linked && (
        <button
          type="button"
          onClick={go("/friends")}
          className="flex w-full items-center gap-3 rounded-lg bg-surface-card p-4 text-left transition-colors hover:bg-surface-soft active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-canvas">
            <CheckCircle2 className="text-coral" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-title-sm text-ink">eticket ulangan</div>
            <div className="truncate text-caption text-muted">
              {railway.data.masked_username ?? "Hamrohlarni ko'rish"}
            </div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}

      {/* Slot "balance" card */}
      <div className="flex items-center gap-3 rounded-lg bg-surface-card p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-canvas">
          <Bell width={22} height={22} className="text-coral" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-title-sm text-ink">Aktiv xabarnomalar</div>
          <div className="text-caption text-muted">{isFree ? "Free tarif" : "Premium tarif"}</div>
        </div>
        <div className="font-display text-display-sm tabular-nums text-ink">
          {slot.used}
          <span className="text-muted-soft">/{slot.max >= 999 ? "∞" : slot.max}</span>
        </div>
      </div>

      {/* Notifications */}
      {all.length === 0 ? (
        <Card variant="feature" pad="lg">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-canvas">
              <TrainFront className="text-ink" width={20} height={20} strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-display-sm text-ink">Hali xabarnoma yo'q</h3>
              <p className="text-body-md text-body">
                “Yangi” tugmasini bosing — joy paydo bo'lishi bilan Telegram orqali xabar yetadi.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <ListGroup label="Xabarnomalar">{active.map(subRow)}</ListGroup>
          )}
          {paused.length > 0 && (
            <ListGroup label="Pauzada">{paused.map(subRow)}</ListGroup>
          )}
        </>
      )}

      {/* Premium upsell (free only) */}
      {isFree && (
        <button
          type="button"
          onClick={go("/premium")}
          className="flex w-full items-center gap-3 rounded-lg border border-hairline bg-canvas p-4 text-left transition-colors hover:bg-surface-soft active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-coral/12">
            <Sparkles className="text-coral" width={20} height={20} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-title-sm text-ink">Premium oling</div>
            <div className="text-caption text-muted">3× tezroq tekshirish · 3 ta slot</div>
          </div>
          <ChevronRight className="shrink-0 text-muted-soft" width={20} height={20} strokeWidth={1.75} />
        </button>
      )}
    </Screen>
  );
}
