import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Badge, Caption, Cell, List, Placeholder, Section, Skeleton, Spinner,
} from "@telegram-apps/telegram-ui";

import { searchTrains } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { useWizard } from "@/store/wizard";

export function TrainPicker() {
  const navigate = useNavigate();
  const { mainButton } = useTelegram();
  const { dep_code, arr_code, travel_date, train_number, setField } = useWizard();

  const { data, isLoading, error } = useQuery({
    queryKey: ["trains", dep_code, arr_code, travel_date],
    queryFn: () => searchTrains({
      dep_code: dep_code!, arr_code: arr_code!, date: travel_date!,
    }),
    enabled: !!(dep_code && arr_code && travel_date),
  });

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText("Davom etish");
    mainButton.show();
    if (train_number) mainButton.enable();
    else mainButton.disable();
    const handler = () => navigate("/new/car-type");
    mainButton.onClick(handler);
    return () => mainButton.offClick(handler);
  }, [mainButton, train_number, navigate]);

  if (isLoading) {
    return <Skeleton visible><div style={{ height: 300 }} /></Skeleton>;
  }
  if (error) {
    return <Placeholder header="⚠️ railway.uz mavjud emas" description="Bir oz keyin qayta urinib ko'ring." />;
  }
  if (!data?.length) {
    return <Placeholder header="📭 Poyezdlar topilmadi" description="Boshqa sana tanlang." />;
  }

  return (
    <List>
      <Section header={`${data.length} ta poyezd topildi`}>
        {data.map(t => {
          const total = t.car_types.reduce((s, c) => s + c.free_seats, 0);
          return (
            <Cell
              key={t.number}
              subtitle={
                <>
                  {fmtTime(t.departure)} → {fmtTime(t.arrival)}
                  {t.time_on_way ? ` (${t.time_on_way})` : ""}
                  {" · "}
                  {t.car_types.map(c => `${c.type} (${c.free_seats})`).join(", ") || "joy yo'q"}
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

function fmtTime(iso: string): string {
  if (iso.includes("T") && iso.length >= 16) return iso.slice(11, 16);
  return iso;
}
