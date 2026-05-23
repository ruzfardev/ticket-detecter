import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin, ArrowDownUp, TrainFront, ChevronDown, Check,
} from "lucide-react";

import { createSubscription, searchTrains, Station } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import type { Berth } from "@/store/wizard";
import { PageHeader } from "@/components/wallet/PageHeader";
import { WalletSection } from "@/components/wallet/WalletSection";
import { Calendar } from "@/components/wallet/Calendar";
import { Chip } from "@/components/wallet/Chip";
import { Segmented } from "@/components/wallet/Segmented";
import { StationSheet } from "@/components/wallet/StationSheet";
import { StickyButton } from "@/components/wallet/StickyButton";

const CAR_TYPES = ["плацкарта", "купе", "люкс", "св", "сидячий"];
const BERTH_TYPES = new Set(["плацкарта", "купе"]);

function fmtTime(iso: string): string {
  if (iso.includes("T") && iso.length >= 16) return iso.slice(11, 16);
  return iso;
}

export function NewWatch() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { haptic } = useTelegram();

  const [dep, setDep] = useState<Station | null>(null);
  const [arr, setArr] = useState<Station | null>(null);
  const [date, setDate] = useState<string | undefined>();
  const [trainNumber, setTrainNumber] = useState<string | null>(null);
  const [carTypes, setCarTypes] = useState<string[]>([]);
  const [berth, setBerth] = useState<Berth>("any");
  const [advanced, setAdvanced] = useState(false);
  const [sheet, setSheet] = useState<"dep" | "arr" | null>(null);

  const needsBerth = carTypes.some(t => BERTH_TYPES.has(t));
  const canSave = !!dep && !!arr && !!date;

  const trains = useQuery({
    queryKey: ["trains", dep?.code, arr?.code, date],
    queryFn: () => searchTrains({ dep_code: dep!.code, arr_code: arr!.code, date: date! }),
    enabled: advanced && !!dep && !!arr && !!date,
  });

  const swap = () => {
    if (!dep && !arr) return;
    haptic?.impactOccurred?.("light");
    setDep(arr);
    setArr(dep);
  };

  const toggleCar = (t: string) => {
    setCarTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));
  };

  const save = useMutation({
    mutationFn: () =>
      createSubscription({
        dep_code: dep!.code,
        arr_code: arr!.code,
        travel_date: date!,
        train_number: trainNumber || null,
        car_types: carTypes,
        berth: needsBerth ? berth : "any",
      }),
    onSuccess: () => {
      haptic?.notificationOccurred?.("success");
      toast.success("Kuzatuv yaratildi");
      qc.invalidateQueries({ queryKey: ["subs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
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

  const endpoint = (s: Station | null, label: string) => (
    <button
      type="button"
      className="w-row w-press"
      onClick={() => setSheet(label === "Qayerdan" ? "dep" : "arr")}
      style={{
        all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center",
        gap: 12, width: "100%", padding: "14px 16px", minHeight: 60, cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "var(--accent-soft)", color: "var(--accent)",
        }}
      >
        <MapPin size={19} strokeWidth={2} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--hint)", fontWeight: 600 }}>
          {label}
        </span>
        <span
          style={{
            display: "block", fontSize: 16.5, fontWeight: 600, marginTop: 1,
            color: s ? "var(--text)" : "var(--hint)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {s ? s.name : "Tanlang"}
        </span>
      </span>
    </button>
  );

  return (
    <div style={{ overflowX: "hidden" }}>
      <PageHeader title="Yangi kuzatuv" />

      <div style={{ padding: "4px 12px 12px" }}>
        {/* ROUTE */}
        <div className="w-rise" style={{ position: "relative", marginBottom: "var(--gap)" }}>
          <div
            style={{
              background: "var(--card)", borderRadius: "var(--radius)",
              overflow: "hidden", boxShadow: "var(--shadow)",
            }}
          >
            {endpoint(dep, "Qayerdan")}
            <div style={{ borderTop: "1px solid var(--separator)" }} />
            {endpoint(arr, "Qayerga")}
          </div>
          <button
            type="button"
            aria-label="Almashtirish"
            onClick={swap}
            className="w-press"
            style={{
              all: "unset", position: "absolute", right: 18, top: "50%",
              transform: "translateY(-50%)", width: 38, height: 38, borderRadius: "50%",
              background: "var(--accent)", color: "var(--accent-tx)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "var(--shadow)",
            }}
          >
            <ArrowDownUp size={18} strokeWidth={2.25} />
          </button>
        </div>

        {/* DATE */}
        <div className="w-rise" style={{ animationDelay: "0.05s" }}>
          <WalletSection header="Sana">
            <Calendar value={date} onChange={setDate} />
          </WalletSection>
        </div>

        {/* ADVANCED (optional) */}
        <div className="w-rise" style={{ animationDelay: "0.1s" }}>
          <div
            style={{
              background: "var(--card)", borderRadius: "var(--radius)",
              overflow: "hidden", boxShadow: "var(--shadow)", marginBottom: "var(--gap)",
            }}
          >
            <button
              type="button"
              className="w-press"
              onClick={() => setAdvanced(v => !v)}
              style={{
                all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center",
                gap: 12, width: "100%", padding: "14px 16px", minHeight: 56, cursor: "pointer",
              }}
            >
              <span style={{ flex: 1, fontSize: 16, fontWeight: 500, color: "var(--text)" }}>
                Qo'shimcha sozlamalar
                <span style={{ color: "var(--hint)", fontWeight: 400 }}> · ixtiyoriy</span>
              </span>
              <ChevronDown
                size={20}
                strokeWidth={2}
                color="var(--hint)"
                style={{
                  transition: "transform 0.22s ease",
                  transform: advanced ? "rotate(180deg)" : "none",
                }}
              />
            </button>

            {advanced && (
              <div style={{ borderTop: "1px solid var(--separator)" }}>
                {/* TRAIN */}
                <div style={{ padding: "14px 16px 8px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--hint)", marginBottom: 10 }}>
                    POYEZD
                  </div>
                  <TrainRow
                    label="Barcha poyezdlar"
                    sub="Har qanday poyezdda joy qidiriladi"
                    selected={!trainNumber}
                    onClick={() => setTrainNumber(null)}
                  />
                  {(!dep || !arr || !date) ? (
                    <div style={{ fontSize: 13, color: "var(--hint)", padding: "8px 2px" }}>
                      Muayyan poyezd uchun avval marshrut va sanani tanlang.
                    </div>
                  ) : trains.isLoading ? (
                    <div style={{ fontSize: 13, color: "var(--hint)", padding: "8px 2px" }}>
                      Poyezdlar yuklanmoqda…
                    </div>
                  ) : trains.error ? (
                    <div style={{ fontSize: 13, color: "var(--hint)", padding: "8px 2px" }}>
                      Poyezdlar ro'yxatini olib bo'lmadi.
                    </div>
                  ) : (
                    trains.data?.map(t => {
                      const total = t.car_types.reduce((s, c) => s + c.free_seats, 0);
                      return (
                        <TrainRow
                          key={t.number}
                          label={`${t.number}${t.brand ? ` · ${t.brand}` : ""}`}
                          sub={`${fmtTime(t.departure)} → ${fmtTime(t.arrival)}${
                            t.time_on_way ? ` (${t.time_on_way})` : ""
                          } · ${total} joy`}
                          selected={trainNumber === t.number}
                          onClick={() => setTrainNumber(t.number)}
                        />
                      );
                    })
                  )}
                </div>

                {/* CAR TYPES */}
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--separator)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--hint)", marginBottom: 10 }}>
                    VAGON TURI
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CAR_TYPES.map(t => (
                      <Chip key={t} label={t} selected={carTypes.includes(t)} onClick={() => toggleCar(t)} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--hint)", marginTop: 8 }}>
                    Bo'sh qoldirsangiz barcha vagon turlari tekshiriladi.
                  </div>
                </div>

                {/* BERTH */}
                {needsBerth && (
                  <div style={{ paddingTop: 10, borderTop: "1px solid var(--separator)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--hint)", margin: "4px 16px 10px" }}>
                      JOY TURI
                    </div>
                    <Segmented
                      value={berth}
                      onChange={setBerth}
                      options={[
                        { value: "lower", label: "Pastki" },
                        { value: "upper", label: "Tepa" },
                        { value: "any", label: "Farqi yo'q" },
                      ]}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <StickyButton onClick={() => save.mutate()} disabled={!canSave} loading={save.isPending}>
        <TrainFront size={19} strokeWidth={2} />
        Kuzatuvni saqlash
      </StickyButton>

      <StationSheet
        open={sheet === "dep"}
        title="Qayerdan?"
        excludeCode={arr?.code}
        onClose={() => setSheet(null)}
        onPick={setDep}
      />
      <StationSheet
        open={sheet === "arr"}
        title="Qayerga?"
        excludeCode={dep?.code}
        onClose={() => setSheet(null)}
        onPick={setArr}
      />
    </div>
  );
}

function TrainRow({
  label, sub, selected, onClick,
}: {
  label: string; sub: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="w-press"
      onClick={onClick}
      style={{
        all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center",
        gap: 10, width: "100%", padding: "10px 4px", cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          border: selected ? "none" : "2px solid var(--separator)",
          background: selected ? "var(--accent)" : "transparent",
          color: "var(--accent-tx)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {selected && <Check size={14} strokeWidth={3} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15.5, fontWeight: 500, color: "var(--text)" }}>
          {label}
        </span>
        <span
          style={{
            display: "block", fontSize: 13, color: "var(--hint)", marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {sub}
        </span>
      </span>
    </button>
  );
}
