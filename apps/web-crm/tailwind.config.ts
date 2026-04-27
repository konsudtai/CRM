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
        'apple-link-dark': '#2997ff',
        'apple-light': '#f5f5f7',
        'apple-black': '#000000',
        'apple-near-black': '#1d1d1f',
        'apple-surface-1': '#272729',
        'apple-surface-2': '#262628',
        'apple-surface-3': '#28282a',
        'apple-surface-4': '#2a2a2d',
        'apple-surface-5': '#242426',
        'apple-btn-active': '#ededf2',
        'apple-btn-light': '#fafafc',
      },
      borderRadius: {
        pill: '980px',
        apple: '8px',
        'apple-sm': '5px',
        'apple-md': '11px',
        'apple-lg': '12px',
      },
      fontFamily: {
        'sf-pro-display': ['"SF Pro Display"', '"SF Pro Icons"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        'sf-pro-text': ['"SF Pro Text"', '"SF Pro Icons"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'apple-hero': ['56px', { lineHeight: '1.07', letterSpacing: '-0.28px', fontWeight: '600' }],
        'apple-section': ['40px', { lineHeight: '1.10', letterSpacing: '0', fontWeight: '600' }],
        'apple-tile': ['28px', { lineHeight: '1.14', letterSpacing: '0.196px', fontWeight: '400' }],
        'apple-card-title': ['21px', { lineHeight: '1.19', letterSpacing: '0.231px', fontWeight: '700' }],
        'apple-subheading': ['21px', { lineHeight: '1.19', letterSpacing: '0.231px', fontWeight: '400' }],
        'apple-body': ['17px', { lineHeight: '1.47', letterSpacing: '-0.374px', fontWeight: '400' }],
        'apple-body-emphasis': ['17px', { lineHeight: '1.24', letterSpacing: '-0.374px', fontWeight: '600' }],
        'apple-link': ['14px', { lineHeight: '1.43', letterSpacing: '-0.224px', fontWeight: '400' }],
        'apple-caption': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '400' }],
        'apple-caption-bold': ['14px', { lineHeight: '1.29', letterSpacing: '-0.224px', fontWeight: '600' }],
        'apple-micro': ['12px', { lineHeight: '1.33', letterSpacing: '-0.12px', fontWeight: '400' }],
        'apple-micro-bold': ['12px', { lineHeight: '1.33', letterSpacing: '-0.12px', fontWeight: '600' }],
        'apple-nano': ['10px', { lineHeight: '1.47', letterSpacing: '-0.08px', fontWeight: '400' }],
      },
      boxShadow: {
        'apple-card': '3px 5px 30px 0px rgba(0, 0, 0, 0.22)',
        'apple-none': 'none',
      },
      spacing: {
        'apple-1': '2px',
        'apple-2': '4px',
        'apple-3': '5px',
        'apple-4': '6px',
        'apple-5': '7px',
        'apple-6': '8px',
        'apple-7': '9px',
        'apple-8': '10px',
        'apple-9': '11px',
        'apple-10': '14px',
        'apple-11': '15px',
        'apple-12': '17px',
        'apple-13': '20px',
        'apple-14': '24px',
      },
      backdropBlur: {
        apple: '20px',
      },
      backdropSaturate: {
        apple: '1.8',
      },
    },
  },
  plugins: [],
};

export default config;
