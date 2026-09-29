import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Mail, Phone, Train } from "lucide-react";

import { linkRailway } from "@/api/client";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StickyAction } from "@/components/StickyAction";
import { cn } from "@/lib/utils";

type Mode = "phone" | "email";

function normalizePhone(raw: string): string {
  // Accept "+998 90 123 45 67" / "998901234567" / "901234567" → "+998901234567"
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) return "+" + digits;
  if (digits.length === 9) return "+998" + digits;
  return raw.trim();
}

export function RailwayLink() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const link = useMutation({
    mutationFn: () => {
      const username = mode === "phone" ? normalizePhone(phone) : email.trim();
      return linkRailway(username, password);
    },
    onSuccess: () => {
      toast.success("Akkount ulandi");
      qc.invalidateQueries({ queryKey: ["railwayAccount"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      navigate("/friends", { replace: true });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code;
      const msg =
        code === "railway_login_failed"
          ? "Login yoki parol noto'g'ri"
          : code === "railway_unavailable"
            ? "eticket.railway.uz hozir mavjud emas"
            : "Ulashda xato. Qaytadan urinib ko'ring";
      toast.error(msg);
    },
  });

  const username = mode === "phone" ? normalizePhone(phone) : email.trim();
  const canSubmit =
    !link.isPending &&
    password.length >= 4 &&
    (mode === "phone"
      ? /^\+998\d{9}$/.test(username)
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username));

  return (
    <Screen
      padded
      title="Railway akkauntim"
      subtitle="eticket.railway.uz hisobingizni bog'lab, hamrohlaringizni va auto-buyni yoqing"
    >
      <div className="flex gap-1 rounded-lg bg-surface-card p-1">
        {(["phone", "email"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-md py-2.5 text-caption transition-colors",
              mode === m ? "bg-canvas text-ink" : "text-muted hover:text-ink",
            )}
          >
            {m === "phone" ? <Phone size={18} strokeWidth={1.75} /> : <Mail size={18} strokeWidth={1.75} />}
            {m === "phone" ? "Telefon" : "Pochta"}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mode === "phone" ? (
          <div className="space-y-1">
            <Label htmlFor="phone">Telefon raqami</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="+998 90 123 45 67"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              before={<Phone size={16} strokeWidth={1.75} />}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="email">Elektron pochta</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              before={<Mail size={16} strokeWidth={1.75} />}
            />
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="password">Parol</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            before={<Lock size={16} strokeWidth={1.75} />}
          />
        </div>
      </div>

      <div className="rounded-md border border-hairline bg-surface-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-body-md font-medium text-ink">
          <Train size={18} strokeWidth={1.75} className="text-coral" />
          eticket.railway.uz
        </div>
        <p className="text-body-sm text-muted">
          Parolingiz Fernet bilan shifrlanib saqlanadi. Biz uni faqat eticket'da
          login uchun ishlatamiz va hech qachon boshqa joyda ko'rinmaydi.
        </p>
      </div>

      <StickyAction>
        <Button full disabled={!canSubmit} onClick={() => link.mutate()}>
          {link.isPending ? "Ulanyapti…" : "Ulash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
