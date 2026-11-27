/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        primary: {
          DEFAULT: "#1C93A0",
          50: "#EEF6F7",
          100: "#D7ECEF",
          200: "#AFD9DF",
          500: "#22A6B4",
          600: "#16808C",
          700: "#116974",
          800: "#0E545D",
          900: "#0B4047",
        },
        ink: {
          DEFAULT: "#1C202B",
          muted: "#5B6472",
          faint: "#8C95A4",
        },
        tint: "#EEF6F7",
        amber: {
          DEFAULT: "#FAC442",
          soft: "#FFF6DA",
          dark: "#8A6400",
        },
        danger: {
          DEFAULT: "#DC2626",
          soft: "#FEE9E9",
          dark: "#991B1B",
        },
        success: {
          DEFAULT: "#16A34A",
          soft: "#E8F8EE",
          dark: "#166534",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28, 32, 43, 0.04), 0 14px 34px -16px rgba(28, 32, 43, 0.16)",
        lift: "0 24px 50px -24px rgba(28, 32, 43, 0.32)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.7)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition: "600px 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
