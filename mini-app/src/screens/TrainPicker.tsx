import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Badge, Cell, List, Placeholder, Section, Spinner,
} from "@telegram-apps/telegram-ui";

import { searchTrains } from "@/api/client";
import { useMainButton } from "@/hooks/useMainButton";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizardGuard } from "@/hooks/useWizardGuard";
import { useWizard } from "@/store/wizard";

function fmtTime(iso: string): string {
  if (iso.includes("T") && iso.length >= 16) return iso.slice(11, 16);
  return iso;
}

export function TrainPicker() {
  useWizardGuard(["dep_code", "arr_code", "travel_date"]);

  const navigate = useNavigate();
  const setField = useWizard(s => s.setField);
  const dep_code = useWizardField("dep_code");
  const arr_code = useWizardField("arr_code");
  const travel_date = useWizardField("travel_date");
  const train_number = useWizardField("train_number");

  const { data, isLoading, error } = useQuery({
    queryKey: ["trains", dep_code, arr_code, travel_date],
    queryFn: () => searchTrains({
      dep_code: dep_code as string,
      arr_code: arr_code as string,
      date: travel_date as string,
    }),
    enabled: !!(dep_code && arr_code && travel_date),
  });

  const onContinue = useCallback(() => navigate("/new/car-type"), [navigate]);
  useMainButton({ text: "Davom etish", enabled: !!train_number, onClick: onContinue });

  return (
    <List>
      <Section header={data ? `${data.length} ta poyezd` : "Poyezdlar"}>
        {isLoading && (
          <Cell><Spinner size="s" /></Cell>
        )}
        {!!error && (
          <Placeholder
            header="railway.uz mavjud emas"
            description="Bir oz keyin qayta urinib ko'ring."
          />
        )}
        {!isLoading && !error && data?.length === 0 && (
          <Placeholder
            header="Poyezdlar topilmadi"
            description="Boshqa sanani tanlang."
          />
        )}
        {data?.map(t => {
          const total = t.car_types.reduce((s, c) => s + c.free_seats, 0);
          const types = t.car_types.map(c => `${c.type} (${c.free_seats})`).join(", ");
          return (
            <Cell
              key={t.number}
              subtitle={
                <>
                  {fmtTime(t.departure)} → {fmtTime(t.arrival)}
                  {t.time_on_way ? ` · ${t.time_on_way}` : ""}
                  {types ? ` · ${types}` : " · joy yo'q"}
                </>
              }
              after={
                <Badge type="number" mode={total > 0 ? "primary" : undefined}>
                  {total}
                </Badge>
              }
              onClick={() => {
                setField("train_number", t.number);
                setField("train_brand", t.brand);
              }}
              hovered={train_number === t.number}
            >
              <b>{t.number}</b>{t.brand ? ` · ${t.brand}` : ""}
            </Cell>
          );
        })}
      </Section>
    </List>
  );
}
