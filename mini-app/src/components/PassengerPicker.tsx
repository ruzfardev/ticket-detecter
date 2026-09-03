import { Check, Users } from "lucide-react";

import type { Friend } from "@/api/client";
import { ListGroup, ListRow } from "@/components/ui/list";
import { ageOn, bandOf, MAX_SEATED, passengerProblem } from "@/lib/passengers";

type Props = {
  friends: Friend[];
  travelDate?: string;
  seatedIds: number[];
  lapIds: number[];
  loading?: boolean;
  onChange: (seated: number[], lap: number[]) => void;
  onAddFriend: () => void;
};

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
      label={`Yo'lovchilar${seatedValid ? ` · ${seatedValid}/${MAX_SEATED}` : ""}`}
      footer={problem ?? `Bir vagondan ${MAX_SEATED} tagacha yonma-yon joy izlanadi. 5 yoshgacha bola quchoqda bepul, joy olmaydi.`}
    >
      {loading ? (
        <ListRow title="Yuklanmoqda…" />
      ) : friends.length === 0 ? (
        <ListRow
          before={<Users className="h-5 w-5 text-muted-soft" strokeWidth={1.75} />}
          title="Hamroh yo'q"
          subtitle="Avval eticket'da hamroh qo'shing"
          onClick={onAddFriend}
          chevron
        />
      ) : (
        <div className="flex flex-col">
          {friends.map(f => {
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
              <button
                key={f.id}
                type="button"
                disabled={atMax}
                onClick={() => toggle(f)}
                className="flex min-h-[56px] items-center gap-3 border-b border-hairline-soft px-4 py-3 text-left transition-colors last:border-b-0 active:bg-hairline-soft disabled:opacity-40"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                    checked ? "border-coral bg-coral text-on-primary" : "border-muted-soft"
                  }`}
                  aria-hidden
                >
                  {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-md font-medium text-ink">
                    {`${f.firstname} ${f.lastname}`.trim()}
                  </div>
                  <div className="truncate text-body-sm text-muted">{meta}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ListGroup>
  );
}
