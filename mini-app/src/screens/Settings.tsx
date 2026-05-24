import { useNavigate } from "react-router-dom";
import { MessageCircle, Megaphone, Heart } from "lucide-react";

import { useTelegram } from "@/hooks/useTelegram";
import { Screen } from "@/components/Screen";
import { ListGroup, ListRow } from "@/components/ui/list";

export function Settings() {
  const navigate = useNavigate();
  const { openLink } = useTelegram();

  return (
    <Screen tabbed padded title="Sozlamalar">
      <ListGroup label="Aloqa">
        <ListRow
          before={<MessageCircle className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title="Support"
          onClick={() => openLink("https://t.me/TicketDetectorSupport")}
        />
        <ListRow
          before={<Megaphone className="h-5 w-5 text-ink" strokeWidth={1.75} />}
          title="Yangiliklar kanali"
          onClick={() => openLink("https://t.me/TicketTips")}
        />
      </ListGroup>

      <ListGroup label="Boshqa" footer="v0.1.0">
        <ListRow
          before={<Heart className="h-5 w-5 text-coral" strokeWidth={1.75} />}
          title="Loyihani qo'llab-quvvatlash"
          subtitle="Telegram Stars orqali"
          onClick={() => navigate("/donate")}
          chevron
        />
      </ListGroup>
    </Screen>
  );
}
