/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Cool neutral ramp, faintly navy-tinted to sit under the Progress indigo.
        ink: {
          50: '#F6F8FC',
          100: '#EEF1F7',
          200: '#E1E6F0',
          300: '#CBD3E1',
          400: '#98A2B8',
          500: '#616B83',
          600: '#454E64',
          700: '#2F3650',
          800: '#1D2338',
          900: '#121628',
          950: '#0A0D1C',
        },
        // Brand — Progress electric indigo → deep navy.
        brand: {
          50: '#EEF1FF',
          100: '#E0E5FF',
          200: '#C6CDFF',
          300: '#A0AAFF',
          400: '#767FFF',
          500: '#4E56F5',
          600: '#2F31D8',
          700: '#2626AC',
          800: '#1E2080',
          900: '#171A54',
          950: '#0E1033',
        },
        // Accent — modern amber/gold for attention states + highlights (used sparingly).
        accent: {
          50: '#FFF7E9',
          100: '#FCE9C2',
          200: '#F9D488',
          300: '#F5BC49',
          400: '#F0A81E',
          500: '#D2870C',
          600: '#A5660A',
          700: '#7C4D0C',
        },
        // Categorical data palette (charts/graph) — modern, high-chroma.
        data: {
          green: '#10B981',
          amber: '#F0A81E',
          clay: '#EF6A4D',
          slate: '#64748B',
          plum: '#8B5CF6',
        },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        // Cool navy-tinted, soft and airy.
        xs: '0 1px 2px rgba(16,20,44,0.06)',
        sm: '0 1px 2px rgba(16,20,44,0.06), 0 1px 1px rgba(16,20,44,0.04)',
        DEFAULT: '0 2px 6px rgba(16,20,44,0.07), 0 1px 2px rgba(16,20,44,0.05)',
        md: '0 8px 24px rgba(16,20,44,0.09)',
        lg: '0 16px 44px rgba(16,20,44,0.12)',
      },
      ringColor: { DEFAULT: 'rgba(47,49,216,0.45)' },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'bounce-dot': { '0%,80%,100%': { transform: 'translateY(0)', opacity: '0.4' }, '40%': { transform: 'translateY(-3px)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
