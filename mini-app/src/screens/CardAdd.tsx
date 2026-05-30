import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CreditCard, ShieldAlert, Trash2 } from "lucide-react";

import { deleteCard, getCard, saveCard } from "@/api/client";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list";
import { StickyAction } from "@/components/StickyAction";
import { useTelegram } from "@/hooks/useTelegram";

function formatPan(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "/" + digits.slice(2);
}

export function CardAdd() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showConfirm } = useTelegram();
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard });

  const [pan, setPan] = useState("");
  const [exp, setExp] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveCard({
        pan: pan.replace(/\D/g, ""),
        exp_mmyy: exp.replace(/\D/g, ""),
      }),
    onSuccess: () => {
      toast.success("Karta saqlandi");
      qc.invalidateQueries({ queryKey: ["card"] });
      navigate(-1);
    },
    onError: () => toast.error("Karta saqlanmadi"),
  });

  const remove = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      toast.success("Karta o'chirildi");
      qc.invalidateQueries({ queryKey: ["card"] });
      setPan(""); setExp("");
    },
    onError: () => toast.error("O'chirib bo'lmadi"),
  });

  if (cardQ.isLoading) return <StatusView kind="loading" />;

  const panDigits = pan.replace(/\D/g, "");
  const expDigits = exp.replace(/\D/g, "");
  const canSave =
    !save.isPending && panDigits.length >= 12 && expDigits.length === 4;

  return (
    <Screen
      padded
      title="To'lov kartasi"
      subtitle="Auto-buy'da chipta topilganda kartangiz avtomatik yuboriladi"
    >
      <div className="flex items-start gap-3 rounded-md border border-coral/30 bg-coral/5 p-4">
        <ShieldAlert className="h-5 w-5 text-coral flex-shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="space-y-1 text-body-sm text-ink">
          <div className="font-medium">Diqqat</div>
          <p className="text-muted">
            Karta ma'lumotlari Fernet shifrlash bilan saqlanadi. Auto-buy
            ishlaganda eticket.railway.uz'ga avtomatik yuboriladi. Telefoningizga
            SMS keladi va siz <b>OTP kodini mini-app'da</b> kiritasiz —
            bron belgilangan vaqt ichida tasdiqlanishi kerak.
          </p>
        </div>
      </div>

      {cardQ.data && (
        <ListGroup label="Hozirgi karta">
          <ListRow
            before={<CreditCard className="h-5 w-5 text-ink" strokeWidth={1.75} />}
            title={`•••• •••• •••• ${cardQ.data.last4}`}
            subtitle={
              cardQ.data.last_used_at
                ? `Oxirgi ishlatilgan: ${new Date(cardQ.data.last_used_at).toLocaleDateString()}`
                : "Hali ishlatilmagan"
            }
          />
          <ListRow
            before={<Trash2 className="h-5 w-5 text-error" strokeWidth={1.75} />}
            title="Kartani o'chirish"
            destructive
            disabled={remove.isPending}
            onClick={async () => {
              if (await showConfirm("Kartani o'chirishni xohlaysizmi? Auto-buy ishlamay qoladi.")) {
                remove.mutate();
              }
            }}
          />
        </ListGroup>
      )}

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="pan">{cardQ.data ? "Yangi karta raqami" : "Karta raqami"}</Label>
          <Input
            id="pan"
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            autoComplete="cc-number"
            value={pan}
            onChange={e => setPan(formatPan(e.target.value))}
            before={<CreditCard size={16} strokeWidth={1.75} />}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="exp">Muddati (OO/YY)</Label>
          <Input
            id="exp"
            type="text"
            inputMode="numeric"
            placeholder="07/27"
            autoComplete="cc-exp"
            value={exp}
            onChange={e => setExp(formatExpiry(e.target.value))}
          />
        </div>
      </div>

      <StickyAction>
        <Button full disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? "Saqlanyapti…" : cardQ.data ? "Yangilash" : "Saqlash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
