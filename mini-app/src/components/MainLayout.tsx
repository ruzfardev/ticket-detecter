import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabbar } from "@telegram-apps/telegram-ui";
import { Bell, Settings, Sparkles } from "lucide-react";

type Props = { children: ReactNode };

const TABS = [
  { path: "/home",     label: "Xabarnoma",  Icon: Bell      },
  { path: "/premium",  label: "Premium",    Icon: Sparkles  },
  { path: "/settings", label: "Sozlamalar", Icon: Settings  },
];

export function MainLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <div style={{ paddingBottom: "calc(var(--tabbar-h) + var(--safe-bottom))" }}>
        {children}
      </div>
      <Tabbar>
        {TABS.map(({ path, label, Icon }) => (
          <Tabbar.Item
            key={path}
            text={label}
            selected={location.pathname === path}
            onClick={() => navigate(path)}
          >
            <Icon size={28} strokeWidth={1.75} />
          </Tabbar.Item>
        ))}
      </Tabbar>
    </>
  );
}
