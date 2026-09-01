/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // A single accent, so the UI never competes with the artwork
        // being previewed.
        accent: {
          DEFAULT: '#6366f1',
          soft: '#eef2ff',
        },
      },
    },
  },
  plugins: [],
};
