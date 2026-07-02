/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand palette
        brand: {
          50:  '#eef2ff',
          100: '#dbe4ff',
          200: '#bac8ff',
          300: '#91a7ff',
          400: '#748ffc',
          500: '#5c7cfa',
          600: '#4c6ef5',
          700: '#4263eb',
          800: '#3b5bdb',
          900: '#364fc7',
        },
        // Monochrome palette — RED only for alerts
        alert: {
          50:  '#fff1f1',
          100: '#ffe1e1',
          200: '#ffc7c7',
          300: '#ffa0a0',
          400: '#ff6b6b',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        // Task status colors
        task: {
          todo: '#6b7280',
          inProgress: '#3b82f6',
          blocked: '#ef4444',
          done: '#10b981',
        },
        // ===== NEW THEME COLORS =====
        // #71BBE1 light blue — accent, hover states, light backgrounds
        // #43476F dark purple — primary text, dark backgrounds, buttons (replaces black)
        // #2865C1 dark blue — secondary text, borders, links, brand elements
        primary: {
          50:  '#e8f4fa',
          100: '#c5e3f2',
          200: '#9ecfe8',
          300: '#71BBE1',  // light blue accent
          400: '#4a8fd0',
          500: '#2865C1',  // dark blue
          600: '#2355a8',
          700: '#1d4590',
          800: '#173578',
          900: '#112560',
        },
        dark: {
          50:  '#e8e8ef',
          100: '#c5c6d6',
          200: '#9ea0ba',
          300: '#777aa0',
          400: '#5d6089',
          500: '#43476F',  // dark purple — primary replacement for black
          600: '#3a3e62',
          700: '#313455',
          800: '#282b48',
          900: '#1f223b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        // Factory aesthetic: sharp corners everywhere
        DEFAULT: '0px',
        none: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        full: '9999px', // Only for pills/avatars
      },
    },
  },
  plugins: [],
};