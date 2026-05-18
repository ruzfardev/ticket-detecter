import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cell, List, Section } from "@telegram-apps/telegram-ui";
import { toast } from "sonner";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
} from "lucide-react";

import { createSubscription } from "@/api/client";
import { useMainButton } from "@/hooks/useMainButton";
import { useTelegram } from "@/hooks/useTelegram";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { IconText } from "@/ui";

export function Confirm() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_number", "car_types"]);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const { haptic } = useTelegram();
  const reset = useWizard(s => s.reset);
  const w = useWizard();

  const mutation = useMutation({
    mutationFn: () => {
      if (!w.dep_code || !w.arr_code || !w.travel_date) {
        throw new Error("incomplete_wizard");
      }
      return createSubscription({
        dep_code: w.dep_code,
        arr_code: w.arr_code,
        travel_date: w.travel_date,
        train_number: w.train_number || null,
        car_types: w.car_types,
        berth: w.berth,
      });
    },
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
        toast.error(err.response?.data?.error?.message || err.message || "Saqlanmadi");
      }
    },
  });

  const onSubmit = useCallback(() => mutation.mutate(), [mutation]);
  useMainButton({
    text: "Saqlash",
    enabled: !mutation.isPending,
    progress: mutation.isPending,
    onClick: onSubmit,
  });

  const berthLabel =
    w.berth === "lower" ? "Pastki" :
    w.berth === "upper" ? "Tepa" :
    null;
  const BerthIcon = w.berth === "lower" ? ArrowDownToLine : ArrowUpToLine;

  return (
    <List>
      <Section
        header="Tasdiqlash"
        footer="Bo'sh joy paydo bo'lganda Telegram orqali darhol xabar olasiz."
      >
        <Cell subtitle="Marshrut" before={<MapPin size={18} strokeWidth={1.75} />}>
          {w.dep_name} → {w.arr_name}
        </Cell>
        <Cell subtitle="Sana" before={<CalendarDays size={18} strokeWidth={1.75} />}>
          {w.travel_date}
        </Cell>
        <Cell subtitle="Poyezd" before={<TrainFront size={18} strokeWidth={1.75} />}>
          {w.train_number}{w.train_brand ? ` · ${w.train_brand}` : ""}
        </Cell>
        <Cell subtitle="Vagon turi" before={<Armchair size={18} strokeWidth={1.75} />}>
          {w.car_types.join(", ")}
        </Cell>
        {berthLabel && (
          <Cell subtitle="Joy turi">
            <IconText icon={BerthIcon}>{berthLabel}</IconText>
          </Cell>
        )}
      </Section>
    </List>
  );
}
