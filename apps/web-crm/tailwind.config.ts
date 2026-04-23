import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui-components/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'apple-blue': '#0071e3',
        'apple-link': '#0066cc',
        'apple-bg-light': '#f5f5f7',
        'apple-bg-dark': '#000000',
        'apple-card-dark': '#272729',
        'section-light': '#f5f5f7',
        'section-dark': '#000000',
        'card-dark': '#272729',
      },
      borderRadius: {
        pill: '980px',
      },
      fontFamily: {
        'sf-pro-display': ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        'sf-pro-text': ['"SF Pro Text"', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card-elevated': '0px 3px 5px 0px rgba(0,0,0,0.22), 0px 5px 30px 0px rgba(0,0,0,0.22)',
      },
    },
  },
  plugins: [],
};

export default config;
