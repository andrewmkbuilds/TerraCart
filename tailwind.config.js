/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './popup.html', './options.html', './src/**/*.{html,tsx,ts,jsx,js}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-alt': 'var(--surface-alt)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        sand: 'var(--sand)',
        mint: 'var(--mint)',
        clay: 'var(--clay)',
        amber: 'var(--amber)',
        forest: {
          DEFAULT: 'var(--forest)',
          soft: 'var(--forest-soft)',
          tint: 'var(--forest-tint)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        lift: 'var(--shadow)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'rise-in': 'riseIn .24s ease-out both',
        'fade-in': 'fadeIn .2s ease-out both',
      },
    },
  },
  plugins: [],
}
