/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563eb', // Clean Royal Blue
          dark: '#1d4ed8',
          soft: 'rgba(37, 99, 235, 0.08)',
        },
        ink: {
          DEFAULT: '#0f172a', // Slate 900
          soft: '#334155',    // Slate 700
          mute: '#64748b',    // Slate 500
          faint: '#94a3b8',   // Slate 400
        },
        surface: {
          DEFAULT: '#f8fafc', // Slate 50
          muted: '#f1f5f9',   // Slate 100
          card: '#ffffff',
          glass: 'rgba(255, 255, 255, 0.95)',
          border: '#e2e8f0',  // Slate 200
        },
        up: '#16a34a',        // Professional Finance Emerald Green
        down: '#dc2626',      // Professional Finance Crimson Red
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans TC"',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};
