import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar, Badge, Cell, List, Placeholder, Section,
} from "@telegram-apps/telegram-ui";
import {
  Plus, Sparkles, TrainFront, CalendarDays, ChevronRight,
} from "lucide-react";

import { getMe, listSubscriptions } from "@/api/client";
import { useWizard } from "@/store/wizard";
import { IconText, StatusView } from "@/ui";

export function Home() {
  const navigate = useNavigate();
  const reset = useWizard(s => s.reset);
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });

  if (me.isLoading || subs.isLoading) return <StatusView kind="loading" />;
  if (!me.data || !subs.data) return <StatusView kind="error" />;

  const { slot, user } = me.data;
  const isFree = user.tier === "free";
  const slotFull = slot.used >= slot.max;
  const list = subs.data.subscriptions;

  const handleNew = () => {
    if (slotFull && isFree) {
      navigate("/premium");
      return;
    }
    reset();
    navigate("/new");
  };

  return (
    <List>
      <Section header={`Xabarnomalar · ${slot.used}/${slot.max}`}>
        {list.length === 0 ? (
          <Placeholder
            header="Hozircha xabarnoma yo'q"
            description="Yangi marshrut qo'shing — joy paydo bo'lganda darhol xabar olasiz."
          />
        ) : (
          list.map(s => (
            <Cell
              key={s.id}
              before={
                <Avatar size={40}>
                  <TrainFront size={20} strokeWidth={1.75} />
                </Avatar>
              }
              subtitle={
                <IconText icon={CalendarDays} size={14} gap={1}>
                  {`${s.travel_date} · ${s.train_number || "har qanday"}`}
                </IconText>
              }
              after={<Badge type="dot" mode={s.is_active ? "primary" : undefined} />}
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
        <Section header="Yangilash">
          <Cell
            before={
              <Avatar size={40} style={{ background: "var(--tg-accent)" }}>
                <Sparkles size={20} strokeWidth={1.75} color="var(--tg-accent-text)" />
              </Avatar>
            }
            subtitle="3 ta slot · 3× tezroq tekshirish"
            after={<ChevronRight size={18} strokeWidth={1.75} />}
            onClick={() => navigate("/premium")}
          >
            Premium oling
          </Cell>
        </Section>
      )}
    </List>
  );
}
