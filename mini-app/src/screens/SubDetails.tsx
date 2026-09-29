import { useMemo, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, Armchair, ArrowDownToLine, ArrowUpDown, ArrowUpToLine, BellRing,
  CalendarDays, CalendarPlus, History, Pause, Play, TrainFront, Trash2, Zap,
  type LucideIcon,
} from "lucide-react";

import {
  deleteSubscription, listSubscriptions, patchSubscription,
} from "@/api/client";
import { carTypeLabels } from "@/lib/cartypes";
import { formatShortDate } from "@/lib/dates";
import { useHaptic } from "@/hooks/useHaptic";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { IconTile } from "@/components/ui/tile";

function berth(b: string): { icon: LucideIcon; text: string } {
  if (b === "lower") return { icon: ArrowDownToLine, text: "pastki" };
  if (b === "upper") return { icon: ArrowUpToLine, text: "tepa" };
  return { icon: ArrowUpDown, text: "har qanday" };
}

const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];

/** "2026-09-30" → "30 sentabr, chorshanba". A calendar date, so read in UTC. */
function travelDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${WEEKDAYS[d.getUTCDay()]}`;
}

/** A moment on the device clock, "29 sen, 12:37" — the year only when it is not this one. */
function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = formatShortDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${day}${year}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Let a long value run onto a second line rather than lose its end. */
function Wrap({ children }: { children: ReactNode }) {
  return <span className="line-clamp-2 whitespace-normal">{children}</span>;
}

/** Shaped like the screen it stands in for: the route, then the lists. */
function SubDetailsSkeleton() {
  return (
    <Screen padded nav reveal={false}>
      <div className="space-y-3 pt-1">
        <Skeleton className="h-[34px] w-4/5 rounded-[12px]" />
        <Skeleton className="h-[22px] w-20 rounded-full" />
      </div>
      <div className="space-y-px overflow-hidden rounded-[26px]">
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[66px] rounded-none" />)}
      </div>
      <Skeleton className="h-[66px] rounded-[26px]" />
    </Screen>
  );
}

export function SubDetails() {
  const { id } = useParams<{ id: string }>();
  const subId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showConfirm } = useTelegram();
  const haptic = useHaptic();

  const { data, isLoading } = useQuery({
    queryKey: ["subs"],
    queryFn: listSubscriptions,
  });
  const sub = useMemo(
    () => data?.subscriptions.find(s => s.id === subId),
    [data, subId],
  );

  const toggle = useMutation({
    mutationFn: () => patchSubscription(subId, { is_active: !sub?.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subs"] }),
    onError: (err: any) => {
      haptic.notify("error");
      const code = err.response?.data?.error?.code;
      if (code === "slot_limit_reached") {
        // Resuming can legitimately fail: a free account has one slot, so a
        // second active subscription is rejected. Without this the row just
        // dimmed and sprang back, which reads as a dead button.
        toast.error("Slot to'lgan — boshqa xabarnomani pauza qiling yoki Premium oling");
        return;
      }
      if (code === "not_found" || code === "forbidden") {
        toast.error("Xabarnoma topilmadi");
        qc.invalidateQueries({ queryKey: ["subs"] });
        return;
      }
      toast.error(err.response?.data?.error?.message || err.message || "Bajarilmadi");
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteSubscription(subId),
    onSuccess: () => {
      toast.success("O'chirildi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      navigate("/home", { replace: true });
    },
    onError: () => {
      haptic.notify("error");
      toast.error("O'chirib bo'lmadi");
    },
  });

  if (isLoading) return <SubDetailsSkeleton />;
  if (!sub) {
    return (
      <StatusView
        kind="empty"
        header="Topilmadi"
        description="Bu xabarnoma o'chirilgan yoki mavjud emas."
        action={
          <Button variant="secondary" onClick={() => navigate("/home")}>
            Bosh sahifaga
          </Button>
        }
      />
    );
  }

  const b = berth(sub.berth);
  const busy = toggle.isPending || remove.isPending;
  const route = `${sub.dep_name} → ${sub.arr_name}`;

  return (
    <Screen
      padded
      navTitle={route}
      // Set at 28pt whatever its length: a route is two names and an arrow,
      // and at 34pt even "Toshkent → Samarqand" breaks after the arrow.
      title={
        <span className="block text-display-lg">
          {sub.dep_name}
          <span className="text-muted-soft">{" →\u00A0"}</span>
          {sub.arr_name}
        </span>
      }
      subtitle={
        <Badge variant={sub.is_active ? "success" : "muted"}>
          {sub.is_active ? "Aktiv" : "Pauzada"}
        </Badge>
      }
    >
      <ListGroup label="Tafsilotlar">
        <ListRow
          before={<IconTile icon={CalendarDays} tone="blue" />}
          title={travelDay(sub.travel_date)}
          subtitle="Sana"
        />
        <ListRow
          before={<IconTile icon={TrainFront} tone="coral" />}
          title={<Wrap>{sub.train_numbers.length ? sub.train_numbers.join(", ") : "Har qanday"}</Wrap>}
          subtitle={sub.train_numbers.length > 1 ? `Poyezdlar · ${sub.train_numbers.length} ta` : "Poyezd"}
        />
        <ListRow
          before={<IconTile icon={Armchair} tone="teal" />}
          title={<Wrap>{carTypeLabels(sub.car_types) || "Barchasi"}</Wrap>}
          subtitle="Vagon turi"
        />
        <ListRow
          before={<IconTile icon={b.icon} tone="violet" />}
          title={<span className="block first-letter:uppercase">{b.text}</span>}
          subtitle="Joy turi"
        />
        <ListRow
          before={<IconTile icon={Activity} tone={sub.is_active ? "green" : "gray"} />}
          title={sub.is_active ? "Aktiv" : "Pauzada"}
          subtitle="Holat"
        />
      </ListGroup>

      <ListGroup
        label="Avto sotib olish"
        footer={
          sub.autobuy_enabled
            ? "Chipta topilganda avtomatik bron qilinadi — sizga faqat SMS kod kerak bo'ladi"
            : "Yoqilsa, chipta topilgan paytda avtomatik bron qilinadi"
        }
      >
        <ListRow
          before={<IconTile icon={Zap} tone={sub.autobuy_enabled ? "coral" : "gray"} />}
          // The badge rides with the title, so the passenger names under it
          // get the row's full width; the chevron keeps the trailing edge.
          title={
            sub.autobuy_enabled ? (
              <span className="flex items-center gap-2">
                Yoqilgan
                <Badge variant="coral">Faol</Badge>
              </span>
            ) : "O'chirilgan"
          }
          subtitle={
            <Wrap>
              {sub.autobuy_enabled
                ? sub.autobuy_friend_names?.length
                  ? `${sub.autobuy_friend_names.length} yo'lovchi: ${sub.autobuy_friend_names.join(", ")}${sub.autobuy_lap_child_names?.length ? ` · quchoqda: ${sub.autobuy_lap_child_names.join(", ")}` : ""}`
                  : sub.autobuy_friend_name
                    ? `Yo'lovchi: ${sub.autobuy_friend_name}`
                    : "Yo'lovchi tanlanmagan"
                : "Sozlash uchun bosing"}
            </Wrap>
          }
          onClick={() => navigate(`/sub/${subId}/autobuy`)}
          chevron
        />
      </ListGroup>

      <ListGroup label="Statistika">
        <ListRow
          before={<IconTile icon={CalendarPlus} tone="gray" />}
          title={<span className="tnum">{stamp(sub.created_at)}</span>}
          subtitle="Yaratilgan"
        />
        <ListRow
          before={<IconTile icon={BellRing} tone="pink" />}
          title={<span className="tnum">{sub.notif_count.toString()}</span>}
          subtitle="Yuborilgan xabarlar"
        />
        {sub.last_notified_at && (
          <ListRow
            before={<IconTile icon={History} tone="gray" />}
            title={<span className="tnum">{stamp(sub.last_notified_at)}</span>}
            subtitle="Oxirgi xabar"
          />
        )}
      </ListGroup>

      <ListGroup label="Boshqarish">
        <ListRow
          before={
            <IconTile
              icon={sub.is_active ? Pause : Play}
              tone={sub.is_active ? "amber" : "green"}
            />
          }
          title={sub.is_active ? "Pauza qilish" : "Davom ettirish"}
          after={toggle.isPending ? <Spinner size="sm" /> : undefined}
          disabled={busy}
          onClick={() => toggle.mutate()}
        />
        <ListRow
          before={<IconTile icon={Trash2} tone="red" />}
          title="O'chirish"
          destructive
          after={remove.isPending ? <Spinner size="sm" className="text-error" /> : undefined}
          disabled={busy}
          onClick={async () => {
            if (await showConfirm("O'chirishni xohlaysizmi?")) remove.mutate();
          }}
        />
      </ListGroup>
    </Screen>
  );
}
