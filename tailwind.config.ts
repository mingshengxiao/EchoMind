import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#09090B",
        paper: "#FAFAFA",
        brand: "#2563EB",
        violet: "#7C3AED",
      },
      boxShadow: {
        soft: "0 24px 80px rgba(15, 23, 42, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
