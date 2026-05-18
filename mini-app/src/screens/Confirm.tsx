import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cell, List, Section } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
} from "lucide-react";

import { createSubscription } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { useWizard } from "@/store/wizard";

const iconBefore = (Icon: any) => (
  <Icon size={18} strokeWidth={1.75}
        style={{ marginRight: 4, verticalAlign: "text-bottom" }} />
);

export function Confirm() {
  const navigate = useNavigate();
  const { mainButton, haptic } = useTelegram();
  const qc = useQueryClient();
  const w = useWizard();
  const reset = useWizard(s => s.reset);

  const mutation = useMutation({
    mutationFn: () => createSubscription({
      dep_code: w.dep_code!,
      arr_code: w.arr_code!,
      travel_date: w.travel_date!,
      train_number: w.train_number || null,
      car_types: w.car_types,
      berth: w.berth,
    }),
    onSuccess: () => {
      haptic?.notificationOccurred?.("success");
      toast.success("Xabarnoma yaratildi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      reset();
      navigate("/home", { replace: true });
    },
    onError: (err: any) => {
      haptic?.notificationOccurred?.("error");
      const code = err.response?.data?.error?.code;
      if (code === "slot_limit_reached") {
        toast.error("Slot to'lgan. Premium kerak.");
        setTimeout(() => navigate("/premium"), 800);
      } else {
        toast.error(err.response?.data?.error?.message || "Saqlanmadi");
      }
    },
  });

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText("Saqlash");
    mainButton.show();
    mainButton.enable();
    if (mutation.isPending) mainButton.showProgress(); else mainButton.hideProgress();
    const handler = () => mutation.mutate();
    mainButton.onClick(handler);
    return () => mainButton.offClick(handler);
  }, [mainButton, mutation]);

  return (
    <List>
      <Section header="Tasdiqlash" footer="Bo'sh joy paydo bo'lganda Telegram orqali darhol xabar olasiz.">
        <Cell subtitle="Marshrut">
          {iconBefore(MapPin)}{w.dep_name} → {w.arr_name}
        </Cell>
        <Cell subtitle="Sana">
          {iconBefore(CalendarDays)}{w.travel_date}
        </Cell>
        <Cell subtitle="Poyezd">
          {iconBefore(TrainFront)}{w.train_number} {w.train_brand ? `· ${w.train_brand}` : ""}
        </Cell>
        <Cell subtitle="Vagon turi">
          {iconBefore(Armchair)}{w.car_types.join(", ")}
        </Cell>
        {w.berth !== "any" && (
          <Cell subtitle="Joy turi">
            {iconBefore(w.berth === "lower" ? ArrowDownToLine : ArrowUpToLine)}
            {w.berth === "lower" ? "Pastki" : "Tepa"}
          </Cell>
        )}
      </Section>
    </List>
  );
}
