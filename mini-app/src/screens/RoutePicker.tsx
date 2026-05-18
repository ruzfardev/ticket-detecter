import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar, Cell, Input, List, Section, Skeleton,
} from "@telegram-apps/telegram-ui";
import { Search, MapPin } from "lucide-react";

import { listStations, Station } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { useWizard } from "@/store/wizard";

type Mode = "dep" | "arr";

export function RoutePicker() {
  const navigate = useNavigate();
  const { mainButton } = useTelegram();
  const { dep_code, arr_code, setField } = useWizard();
  const [mode, setMode] = useState<Mode>(dep_code ? "arr" : "dep");
  const [q, setQ] = useState("");

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations", q],
    queryFn: () => listStations(q),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!mainButton) return;
    mainButton.setText("Davom etish");
    mainButton.show();
    if (dep_code && arr_code && dep_code !== arr_code) mainButton.enable();
    else mainButton.disable();
    const handler = () => navigate("/new/date");
    mainButton.onClick(handler);
    return () => mainButton.offClick(handler);
  }, [mainButton, dep_code, arr_code, navigate]);

  const pick = (s: Station) => {
    if (mode === "dep") {
      setField("dep_code", s.code);
      setField("dep_name", s.name);
      setMode("arr");
      setQ("");
    } else {
      setField("arr_code", s.code);
      setField("arr_name", s.name);
    }
  };

  return (
    <List>
      <Section
        header={mode === "dep" ? "Qayerdan?" : "Qayerga?"}
        footer={
          dep_code && arr_code
            ? `${useWizard.getState().dep_name} → ${useWizard.getState().arr_name}`
            : undefined
        }
      >
        <Input
          before={<Search size={18} />}
          placeholder="Stantsiya nomi..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {isLoading ? (
          <Skeleton visible><div style={{ height: 200 }} /></Skeleton>
        ) : (
          stations?.slice(0, 30).map(s => (
            <Cell
              key={s.code}
              before={<Avatar size={28}><MapPin size={16} strokeWidth={1.75} /></Avatar>}
              subtitle={s.city ?? undefined}
              onClick={() => pick(s)}
            >
              {s.name}
            </Cell>
          ))
        )}
      </Section>

      {dep_code && (
        <Section header="Tanlangan">
          <Cell subtitle="Qayerdan">{useWizard.getState().dep_name}</Cell>
          {arr_code && <Cell subtitle="Qayerga">{useWizard.getState().arr_name}</Cell>}
          <Cell onClick={() => setMode(arr_code ? "arr" : "dep")}>
            {arr_code ? "Qayerga ni o'zgartirish" : "Qayerdan ni o'zgartirish"}
          </Cell>
        </Section>
      )}
    </List>
  );
}
