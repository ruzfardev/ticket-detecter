import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, UserPlus, Users } from "lucide-react";

import { getFriends, getRailwayStatus, syncFriends, type Friend } from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { useTelegram } from "@/hooks/useTelegram";

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

  if (accountQ.isLoading) return <StatusView kind="loading" />;
  if (!accountQ.data?.linked) {
    return (
      <StatusView
        kind="empty"
        header="Akkount ulanmagan"
        description="Hamrohlarni ko'rish uchun avval eticket.railway.uz akkauntingizni ulang."
        action={
          <Button onClick={() => navigate("/railway-link")}>
            Akkountni ulash
          </Button>
        }
      />
    );
  }

  const friends = friendsQ.data ?? [];

  return (
    <Screen
      padded
      title="Hamrohlarim"
      subtitle="eticket.railway.uz ro'yxatingizdan"
    >
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          <RefreshCw size={16} strokeWidth={1.75} className={sync.isPending ? "animate-spin" : ""} />
          {sync.isPending ? "Yangilanyapti…" : "Yangilash"}
        </Button>
      </div>

      {friends.length === 0 ? (
        <div className="rounded-md border border-hairline bg-surface-card p-6 text-center space-y-3">
          <Users className="h-8 w-8 mx-auto text-muted-soft" strokeWidth={1.5} />
          <div className="space-y-1">
            <div className="text-body-md font-medium text-ink">Hamrohlar topilmadi</div>
            <p className="text-body-sm text-muted">
              eticket.railway.uz sahifasida "Mening sayohatdagi hamrohlarim"
              bo'limidan yangi hamroh qo'shing.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openLink("https://eticket.railway.uz/uz/cabinet/passengers")}
          >
            <UserPlus size={16} strokeWidth={1.75} />
            eticket sahifasida qo'shish
          </Button>
        </div>
      ) : (
        <ListGroup label={`${friends.length} ta hamroh`}>
          {friends.map((f) => (
            <ListRow
              key={f.id}
              before={
                <div className="h-10 w-10 rounded-full bg-coral/10 text-coral flex items-center justify-center text-body-sm font-medium">
                  {initials(f)}
                </div>
              }
              title={`${f.firstname} ${f.lastname}`.trim() || "—"}
              subtitle={
                <>
                  {f.is_self ? "Men · " : ""}
                  {formatBday(f.birth_day)}
                  {f.doc_type ? ` · ${f.doc_type}` : ""}
                  {f.doc_masked ? ` ${f.doc_masked}` : ""}
                </>
              }
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
