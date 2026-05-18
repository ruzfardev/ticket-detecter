# 06 — Telegram Mini App Spetsifikatsiyasi

> **Status:** Draft v2 (TelegramUI) · **Oxirgi tahrir:** 2026-05-18
> **Stack:** React 18 + Vite + TypeScript + **@telegram-apps/telegram-ui**

Mini App — foydalanuvchi notification yaratish va boshqarish uchun asosiy interfeys. UI **@telegram-apps/telegram-ui** kutubxonasi orqali iOS/Android'ning nativeligidek ko'rinadi (avto-platform detection, Telegram theme variables).

---

## 1. Tech stack

| Komponent | Tanlov | Sabab |
|-----------|--------|-------|
| Framework | React 18 | Eng keng community |
| Bundler | Vite | Tez dev server, kichik build |
| Til | TypeScript | Type safety, openapi-typescript bilan integration |
| **UI kutubxonasi** | **@telegram-apps/telegram-ui** v2.x | iOS HIG + Material Design avto-switching, native Telegram look |
| **Telegram SDK** | **@telegram-apps/sdk-react** | initData, theme, MainButton, BackButton, haptic |
| Routing | react-router 6 | Ko'p screen flow |
| State mgmt | Zustand | Yengil, persistent sessionStorage |
| Data fetching | TanStack Query (React Query) | Caching, retry |
| Date picker | `react-day-picker` (lightweight, ~12KB) | TelegramUI'da Calendar yo'q |
| Forms | React Hook Form + Zod | Validatsiya |
| Icons | `@telegram-apps/telegram-ui/icons` + lucide-react fallback | Native Telegram ikonkalari |
| Charts | `recharts` (faqat Mini App'da kerak bo'lsa) | Sparkline (MVP'da kerak emas) |
| i18n | react-i18next | uz/ru/en |

### 1.1 Nima uchun TelegramUI

| Aspekt | TelegramUI | shadcn/ui (avval ko'rilgan) |
|--------|-----------|------------------------------|
| Native Telegram look | ✅ avto | ❌ generic web |
| iOS/Android farqi | ✅ `usePlatform` avto | ❌ qo'lda |
| Cell+Section pattern (settings ro'yxat) | ✅ built-in | ❌ qo'lda yig'iladi |
| Theme (TG variables) | ✅ avto, `AppRoot` orqali | 🟡 Tailwind config'da |
| Komponent ownership | ❌ npm | ✅ copy-paste |
| Bundle hajmi | ~80 KB gz | Faqat ishlatilganini |
| Custom dizayn | 🟡 cheklangan (CSS variables override) | ✅ cheksiz |

Sizning loyihangiz **native Telegram look** kerak — TelegramUI to'g'ri tanlov.

---

## 2. Setup va Telegram SDK

### 2.1 O'rnatish

```bash
npm create vite@latest mini-app -- --template react-ts
cd mini-app
npm install
npm install @telegram-apps/telegram-ui @telegram-apps/sdk-react
npm install react-router-dom@6 zustand @tanstack/react-query \
            react-hook-form zod @hookform/resolvers axios \
            react-day-picker date-fns react-i18next i18next \
            sonner clsx
```

### 2.2 Entry: `src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@telegram-apps/telegram-ui";
import "@telegram-apps/telegram-ui/dist/styles.css";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { useTelegram } from "./hooks/useTelegram";

const queryClient = new QueryClient();

function Root() {
  const { platform, colorScheme } = useTelegram();
  return (
    <AppRoot
      appearance={colorScheme}        // 'light' | 'dark' — Telegram'dan keladi
      platform={platform}             // 'ios' | 'base' (Android va boshqasi)
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </AppRoot>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<Root />);
```

> `AppRoot` Telegram'dan kelgan `platform` va `colorScheme` ni avtomatik propagate qiladi. Hech qanday qo'shimcha CSS yozish shart emas — barcha komponent ranglari TG variables'dan keladi.

### 2.3 `useTelegram` hook

```tsx
// src/hooks/useTelegram.ts
import { useEffect, useMemo } from "react";

declare global {
  interface Window { Telegram?: any; }
}

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, [tg]);

  return useMemo(() => ({
    initData:     tg?.initData ?? "",
    user:         tg?.initDataUnsafe?.user,
    colorScheme:  (tg?.colorScheme ?? "light") as "light" | "dark",
    platform:     (tg?.platform === "ios" ? "ios" : "base") as "ios" | "base",
    haptic:       tg?.HapticFeedback,
    mainButton:   tg?.MainButton,
    backButton:   tg?.BackButton,
    close:        () => tg?.close(),
    showAlert:    (text: string) => tg?.showAlert(text),
    showConfirm:  (text: string) => tg?.showConfirm(text),
    openInvoice:  (link: string, cb?: (status: string) => void) =>
                    tg?.openInvoice(link, cb),
  }), [tg]);
}
```

### 2.4 Platform-aware ikonkalar

TelegramUI ichida `Icon24*` (Android) va `Icon28*` (iOS) ikonka to'plamlari bor. Yoki `lucide-react` ham mos:

```tsx
import { Icon28AddCircle } from "@telegram-apps/telegram-ui/dist/icons/28/add_circle";
// yoki:
import { Plus } from "lucide-react";
```

---

## 3. Routing va screenlar

```
/                       → Welcome (auth + redirect)
/home                   → Asosiy ekran (sub'lar list + CTA)
/new                    → Wizard step 1: Route picker
/new/date               → Wizard step 2: Date picker
/new/train              → Wizard step 3: Train picker
/new/car-type           → Wizard step 4: Car type picker
/new/berth              → Wizard step 5: Berth picker (shartli)
/new/confirm            → Wizard step 6: Confirm + save
/sub/:id                → Subscription details
/premium                → Premium info + 5 tarif tugmalari
/donate                 → Donate (4 default + custom)
/settings               → Til, support, version
```

Wizard state: Zustand store + `sessionStorage`.

---

## 4. Screen tafsiloti

Har screen TelegramUI primitivlardan yig'iladi. Mavjud ko'rinish: native iOS/Android Telegram appearance.

### 4.1 Welcome (Auth)

```tsx
import { Spinner, Placeholder } from "@telegram-apps/telegram-ui";

export function Welcome() {
  const navigate = useNavigate();
  const { initData } = useTelegram();
  const { mutate, isPending, error } = useMutation({
    mutationFn: () => api.post("/api/v1/auth/tg"),
    onSuccess: () => navigate("/home"),
  });

  useEffect(() => { mutate(); }, []);

  return (
    <Placeholder
      header="🎫 Ticket Detector"
      description={isPending ? "Ulanmoqda..." : (error ? "Xato yuz berdi" : "")}
    >
      {isPending ? <Spinner size="l" /> : null}
    </Placeholder>
  );
}
```

### 4.2 Home — asosiy ekran

```
┌────────────────────────────────────┐
│  Salom, Farrukh!  ⭐ Free           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                     │
│  📋 Sizning xabarnomalaringiz       │ ← Section header
│  ┌───────────────────────────────┐ │
│  │ 🚂  Toshkent → Urganch         │ │ ← Cell
│  │     2026-04-24 · 076Ж          │ │
│  │     плацкарта · pastki    🟢   │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ➕  Yangi xabarnoma             │ │ ← Cell with action
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ⭐  Premium oling                │ │ ← Banner
│  │   3 ta xabarnoma + 3x tezroq    │ │
│  └───────────────────────────────┘ │
└────────────────────────────────────┘
```

```tsx
import { List, Section, Cell, Avatar, Badge, Banner, Button } from "@telegram-apps/telegram-ui";
import { Train, Plus, Star } from "lucide-react";

export function Home() {
  const { data: me } = useMe();
  const { data: subs } = useSubscriptions();
  const navigate = useNavigate();

  const slotsFull = me && (me.slot.used >= me.slot.max);

  return (
    <>
      <Section
        header={`📋 Xabarnomalaringiz (${me?.slot.used}/${me?.slot.max})`}
      >
        {subs?.subscriptions.map(s => (
          <Cell
            key={s.id}
            before={<Avatar size={40}><Train size={20} /></Avatar>}
            subtitle={`${s.travel_date} · ${s.train_number} · ${s.car_types.join(", ")}`}
            after={<Badge type="dot" mode={s.is_active ? "primary" : "gray"} />}
            onClick={() => navigate(`/sub/${s.id}`)}
          >
            {s.dep_name} → {s.arr_name}
          </Cell>
        ))}

        <Cell
          before={<Avatar size={40}><Plus size={20} /></Avatar>}
          onClick={() => slotsFull ? navigate("/premium") : navigate("/new")}
        >
          {slotsFull ? "⭐ Premium kerak (slot to'lgan)" : "Yangi xabarnoma"}
        </Cell>
      </Section>

      {me?.tier === "free" && (
        <Banner
          header="⭐ Premium oling"
          subheader="3 ta xabarnoma + har 10s tekshirish"
          callToAction={<Button size="s" onClick={() => navigate("/premium")}>Ko'rish</Button>}
        />
      )}
    </>
  );
}
```

### 4.3 Wizard step 1 — Route picker (`/new`)

```tsx
import { List, Section, Input, Cell, Avatar } from "@telegram-apps/telegram-ui";

export function RoutePicker() {
  const [dep, setDep] = useWizardField("dep_code");
  const [arr, setArr] = useWizardField("arr_code");
  const [query, setQuery] = useState("");
  const { data: stations } = useStations(query);
  const { mainButton } = useTelegram();

  useEffect(() => {
    mainButton.setText("Davom etish");
    mainButton.show();
    mainButton.onClick(() => navigate("/new/date"));
    if (!dep || !arr || dep === arr) mainButton.disable();
    else mainButton.enable();
    return () => mainButton.offClick();
  }, [dep, arr]);

  return (
    <List>
      <Section header="Qayerdan?">
        <Input
          placeholder="Stantsiya nomi..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          before={<SearchIcon />}
        />
        {stations?.map(s => (
          <Cell
            key={s.code}
            before={<Avatar size={32}>🚉</Avatar>}
            multiline
            selected={dep === s.code}
            onClick={() => setDep(s.code)}
          >
            {s.name}
          </Cell>
        ))}
      </Section>

      <Section header="Qayerga?">
        {/* arr uchun xuddi shunday */}
      </Section>

      <Section header="Tez tanlash">
        <Cell.Chips>
          {POPULAR_STATIONS.map(s => (
            <Chip
              key={s.code}
              mode={dep === s.code || arr === s.code ? "elevated" : "outline"}
              onClick={() => !dep ? setDep(s.code) : setArr(s.code)}
            >
              {s.name}
            </Chip>
          ))}
        </Cell.Chips>
      </Section>
    </List>
  );
}
```

### 4.4 Wizard step 2 — Date picker (`/new/date`)

`react-day-picker` TelegramUI ranglariga ulanadi:

```tsx
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import "./datepicker.css";    // TG variables override
import { Section } from "@telegram-apps/telegram-ui";

export function DatePickerScreen() {
  const [date, setDate] = useWizardField("travel_date");
  const today = new Date();
  const maxDate = addDays(today, 60);

  return (
    <Section header="Qachon sayohat qilasiz?">
      <DayPicker
        mode="single"
        selected={date ? new Date(date) : undefined}
        onSelect={d => setDate(d?.toISOString().slice(0, 10))}
        disabled={{ before: today, after: maxDate }}
        showOutsideDays
        weekStartsOn={1}
      />
    </Section>
  );
}
```

`datepicker.css`:
```css
.rdp-root {
  --rdp-accent-color: var(--tg-theme-button-color);
  --rdp-background-color: var(--tg-theme-secondary-bg-color);
  font-family: inherit;
}
.rdp-day_selected { background: var(--tg-theme-button-color); }
```

### 4.5 Wizard step 3 — Train picker

```tsx
import { Section, Cell, Avatar, Badge, Skeleton } from "@telegram-apps/telegram-ui";

export function TrainPicker() {
  const { dep_code, arr_code, travel_date } = useWizardStore();
  const [picked, setPicked] = useWizardField("train_number");
  const { data, isLoading } = useTrains({ dep_code, arr_code, date: travel_date });

  if (isLoading) return <Skeleton visible><div style={{height: 80}} /></Skeleton>;

  return (
    <Section header="Mavjud poyezdlar">
      {data?.trains.map(t => (
        <Cell
          key={t.number}
          before={<Avatar size={40}>🚂</Avatar>}
          subtitle={`${formatTime(t.departure)} → ${formatTime(t.arrival)} (${t.time_on_way})`}
          after={
            <Badge type="number" mode={t.car_types.some(c=>c.free_seats>0) ? "primary" : "gray"}>
              {t.car_types.reduce((s,c)=>s+c.free_seats, 0)}
            </Badge>
          }
          selected={picked === t.number}
          onClick={() => setPicked(t.number)}
        >
          <b>{t.number}</b> · {t.brand}
        </Cell>
      ))}
    </Section>
  );
}
```

### 4.6 Wizard step 4 — Car type picker

```tsx
import { Section, Cell, Checkbox } from "@telegram-apps/telegram-ui";

export function CarTypePicker() {
  const [carTypes, setCarTypes] = useWizardField("car_types", []);

  const toggle = (t: string) => {
    setCarTypes(carTypes.includes(t)
      ? carTypes.filter(x => x !== t)
      : [...carTypes, t]);
  };

  return (
    <Section header="Vagon turi (bir nechta tanlash mumkin)">
      {CAR_TYPES.map(t => (
        <Cell
          key={t}
          before={<Checkbox checked={carTypes.includes(t)} />}
          onClick={() => toggle(t)}
        >
          {t}
        </Cell>
      ))}
    </Section>
  );
}
```

### 4.7 Wizard step 5 — Berth picker (shartli)

Faqat плацкарта yoki купе tanlangan bo'lsa ko'rsatiladi:

```tsx
import { Section, Cell, Radio } from "@telegram-apps/telegram-ui";

export function BerthPicker() {
  const [berth, setBerth] = useWizardField("berth", "any");

  return (
    <Section
      header="Joy turi"
      footer="Past: chiqish oson · Tepa: tinchroq, arzonroq"
    >
      <Cell
        before={<Radio name="berth" checked={berth === "lower"} value="lower"
                       onChange={() => setBerth("lower")} />}
        subtitle="Toq raqamlar"
      >
        ⬇️ Pastki o'rin
      </Cell>
      <Cell
        before={<Radio name="berth" checked={berth === "upper"} value="upper"
                       onChange={() => setBerth("upper")} />}
        subtitle="Juft raqamlar"
      >
        ⬆️ Tepa o'rin
      </Cell>
      <Cell
        before={<Radio name="berth" checked={berth === "any"} value="any"
                       onChange={() => setBerth("any")} />}
      >
        🟦 Farqi yo'q
      </Cell>
    </Section>
  );
}
```

### 4.8 Wizard step 6 — Confirm

```tsx
import { List, Section, Cell, Headline } from "@telegram-apps/telegram-ui";

export function ConfirmScreen() {
  const wiz = useWizardStore();
  const { mutate, isPending } = useCreateSubscription();
  const { mainButton, haptic } = useTelegram();

  useEffect(() => {
    mainButton.setText("✅ Saqlash");
    mainButton.show();
    mainButton.onClick(() => mutate(wiz, {
      onSuccess: () => { haptic.notificationOccurred("success"); navigate("/home"); },
      onError:  () => { haptic.notificationOccurred("error"); },
    }));
    if (isPending) mainButton.showProgress(); else mainButton.hideProgress();
  }, [isPending]);

  return (
    <List>
      <Section header="Tasdiqlash">
        <Cell before="📍" subtitle="Marshrut">{wiz.dep_name} → {wiz.arr_name}</Cell>
        <Cell before="📅" subtitle="Sana">{wiz.travel_date}</Cell>
        <Cell before="🚆" subtitle="Poyezd">{wiz.train_number}</Cell>
        <Cell before="🪑" subtitle="Vagon turi">{wiz.car_types.join(", ")}</Cell>
        {wiz.berth !== "any" && (
          <Cell before="↕️" subtitle="Joy">{wiz.berth === "lower" ? "Pastki" : "Tepa"}</Cell>
        )}
      </Section>
    </List>
  );
}
```

### 4.9 Subscription details (`/sub/:id`)

```tsx
import { List, Section, Cell, Button } from "@telegram-apps/telegram-ui";

export function SubDetails() {
  const { id } = useParams();
  const { data: sub } = useSubscription(id);
  const { showConfirm } = useTelegram();
  const del = useDeleteSubscription();
  const togglePause = useToggleSubscription();

  return (
    <List>
      <Section header={`${sub.dep_name} → ${sub.arr_name}`}>
        <Cell subtitle="Sana">{sub.travel_date}</Cell>
        <Cell subtitle="Poyezd">{sub.train_number}</Cell>
        <Cell subtitle="Vagon">{sub.car_types.join(", ")} · {sub.berth}</Cell>
        <Cell subtitle="Holat">{sub.is_active ? "🟢 Aktiv" : "⏸ Pauzada"}</Cell>
      </Section>

      <Section header="Statistika">
        <Cell subtitle="Yaratilgan">{formatDate(sub.created_at)}</Cell>
        <Cell subtitle="Yuborilgan xabarlar">{sub.notif_count}</Cell>
        {sub.last_notified_at && (
          <Cell subtitle="Oxirgi xabar">{formatDate(sub.last_notified_at)}</Cell>
        )}
      </Section>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button
          mode="bezeled"
          stretched
          onClick={() => togglePause.mutate(sub.id)}
        >
          {sub.is_active ? "⏸ Pauza qilish" : "▶️ Davom ettirish"}
        </Button>
        <Button
          mode="plain"
          stretched
          onClick={async () => {
            if (await showConfirm("O'chirishni xohlaysizmi?")) {
              del.mutate(sub.id);
            }
          }}
        >
          🗑 O'chirish
        </Button>
      </div>
    </List>
  );
}
```

### 4.10 Premium (`/premium`)

```
┌────────────────────────────────────┐
│  ⭐ Premium                         │
│                                     │
│  Hozirgi: Free                      │
│                                     │
│  ⚡ Afzalliklar                      │
│  ✅ Har 10s tekshirish               │
│  ✅ 3 ta aktiv xabarnoma            │
│  ✅ Yangi funksiyalar dastlab       │
│  ✅ 3x tezroq topish                │
│                                     │
│  Tarif tanlang                      │
│  ┌──────────────────────────────┐ │
│  │ 1 kun                  20 ⭐  │ │ ← Cell
│  │ 20 ⭐/kun                     │ │
│  ├──────────────────────────────┤ │
│  │ 3 kun                  50 ⭐  │ │
│  │ 16.7 ⭐/kun                   │ │
│  ├──────────────────────────────┤ │
│  │ ...                           │ │
│  ├──────────────────────────────┤ │
│  │ 💎 30 kun · Eng tejamli 350⭐ │ │ ← Badge
│  │ 11.7 ⭐/kun                   │ │
│  └──────────────────────────────┘ │
└────────────────────────────────────┘
```

```tsx
import { List, Section, Cell, Banner, Badge, Caption } from "@telegram-apps/telegram-ui";

export function Premium() {
  const { data: me } = useMe();
  const { data: plans } = usePlans();
  const { openInvoice, haptic } = useTelegram();

  const buy = async (planId: string) => {
    const { data } = await api.get(`/api/v1/payments/invoice?plan=${planId}`);
    openInvoice(data.invoice_link, (status) => {
      if (status === "paid") { haptic.notificationOccurred("success"); refetchMe(); }
    });
  };

  return (
    <List>
      <Banner
        header="⭐ Premium"
        subheader={`Hozirgi: ${me?.tier === "premium" ? "Premium" : "Free"}`}
        type="section"
      />

      <Section header="⚡ Afzalliklari">
        <Cell before="✅">Har 10 sekundda tekshirish</Cell>
        <Cell before="✅">3 ta aktiv xabarnoma</Cell>
        <Cell before="✅">Yangi funksiyalar dastlab</Cell>
        <Cell before="✅">3 baravar tezroq topish</Cell>
      </Section>

      <Section header="Tarif tanlang">
        {plans?.premium.map(p => (
          <Cell
            key={p.id}
            after={
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <b style={{ fontFamily: "var(--tg-font-mono)" }}>⭐ {p.stars}</b>
                <Caption level="2" weight="3">{(p.stars/p.days).toFixed(1)} ⭐/kun</Caption>
              </div>
            }
            subtitle={p.badge ? "💎 Eng tejamli" : undefined}
            onClick={() => buy(p.id)}
          >
            {p.days} kun
          </Cell>
        ))}
      </Section>

      <Section header="Tarix">
        <Cell onClick={() => navigate("/premium/history")}>
          📜 Sotib olish tarixi
        </Cell>
      </Section>
    </List>
  );
}
```

### 4.11 Donate (`/donate`)

```tsx
import { List, Section, Cell, Modal, Input, Slider, Button } from "@telegram-apps/telegram-ui";

const DONATE_OPTS = [
  { id: "donate_25",  stars: 25,  emoji: "☕", label: "Kichik rahmat" },
  { id: "donate_50",  stars: 50,  emoji: "🍪", label: "O'rtacha rahmat" },
  { id: "donate_100", stars: 100, emoji: "🍰", label: "Katta rahmat" },
  { id: "donate_500", stars: 500, emoji: "🎁", label: "Generous" },
];

export function Donate() {
  const [customOpen, setCustomOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const { openInvoice, haptic } = useTelegram();

  return (
    <List>
      <Banner header="💝 Botni qo'llab-quvvatlash" type="section"
              description="Premium status bermaydi, lekin loyihaga yordam beradi." />

      <Section header="Tanlang">
        {DONATE_OPTS.map(o => (
          <Cell
            key={o.id}
            before={o.emoji}
            after={<b>⭐ {o.stars}</b>}
            onClick={() => donate(o.id)}
          >
            {o.label}
          </Cell>
        ))}
        <Cell
          before="✏️"
          onClick={() => setCustomOpen(true)}
        >
          Boshqa miqdor
        </Cell>
      </Section>

      <Modal open={customOpen} onOpenChange={setCustomOpen}>
        <Modal.Header>Miqdorni tanlang</Modal.Header>
        <div style={{ padding: 16 }}>
          <Caption level="1">10–5000 ⭐ oraliq</Caption>
          <Input
            type="number"
            value={amount}
            onChange={e => setAmount(+e.target.value)}
            min={10} max={5000}
          />
          <Button stretched onClick={() => donate("donate_custom", amount)}>
            ⭐ {amount} bilan rahmat aytish
          </Button>
        </div>
      </Modal>
    </List>
  );
}
```

### 4.12 Settings (`/settings`)

```tsx
import { List, Section, Cell, Selectable } from "@telegram-apps/telegram-ui";

export function Settings() {
  const { data: me } = useMe();
  const updateLang = useUpdateLang();

  return (
    <List>
      <Section header="Til">
        {[
          { code: "uz", flag: "🇺🇿", label: "O'zbekcha" },
          { code: "ru", flag: "🇷🇺", label: "Русский" },
          { code: "en", flag: "🇬🇧", label: "English" },
        ].map(l => (
          <Cell
            key={l.code}
            before={l.flag}
            after={me?.lang === l.code ? "✓" : null}
            onClick={() => updateLang.mutate(l.code)}
          >
            {l.label}
          </Cell>
        ))}
      </Section>

      <Section header="Aloqa">
        <Cell before="📞" onClick={() => openLink("https://t.me/TicketDetectorSupport")}>
          Support
        </Cell>
        <Cell before="📢" onClick={() => openLink("https://t.me/TicketTips")}>
          Yangiliklar kanali
        </Cell>
      </Section>

      <Section footer={`Versiya ${VERSION}`}>
        <Cell before="📜" onClick={() => navigate("/terms")}>Foydalanish shartlari</Cell>
        <Cell before="🔒" onClick={() => navigate("/privacy")}>Maxfiylik</Cell>
      </Section>
    </List>
  );
}
```

---

## 5. State management (Zustand)

```tsx
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type WizardState = {
  dep_code?: string;
  arr_code?: string;
  travel_date?: string;
  train_number?: string;
  car_types: string[];
  berth: "lower" | "upper" | "any";
  setField: <K extends keyof Omit<WizardState, "setField"|"reset">>(key: K, val: WizardState[K]) => void;
  reset: () => void;
};

const initial = { car_types: [], berth: "any" as const };

export const useWizardStore = create(persist<WizardState>(
  (set) => ({
    ...initial,
    setField: (k, v) => set({ [k]: v } as any),
    reset:    () => set(initial),
  }),
  { name: "td-wizard", storage: createJSONStorage(() => sessionStorage) }
));

// Helper:
export function useWizardField<K extends keyof WizardState>(
  key: K, defaultValue?: WizardState[K]
): [WizardState[K], (v: WizardState[K]) => void] {
  const value = useWizardStore(s => s[key] ?? defaultValue);
  const setField = useWizardStore(s => s.setField);
  return [value, (v) => setField(key, v)];
}
```

---

## 6. API client

```tsx
// src/api/client.ts
import axios from "axios";

const initData = window.Telegram?.WebApp?.initData ?? "";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { "X-Tg-Init-Data": initData },
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      window.Telegram?.WebApp?.showAlert("Sessiya tugagan, Mini App ni qayta oching.");
      window.Telegram?.WebApp?.close();
    }
    return Promise.reject(err);
  }
);
```

React Query hooks:

```tsx
export const useMe = () => useQuery({
  queryKey: ["me"],
  queryFn: () => api.get("/api/v1/me").then(r => r.data),
});

export const useSubscriptions = () => useQuery({
  queryKey: ["subs"],
  queryFn: () => api.get("/api/v1/subscriptions").then(r => r.data),
});

export const useCreateSubscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewSub) => api.post("/api/v1/subscriptions", body).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subs"] }),
  });
};

export const useStations = (q: string) => useQuery({
  queryKey: ["stations", q],
  queryFn: () => api.get(`/api/v1/stations?q=${encodeURIComponent(q)}`).then(r => r.data.stations),
  staleTime: 60_000,
});

export const useTrains = (params: TrainSearchParams) => useQuery({
  queryKey: ["trains", params],
  queryFn: () => api.post("/api/v1/trains/search", params).then(r => r.data),
  staleTime: 30_000,
});
```

---

## 7. Loading, empty, error states

TelegramUI primitivlari:

| Holat | Komponent |
|-------|-----------|
| Initial load | `<Spinner size="l" />` yoki `<Skeleton visible>` |
| Empty list | `<Placeholder header="📭 Hozircha xabarnoma yo'q" description="..." />` |
| API error | `<Banner type="section" header="⚠️ Xato" subheader={msg} callToAction={<Button>Qayta urinish</Button>} />` |
| Mutation loading | `mainButton.showProgress()` |
| Success toast | `sonner` library (TelegramUI'da Toast yo'q) |

```tsx
import { toast } from "sonner";
toast.success("Xabarnoma yaratildi!");
```

---

## 8. Validation (Zod)

```tsx
export const SubFormSchema = z.object({
  dep_code: z.string().regex(/^\d{7}$/),
  arr_code: z.string().regex(/^\d{7}$/),
  travel_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  train_number: z.string().min(1).max(10),
  car_types: z.array(z.enum(["плацкарта", "купе", "люкс", "св", "сидячий"])).min(1),
  berth: z.enum(["lower", "upper", "any"]),
}).refine(d => d.dep_code !== d.arr_code, {
  message: "Jo'nash va manzil bir xil bo'lishi mumkin emas",
});
```

---

## 9. Accessibility va UX

- **Haptic feedback** — wizard step o'tishlarida `haptic.impactOccurred("light")`, save'da `haptic.notificationOccurred("success")`
- **MainButton/BackButton** — Telegram'ning native tugmalari (HTML tugma emas)
- **TelegramUI'ning Section/Cell** — avto-divider, avto-padding (Telegram'ning native paddingi)
- **Dark/light mode** — `AppRoot` orqali avto (`AppRoot appearance="dark"`)
- **Platform farqi** — `AppRoot platform="ios"` iOS look, `"base"` Android look. Avto-aniqlanadi.
- **Tugma kattaligi** — `Button size="l"` minimum tap target 44pt (Apple HIG)

---

## 10. Build va deploy

```bash
# Scaffold (bir martalik):
cd mini-app
npm create vite@latest . -- --template react-ts
npm install
npm install @telegram-apps/telegram-ui @telegram-apps/sdk-react \
            react-router-dom@6 zustand @tanstack/react-query \
            react-hook-form zod @hookform/resolvers axios \
            react-day-picker date-fns react-i18next i18next \
            sonner clsx lucide-react

# Dev:
npm run dev   # http://localhost:5173

# Build:
npm run build  # outputs to dist/
```

Production: `dist/` folder nginx orqali statik beriladi. Bot Father'da Mini App URL: `https://app.tdbot.example/`.

> **Eslatma:** TelegramUI uchun Tailwind shart emas. Lekin custom layout (grid, flex helpers) uchun foydali bo'lishi mumkin — ixtiyoriy.

---

## 11. Test (manual checklist)

- [ ] Mini App ochilganda spinner ko'rinadi, keyin home screen
- [ ] iOS'da iOS Telegram look (yumshoq rounded corners, SF Pro)
- [ ] Android'da Material look (Roboto, sharqona corners, ripple)
- [ ] Dark mode avto (Telegram settings'dan o'zgarsa)
- [ ] Wizard har step'i MainButton bilan ishlaydi
- [ ] BackButton wizard'da bitta step orqaga qaytaradi
- [ ] Station autocomplete debounced (300ms)
- [ ] Date picker o'tgan sanalarni disable qiladi, max +60 kun
- [ ] Train search loading: Skeleton; error: Banner with retry
- [ ] Berth picker faqat плацкарта/купе bo'lsa ko'rinadi
- [ ] Confirm screen: barcha qiymatlar to'g'ri, save → home
- [ ] Slot to'lganda Home'da "Yangi" tugma "Premium kerak" ga aylanadi
- [ ] Premium invoice ochiladi, to'lov tugaganda tier yangilanadi
- [ ] Donate custom Modal Slider 10-5000 oraliqda
- [ ] Til o'zgartirish darhol qo'llaniladi
- [ ] Sub o'chirish: showConfirm chiqadi

---

## 12. Bog'liq hujjatlar

- Backend endpoints: [04-backend-api.md](04-backend-api.md)
- Bot orqali Mini App ochilishi: [05-bot-spec.md](05-bot-spec.md)
- Stars to'lov: [07-payments.md](07-payments.md)
- Berth logikasi: [02-railway-api.md](02-railway-api.md#43-berth-joy-turi-ajratish)
- TelegramUI rasmiy: https://github.com/Telegram-Mini-Apps/TelegramUI
- TelegramUI docs (DeepWiki): https://deepwiki.com/Telegram-Mini-Apps/TelegramUI
- Telegram Mini Apps platform: https://docs.telegram-mini-apps.com/
