import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "blue-50": "#2486F5",
        "blue-main": "#0B77F0",
        white: "#FFFFFF",
        "blue-80": "#063C7A",
        "wb-40": "#A6A6A6",
        "blue-90": "#032449",
        "blue-100": "#010C18",
        "wb-90": "#262626",
        "wb-100": "#0D0D0D",
        "blue-70": "#0855AB",
        black: "#000000",
        disppaprove: "#D92D20",
        "rgba-1": "rgba(9, 78, 221, 0.25)",
        "rgba-2": "rgba(243, 177, 208, 0.06)",
        "rgba-3": "rgba(217, 3, 104, 0.25)",
        gradientStart: "#050208",
        gradientEnd: "#601e96",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          blue: "#4A90E2",
          purple: "#6C5CE7",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          pink: "#FF69B4",
          green: "#4CAF50",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        karla: ["Karla", "sans-serif"], // ✅ lowercase key
        digitalt: ["Digitalt", "sans-serif"],
        // sans: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        "glow-sm": "0 0 10px 2px rgba(255,255,255,0.8)",
        "glow-md": "0 0 15px 5px rgba(255,255,255,0.8)",
        "glow-lg": "0 0 20px 10px rgba(255,255,255,0.8)",
      },
      gridTemplateColumns: {
        custom: "minmax(468px, 1fr) minmax(350px, 1fr) minmax(250px, 1fr)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
