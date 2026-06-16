/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Research Portal palette — deep indigo + cyan accent on slate
        ink: {
          50: '#f5f7fa',
          100: '#e9edf4',
          200: '#cdd6e4',
          300: '#a3b3cc',
          400: '#7188ad',
          500: '#4f6791',
          600: '#3d5176',
          700: '#324160',
          800: '#2b3750',
          900: '#0f172a',
          950: '#080d1a',
        },
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8eb5ff',
          400: '#598dff',
          500: '#3366ff',
          600: '#1f47f0',
          700: '#1735db',
          800: '#1a30b1',
          900: '#1c2f8c',
        },
        accent: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
        },
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': { '0%': { transform: 'scale(0.8)', opacity: '0.5' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-ring': 'pulse-ring 1.4s cubic-bezier(0.4,0,0.2,1) infinite',
      },
    },
  },
  plugins: [],
};
