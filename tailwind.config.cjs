/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './App.tsx', './index.tsx', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'primary-green': '#A7D9C7',
        'secondary-blue': '#B7E0F2',
        'accent-yellow': '#F2D7AE',
        'soft-pink': '#F4C2C2',
        'text-dark': '#333333',
        'text-light': '#F8F8F8',
        'border-light': '#D1D5DB',
        'success-green': '#6EE7B7',
        'error-red': '#FCA5A5',
      },
    },
  },
  plugins: [],
};
