import { useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Lock, Mail, Phone } from "lucide-react";

import { linkRailway } from "@/api/client";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { IconTile } from "@/components/ui/tile";
import { StickyAction } from "@/components/StickyAction";
import { spring } from "@/lib/motion";

type Mode = "phone" | "email";

const MODE_OPTS: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: "phone", label: "Telefon", icon: <Phone strokeWidth={1.9} /> },
  { value: "email", label: "Pochta",  icon: <Mail strokeWidth={1.9} /> },
];

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
  const passwordRef = useRef<HTMLInputElement>(null);

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

  // The keyboard's own keys do what they say: "next" moves on to the
  // password, "go" submits — through the same guard as the button.
  const toPassword = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    passwordRef.current?.focus();
  };
  const submitOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (canSubmit) link.mutate();
  };

  return (
    <Screen
      padded
      title="Railway akkauntim"
      subtitle="eticket.railway.uz hisobingizni bog'lab, hamrohlaringizni va auto-buyni yoqing"
    >
      <div className="space-y-5">
        <Segmented aria-label="Kirish usuli" value={mode} onChange={setMode} options={MODE_OPTS} />

        <div className="relative space-y-5">
          {/* Only the login field changes with the mode; it settles in rather
              than blinking, and the password below never moves. */}
          <AnimatePresence initial={false} mode="popLayout">
            <m.div
              key={mode}
              className="space-y-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.08 } }}
              transition={spring.snappy}
            >
              {mode === "phone" ? (
                <>
                  <Label htmlFor="phone">Telefon raqami</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+998 90 123 45 67"
                    autoComplete="tel"
                    enterKeyHint="next"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onKeyDown={toPassword}
                    before={<Phone className="size-[18px]" strokeWidth={2} />}
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="email">Elektron pochta</Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    enterKeyHint="next"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={toPassword}
                    before={<Mail className="size-[18px]" strokeWidth={2} />}
                  />
                </>
              )}
            </m.div>
          </AnimatePresence>

          <div className="space-y-2">
            <Label htmlFor="password">Parol</Label>
            <Input
              ref={passwordRef}
              id="password"
              type="password"
              placeholder="••••••"
              autoComplete="current-password"
              enterKeyHint="go"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={submitOnEnter}
              before={<Lock className="size-[18px]" strokeWidth={2} />}
            />
          </div>
        </div>
      </div>

      {/* Why it is safe to hand us the password — quiet, but right where the
          password is asked for. */}
      <div className="surface-soft flex items-start gap-3.5 p-4">
        <IconTile icon={Lock} tone="green" />
        <div className="min-w-0 space-y-1">
          <p className="text-title-sm text-ink">eticket.railway.uz</p>
          <p className="text-body-sm text-muted">
            Parolingiz Fernet bilan shifrlanib saqlanadi. Biz uni faqat eticket'da
            login uchun ishlatamiz va hech qachon boshqa joyda ko'rinmaydi.
          </p>
        </div>
      </div>

      <StickyAction>
        <Button
          full
          size="lg"
          loading={link.isPending}
          disabled={!canSubmit}
          onClick={() => link.mutate()}
        >
          {link.isPending ? "Ulanyapti…" : "Ulash"}
        </Button>
      </StickyAction>
    </Screen>
  );
}
