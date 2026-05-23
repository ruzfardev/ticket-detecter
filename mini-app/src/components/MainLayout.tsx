import { ReactNode } from "react";
import { Bell, Settings, Sparkles } from "lucide-react";
import { FloatingTabbar, FloatingTab } from "./wallet/FloatingTabbar";

type Props = { children: ReactNode };

const TABS: FloatingTab[] = [
  { path: "/home",     label: "Xabarnoma",  Icon: Bell      },
  { path: "/premium",  label: "Premium",    Icon: Sparkles  },
  { path: "/settings", label: "Sozlamalar", Icon: Settings  },
];

export function MainLayout({ children }: Props) {
  return (
    <>
      <div style={{ paddingBottom: 100 }}>
        {children}
      </div>
      <FloatingTabbar tabs={TABS} />
    </>
  );
}
