import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0B1F3A",
          50: "#E7ECF3",
          100: "#C4D2E3",
          200: "#9FB5D1",
          300: "#7997BF",
          400: "#4D73A6",
          500: "#2B5287",
          600: "#1A3B69",
          700: "#112C52",
          800: "#0B1F3A",
          900: "#051122",
          950: "#020812",
        },
        gold: {
          DEFAULT: "#C9A227",
          50: "#FCF9ED",
          100: "#F8F1D2",
          200: "#F0E2A5",
          300: "#E5CF72",
          400: "#D7BC42",
          500: "#C9A227",
          600: "#A8831C",
          700: "#806214",
          800: "#5A440D",
          900: "#362807",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          bg: "#F7F8FA",
          muted: "#F0F2F5",
          border: "#E4E7EC",
        },
        brand: {
          text: "#172033",
          muted: "#667085",
        }
      },
      borderRadius: {
        'card': '16px',
        'button': '8px',
      },
      maxWidth: {
        'site': '1280px',
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(11, 31, 58, 0.06), 0 4px 16px -4px rgba(11, 31, 58, 0.08)',
        'card-hover': '0 8px 24px -4px rgba(11, 31, 58, 0.12), 0 16px 32px -8px rgba(11, 31, 58, 0.08)',
        'float': '0 12px 36px -4px rgba(11, 31, 58, 0.16)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'var(--font-prompt)', 'sans-serif'],
        thai: ['var(--font-prompt)', 'var(--font-noto-thai)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
