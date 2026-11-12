/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#14532D",
          primary: "#228B22",
          lime: "#A3E635",
          soft: "#D9F99D",
          bg: "#F7FBEF",
          text: "#172B1B",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(20, 83, 45, 0.08)",
        glow: "0 10px 30px -5px rgba(34, 139, 34, 0.22)",
      },
    },
  },
  plugins: [],
};
