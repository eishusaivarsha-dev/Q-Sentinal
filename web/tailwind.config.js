/** @type {import('tailwindcss').Config} */
// Colours are CSS variables (src/index.css) so the light and dark themes swap without re-rendering.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: v('bg'), 2: v('bg-2') },
        surface: { DEFAULT: v('surface'), 2: v('surface-2') },
        line: { DEFAULT: v('line'), 2: v('line-2') },
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
        brand: { DEFAULT: v('brand'), 2: v('brand-2') },
        violet: v('violet'),
        ok: v('ok'),
        warn: v('warn'),
        bad: v('bad'),
      },
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: { xl2: '20px', xl3: '28px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / .05), 0 16px 36px -22px rgb(var(--shadow) / .35)',
        lift: '0 2px 4px rgb(var(--shadow) / .06), 0 30px 60px -30px rgb(var(--brand) / .45)',
        glow: '0 0 0 1px rgb(var(--brand) / .35), 0 10px 40px -10px rgb(var(--brand) / .55)',
      },
      keyframes: {
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pulseRing: { '0%': { transform: 'scale(.8)', opacity: '.8' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        shimmer: 'shimmer 2.4s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'pulse-ring': 'pulseRing 1.8s cubic-bezier(.2,.6,.3,1) infinite',
        marquee: 'marquee 40s linear infinite',
        'spin-slow': 'spinSlow 30s linear infinite',
      },
    },
  },
  plugins: [],
};
