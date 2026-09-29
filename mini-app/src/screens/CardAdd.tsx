import { useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { CalendarDays, CreditCard, Nfc, Plus, ShieldAlert, Trash2 } from "lucide-react";

import { deleteCard, getCard, saveCard, type SavedCard } from "@/api/client";
import { Screen } from "@/components/Screen";
import { Specular } from "@/components/glass/Specular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListRow } from "@/components/ui/list";
import { PressCard } from "@/components/ui/press-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { IconTile } from "@/components/ui/tile";
import { StickyAction } from "@/components/StickyAction";
import { useSmartBack } from "@/hooks/useBackButton";
import { useTelegram } from "@/hooks/useTelegram";
import { spring } from "@/lib/motion";

function formatPan(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + "/" + digits.slice(2);
}

const TITLE = "To'lov kartasi";
const SUBTITLE = "Auto-buy'da chipta topilganda kartangiz avtomatik yuboriladi";

/** The contact chip, gilded with the palette's amber. */
function Chip() {
  return (
    <span
      aria-hidden
      className="relative block h-[30px] w-10 overflow-hidden rounded-[7px] bg-[linear-gradient(135deg,hsl(var(--amber-bright)),hsl(var(--accent-amber)/0.85))] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.2),inset_0_1px_0.5px_rgb(255_255_255/0.55)]"
    >
      <svg viewBox="0 0 40 30" fill="none" className="absolute inset-0 size-full stroke-black/20">
        <path d="M0 10.5H13M0 19.5H13M27 10.5H40M27 19.5H40M13 0V30M27 0V30M13 15H27" strokeWidth="1" />
      </svg>
    </span>
  );
}

/**
 * The saved card, Wallet-style: a pane of glass the size of a bank card, lit
 * from two corners by the palette's warm colours. Only the last four digits
 * are ever known here.
 */
function WalletCard({ card }: { card: SavedCard }) {
  return (
    <div className="relative h-full overflow-hidden rounded-[22px] p-5">
      <span
        aria-hidden
        className="absolute -left-16 -top-24 size-64 rounded-full bg-[radial-gradient(closest-side,hsl(var(--coral-bright)/0.34),transparent)]"
      />
      <span
        aria-hidden
        className="absolute -bottom-28 -right-14 size-72 rounded-full bg-[radial-gradient(closest-side,hsl(var(--amber-bright)/0.28),transparent)]"
      />
      <Specular />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <span className="text-caption-upper uppercase text-muted">Hozirgi karta</span>
          <Nfc className="size-6 text-muted" strokeWidth={1.8} aria-hidden />
        </div>
        <div className="mt-4"><Chip /></div>
        <div className="mt-auto">
          <p className="flex items-center gap-[14px] text-ink">
            {[0, 1, 2].map(g => (
              <span key={g} aria-hidden className="flex gap-[5px]">
                {[0, 1, 2, 3].map(d => <i key={d} className="size-[7px] rounded-full bg-current" />)}
              </span>
            ))}
            <span aria-hidden className="tnum text-[22px] font-semibold leading-7 tracking-[0.06em]">
              {card.last4}
            </span>
            <span className="sr-only">{`•••• •••• •••• ${card.last4}`}</span>
          </p>
          <p className="mt-0.5 text-caption text-muted">
            {card.last_used_at
              ? `Oxirgi ishlatilgan: ${new Date(card.last_used_at).toLocaleDateString()}`
              : "Hali ishlatilmagan"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** No card yet: the card's outline, waiting to be filled. Tapping it starts. */
function EmptyCard({ onAdd }: { onAdd: () => void }) {
  return (
    <PressCard material="none" onClick={onAdd} className="rounded-[22px]">
      <span className="flex aspect-[1.586] flex-col items-center justify-center gap-3.5 rounded-[22px] border-[1.5px] border-dashed border-muted-soft/50 bg-surface-soft/40 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-coral-bright/15 text-coral-ink shadow-[inset_0_0_0_0.5px_hsl(var(--coral-bright)/0.3)]">
          <Plus className="size-6" strokeWidth={2.4} aria-hidden />
        </span>
        <span className="space-y-0.5">
          <span className="block text-title-md text-ink">Karta saqlanmagan</span>
          <span className="block text-body-sm text-muted">Auto-buy uchun saqlash kerak</span>
        </span>
      </span>
    </PressCard>
  );
}

function CardSkeleton() {
  return (
    <Screen padded title={TITLE} subtitle={SUBTITLE} reveal={false}>
      <Skeleton className="aspect-[1.586] w-full rounded-[22px]" />
      <Skeleton className="h-[136px] rounded-[20px]" />
      <div className="space-y-5">
        {[0, 1].map(i => (
          <div key={i} className="space-y-2">
            <Skeleton className="ml-1 h-3.5 w-28 rounded-full" />
            <Skeleton className="h-[52px] rounded-[18px]" />
          </div>
        ))}
      </div>
    </Screen>
  );
}

export function CardAdd() {
  const goBack = useSmartBack();
  const qc = useQueryClient();
  const { showConfirm } = useTelegram();
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard });

  const [pan, setPan] = useState("");
  const [exp, setExp] = useState("");
  const panRef = useRef<HTMLInputElement>(null);
  const expRef = useRef<HTMLInputElement>(null);

  const save = useMutation({
    mutationFn: () =>
      saveCard({
        pan: pan.replace(/\D/g, ""),
        exp_mmyy: exp.replace(/\D/g, ""),
      }),
    onSuccess: () => {
      toast.success("Karta saqlandi");
      qc.invalidateQueries({ queryKey: ["card"] });
      goBack();
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

  if (cardQ.isLoading) return <CardSkeleton />;

  const panDigits = pan.replace(/\D/g, "");
  const expDigits = exp.replace(/\D/g, "");
  const canSave =
    !save.isPending && panDigits.length >= 12 && expDigits.length === 4;

  // "next" on the number moves to the expiry; "done" on the expiry puts the
  // keyboard away so the save button is in reach. Saving stays a deliberate tap.
  const toExpiry = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    expRef.current?.focus();
  };
  const closeKeyboard = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.currentTarget.blur();
  };

  return (
    <Screen padded title={TITLE} subtitle={SUBTITLE}>
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {cardQ.data ? (
            <m.div
              key="saved"
              className="glass aspect-[1.586] rounded-[22px]"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring.smooth}
            >
              <WalletCard card={cardQ.data} />
            </m.div>
          ) : (
            <m.div
              key="empty"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={spring.smooth}
            >
              <EmptyCard onAdd={() => panRef.current?.focus()} />
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-start gap-3.5 rounded-[20px] bg-amber-bright/10 p-4 shadow-[inset_0_0_0_0.5px_hsl(var(--amber-bright)/0.35)]">
        <IconTile icon={ShieldAlert} tone="amber" />
        <div className="min-w-0 space-y-1">
          <p className="text-title-sm text-ink">Diqqat</p>
          <p className="text-body-sm text-muted">
            Karta ma'lumotlari Fernet shifrlash bilan saqlanadi. Auto-buy
            ishlaganda eticket.railway.uz'ga avtomatik yuboriladi. Telefoningizga
            SMS keladi va siz <b className="font-semibold text-ink">OTP kodini mini-app'da</b> kiritasiz —
            bron belgilangan vaqt ichida tasdiqlanishi kerak.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pan">{cardQ.data ? "Yangi karta raqami" : "Karta raqami"}</Label>
          <Input
            ref={panRef}
            id="pan"
            name="cardnumber"
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            autoComplete="cc-number"
            enterKeyHint="next"
            className="tnum"
            value={pan}
            onChange={e => setPan(formatPan(e.target.value))}
            onKeyDown={toExpiry}
            before={<CreditCard className="size-[18px]" strokeWidth={2} />}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="exp">Muddati (OO/YY)</Label>
          <Input
            ref={expRef}
            id="exp"
            name="exp-date"
            type="text"
            inputMode="numeric"
            placeholder="07/27"
            autoComplete="cc-exp"
            enterKeyHint="done"
            className="tnum"
            value={exp}
            onChange={e => setExp(formatExpiry(e.target.value))}
            onKeyDown={closeKeyboard}
            before={<CalendarDays className="size-[18px]" strokeWidth={2} />}
          />
        </div>
      </div>

      {cardQ.data && (
        <ListGroup>
          <ListRow
            before={<IconTile icon={Trash2} tone="red" />}
            title="Kartani o'chirish"
            destructive
            disabled={remove.isPending}
            after={remove.isPending ? <Spinner size="sm" className="text-error" /> : undefined}
            onClick={async () => {
              if (await showConfirm("Kartani o'chirishni xohlaysizmi? Auto-buy ishlamay qoladi.")) {
                remove.mutate();
              }
            }}
          />
        </ListGroup>
      )}

      <StickyAction>
        <Button
          full
          size="lg"
          loading={save.isPending}
          disabled={!canSave}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saqlanyapti…" : cardQ.data ? "Yangilash" : "Saqlash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
