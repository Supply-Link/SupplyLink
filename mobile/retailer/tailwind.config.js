/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#153e35', soft: '#b6d8c0', mist: '#d7e8dd', accent: '#d6eba9' },
        ink: '#203d35',
        muted: '#78877f',
        canvas: '#f4f7f4',
        line: '#dfe7df',
        danger: '#b42318',
      },
      borderRadius: { card: '15px' },
    },
  },
  plugins: [],
};
