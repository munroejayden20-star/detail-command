import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        elevated: "hsl(var(--elevated))",
        hover: "hsl(var(--hover))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brand — refined neutral charcoal palette (was blue).
        // Used for avatar gradients and other neutral-accent surfaces.
        brand: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#475569",
          600: "#334155",
          700: "#1e293b",
          800: "#0f172a",
          900: "#020617",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        // Map to CSS-var-driven shadows for theme-aware elevation
        xs: "var(--shadow-xs)",
        soft: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lift: "var(--shadow-lg)",
        elevated: "var(--shadow-xl)",
        // Subtle inner glow used on focus / active states
        "ring-primary": "0 0 0 3px hsl(var(--primary) / 0.18)",
      },
      transitionTimingFunction: {
        // Premium easing — exits sharply, settles smoothly
        smooth: "cubic-bezier(0.32, 0.72, 0, 1)",
        // Snappy — for button presses and small interactions
        snappy: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        instant: "100ms",
        fast: "150ms",
        normal: "200ms",
        relaxed: "300ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // ─── Iris HUD ───────────────────────────────────────────────
        "iris-ring-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "iris-ring-spin-rev": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        "iris-scanline": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        "iris-grid-drift": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "40px 40px" },
        },
        "iris-fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "iris-cursor-blink": {
          "0%, 50%": { opacity: "1" },
          "51%, 100%": { opacity: "0" },
        },
        "iris-bracket-draw": {
          from: { strokeDashoffset: "40" },
          to: { strokeDashoffset: "0" },
        },
        // ─── Iris orb (Phase H6) ────────────────────────────────────
        "orb-breathe": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        "orb-breathe-fast": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.1)", opacity: "1" },
        },
        "orb-spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "orb-spin-reverse": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        "orb-shimmer": {
          "0%": { transform: "rotate(0deg) scale(1)" },
          "50%": { transform: "rotate(180deg) scale(1.05)" },
          "100%": { transform: "rotate(360deg) scale(1)" },
        },
        "orb-pulse-out": {
          "0%": { transform: "scale(0.95)", opacity: "0.6" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        "orb-flare": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-up": "slide-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        "scale-in": "scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.6s linear infinite",
        // Iris HUD
        "iris-ring-spin-slow": "iris-ring-spin 60s linear infinite",
        "iris-ring-spin-med": "iris-ring-spin-rev 90s linear infinite",
        "iris-ring-spin-fast": "iris-ring-spin 32s linear infinite",
        "iris-scanline": "iris-scanline 8s linear infinite",
        "iris-grid-drift": "iris-grid-drift 12s linear infinite",
        "iris-fade-up": "iris-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
        "iris-cursor-blink": "iris-cursor-blink 1s steps(1, end) infinite",
        "iris-bracket-draw": "iris-bracket-draw 0.6s ease-out forwards",
        // Iris orb
        "orb-breathe": "orb-breathe 4.5s cubic-bezier(0.45, 0, 0.55, 1) infinite",
        "orb-breathe-fast": "orb-breathe-fast 1.8s cubic-bezier(0.45, 0, 0.55, 1) infinite",
        "orb-spin-slow": "orb-spin-slow 22s linear infinite",
        "orb-spin-reverse": "orb-spin-reverse 16s linear infinite",
        "orb-spin-fast": "orb-spin-slow 7s linear infinite",
        "orb-shimmer": "orb-shimmer 9s ease-in-out infinite",
        "orb-pulse-out": "orb-pulse-out 2.4s ease-out infinite",
        "orb-flare": "orb-flare 3s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};
