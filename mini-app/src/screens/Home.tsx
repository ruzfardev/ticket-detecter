import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar, Badge, Cell, List, Placeholder, Section, Spinner,
} from "@telegram-apps/telegram-ui";
import {
  Plus, Sparkles, Heart, TrainFront, CalendarDays, ChevronRight,
} from "lucide-react";

import { getMe, listSubscriptions } from "@/api/client";
import { useWizard } from "@/store/wizard";

export function Home() {
  const navigate = useNavigate();
  const reset = useWizard(s => s.reset);
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });

  if (me.isLoading || subs.isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", padding: 40 }}>
        <Spinner size="l" />
      </div>
    );
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
      <Section header={`Xabarnomalar (${me.data?.slot.used}/${me.data?.slot.max})`}>
        {subs.data?.subscriptions.length === 0 ? (
          <Placeholder
            header="Hozircha xabarnoma yo'q"
            description="Pastdagi tugma orqali yangisini yarating."
          />
        ) : (
          subs.data?.subscriptions.map(s => (
            <Cell
              key={s.id}
              before={
                <Avatar size={40}>
                  <TrainFront size={20} strokeWidth={1.75} />
                </Avatar>
              }
              subtitle={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CalendarDays size={14} strokeWidth={1.75} />
                  {s.travel_date}
                  {" · "}
                  {s.train_number || "har qanday"}
                  {" · "}
                  {s.car_types.join(", ") || "barchasi"}
                </span>
              }
              after={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Badge type="dot" mode={s.is_active ? "primary" : undefined} />
                  <ChevronRight size={18} strokeWidth={1.75} />
                </span>
              }
              onClick={() => navigate(`/sub/${s.id}`)}
            >
              {s.dep_name} → {s.arr_name}
            </Cell>
          ))
        )}

        <Cell
          before={<Avatar size={40}><Plus size={20} strokeWidth={1.75} /></Avatar>}
          onClick={handleNew}
        >
          {slotFull && isFree ? "Premium kerak — slot to'lgan" : "Yangi xabarnoma"}
        </Cell>
      </Section>

      {isFree && (
        <Section>
          <Cell
            before={
              <Avatar size={40} style={{ background: "var(--tg-theme-button-color, #2481cc)" }}>
                <Sparkles size={20} strokeWidth={1.75} color="#fff" />
              </Avatar>
            }
            subtitle="3 ta slot + har 10s tekshirish"
            after={<ChevronRight size={18} strokeWidth={1.75} />}
            onClick={() => navigate("/premium")}
          >
            Premium oling
          </Cell>
        </Section>
      )}

      <Section>
        <Cell
          before={
            <Avatar size={40} style={{ background: "#FF6B6B" }}>
              <Heart size={20} strokeWidth={1.75} color="#fff" fill="#fff" />
            </Avatar>
          }
          subtitle="Loyihani qo'llab-quvvatlash"
          after={<ChevronRight size={18} strokeWidth={1.75} />}
          onClick={() => navigate("/donate")}
        >
          Donate
        </Cell>
      </Section>
    </List>
  );
}
