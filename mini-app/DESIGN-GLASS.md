# Chiptachi Glass — mini-app design system

Apple-style UI with Liquid Glass, in Chiptachi's warm coral. This file is the
contract: read it before adding or changing a screen.

**Concept — dawn on the rails.** Warm light behind glass panes, like morning
through a train window. Content sits on quiet surfaces; *controls* float above
it as glass. The ticket (the punched hole of the logo) is the recurring shape.

## The three layers

| Layer | What | Material | Rule |
|---|---|---|---|
| Ambient | drifting colour washes behind everything | `<Ambient/>`, mounted once in `App` | never touch it from a screen |
| Content | cards, lists, tickets, forms | `.surface` (translucent, **no blur**) | most of every screen |
| Navigation | tab bar, top bar, sticky action, sheets, toasts, a few hero panes | `.glass*` (backdrop blur + rim light) | **glass never sits on glass; ≤ ~6 panes on screen** |

Apple's rule, and also what keeps blur cheap. If you are about to add
`glass` to a card that lives in a list: don't, use `surface`.

## Tokens

All colours are `H S% L%` triplets exposed as Tailwind colours (opacity
modifiers work: `bg-coral-bright/16`). Three palettes (`cream` default,
`eticket`, `emerald`) × light/dark, chosen in Settings; you never write a hex.

- **Primary:** `bg-coral` (fill that carries white text, AA), `text-coral-ink`
  (accent for text/icons on canvas, AA), `bg-coral-bright` (luminous — dots,
  glows, gradients; **never text**), `text-on-primary`.
- **Ink:** `text-ink` › `text-body` › `text-muted` (secondary, AA) ›
  `text-muted-soft` (placeholders / decoration only).
- **Surfaces:** `bg-surface-card` (translucent), `bg-surface-strong`,
  `bg-canvas`, `hairline`/`hairline-soft` borders.
- **Accents:** `accent-teal`, `accent-amber` (text-safe) and
  `teal-bright`/`amber-bright` (fills); `success` `warning` `error`.

Type (Apple's scale; SF Pro on Apple devices, Inter elsewhere):
`text-display-xl` 34 bold (large title) · `display-lg` 28 · `display-md` 22 ·
`display-sm` 20 · `title-lg/md` 17 semibold/medium · `title-sm` 15 ·
`body-md` 17 · `body-sm` 15 · `caption` 13 · `caption-upper` 12 uppercase.
Numbers that change or align (times, prices, counters): add `tnum`.
Radii are concentric: card `rounded-[26px]` (`rounded-xl`), inner tile 30 % of
its edge, inputs `rounded-[18px]`, everything interactive is a capsule
(`rounded-pill`). Page gutter is 20 px (`page-frame`).

## Components (all in `src/components`)

**Frame**
- `<Screen title subtitle tabbed wizard actions padded center reveal>` — every
  screen. Sticky top bar + collapsing 34 pt large title + staggered blocks.
  Each **direct child** of `Screen` is one block that springs in; wrap things
  that belong together in one `<div className="space-y-…">` (a Fragment is one
  block). `tabbed` on the five tab screens reserves room for the tab bar.
  `wizard` shows the 6-step indicator in the top bar. `reveal={false}` for
  screens that animate their own content.
- `<StickyAction hint>` — the one primary action, floating at the bottom in the
  thumb zone. Put a `<Button full size="lg">` in it. `hint` = why it is
  disabled, in words. Portalled to `<body>` — **never use `position: fixed`
  inside a screen** (pages carry a transform while entering).
- `<StatusView kind="loading|error|empty" header description action/>` —
  full-screen state. For *in-page* empty states use `<EmptyNote icon title body action/>`.
- `BottomNav`, `PageTransition`, `Ambient` are mounted by `App`; leave them.

**Controls (`components/ui`)**
- `Button` variants `primary` (luminous, one per screen) `secondary`
  (glass) `tint` `ghost` `link` `destructive`; sizes `sm` `default` `lg`
  `icon`; `full`, `loading`. Haptics + press physics are built in.
- `IconButton aria-label` — 44 pt round glass.
- `ListGroup label footer` + `ListRow before after title subtitle chevron
  selected destructive disabled onClick` — inset grouped lists.
  Put `<IconTile icon tone soft size/>` in `before` (tones: coral teal amber
  green red blue violet pink gray ink). If a trailing badge/status exists,
  skip the chevron (it eats title width).
- `SelectMark checked` (multi-select circle) / `RadioMark checked`
  (single-select) — visuals for custom rows; `Checkbox` / `RadioGroupItem`
  are the real controls with the same look. `Switch checked onCheckedChange`.
- `Segmented value onChange options [layout="stack"]` and `Tabs*` — segmented
  controls with the sliding glass lens.
- `Input before after` + `Label` (sentence case, no uppercase). 17 px text
  so iOS never zooms. Set `inputMode`, `autoComplete`, `enterKeyHint`.
- `Badge` variants `pill coral solid dark outline success warning error muted`.
- `Card` variants `feature outline dark coral glass plain`; `PressCard`
  (`material="surface|glass|none"`) for a whole card that is one tap target.
- `Sheet/SheetContent/SheetTitle/SheetDescription` — floating glass bottom
  sheet, drag-to-dismiss, Telegram Back closes it. Controlled: `open`,
  `onOpenChange`.
- `SwipeRow actions={[{key,label,icon,tone,onSelect}]}` — iOS swipe actions
  for a row (drag left). A pointer shortcut only: the same actions must exist
  on the item's own screen (the panel is `aria-hidden`). Used on Home's
  subscription rows: pause/resume and delete (delete behind `showConfirm`).
- `Skeleton` (shimmer), `Spinner`.

**Travel**
- `TicketShell top bottom tone="surface|tint|coral" selected` — the notched
  ticket. `TripTimes dep arr duration tone moving` — big tabular times with
  the route line. `RouteLine`, `Ticker value` (rolling digits),
  `Specular` (tilt highlight; only inside a `relative overflow-hidden` glass).

## Patterns

```tsx
// A list screen
<Screen padded title="Buyurtmalar" tabbed>
  <ListGroup label="Faol">
    <ListRow before={<IconTile icon={Train} tone="coral"/>} title=… subtitle=…
             after={<Badge variant="coral">OTP</Badge>} onClick=… />
  </ListGroup>
</Screen>

// A form / wizard step
<Screen padded wizard title="Sana" subtitle="…">
  <Input before={<Search/>} …/>
  <ListGroup>…</ListGroup>
  <StickyAction hint={!ready ? "Kamida bitta tanlang" : undefined}>
    <Button full size="lg" disabled={!ready} onClick=…>Davom etish</Button>
  </StickyAction>
</Screen>

// Selecting from cards: `selected` ring + SelectMark
<PressCard material="none" aria-pressed={sel} onClick=…>
  <div className={cn("surface p-4", sel && "ring-select")}> … <SelectMark checked={sel}/> </div>
</PressCard>
```

Loading = skeletons shaped like the real content (`Skeleton`), not a spinner
on a blank page. Empty = `EmptyNote`/`StatusView` with a next step. Error =
say what happened + a retry. Destructive actions: `Button variant="destructive"`
or a destructive `ListRow`, always behind `showConfirm` (Telegram native).

## Motion

- Springs, not curves: `spring.snappy | smooth | gentle | bouncy | lens`
  from `lib/motion.ts`. `whileTap` scale 0.96–0.97 with `spring.bouncy`.
- Entrances: `Screen` staggers blocks; lists inside tabs use a 50 ms stagger
  capped at 6. Animate **transform and opacity only**.
- **Never put `opacity < 1`, `filter`, or `mask` on an ancestor of a glass
  pane** — it becomes a "backdrop root" and the glass goes blind until the
  animation ends. Animate the glass element itself, or its contents.
- `MotionConfig reducedMotion="user"` is on globally: with the OS setting,
  transforms are dropped. Do not add JS timers to compensate.
- Use `m.*` from `motion/react-m` (the app runs `LazyMotion strict`).

## Haptics

`useHaptic()` → `impact("light"|"medium"…)`, `selection()`, `notify("success"|
"warning"|"error")`. Buttons, rows, tabs, switches already fire theirs;
identical ticks within ~40 ms collapse, so calling one in a handler as well is
harmless. Use `notify` for outcomes (saved / failed).

## Mobile checklist (every screen)

- Touch targets ≥ 44 pt; primary action reachable by the thumb (StickyAction).
- Body text ≥ 15 px, inputs 17 px. No text below 11 px. Contrast comes from the
  tokens above — don't invent colours.
- Safe areas: use `var(--safe-t)` / `var(--safe-b)`; the frame already does.
- Keyboard: set `inputMode` / `autoComplete` / `enterKeyHint`; the sticky
  action rides above the keyboard.
- One screen = one job = one luminous coral element.
- Every async button shows `loading`; every list has loading/empty/error.
- Keep Uzbek copy exactly as it was. Keep every query, mutation, guard and
  haptic call; a redesign changes presentation, never behaviour.

## Accessibility (already handled by the frame — keep it that way)

- `Screen` renders one `<main>` (focus moves into it on every navigation
  unless a field asked for focus), one `<header>` banner (the top bar), and the
  large title as the page's `<h1>`. A screen without a visible title needs an
  `sr-only` `<h1>` (Home has one).
- Tokens are contrast-checked (WCAG AA) including secondary text directly on
  the ambient light; don't introduce ad-hoc greys.
- Zoom is not disabled (the viewport meta has no `user-scalable=no`); inputs
  are 17 px so iOS doesn't zoom on focus.
- Reduced motion drops transforms; reduced transparency (OS) forces the solid
  material.

## Bundle

Non-launch screens are `React.lazy` chunks (see `App.tsx`) prefetched on idle,
so the entry chunk stays small (the date step alone pulls in a calendar
library). `OrderDetail` stays in the entry chunk: it is the bot's deep link for
the SMS code. Add new screens to the `loaders` table unless they are needed at
launch.

## Quality tiers

`<html data-fx="full|lite|off">` (Settings → Shisha effekti; auto by default;
the OS "reduce transparency" forces `off`). Layout never changes between
tiers, only material. `lite` = smaller blur, still orbs; `off` = solid panes.

## Testing notes

- Chromium renders everything including blur. Headless **WebKit (Playwright)
  does not paint `backdrop-filter` at all** — its screenshots show crisp
  content under glass; that is the tool, not the CSS (real Safari/WKWebView
  blur). It is still the right engine for masks, notches, gradients, fonts
  (real SF Pro) and layout.
- Never combine `backdrop-filter` with `mask-image` on one element (Safari can
  blur the whole rectangle); the scroll-edge veil is a plain gradient for that
  reason.
- Verified behaviours worth re-checking after changes to shared chrome: tab
  lens tap + drag, sheet drag-to-dismiss, page slide keeps fixed chrome fixed
  and adds no horizontal overflow, scroll restoration on back, large-title
  collapse, `data-fx` tiers, reduced motion, tilt highlight, swipe rows.

## Running it

```bash
cd mini-app
VITE_DEV_MOCK=true npm run dev     # every screen with fake data, in a browser
npx tsc --noEmit -p .              # must be clean
```
