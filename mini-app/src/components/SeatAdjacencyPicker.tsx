import { Check } from "lucide-react";

import type { SeatAdjacency } from "@/api/client";
import { ListGroup, ListRow } from "@/components/ui/list";

const OPTIONS: { v: SeatAdjacency; t: string; d: string }[] = [
  { v: "together", t: "Yonma-yon", d: "Bir kupeda, masalan 1-3 yoki 5-7" },
  { v: "any",      t: "Istalgan joy", d: "Bitta vagonda, qayerda bo'lsa ham" },
];

type Props = {
  value: SeatAdjacency;
  onChange: (v: SeatAdjacency) => void;
};

/** Whether an auto-buy group must sit in one compartment. Shown only for two
 *  or more seated passengers; the worker's rule lives in app/worker/seats.py. */
export function SeatAdjacencyPicker({ value, onChange }: Props) {
  return (
    <ListGroup
      label="Joylar"
      footer={
        value === "together"
          ? "Bir kupeda joy chiqmaguncha kutiladi, bokovoy joylar olinmaydi. Kupega sig'magan guruh (SV va lyuksda 3–4 kishi) qo'shni kupelarga bo'linadi. O'rindiqli vagonda ketma-ket raqamli joylar olinadi."
          : "Bir kupe bo'sh bo'lsa, o'sha olinadi. Bo'lmasa, joylar vagonning turli qismida bo'lishi mumkin."
      }
    >
      {OPTIONS.map(o => (
        <ListRow
          key={o.v}
          before={
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border ${
                value === o.v ? "border-coral bg-coral text-on-primary" : "border-muted-soft"
              }`}
              aria-hidden
            >
              {value === o.v && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
          }
          title={o.t}
          subtitle={o.d}
          selected={value === o.v}
          onClick={() => onChange(o.v)}
        />
      ))}
    </ListGroup>
  );
}
