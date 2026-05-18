import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Anthropic brand
        coral: {
          DEFAULT: "hsl(var(--coral))",
          active: "hsl(var(--coral-active))",
          disabled: "hsl(var(--coral-disabled))",
        },
        // Surfaces
        canvas: "hsl(var(--canvas))",
        "surface-soft": "hsl(var(--surface-soft))",
        "surface-card": "hsl(var(--surface-card))",
        "surface-cream-strong": "hsl(var(--surface-cream-strong))",
        "surface-dark": "hsl(var(--surface-dark))",
        "surface-dark-elevated": "hsl(var(--surface-dark-elevated))",
        "surface-dark-soft": "hsl(var(--surface-dark-soft))",
        // Text / ink
        ink: "hsl(var(--ink))",
        body: "hsl(var(--body))",
        "body-strong": "hsl(var(--body-strong))",
        muted: "hsl(var(--muted))",
        "muted-soft": "hsl(var(--muted-soft))",
        hairline: "hsl(var(--hairline))",
        "hairline-soft": "hsl(var(--hairline-soft))",
        "on-primary": "hsl(var(--on-primary))",
        "on-dark": "hsl(var(--on-dark))",
        "on-dark-soft": "hsl(var(--on-dark-soft))",
        // Accents
        "accent-teal": "hsl(var(--accent-teal))",
        "accent-amber": "hsl(var(--accent-amber))",
        // Semantic
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        error: "hsl(var(--error))",

        // shadcn aliases (background/foreground/border/ring/etc.)
        background: "hsl(var(--canvas))",
        foreground: "hsl(var(--ink))",
        border: "hsl(var(--hairline))",
        input: "hsl(var(--hairline))",
        ring: "hsl(var(--coral))",
        primary: {
          DEFAULT: "hsl(var(--coral))",
          foreground: "hsl(var(--on-primary))",
        },
        secondary: {
          DEFAULT: "hsl(var(--surface-card))",
          foreground: "hsl(var(--ink))",
        },
        destructive: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--on-primary))",
        },
        accent: {
          DEFAULT: "hsl(var(--surface-cream-strong))",
          foreground: "hsl(var(--ink))",
        },
        popover: {
          DEFAULT: "hsl(var(--canvas))",
          foreground: "hsl(var(--ink))",
        },
        card: {
          DEFAULT: "hsl(var(--surface-card))",
          foreground: "hsl(var(--ink))",
        },
      },
      fontFamily: {
        display: ["'EB Garamond'", "Tiempos Headline", "Cormorant Garamond", "Garamond", "serif"],
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono Variable'", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Mobile-tuned scale (display sizes scaled down from spec for mini-app viewport)
        "display-xl": ["32px", { lineHeight: "1.05", letterSpacing: "-0.75px", fontWeight: "400" }],
        "display-lg": ["28px", { lineHeight: "1.1",  letterSpacing: "-0.6px",  fontWeight: "400" }],
        "display-md": ["24px", { lineHeight: "1.15", letterSpacing: "-0.4px",  fontWeight: "400" }],
        "display-sm": ["20px", { lineHeight: "1.2",  letterSpacing: "-0.25px", fontWeight: "400" }],
        "title-lg":   ["18px", { lineHeight: "1.3",  letterSpacing: "0",       fontWeight: "500" }],
        "title-md":   ["16px", { lineHeight: "1.4",  letterSpacing: "0",       fontWeight: "500" }],
        "title-sm":   ["15px", { lineHeight: "1.4",  letterSpacing: "0",       fontWeight: "500" }],
        "body-md":    ["16px", { lineHeight: "1.55", letterSpacing: "0",       fontWeight: "400" }],
        "body-sm":    ["14px", { lineHeight: "1.5",  letterSpacing: "0",       fontWeight: "400" }],
        caption:      ["12px", { lineHeight: "1.4",  letterSpacing: "0",       fontWeight: "500" }],
        "caption-upper": ["11px", { lineHeight: "1.4", letterSpacing: "1.4px", fontWeight: "500" }],
        button:       ["14px", { lineHeight: "1",    letterSpacing: "0",       fontWeight: "500" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
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
        "tabbar": "76px",
      },
      keyframes: {
        "fade-in":  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "slide-up": {
          "0%":   { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-down": {
          "0%":   { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        "fade-in":    "fade-in 200ms ease-out",
        "slide-up":   "slide-up 260ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-down": "slide-down 240ms cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [animate],
};

export default config;
