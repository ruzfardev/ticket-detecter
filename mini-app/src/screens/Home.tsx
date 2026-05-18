import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar, Badge, Banner, Button, Cell, List, Placeholder, Section, Spinner,
} from "@telegram-apps/telegram-ui";
import { Plus, Star, Settings as SettingsIcon, Heart, Train } from "lucide-react";

import { getMe, listSubscriptions } from "@/api/client";
import { useWizard } from "@/store/wizard";

export function Home() {
  const navigate = useNavigate();
  const reset = useWizard(s => s.reset);
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });

  if (me.isLoading || subs.isLoading) {
    return <div style={{ display: "grid", placeItems: "center", padding: 40 }}><Spinner size="l" /></div>;
  }

  const slotFull = me.data && me.data.slot.used >= me.data.slot.max;
  const isFree = me.data?.user.tier === "free";

  const handleNew = () => {
    if (slotFull && isFree) {
      navigate("/premium");
    } else {
      reset();
      navigate("/new");
    }
  };

  return (
    <List>
      <Section header={`Xabarnomalaringiz (${me.data?.slot.used}/${me.data?.slot.max})`}>
        {subs.data?.subscriptions.length === 0 ? (
          <Placeholder
            header="📭 Hozircha xabarnoma yo'q"
            description="Pastdagi tugma orqali yangisini yarating."
          />
        ) : (
          subs.data?.subscriptions.map(s => (
            <Cell
              key={s.id}
              before={<Avatar size={40}><Train size={20} /></Avatar>}
              subtitle={`${s.travel_date} · ${s.train_number || "har qanday"} · ${s.car_types.join(", ") || "barchasi"}`}
              after={
                <Badge type="dot" mode={s.is_active ? "primary" : undefined} />
              }
              onClick={() => navigate(`/sub/${s.id}`)}
            >
              {s.dep_name} → {s.arr_name}
            </Cell>
          ))
        )}

        <Cell
          before={<Avatar size={40}><Plus size={20} /></Avatar>}
          onClick={handleNew}
        >
          {slotFull && isFree ? "⭐ Premium — slot to'lgan" : "Yangi xabarnoma"}
        </Cell>
      </Section>

      {isFree && (
        <Section>
          <Cell
            before={<Avatar size={40} style={{ background: "#FFD700" }}><Star size={20} color="#fff" /></Avatar>}
            subtitle="3 ta slot + har 10s tekshirish"
            onClick={() => navigate("/premium")}
          >
            ⭐ Premium oling
          </Cell>
        </Section>
      )}

      <Section>
        <Cell
          before={<Avatar size={40} style={{ background: "#FF6B6B" }}><Heart size={20} color="#fff" /></Avatar>}
          onClick={() => navigate("/donate")}
        >
          ❤️ Donate — qo'llab-quvvatlash
        </Cell>
        <Cell
          before={<Avatar size={40}><SettingsIcon size={20} /></Avatar>}
          onClick={() => navigate("/settings")}
        >
          ⚙️ Sozlamalar
        </Cell>
      </Section>
    </List>
  );
}
