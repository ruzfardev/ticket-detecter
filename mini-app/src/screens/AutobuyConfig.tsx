import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, Users, Zap } from "lucide-react";

import {
  getCard,
  getFriends,
  getRailwayStatus,
  listSubscriptions,
  patchAutobuy,
  type PaymentMethod,
} from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string }[] = [
  { value: "hamkorbank", label: "Humo / Uzcard", hint: "Saqlangan karta orqali (tavsiya etiladi)" },
  { value: "payme",      label: "Payme",         hint: "Payme karta yoki balans" },
];

export function AutobuyConfig() {
  const { id } = useParams<{ id: string }>();
  const subId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const subsQ = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });
  const friendsQ = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
    enabled: accountQ.data?.linked === true,
  });
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard });

  const sub = subsQ.data?.subscriptions.find(s => s.id === subId);

  const [enabled, setEnabled] = useState<boolean>(false);
  const [friendId, setFriendId] = useState<number | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod | null>(null);

  // Seed local state when the subscription loads.
  useEffect(() => {
    if (sub) {
      setEnabled(sub.autobuy_enabled);
      setFriendId(sub.autobuy_friend_id);
      setPayMethod(sub.autobuy_payment_method);
    }
  }, [sub?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () =>
      patchAutobuy(subId, {
        enabled,
        friend_id: enabled ? friendId : null,
        payment_method: enabled ? payMethod : null,
      }),
    onSuccess: () => {
      toast.success("Saqlandi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      navigate(`/sub/${subId}`);
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code;
      if (code === "railway_account_required") {
        toast.error("Avval eticket akkountni ulang");
        navigate("/railway-link");
      } else if (code === "invalid_payload") {
        const inner = err?.response?.data?.error?.details?.code;
        if (inner === "friend_not_owned") toast.error("Hamroh topilmadi");
        else toast.error("Forma noto'g'ri to'ldirildi");
      } else {
        toast.error("Saqlashda xato");
      }
    },
  });

  if (subsQ.isLoading || accountQ.isLoading) return <StatusView kind="loading" />;
  if (!sub) {
    return (
      <StatusView
        kind="empty"
        header="Topilmadi"
        description="Bu xabarnoma o'chirilgan yoki mavjud emas."
      />
    );
  }
  if (!accountQ.data?.linked) {
    return (
      <StatusView
        kind="empty"
        header="Akkount ulanmagan"
        description="Auto-buy uchun avval eticket.railway.uz akkountingizni ulang."
        action={<Button onClick={() => navigate("/railway-link")}>Akkountni ulash</Button>}
      />
    );
  }

  const friends = friendsQ.data ?? [];
  const canSave =
    !save.isPending &&
    (!enabled ||
      (friendId !== null &&
       friends.some(f => f.id === friendId) &&
       cardQ.data !== null));

  return (
    <Screen
      padded
      title="Avto sotib olish"
      subtitle={`${sub.dep_name} → ${sub.arr_name} · ${sub.travel_date}`}
    >
      <ListGroup label="Holat">
        <ListRow
          before={<Zap className="h-5 w-5 text-coral" strokeWidth={1.75} />}
          title="Auto-buy yoqilgan"
          subtitle={enabled
            ? "Chipta topilganda avtomatik bron qilinadi"
            : "Hozircha faqat xabar yuboriladi"}
          after={
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="h-5 w-5 accent-coral"
              aria-label="Auto-buy"
            />
          }
        />
      </ListGroup>

      {enabled && (
        <>
          <ListGroup label="To'lov kartasi" footer="Karta auto-buy paytida avtomatik yuboriladi">
            <ListRow
              before={<CreditCard className={`h-5 w-5 ${cardQ.data ? "text-coral" : "text-muted-soft"}`} strokeWidth={1.75} />}
              title={cardQ.data ? `•••• ${cardQ.data.last4}` : "Karta saqlanmagan"}
              subtitle={cardQ.data ? "Saqlangan" : "Avval kartani saqlash kerak"}
              onClick={() => navigate("/cards/add")}
              chevron
            />
          </ListGroup>

          <ListGroup label="Hamroh">
            {friends.length === 0 ? (
              <ListRow
                before={<Users className="h-5 w-5 text-muted-soft" strokeWidth={1.75} />}
                title="Hamroh yo'q"
                subtitle="Avval eticket'da hamroh qo'shing"
                onClick={() => navigate("/friends")}
                chevron
              />
            ) : (
              <RadioGroup
                value={friendId ? String(friendId) : ""}
                onValueChange={v => setFriendId(Number(v))}
                className="gap-0"
              >
                {friends.map(f => (
                  <label
                    key={f.id}
                    htmlFor={`friend-${f.id}`}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-hairline-soft transition-colors min-h-[56px] border-b border-hairline-soft last:border-b-0"
                  >
                    <RadioGroupItem id={`friend-${f.id}`} value={String(f.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-body-md font-medium truncate text-ink">
                        {`${f.firstname} ${f.lastname}`.trim()}
                      </div>
                      <div className="text-body-sm text-muted truncate">
                        {f.is_self ? "Men · " : ""}
                        {f.doc_type ?? ""}
                        {f.doc_masked ? ` ${f.doc_masked}` : ""}
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            )}
          </ListGroup>

          <ListGroup label="To'lov uslubi (ixtiyoriy)" footer="Tanlanmasa, bron paytida tanlaysiz">
            <RadioGroup
              value={payMethod ?? ""}
              onValueChange={v => setPayMethod(v as PaymentMethod)}
              className="gap-0"
            >
              {PAYMENT_OPTIONS.map(o => (
                <label
                  key={o.value}
                  htmlFor={`pm-${o.value}`}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-hairline-soft transition-colors min-h-[56px] border-b border-hairline-soft last:border-b-0"
                >
                  <RadioGroupItem id={`pm-${o.value}`} value={o.value} />
                  <CreditCard className="h-5 w-5 text-ink" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="text-body-md font-medium truncate text-ink">{o.label}</div>
                    <div className="text-body-sm text-muted truncate">{o.hint}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </ListGroup>
        </>
      )}

      <StickyAction
        hint={
          enabled && !cardQ.data
            ? "Avval karta saqlang"
            : enabled && !friendId
              ? "Avval hamroh tanlang"
              : undefined
        }
      >
        <Button full disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? "Saqlanyapti…" : "Saqlash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
