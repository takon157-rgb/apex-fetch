import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#090d16",
        cardBg: "#111827",
        borderDark: "#1f2937",
      },
    },
  },
  plugins: [],
};
export default config;