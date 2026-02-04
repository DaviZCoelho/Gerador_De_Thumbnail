/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gamer': {
          'dark': '#000000',
          'darker': '#0a0a0a',
          'purple': '#ffffff',
          'purple-light': '#e5e5e5',
          'purple-dark': '#cccccc',
          'neon': '#ffffff',
          'accent': '#ffffff',
          'card': '#111111',
          'card-hover': '#1a1a1a',
        }
      },
      boxShadow: {
        'neon': '0 0 20px rgba(255, 255, 255, 0.1)',
        'neon-lg': '0 0 40px rgba(255, 255, 255, 0.15)',
        'neon-accent': '0 0 20px rgba(255, 255, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)' },
          '100%': { boxShadow: '0 0 40px rgba(255, 255, 255, 0.2)' },
        }
      }
    },
  },
  plugins: [],
}
