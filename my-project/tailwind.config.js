/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0f0202",
        secondary: "#FF2625",
      },
      container: {
        center: true,
        padding: {
          DEFAULT: "1rem",
          sm: "2rem",
          lg: "4rem",
          xl: "5rem",
          "2xl": "6rem",
        },
      },
      // ДОБАВИЛИ АНИМАЦИЮ СЮДА:
      animation: {
        'infinite-scroll': 'scroll 45s linear infinite',
      },
      keyframes: {
        scroll: {
          'to': { transform: 'translateX(calc(-50% - 4rem))' },
        },
      },
    },
  },
  plugins: [],
};