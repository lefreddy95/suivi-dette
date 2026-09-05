/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Permet `bg-gradient-pizza` etc. (helpers maison, optional)
    },
  },
  plugins: [],
};
