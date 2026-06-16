/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Warm neutral ramp ("paper/stone") — deliberately not cold blue-gray.
        ink: {
          50: '#FAF9F7',
          100: '#F3F1EC',
          200: '#E7E3DB',
          300: '#D4CEC3',
          400: '#A39C8F',
          500: '#6F6A60',
          600: '#524E46',
          700: '#3C3933',
          800: '#2A2823',
          900: '#1C1A16',
          950: '#121017',
        },
        // Brand — a confident evergreen, not Tailwind blue/indigo.
        brand: {
          50: '#EDF6F1',
          100: '#D2E9DE',
          200: '#A6D3C2',
          300: '#72B79C',
          400: '#429A78',
          500: '#237D5E',
          600: '#1A6A4F',
          700: '#14543F',
          800: '#124533',
          900: '#0F3829',
        },
        // Accent — warm amber/gold for data + highlights (used sparingly).
        accent: {
          50: '#FBF3E6',
          100: '#F6E4C6',
          200: '#EECB92',
          300: '#E2AC55',
          400: '#D08E2A',
          500: '#B0741A',
          600: '#8E5C14',
          700: '#6E4711',
        },
        // Categorical data palette (charts/graph).
        data: {
          green: '#1A6A4F',
          amber: '#C8861A',
          clay: '#B5543F',
          slate: '#5B7B8A',
          plum: '#7C5C8A',
        },
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        // Warm-tinted, restrained.
        xs: '0 1px 2px rgba(28,26,22,0.05)',
        sm: '0 1px 2px rgba(28,26,22,0.06), 0 1px 1px rgba(28,26,22,0.04)',
        DEFAULT: '0 1px 3px rgba(28,26,22,0.08), 0 1px 2px rgba(28,26,22,0.05)',
        md: '0 4px 14px rgba(28,26,22,0.08)',
        lg: '0 10px 30px rgba(28,26,22,0.10)',
      },
      ringColor: { DEFAULT: 'rgba(35,125,94,0.45)' },
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
