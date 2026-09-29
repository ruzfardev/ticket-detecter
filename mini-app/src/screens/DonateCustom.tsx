import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getInvoice, getPlans } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DonateCustom() {
  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const { openInvoice, haptic } = useTelegram();
  const [raw, setRaw] = useState("50");

  if (plans.isLoading) return <StatusView kind="loading" />;
  if (!plans.data) return <StatusView kind="error" />;

  const range = plans.data.donate_custom_range;
  const parsed = Number(raw);
  const valid = Number.isFinite(parsed) && parsed >= range.min && parsed <= range.max;

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

  return (
    <Screen
      padded
      title="Boshqa miqdor"
      subtitle={`${range.min}–${range.max} ⭐ oralig'ida`}
    >
      <div className="space-y-2">
        <Label htmlFor="amount">Miqdor</Label>
        <Input
          id="amount"
          type="number"
          inputMode="numeric"
          value={raw}
          min={range.min}
          max={range.max}
          onChange={e => setRaw(e.target.value)}
          placeholder="50"
          after={<span className="text-accent-amber">★</span>}
        />
      </div>

      {valid && (
        <p className="text-body-md text-muted px-1">
          Yuboriladi: <Money stars={parsed} className="text-ink" />
        </p>
      )}

      <Button full disabled={!valid} onClick={onSubmit}>
        {valid ? `${parsed} ⭐ yuborish` : "Miqdorni kiriting"}
      </Button>
    </Screen>
  );
}
