import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MessageCircle, Megaphone, Heart, Monitor, Sun, Moon,
  Train, LinkIcon, Users, Unlink, CreditCard, Receipt,
} from "lucide-react";

import { getCard, getRailwayStatus, unlinkRailway } from "@/api/client";
import { useTelegram } from "@/hooks/useTelegram";
import { useHaptic } from "@/hooks/useHaptic";
import { useTheme, type FxPref, type Palette, type ThemeMode } from "@/store/theme";
import { Screen } from "@/components/Screen";
import { ListGroup, ListRow } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import { IconTile } from "@/components/ui/tile";

const THEME_OPTS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Tizim",   icon: <Monitor strokeWidth={1.9} /> },
  { value: "light",  label: "Yorug'",  icon: <Sun strokeWidth={1.9} /> },
  { value: "dark",   label: "Tungi",   icon: <Moon strokeWidth={1.9} /> },
];

// Swatches are literal hexes (the light variant of each palette) so every
// option shows its own colors regardless of which palette is active.
const PALETTE_OPTS: { value: Palette; label: string; swatch: [string, string, string] }[] = [
  { value: "cream",   label: "Chiptachi", swatch: ["#e0694a", "#e9a14a", "#4fb39f"] },
  { value: "eticket", label: "Eticket",   swatch: ["#01c3a7", "#187cee", "#ffc233"] },
  { value: "emerald", label: "Zumrad",    swatch: ["#0c8d62", "#f59f0a", "#3aa0d8"] },
];

const FX_OPTS: { value: FxPref; label: string }[] = [
  { value: "auto", label: "Avto" },
  { value: "full", label: "To'liq" },
  { value: "lite", label: "Yengil" },
];

function Swatch({ colors }: { colors: [string, string, string] }) {
  return (
    <span className="flex -space-x-1.5">
      {colors.map(c => (
        <span
          key={c}
          className="size-[18px] rounded-full ring-2 ring-canvas/70"
          style={{ backgroundColor: c }}
        />
      ))}
    </span>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <div className="px-1 text-caption font-semibold text-muted">{label}</div>
      {children}
      {hint && <p className="px-1 text-caption text-muted">{hint}</p>}
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const haptic = useHaptic();
  const { openLink, showConfirm } = useTelegram();
  const mode = useTheme(s => s.mode);
  const setMode = useTheme(s => s.setMode);
  const palette = useTheme(s => s.palette);
  const setPalette = useTheme(s => s.setPalette);
  const fx = useTheme(s => s.fx);
  const setFx = useTheme(s => s.setFx);

  const accountQ = useQuery({ queryKey: ["railwayAccount"], queryFn: getRailwayStatus });
  const cardQ = useQuery({ queryKey: ["card"], queryFn: getCard });
  const unlink = useMutation({
    mutationFn: unlinkRailway,
    onSuccess: () => {
      toast.success("Akkount uzildi");
      qc.invalidateQueries({ queryKey: ["railwayAccount"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["subs"] });
    },
    onError: () => toast.error("Uzishda xato"),
  });

  return (
    <Screen tabbed padded title="Sozlamalar">
      <ListGroup label="Ko'rinish">
        <div className="space-y-5 p-4">
          <Field label="Mavzu">
            <Segmented
              layout="stack"
              aria-label="Mavzu"
              value={mode}
              onChange={setMode}
              options={THEME_OPTS}
            />
          </Field>
          <Field label="Rang">
            <Segmented
              layout="stack"
              aria-label="Rang"
              value={palette}
              onChange={setPalette}
              options={PALETTE_OPTS.map(p => ({ value: p.value, label: p.label, icon: <Swatch colors={p.swatch} /> }))}
            />
          </Field>
          <Field
            label="Shisha effekti"
            hint={
              fx === "lite"
                ? "Yengil rejim: kamroq xiralik — kuchsiz telefonlarda tezroq ishlaydi."
                : fx === "full"
                  ? "To'liq rejim: xira shisha, yorug'lik va harakat."
                  : "Avto: qurilmangizga qarab o'zi tanlanadi."
            }
          >
            <Segmented aria-label="Shisha effekti" value={fx} onChange={setFx} options={FX_OPTS} />
          </Field>
        </div>
      </ListGroup>

      <ListGroup
        label="Railway akkauntim"
        footer={
          accountQ.data?.link_status === "login_failed"
            ? "Parol o'zgargan ko'rinadi — qaytadan ulang"
            : accountQ.data?.last_sync_at
              ? `Oxirgi yangilash: ${new Date(accountQ.data.last_sync_at).toLocaleString()}`
              : undefined
        }
      >
        {!accountQ.data?.linked ? (
          <ListRow
            before={<IconTile icon={Train} tone="coral" />}
            title="eticket.railway.uz'ni ulash"
            subtitle="Hamrohlar va auto-buy uchun"
            onClick={() => navigate("/railway-link")}
            chevron
          />
        ) : (
          <>
            <ListRow
              before={<IconTile icon={LinkIcon} tone="green" />}
              title={accountQ.data.masked_username ?? "Ulangan"}
              subtitle="eticket akkounti"
            />
            <ListRow
              before={<IconTile icon={Users} tone="teal" />}
              title="Hamrohlarim"
              onClick={() => navigate("/friends")}
              chevron
            />
            <ListRow
              before={<IconTile icon={Unlink} tone="red" />}
              title="Ulashni bekor qilish"
              destructive
              disabled={unlink.isPending}
              onClick={async () => {
                if (await showConfirm("Akkountni uzishni xohlaysizmi? Auto-buy o'chiriladi.")) {
                  haptic.impact("medium");
                  unlink.mutate();
                }
              }}
            />
          </>
        )}
      </ListGroup>

      <ListGroup label="To'lov va buyurtmalar">
        <ListRow
          before={<IconTile icon={CreditCard} tone={cardQ.data ? "coral" : "gray"} />}
          title={cardQ.data ? `Karta •••• ${cardQ.data.last4}` : "Karta saqlanmagan"}
          subtitle={cardQ.data ? "Auto-buy uchun" : "Auto-buy uchun saqlash kerak"}
          onClick={() => navigate("/cards/add")}
          chevron
        />
        <ListRow
          before={<IconTile icon={Receipt} tone="amber" />}
          title="Buyurtmalar"
          onClick={() => navigate("/orders")}
          chevron
        />
      </ListGroup>

      <ListGroup label="Aloqa">
        <ListRow
          before={<IconTile icon={MessageCircle} tone="blue" />}
          title="Support"
          onClick={() => openLink("https://t.me/railwayuzz_bot")}
        />
        <ListRow
          before={<IconTile icon={Megaphone} tone="violet" />}
          title="Yangiliklar kanali"
          onClick={() => openLink("https://t.me/railwayuzz")}
        />
      </ListGroup>

      <ListGroup label="Boshqa" footer="v0.1.0">
        <ListRow
          before={<IconTile icon={Heart} tone="pink" />}
          title="Loyihani qo'llab-quvvatlash"
          subtitle="Telegram Stars orqali"
          onClick={() => navigate("/donate")}
          chevron
        />
      </ListGroup>
    </Screen>
  );
}
