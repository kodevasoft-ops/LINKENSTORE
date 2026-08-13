import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':    '#0a0a0f',
        'bg-secondary':  '#111118',
        'bg-card':       '#16161f',
        'bg-card-hover': '#1c1c28',
        'bg-input':      '#1a1a24',
        'border-base':   '#2a2a3a',
        'border-light':  '#3a3a4f',
        'primary':       '#6366f1',
        'primary-light': '#818cf8',
        'primary-dark':  '#4f52d4',
        'accent':        '#22d3ee',
        'success':       '#10b981',
        'warning':       '#f59e0b',
        'danger':        '#ef4444',
        'text-primary':  '#f1f5f9',
        'text-secondary':'#94a3b8',
        'text-muted':    '#64748b',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '24px' },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
export default config;
