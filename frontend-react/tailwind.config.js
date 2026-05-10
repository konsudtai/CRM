/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sf: {
          blue: '#0176D3',
          'blue-d': '#014486',
          'blue-l': '#1B96FF',
          navy: '#032D60',
          'navy-d': '#001639',
        },
        brand: {
          green: '#2E844A',
          orange: '#DD7A01',
          red: '#C23934',
          purple: '#7F56D9',
          teal: '#0B827C',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        jakarta: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
