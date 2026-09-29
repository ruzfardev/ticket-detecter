import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/** `hsl(var(--x) / <alpha>)` — every colour token is an "H S% L%" triplet, so
 *  Tailwind's opacity modifiers (`bg-coral/12`) work on all of them. */
const c = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

/** Same, but a bare `bg-x` resolves to the token's own translucency (a var),
 *  so content cards can sit a little see-through over the ambient light while
 *  `bg-x/60` still means exactly 60 %. */
const cd = (name: string, alpha: string) =>
  ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `hsl(var(--${name}) / var(--${alpha}))`
      : `hsl(var(--${name}) / ${opacityValue})`;

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        // Primary. `coral` is the historical name: it is the palette's primary
        // fill (buttons, selection) whichever palette is active.
        coral: {
          DEFAULT: c("coral"),
          active: c("coral-active"),
          disabled: c("coral-disabled"),
          bright: c("coral-bright"), // luminous: glows, dots, gradients — never text
          ink: c("coral-ink"),       // accent for text / icons on the canvas
        },
        // Surfaces
        canvas: c("canvas"),
        "canvas-2": c("canvas-2"),
        "surface-soft": cd("surface-soft", "surface-soft-a"),
        "surface-card": cd("surface-card", "surface-card-a"),
        "surface-strong": cd("surface-strong", "surface-strong-a"),
        "surface-cream-strong": cd("surface-strong", "surface-strong-a"), // legacy name
        "surface-dark": c("surface-dark"),
        "surface-dark-elevated": c("surface-dark-elevated"),
        "surface-dark-soft": c("surface-dark-soft"),
        // Text / ink
        ink: c("ink"),
        body: c("body"),
        "body-strong": c("body-strong"),
        muted: c("muted"),
        "muted-soft": c("muted-soft"),
        hairline: c("hairline"),
        "hairline-soft": c("hairline-soft"),
        "on-primary": c("on-primary"),
        "on-dark": c("on-dark"),
        "on-dark-soft": c("on-dark-soft"),
        // Accents (text-safe) and their luminous twins (fills, tiles)
        "accent-teal": c("accent-teal"),
        "accent-amber": c("accent-amber"),
        "teal-bright": c("teal-bright"),
        "amber-bright": c("amber-bright"),
        // Semantic
        success: c("success"),
        warning: c("warning"),
        error: c("error"),

        // shadcn aliases
        background: c("canvas"),
        foreground: c("ink"),
        border: c("hairline"),
        input: c("hairline"),
        ring: c("coral-bright"),
        primary: { DEFAULT: c("coral"), foreground: c("on-primary") },
        secondary: { DEFAULT: cd("surface-card", "surface-card-a"), foreground: c("ink") },
        destructive: { DEFAULT: c("error"), foreground: c("on-primary") },
        accent: { DEFAULT: cd("surface-strong", "surface-strong-a"), foreground: c("ink") },
        popover: { DEFAULT: c("canvas"), foreground: c("ink") },
        card: { DEFAULT: cd("surface-card", "surface-card-a"), foreground: c("ink") },
      },

      // SF Pro on Apple devices (through the system stack), Inter everywhere
      // else. SF Pro is not redistributable, so it is never bundled.
      fontFamily: {
        display: ["var(--font-ui)"],
        sans: ["var(--font-ui)"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      // Apple's text styles. `--tk` is 1 off Apple platforms and 0 on them —
      // SF already tracks itself by size, so adding tracking would double it.
      fontSize: {
        "display-xl": ["34px", { lineHeight: "41px", letterSpacing: "calc(0.37px * var(--tk, 1))", fontWeight: "700" }],
        "display-lg": ["28px", { lineHeight: "34px", letterSpacing: "calc(0.36px * var(--tk, 1))", fontWeight: "700" }],
        "display-md": ["22px", { lineHeight: "28px", letterSpacing: "calc(0.35px * var(--tk, 1))", fontWeight: "600" }],
        "display-sm": ["20px", { lineHeight: "25px", letterSpacing: "calc(0.38px * var(--tk, 1))", fontWeight: "600" }],
        "title-lg":   ["17px", { lineHeight: "22px", letterSpacing: "calc(-0.41px * var(--tk, 1))", fontWeight: "600" }],
        "title-md":   ["17px", { lineHeight: "22px", letterSpacing: "calc(-0.41px * var(--tk, 1))", fontWeight: "500" }],
        "title-sm":   ["15px", { lineHeight: "20px", letterSpacing: "calc(-0.24px * var(--tk, 1))", fontWeight: "600" }],
        "body-md":    ["17px", { lineHeight: "22px", letterSpacing: "calc(-0.41px * var(--tk, 1))", fontWeight: "400" }],
        "body-sm":    ["15px", { lineHeight: "20px", letterSpacing: "calc(-0.24px * var(--tk, 1))", fontWeight: "400" }],
        caption:      ["13px", { lineHeight: "18px", letterSpacing: "calc(-0.08px * var(--tk, 1))", fontWeight: "400" }],
        "caption-upper": ["12px", { lineHeight: "16px", letterSpacing: "0.06em", fontWeight: "600" }],
        button:       ["17px", { lineHeight: "22px", letterSpacing: "calc(-0.41px * var(--tk, 1))", fontWeight: "600" }],
      },

      // Concentric radii: an inner shape is its container's radius minus the
      // padding between them (card 26 → tile 10 at 16px padding).
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "26px",
        "2xl": "32px",
        "3xl": "38px",
        pill: "9999px",
      },

      spacing: {
        xxs: "4px",
        xs: "8px",
        sm: "12px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        xxl: "48px",
        section: "64px",
        tabbar: "96px",
      },

      // Steps the default scale lacks but the design uses (tints of 6–22 %).
      // Without them `bg-coral-bright/16` etc. silently generate no CSS.
      opacity: { 6: "0.06", 14: "0.14", 16: "0.16", 22: "0.22" },

      boxShadow: {
        card: "0 1px 2px hsl(var(--shadow) / 0.06), 0 6px 20px -8px hsl(var(--shadow) / 0.14)",
        pop: "0 10px 30px -10px hsl(var(--shadow) / 0.28), 0 2px 6px hsl(var(--shadow) / 0.10)",
        glow: "0 8px 28px -6px hsl(var(--coral-bright) / 0.45)",
      },

      keyframes: {
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
