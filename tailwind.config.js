/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0a84ff',
          dark: '#0066cc',
          soft: 'rgba(10, 132, 255, 0.12)',
        },
        ink: {
          DEFAULT: '#1d1d1f',
          soft: '#3a3a3c',
          mute: '#6e6e73',
          faint: '#86868b',
        },
        surface: {
          DEFAULT: '#f5f5f7',
          muted: '#ebebf0',
          card: 'rgba(255, 255, 255, 0.72)',
          glass: 'rgba(255, 255, 255, 0.55)',
          border: 'rgba(0, 0, 0, 0.08)',
        },
        up: '#1f9d55',
        down: '#d93544',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          '"Noto Sans TC"',
          '"PingFang TC"',
          '"Helvetica Neue"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      letterSpacing: {
        tightish: '-0.012em',
      },
      boxShadow: {
        glass:
          '0 1px 0 0 rgba(255, 255, 255, 0.6) inset, 0 8px 24px -10px rgba(15, 23, 42, 0.18), 0 1px 2px rgba(15, 23, 42, 0.04)',
        pop: '0 12px 32px -10px rgba(15, 23, 42, 0.22)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
