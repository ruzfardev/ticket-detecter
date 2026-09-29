import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { cn } from "@/lib/utils";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { StickyAction } from "@/components/StickyAction";
import { Money, Star } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";

/** One-tap amounts; each only fills the field. */
const QUICK = [25, 50, 100];

function DonateCustomSkeleton() {
  return (
    <Screen
      padded
      title="Boshqa miqdor"
      // A span, not <Skeleton/> (a div): the subtitle renders inside a <p>.
      subtitle={<span aria-hidden className="skeleton inline-block h-4 w-40 rounded-full align-middle" />}
      reveal={false}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="mx-1 h-3.5 w-16 rounded-full" />
          <Skeleton className="h-[88px] rounded-[22px]" />
        </div>
        <div className="h-[22px]" />
        <Skeleton className="h-11 rounded-full" />
      </div>
    </Screen>
  );
}

export function DonateCustom() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  const [raw, setRaw] = useState("50");
  // The invoice link is being fetched: the button shows it.
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (plans.isLoading) return <DonateCustomSkeleton />;
  if (!plans.data) {
    return <StatusView kind="error" description="Ma'lumotni yuklab bo'lmadi." />;
  }

  const range = plans.data.donate_custom_range;
  const parsed = Number(raw);
  const valid = Number.isFinite(parsed) && parsed >= range.min && parsed <= range.max;
  // Typed something, but not a sendable amount: say so at the field.
  const outOfRange = raw !== "" && !valid;
  const quick = QUICK.filter(v => v >= range.min && v <= range.max);

  const onSubmit = async () => {
    if (!valid) return;
    try {
      const inv = await getInvoice("donate_custom", parsed);
      openInvoice(inv.invoice_link, status => {
        if (status === "paid") {
          haptic?.notificationOccurred?.("success");
          toast.success("Katta rahmat!");
        }
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || "Xato");
    }
  };

  const submit = () => {
    setBusy(true);
    onSubmit().finally(() => setBusy(false));
  };

  return (
    <Screen
      padded
      title="Boshqa miqdor"
      subtitle={`${range.min}–${range.max} ⭐ oralig'ida`}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="amount">Miqdor</Label>
          {/* The number sits centred, the star right after it — the field
              hugs what is typed, so a tap anywhere on the well focuses it. */}
          <div className="cursor-text" onClick={() => inputRef.current?.focus()}>
            <Input
              ref={inputRef}
              id="amount"
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              value={raw}
              min={range.min}
              max={range.max}
              onChange={e => setRaw(e.target.value)}
              placeholder="50"
              aria-invalid={outOfRange || undefined}
              style={{ width: `min(${(raw.length || 2) + 0.4}ch, 100%)` }}
              className={cn(
                "h-[88px] justify-center gap-1.5 rounded-[22px] px-5",
                "[&_input]:flex-none [&_input]:text-center [&_input]:text-[44px] [&_input]:font-bold",
                "[&_input]:leading-[52px] [&_input]:tracking-[-0.02em] [&_input]:tabular-nums [&_input]:caret-coral-bright",
                "[&_input]:[appearance:textfield] [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none",
              )}
              after={<Star className="size-[30px]" />}
            />
          </div>
        </div>

        {/* Confirmation when the amount is good; the allowed range when not. */}
        <p
          role="status"
          className={`min-h-[22px] px-1 text-center text-body-md ${outOfRange ? "text-error" : "text-muted"}`}
        >
          {valid ? (
            <>Yuboriladi: <Money stars={parsed} className="text-ink" /></>
          ) : outOfRange ? (
            `${range.min}–${range.max} ⭐ oralig'ida`
          ) : null}
        </p>

        {quick.length > 1 && (
          <Segmented
            aria-label="Miqdor"
            value={raw}
            onChange={setRaw}
            options={quick.map(v => ({
              value: String(v),
              label: <Money stars={v} className="font-semibold" />,
            }))}
          />
        )}
      </div>

      <StickyAction>
        <Button full size="lg" disabled={!valid} loading={busy} onClick={submit}>
          {valid ? `${parsed} ⭐ yuborish` : "Miqdorni kiriting"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
