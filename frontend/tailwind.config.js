/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Nueva paleta de colores (amarillo-púrpura)
        background: '#fafafa',
        sidebar: '#352151',
        'sidebar-hover': '#4a2d6b',
        'sidebar-active': '#8E6AAA',
        primary: '#FCE5B7',
        'primary-hover': '#e6c41d',
        secondary: '#8E6AAA',
        'secondary-hover': '#7a5a95',
        accent: '#F1ABB5',
        'accent-light': '#FCE5B7',
        border: '#e5e7eb',
        'text-primary': '#352151',
        'text-secondary': '#64748b',
        'text-light': '#94a3b8',
        'text-white': '#ffffff',
        danger: '#ef4444',
        'danger-hover': '#dc2626',
        success: '#10b981',
        warning: '#f59e0b',
        // Colores específicos de la paleta
        'palette-yellow': '#FCE5B7',
        'palette-cream': '#FCE5B7',
        'palette-pink': '#F1ABB5',
        'palette-purple': '#8E6AAA',
        'palette-dark': '#352151',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'bounce-soft': 'bounceSoft 0.6s ease-out',
        'slide-up-out': 'slideUpOut 0.3s ease-in forwards',
        'slide-down-in': 'slideDownIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        bounceSoft: {
          '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(0)' },
          '40%': { transform: 'translateY(-4px)' },
          '60%': { transform: 'translateY(-2px)' },
        },
        slideUpOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100%)', opacity: '0' },
        },
        slideDownIn: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}