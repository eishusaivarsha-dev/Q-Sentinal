/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0c0a07', 900: '#0c0a07', 800: '#14110c', 700: '#1c1811', 600: '#27211779', 500: '#3a3123' },
        paper: { DEFAULT: '#e9dcc0', dim: '#bfae8c', faint: '#8a7c62', mute: '#5f5442' },
        amber: { DEFAULT: '#f0a53a', hot: '#ffc15e', deep: '#c4761c', glow: '#ffd28a' },
        rust: { DEFAULT: '#c8502a', deep: '#8e3219' },
        verdigris: { DEFAULT: '#7fb8a4', deep: '#3f7a6a' },
        accept: '#a9c46c',
        reject: '#e0513a',
        photon: '#fff1c9',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        label: ['"Oswald"', '"Arial Narrow"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        type: ['"Special Elite"', '"Courier New"', 'monospace'],
      },
      boxShadow: {
        panel: 'inset 0 0 0 1px rgba(240,165,58,.14), inset 0 1px 0 rgba(255,210,138,.06), 0 10px 30px -12px rgba(0,0,0,.8)',
        glow: '0 0 24px -4px rgba(240,165,58,.55)',
      },
      keyframes: {
        flicker: { '0%,100%': { opacity: '1' }, '47%': { opacity: '.86' }, '50%': { opacity: '.6' }, '53%': { opacity: '.92' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
        slideIn: { from: { transform: 'translateX(110%)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        stamp: { '0%': { transform: 'scale(2.2) rotate(-14deg)', opacity: '0' }, '60%': { transform: 'scale(.94) rotate(-7deg)', opacity: '1' }, '100%': { transform: 'scale(1) rotate(-7deg)', opacity: '1' } },
      },
      animation: {
        flicker: 'flicker 4s infinite',
        'spin-slow': 'spinSlow 40s linear infinite',
        'spin-slower': 'spinSlow 90s linear infinite reverse',
        slideIn: 'slideIn .35s cubic-bezier(.2,.9,.3,1.2)',
        stamp: 'stamp .45s cubic-bezier(.2,.9,.3,1.3) forwards',
      },
    },
  },
  plugins: [],
};
