/** @type {import('tailwindcss').Config} */
// Design tokens mirror design/design-tokens.json + design/tailwind-theme-snippet.js.
// The design/ folder is not deployed, so the values live here as the source of truth.
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'camera-blue': '#71CCE2',
        'camera-blue-light': '#94D6EB',
        'magic-yellow': '#F6D42E',
        'magic-yellow-light': '#F9DD53',
        charcoal: '#19222B',
        slate: '#364653',
        'soft-slate': '#505862',
        'paper-white': '#FFF9E8',
      },
      borderRadius: {
        toy: '28px',
        'toy-lg': '36px',
      },
      boxShadow: {
        toy: '0 10px 0 rgba(25,34,43,0.22), 0 18px 34px rgba(25,34,43,0.18)',
        soft: '0 10px 24px rgba(25,34,43,0.18)',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
