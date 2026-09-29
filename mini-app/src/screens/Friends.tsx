import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Link2, RefreshCw, UserPlus, Users } from "lucide-react";

import { getFriends, getRailwayStatus, syncFriends, type Friend } from "@/api/client";
import { EmptyNote } from "@/components/EmptyNote";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { useTelegram } from "@/hooks/useTelegram";
import { cn } from "@/lib/utils";

function initials(f: Friend): string {
  const a = f.firstname?.trim().charAt(0) || "";
  const b = f.lastname?.trim().charAt(0) || "";
  return (a + b || "?").toUpperCase();
}

function formatBday(d: string): string {
  if (!d) return "";
  // yyyy-mm-dd → dd.mm.yyyy
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

/** A round monogram — a soft wash of the palette's primary, lit from above. */
function Monogram({ f }: { f: Friend }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 items-center justify-center rounded-full text-[15px] font-semibold text-coral-ink",
        "bg-[linear-gradient(160deg,hsl(var(--coral-bright)/0.3),hsl(var(--coral-bright)/0.1))]",
        "shadow-[inset_0_0_0_0.5px_hsl(var(--coral-bright)/0.34),inset_0_1px_0.5px_rgb(255_255_255/0.45)]",
      )}
    >
      {initials(f)}
    </span>
  );
}

// Rows carry a 40pt monogram, so the hairline starts at 16 + 40 + 14.
const ROW_INSET = 70;

/** The list while it loads: the same rows, blank. */
function RowsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <Skeleton className="ml-5 h-3.5 w-24 rounded-full" />
      <div className="surface overflow-hidden">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="relative flex items-center gap-3.5 px-4 py-3 after:absolute after:bottom-0 after:left-[70px] after:right-0 after:h-px after:bg-hairline-soft last:after:hidden"
          >
            <Skeleton className="size-10 shrink-0 rounded-full bg-ink/[0.07]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5 rounded-full bg-ink/[0.07]" />
              <Skeleton className="h-3 w-3/5 rounded-full bg-ink/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TITLE = "Hamrohlarim";
const SUBTITLE = "eticket.railway.uz ro'yxatingizdan";

export function Friends() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { openLink } = useTelegram();

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const friendsQ = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: accountQ.data?.linked === true,
  });

  const sync = useMutation({
    mutationFn: syncFriends,
    onSuccess: (friends) => {
      qc.setQueryData(["friends"], friends);
      qc.invalidateQueries({ queryKey: ["railwayAccount"] });
      toast.success(`Yangilandi · ${friends.length} ta hamroh`);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code;
      if (code === "friend_sync_throttled") {
        const wait = err?.response?.data?.error?.details?.retry_after_s ?? 30;
        toast.error(`Tezroq emas — yana ${wait}s kuting`);
      } else {
        toast.error("Yangilash muvaffaqiyatsiz");
      }
    },
  });

  // The top-bar refresh. Kept in the bar while loading too (disabled), so the
  // title does not shift when the list arrives.
  const refresh = (
    <IconButton
      aria-label={sync.isPending ? "Yangilanyapti…" : "Yangilash"}
      aria-busy={sync.isPending || undefined}
      disabled={sync.isPending || !accountQ.data?.linked}
      onClick={() => sync.mutate()}
    >
      <RefreshCw className={cn(sync.isPending && "animate-spin")} strokeWidth={2.2} />
    </IconButton>
  );

  if (accountQ.isLoading) {
    return (
      <Screen padded title={TITLE} subtitle={SUBTITLE} actions={refresh} reveal={false}>
        <RowsSkeleton />
      </Screen>
    );
  }
  if (!accountQ.data?.linked) {
    return (
      <StatusView
        kind="empty"
        header="Akkount ulanmagan"
        description="Hamrohlarni ko'rish uchun avval eticket.railway.uz akkauntingizni ulang."
        action={
          <Button onClick={() => navigate("/railway-link")}>
            <Link2 strokeWidth={2.2} />
            Akkountni ulash
          </Button>
        }
      />
    );
  }

  const friends = friendsQ.data ?? [];
  const lastSync = accountQ.data.last_sync_at;

  return (
    <Screen padded title={TITLE} subtitle={SUBTITLE} actions={refresh}>
      {friendsQ.isLoading ? (
        <RowsSkeleton />
      ) : friendsQ.isError ? (
        <EmptyNote
          icon={AlertTriangle}
          title="Hamrohlarni yuklab bo'lmadi"
          body="Birozdan so'ng qayta urinib ko'ring."
          action={
            <Button variant="secondary" size="sm" className="font-semibold" onClick={() => friendsQ.refetch()}>
              Qayta urinish
            </Button>
          }
        />
      ) : friends.length === 0 ? (
        <EmptyNote
          icon={Users}
          title="Hamrohlar topilmadi"
          body={
            <>
              eticket.railway.uz sahifasida "Mening sayohatdagi hamrohlarim"
              bo'limidan yangi hamroh qo'shing.
            </>
          }
          action={
            <Button
              variant="secondary"
              size="sm"
              className="font-semibold"
              onClick={() => openLink("https://eticket.railway.uz/uz/cabinet/passengers")}
            >
              <UserPlus strokeWidth={2.2} />
              eticket sahifasida qo'shish
            </Button>
          }
        />
      ) : (
        <ListGroup
          label={`${friends.length} ta hamroh`}
          footer={lastSync ? `Oxirgi yangilash: ${new Date(lastSync).toLocaleString()}` : undefined}
        >
          {friends.map((f) => (
            <ListRow
              key={f.id}
              inset={ROW_INSET}
              before={<Monogram f={f} />}
              // "Men" rides beside the name, not in the trailing slot: there it
              // would take width from the subtitle too, and the document number
              // is what gets cut on a narrow phone.
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{`${f.firstname} ${f.lastname}`.trim() || "—"}</span>
                  {f.is_self && <Badge variant="coral" className="shrink-0">Men</Badge>}
                </span>
              }
              subtitle={
                <span className="tnum">
                  {formatBday(f.birth_day)}
                  {f.doc_type ? ` · ${f.doc_type}` : ""}
                  {f.doc_masked ? ` ${f.doc_masked}` : ""}
                </span>
              }
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
