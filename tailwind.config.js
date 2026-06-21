/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#08090C',
          50: '#F5F6FA',
          100: '#E7E8F0',
          200: '#A0A3B1',
          300: '#5F6175',
          400: '#34374A',
          500: '#23252F',
          600: '#181923',
          700: '#12131A',
          800: '#0D0E13',
          900: '#08090C',
        },
        accent: {
          DEFAULT: '#6D5DFC',
          soft: '#EDEAFF',
          50: '#F1EEFF',
          400: '#8676FF',
          500: '#6D5DFC',
          600: '#5B4CE0',
          700: '#4A3DBD',
        },
        teal: {
          DEFAULT: '#22D3EE',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        overline: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
}
