import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar, Cell, Input, List, Section,
} from "@telegram-apps/telegram-ui";
import { Search, MapPin } from "lucide-react";

import { listStations, Station } from "@/api/client";
import { useMainButton } from "@/hooks/useMainButton";
import { useWizardField } from "@/hooks/useWizardField";
import { useWizard } from "@/store/wizard";
import { StatusView } from "@/ui";

type Mode = "dep" | "arr";

export function RoutePicker() {
  const navigate = useNavigate();
  const setField = useWizard(s => s.setField);
  const dep_code = useWizardField("dep_code");
  const dep_name = useWizardField("dep_name");
  const arr_code = useWizardField("arr_code");
  const arr_name = useWizardField("arr_name");

  const [mode, setMode] = useState<Mode>(dep_code ? "arr" : "dep");
  const [q, setQ] = useState("");

  const { data: stations, isLoading } = useQuery({
    queryKey: ["stations", q],
    queryFn: () => listStations(q),
    staleTime: 30_000,
  });

  const ready = !!(dep_code && arr_code && dep_code !== arr_code);
  const onContinue = useCallback(() => navigate("/new/date"), [navigate]);

  useMainButton({ text: "Davom etish", enabled: ready, onClick: onContinue });

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
        footer={dep_name && arr_name ? `${dep_name} → ${arr_name}` : undefined}
      >
        <Input
          before={<Search size={18} />}
          placeholder="Stantsiya nomi..."
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        {isLoading ? (
          <StatusView kind="loading" />
        ) : (
          (stations ?? []).slice(0, 30).map(s => (
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

      {dep_name && (
        <Section header="Tanlangan">
          <Cell subtitle="Qayerdan">{dep_name}</Cell>
          {arr_name && <Cell subtitle="Qayerga">{arr_name}</Cell>}
          <Cell onClick={() => setMode(arr_code ? "arr" : "dep")}>
            {arr_code ? "Qayerga ni o'zgartirish" : "Qayerdan ni o'zgartirish"}
          </Cell>
        </Section>
      )}
    </List>
  );
}
