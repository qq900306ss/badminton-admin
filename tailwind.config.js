/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        brand: {
          pink:     '#F9A8D4',
          mint:     '#A7F3D0',
          yellow:   '#FDE68A',
          peach:    '#FED7AA',
          lavender: '#DDD6FE',
          bg:       '#FFF7F7',
        },
      },
    },
  },
  plugins: [],
}

