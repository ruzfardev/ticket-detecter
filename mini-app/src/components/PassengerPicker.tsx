import * as m from "motion/react-m";
import { AlertCircle, Users } from "lucide-react";

import type { Friend, SeatStrategy } from "@/api/client";
import { ListGroup, ListRow } from "@/components/ui/list";
import { RadioMark, SelectMark } from "@/components/ui/select-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTile } from "@/components/ui/tile";
import { spring } from "@/lib/motion";
import { ageOn, bandOf, MAX_SEATED, passengerProblem } from "@/lib/passengers";

/** Where a row's hairline starts when a 24pt mark leads it (16 + 24 + 14),
 *  so the line runs under the text, not under the mark. */
const MARK_INSET = 54;

/** Lets a descriptive subtitle wrap instead of ending in "…" on narrow phones. */
const wrap = (text: string) => <span className="whitespace-normal">{text}</span>;

type Props = {
  friends: Friend[];
  travelDate?: string;
  seatedIds: number[];
  lapIds: number[];
  loading?: boolean;
  onChange: (seated: number[], lap: number[]) => void;
  onAddFriend: () => void;
};

/** Two rows shaped like passengers while the list loads. */
function PassengerSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Yuklanmoqda…</span>
      {[0, 1].map(i => (
        <div
          key={i}
          aria-hidden
          className="relative flex min-h-[64px] items-center gap-3.5 px-4 py-2.5 after:absolute after:bottom-0 after:left-[54px] after:right-0 after:h-px after:bg-hairline-soft last:after:hidden"
        >
          <Skeleton className="size-6 shrink-0 rounded-full bg-ink/[0.07]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-[44%] rounded-full bg-ink/[0.07]" />
            <Skeleton className="h-3 w-[62%] rounded-full bg-ink/[0.07]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Pick the group for an auto-buy. Adults and children with a seat count
 * towards the seat limit; a child under 5 rides on a lap, free, and is
 * ticked separately so the seat count stays honest.
 */
export function PassengerPicker({
  friends, travelDate, seatedIds, lapIds, loading, onChange, onAddFriend,
}: Props) {
  const seatedValid = seatedIds.filter(id => friends.some(f => f.id === id)).length;
  const problem = passengerProblem(friends, travelDate, seatedIds, lapIds);

  const toggle = (f: Friend) => {
    if (bandOf(f, travelDate) === "lap") {
      onChange(
        seatedIds,
        lapIds.includes(f.id) ? lapIds.filter(x => x !== f.id) : [...lapIds, f.id],
      );
      return;
    }
    onChange(
      seatedIds.includes(f.id)
        ? seatedIds.filter(x => x !== f.id)
        : seatedIds.length >= MAX_SEATED ? seatedIds : [...seatedIds, f.id],
      lapIds,
    );
  };

  return (
    <ListGroup
      label={
        <>
          Yo'lovchilar
          {seatedValid ? <span className="tnum">{` · ${seatedValid}/${MAX_SEATED}`}</span> : null}
        </>
      }
      footer={
        problem ? (
          <span role="alert" className="flex items-start gap-1.5 text-error">
            <AlertCircle aria-hidden className="mt-[2px] size-3.5 shrink-0" strokeWidth={2.4} />
            {problem}
          </span>
        ) : (
          `Bir vagondan ${MAX_SEATED} tagacha yonma-yon joy izlanadi. 5 yoshgacha bola quchoqda bepul, joy olmaydi.`
        )
      }
    >
      {loading ? (
        <PassengerSkeleton />
      ) : friends.length === 0 ? (
        <ListRow
          before={<IconTile icon={Users} tone="teal" />}
          title="Hamroh yo'q"
          subtitle={wrap("Avval eticket'da hamroh qo'shing")}
          onClick={onAddFriend}
          chevron
        />
      ) : (
        friends.map(f => {
          const age = ageOn(f.birth_day, travelDate);
          const band = bandOf(f, travelDate);
          const checked = band === "lap" ? lapIds.includes(f.id) : seatedIds.includes(f.id);
          const atMax = band !== "lap" && !checked && seatedIds.length >= MAX_SEATED;
          const meta = band === "lap"
            ? `${age} yosh · quchoqda, bepul`
            : band === "minor"
              ? `Bola · ${age} yosh · o'z joyi bilan`
              : [f.is_self ? "Men" : "", f.doc_type ?? "", f.doc_masked ?? ""]
                  .filter(Boolean).join(" · ");
          return (
            <ListRow
              key={f.id}
              role="checkbox"
              aria-checked={checked}
              before={<SelectMark checked={checked} />}
              inset={MARK_INSET}
              title={`${f.firstname} ${f.lastname}`.trim()}
              subtitle={meta || undefined}
              disabled={atMax}
              onClick={() => toggle(f)}
            />
          );
        })
      )}
    </ListGroup>
  );
}

const STRATEGIES: { v: SeatStrategy; t: string; d: string }[] = [
  { v: "all", t: "Hammasi birga", d: "Yoki hech nima — guruh ajralmaydi" },
  { v: "partial", t: "Nechta bo'lsa, shuncha", d: "Kamida bittasini kafolatlash" },
];

/**
 * "Joy yetmasa" — what to do when fewer seats turn up than the group needs.
 * Only meaningful with two or more seated passengers; it rises in when the
 * second one is ticked.
 */
export function SeatStrategyGroup({
  value, onChange,
}: { value: SeatStrategy; onChange: (v: SeatStrategy) => void }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
    >
      <ListGroup
        role="radiogroup"
        aria-label="Joy yetmasa"
        label="Joy yetmasa"
        footer={
          value === "partial"
            ? "Nechta joy bo'lsa, shuncha olinadi. Qolganlari uchun kuzatuv davom etadi."
            : "Hamma yo'lovchiga bitta vagondan joy topilmaguncha kutiladi."
        }
      >
        {STRATEGIES.map(o => {
          const on = value === o.v;
          return (
            <ListRow
              key={o.v}
              role="radio"
              aria-checked={on}
              before={<RadioMark checked={on} />}
              inset={MARK_INSET}
              title={o.t}
              subtitle={wrap(o.d)}
              selected={on}
              onClick={() => onChange(o.v)}
            />
          );
        })}
      </ListGroup>
    </m.div>
  );
}
