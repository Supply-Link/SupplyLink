/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#173d34', soft: '#edf3e7', mist: '#c0d0c0', accent: '#d6eba9' },
        ink: '#243c33',
        muted: '#7c827e',
        canvas: '#f6f7f3',
        line: '#e5e8e3',
        danger: '#a54542',
      },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
};
