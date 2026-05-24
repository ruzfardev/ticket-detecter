import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin, CalendarDays, TrainFront, Armchair, ArrowDownToLine, ArrowUpToLine,
} from "lucide-react";

import { createSubscription } from "@/api/client";
import { useHaptic } from "@/hooks/useHaptic";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";
import { Screen } from "@/components/Screen";
import { StickyAction } from "@/components/StickyAction";
import { Button } from "@/components/ui/button";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";

export function Confirm() {
  useWizardGuard(["dep_code", "arr_code", "travel_date", "train_numbers", "car_types"]);

  const navigate = useNavigate();
  const qc = useQueryClient();
  const haptic = useHaptic();
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
        train_numbers: w.train_numbers,
        car_types: w.car_types,
        berth: w.berth,
      });
    },
    onSuccess: () => {
      haptic.notify("success");
      toast.success("Xabarnoma yaratildi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      reset();
      navigate("/home", { replace: true });
    },
    onError: (err: any) => {
      haptic.notify("error");
      const code = err.response?.data?.error?.code;
      if (code === "slot_limit_reached") {
        toast.error("Slot to'lgan. Premium kerak.");
        setTimeout(() => navigate("/premium"), 800);
      } else {
        toast.error(err.response?.data?.error?.message || err.message || "Saqlanmadi");
      }
    },
  });

  const BerthIcon = w.berth === "lower" ? ArrowDownToLine : ArrowUpToLine;
  const berthLabel =
    w.berth === "lower" ? "Pastki" :
    w.berth === "upper" ? "Tepa" :
    null;

  return (
    <Screen
      padded
      wizard
      title="Tasdiqlash"
      subtitle="O'zgartirish uchun qatorga bosing"
    >
      <ListGroup>
        <ListRow
          before={<MapPin className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={`${w.dep_name} → ${w.arr_name}`}
          subtitle="Marshrut"
          chevron
          onClick={() => navigate("/new")}
        />
        <ListRow
          before={<CalendarDays className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={w.travel_date ?? ""}
          subtitle="Sana"
          chevron
          onClick={() => navigate("/new/date")}
        />
        <ListRow
          before={<TrainFront className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={w.train_numbers.length ? w.train_numbers.join(", ") : "Har qanday"}
          subtitle={w.train_numbers.length > 1 ? `Poyezdlar · ${w.train_numbers.length} ta` : "Poyezd"}
          chevron
          onClick={() => navigate("/new/train")}
        />
        <ListRow
          before={<Armchair className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title={w.car_types.join(", ")}
          subtitle="Vagon turi"
          chevron
          onClick={() => navigate("/new/car-type")}
        />
        {berthLabel && (
          <ListRow
            before={<BerthIcon className="h-5 w-5 text-ink" strokeWidth={1.75} />}
            title={berthLabel}
            subtitle="Joy turi"
            chevron
            onClick={() => navigate("/new/berth")}
          />
        )}
      </ListGroup>

      <p className="text-body-sm text-muted px-1">
        Bo'sh joy paydo bo'lganda Telegram orqali darhol xabar olasiz.
      </p>

      <StickyAction>
        <Button full disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? (
            <span className="inline-flex items-center gap-2">
              <Spinner size="sm" className="text-on-primary" />
              Saqlanmoqda...
            </span>
          ) : (
            "Saqlash"
          )}
        </Button>
      </StickyAction>
    </Screen>
  );
}
