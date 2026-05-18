import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Sparkles, TrainFront, CalendarDays } from "lucide-react";

import { getMe, listSubscriptions } from "@/api/client";
import { useWizard } from "@/store/wizard";
import { useHaptic } from "@/hooks/useHaptic";
import { Screen } from "@/components/Screen";
import { StatusView } from "@/components/StatusView";
import { Wordmark } from "@/components/Wordmark";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list";

export function Home() {
  const navigate = useNavigate();
  const haptic = useHaptic();
  const reset = useWizard(s => s.reset);
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const subs = useQuery({ queryKey: ["subs"], queryFn: listSubscriptions });

  if (me.isLoading || subs.isLoading) return <StatusView kind="loading" />;
  if (!me.data || !subs.data) {
    return <StatusView kind="error" description="Ma'lumotni yuklab bo'lmadi." />;
  }

  const { slot, user } = me.data;
  const isFree = user.tier === "free";
  const slotFull = slot.used >= slot.max;
  const list = subs.data.subscriptions;

  const handleNew = () => {
    haptic.impact("light");
    if (slotFull && isFree) {
      navigate("/premium");
      return;
    }
    reset();
    navigate("/new");
  };

  return (
    <Screen tabbed padded>
      <header className="flex items-center justify-between mb-1">
        <Wordmark size="md" />
        <Badge variant={isFree ? "outline" : "coral"}>
          {isFree ? "Free" : "Premium"}
        </Badge>
      </header>

      <section>
        <h1 className="font-display text-display-lg tracking-tight text-ink">
          Marshrutlaringiz
        </h1>
        <p className="text-body-md text-muted mt-1">
          {slot.used} / {slot.max} ta aktiv xabarnoma
        </p>
      </section>

      {list.length === 0 ? (
        <Card variant="feature" pad="lg">
          <div className="flex flex-col items-start gap-4">
            <div className="h-10 w-10 rounded-pill bg-canvas flex items-center justify-center">
              <TrainFront className="h-5 w-5 text-ink" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-display-sm text-ink">
                Birinchi xabarnomangizni yarating
              </h3>
              <p className="text-body-md text-body">
                Marshrut tanlang — joy paydo bo'lishi bilan Telegram orqali xabar yetadi.
              </p>
            </div>
            <Button onClick={handleNew} className="mt-1">
              <Plus className="h-5 w-5" strokeWidth={2} />
              Yangi xabarnoma
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <ListGroup label="Aktiv xabarnomalar">
            {list.map(s => (
              <ListRow
                key={s.id}
                before={
                  <div className="h-10 w-10 rounded-pill bg-canvas flex items-center justify-center">
                    <TrainFront className="h-5 w-5 text-ink" strokeWidth={1.75} />
                  </div>
                }
                title={`${s.dep_name} → ${s.arr_name}`}
                subtitle={
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {s.travel_date} · {s.train_number || "har qanday"}
                  </span>
                }
                after={
                  <span
                    className={`h-2 w-2 rounded-pill ${
                      s.is_active ? "bg-coral" : "bg-muted-soft"
                    }`}
                    aria-hidden
                  />
                }
                chevron
                onClick={() => navigate(`/sub/${s.id}`)}
              />
            ))}
          </ListGroup>

          <Button full onClick={handleNew}>
            <Plus className="h-5 w-5" strokeWidth={2} />
            {slotFull && isFree ? "Premium kerak — slot to'lgan" : "Yangi xabarnoma"}
          </Button>
        </>
      )}

      {isFree && (
        <Card variant="dark" pad="lg">
          <div className="flex flex-col gap-3">
            <Sparkles className="h-6 w-6 text-accent-amber" strokeWidth={1.75} />
            <div className="space-y-1">
              <h3 className="font-display text-display-sm text-on-dark">
                Premium oling
              </h3>
              <p className="text-body-md text-on-dark-soft">
                3× tezroq tekshirish va 3 ta slot. Telegram Stars orqali.
              </p>
            </div>
            <CardContent className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/premium")}
                className="inline-flex items-center gap-2 rounded-md bg-on-dark text-ink px-4 py-2 text-button font-medium hover:bg-on-dark/90 transition-colors"
              >
                Premium ko'rish
              </button>
            </CardContent>
          </div>
        </Card>
      )}
    </Screen>
  );
}
