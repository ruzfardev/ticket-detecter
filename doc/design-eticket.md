# Design System Inspired by O'zbekiston temir yo'llari

> Auto-extracted from `https://eticket.railway.uz/uz/pages/trains-page` on 2026-08-21

## 1. Visual Theme & Atmosphere

Friendly, approachable design with rounded shapes and generous whitespace.

The hero section leads with "Chiptaning haqiqiyligini tekshiring" followed by "DIQQAT! Hurmatli foydalanuvchilar!!! Tekshiruv chog‘ida qalbaki yoki egasi bo‘lmagan chipta bilan an".

**Key Characteristics:**
- Gilroy as the heading font
- Gilroy as the body font for all running text
- Heading weight 700
- Light/white background (#ffffff) as the primary canvas
- Primary accent `#01c3a7` used for CTAs and brand highlights
- 5 shadow level(s) detected — tinted shadows
- Rounded corners (10px+) creating a friendly, approachable feel
- Tags: light, rounded, accented, sans-serif

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (`#01c3a7`) · `--color-primary`: Brand color, CTA backgrounds, link text, interactive highlights.
- **Secondary Accent** (`#187cee`) · `--color-secondary`: Secondary brand, hover states, complementary highlights.
- **Background** (`#ffffff`) · `--color-bg`: Page background, primary canvas.
- **Background Secondary** (`#01c3a7`) · `--color-bg-secondary`: Cards, surfaces, alternating sections.

### Text
- **Text Primary** (`#212529`) · `--color-text`: Headings and body text.
- **Text Secondary** (`#354356`) · `--color-text-secondary`: Muted text, captions, placeholders.

### Borders & Surfaces
- **Border** (`#f0f2f7`) · `--color-border`: Dividers, outlines, input borders.

### Full Extracted Palette

| # | Hex | CSS Variable | Role | Area | Contrast |
|---|---|---|---|---|---|
| 1 | `#ffffff` | `--palette-1` | section | large | text-dark |
| 2 | `#01c3a7` | `--palette-2` | badge | large | text-dark |
| 3 | `#f0f2f7` | `--palette-3` | block | large | text-dark |
| 4 | `#dde0ed` | `--palette-4` | button | medium | text-dark |
| 5 | `#187cee` | `--palette-5` | text-accent | small | text-light |
| 6 | `#deb887` | `--palette-6` | badge | small | text-dark |
| 7 | `#354356` | `--palette-7` | text-accent | small | text-light |
| 8 | `#000000` | `--palette-8` | badge | small | text-light |
| 9 | `#9ea7b8` | `--palette-9` | text-accent | small | text-dark |
| 10 | `#007bff` | `--palette-10` | text-accent | small | text-light |
| 11 | `#8090a0` | `--palette-11` | text-accent | small | text-dark |

## 3. Typography Rules

- **Heading Font:** `Gilroy`, sans-serif
- **Body Font:** `Gilroy`, sans-serif

### Type Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|
| H1 | Gilroy | 42px | 700 | 52px | normal |
| Body | Inter | 16px | 400 | 36px | normal |

### Type Scale

| Token | Size | Suggested Usage |
|---|---|---|
| Display | `42px` | headings |
| H1 | `26px` | headings |
| H2 | `18px` | headings |
| H3 | `16px` | headings |
| H4 | `14px` | headings |
| Body L | `13px` | body / supporting text |
| Body | `12px` | body / supporting text |
| Small | `11px` | body / supporting text |
| XS | `10px` | body / supporting text |

## 4. Component Stylings

### Primary Button

```css
.btn-primary {
  background: #01c3a7;
  color: #ffffff;
  border-radius: 10px;
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
```

### Ghost Button

```css
.btn-ghost {
  background: transparent;
  color: #ffffff;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 2

```css
.btn-ghost-2 {
  background: transparent;
  color: #187cee;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 3

```css
.btn-ghost-3 {
  background: transparent;
  color: #292b3f;
  border-radius: 0px;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 4

```css
.btn-ghost-4 {
  background: transparent;
  color: #6b7280;
  border-radius: 0px;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
```

### Ghost Button 5

```css
.btn-ghost-5 {
  background: transparent;
  color: #212529;
  border-radius: 0px;
  padding: 0px 0px;
  font-size: 14px;
  font-weight: 400;
  border: none;
  cursor: pointer;
}
```

### Card

```css
.card {
  background: #01c3a7;
  border-radius: 100px;
  padding: 8px;
  box-shadow: rgba(0, 0, 0, 0.12) 0px 2px 6px 0px;
}
```

## 5. Layout Principles

- **Base spacing unit:** `10px` — use multiples (20px, 30px, 40px, etc.)

### Spacing Scale (extracted from real elements)

| Token | Value | Role |
|---|---|---|
| spacing-1 | `10px` | element |
| spacing-2 | `8px` | element |
| spacing-3 | `6px` | element |
| spacing-4 | `5px` | element |
| spacing-5 | `1px` | element |
| spacing-6 | `4px` | element |
| spacing-7 | `15px` | element |
| spacing-8 | `3px` | element |

### Border Radius Scale

| Token | Value | Element |
|---|---|---|
| radius-button | `10px` | button |
| radius-subtle | `5px` | subtle |
| radius-pill | `100px` | pill |
| radius-button | `15px` | button |
| radius-subtle | `3px` | subtle |
| radius-subtle | `2px` | subtle |

## 6. Depth & Elevation

| Level | Shadow | Usage |
|---|---|---|
| Mid | `rgba(0, 0, 0, 0.12) 0px 2px 6px 0px` | Dropdowns, popovers |
| Low | `rgba(0, 0, 0, 0.04) 0px 2px 4px 0px, rgba(0, 0, 0, 0.12) 0px 4px 10px 0px` | Cards, subtle elevation |
| Mid | `rgba(0, 0, 0, 0.06) 0px 3px 6px 0px, rgba(0, 0, 0, 0.16) 0px 8px 16px 0px` | Dropdowns, popovers |
| Mid | `rgba(0, 0, 0, 0.1) 0px 2px 8px 0px` | Dropdowns, popovers |
| Mid | `rgb(128, 128, 128) 0px 0px 5px 0px` | Dropdowns, popovers |


## 7. Do's and Don'ts

### Do
- Use `#ffffff` as the primary background color
- Use `Gilroy` for all headings and `Gilroy` for body text
- Use `#01c3a7` as the single dominant accent/CTA color
- Maintain `10px` as the base spacing unit — all gaps should be multiples
- Use rounded corners (`10px`+) consistently for all interactive elements
- Apply the shadow system for elevation — use the extracted shadow values
- Use weight 700 for headings to match the brand's typographic voice

### Don't
- Don't use colors outside the extracted palette without justification
- Don't substitute Gilroy/Gilroy with generic alternatives
- Don't use irregular spacing — stick to 10px grid
- Don't use dark/black backgrounds — this is a light-themed design
- Don't use sharp corners — they feel hostile in this rounded design language
- Don't use pure black (#000000) for text — use `#212529` instead
- Don't add decorative elements not present in the original design — no badges, ribbons, banners, or ornaments unless the source site uses them
- Don't invent UI patterns the source site doesn't have — if the original has no NEW badge, don't add one just because a red is in the palette

## 8. Responsive Behavior

| Breakpoint | Width | Notes |
|---|---|---|
| Mobile | < 640px | Single column, stack sections, reduce font sizes ~80% |
| Tablet | 640–1024px | 2-column where appropriate, maintain spacing ratios |
| Desktop | 1024–1440px | Full layout as designed |
| Wide | > 1440px | Max-width container, center content |

- Touch targets: minimum 44×44px on mobile
- Maintain 10px base unit across breakpoints — only scale multipliers

## 9. Agent Prompt Guide

### Quick Color Reference

```
Background:  #ffffff
Text:        #212529
Accent:      #01c3a7
Secondary:   #187cee
Border:      #f0f2f7
```

### Example Prompts

1. "Build a hero section with a `#ffffff` background, `Gilroy` heading in `#212529`, and a `#01c3a7` CTA button with 10px radius."
2. "Create a pricing card using background `#01c3a7`, border `#f0f2f7`, `Gilroy` for text, and 30px padding."
3. "Design a navigation bar — `#ffffff` background, `#212529` links, `#01c3a7` for active state."
4. "Build a feature grid with 3 columns, 30px gap, each card using the card component style."
5. "Create a footer with `#212529` background, `#ffffff` text, and 20px padding."

### Iteration Guide

1. Start with layout structure (sections, grid, spacing)
2. Apply colors from the palette — background first, then text, then accents
3. Set typography — font families, sizes from the type scale, weights
4. Add components — buttons, cards, inputs using the specs above
5. Apply border-radius consistently across all elements
6. Add shadows for depth — use the extracted shadow values, not defaults
7. Check responsive behavior — test mobile and tablet layouts
8. Final pass — verify all colors match, spacing is consistent, fonts are correct

## 10. CSS Custom Properties

> 34 custom properties extracted from `:root` / `html` stylesheets.

### Color Variables

| Variable | Value |
|---|---|
| `--blue` | `#007bff` |
| `--indigo` | `#6610f2` |
| `--purple` | `#6f42c1` |
| `--pink` | `#e83e8c` |
| `--red` | `#dc3545` |
| `--orange` | `#fd7e14` |
| `--yellow` | `#ffc107` |
| `--green` | `#28a745` |
| `--teal` | `#20c997` |
| `--cyan` | `#17a2b8` |
| `--white` | `#fff` |
| `--gray` | `#6c757d` |
| `--gray-dark` | `#343a40` |
| `--primary` | `#007bff` |
| `--secondary` | `#6c757d` |
| `--success` | `#28a745` |
| `--info` | `#17a2b8` |
| `--warning` | `#ffc107` |
| `--danger` | `#ff7051` |
| `--light` | `#f8f9fa` |
| `--dark` | `#343a40` |

### Spacing Variables

| Variable | Value |
|---|---|
| `--breakpoint-xs` | `0` |
| `--breakpoint-sm` | `576px` |
| `--breakpoint-md` | `768px` |
| `--breakpoint-lg` | `992px` |
| `--breakpoint-xl` | `1200px` |
| `--bs-breakpoint-xs` | `0` |
| `--bs-breakpoint-sm` | `576px` |
| `--bs-breakpoint-md` | `768px` |
| `--bs-breakpoint-lg` | `992px` |
| `--bs-breakpoint-xl` | `1200px` |
| `--bs-breakpoint-xxl` | `1400px` |

### Typography Variables

| Variable | Value |
|---|---|
| `--font-family-sans-serif` | `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans","Liberation Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"` |
| `--font-family-monospace` | `SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace` |
