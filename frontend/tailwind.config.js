/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        page: 'var(--bg-page)',
        sidebar: 'var(--bg-sidebar)',
        card: 'var(--bg-card)',
        border: 'var(--border-color)',
        primary: 'var(--text-primary)',
        muted: 'var(--text-muted)',
      }
    },
  },
  plugins: [],
}
