export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lc: {
          dark: '#1a1a1a',
          darkCard: '#282828',
          darkSurface: '#202020',
          darkBorder: '#3e3e3e',
          darkBorderSubtle: '#333333',
          light: '#f7f7f8',
          lightCard: '#ffffff',
          lightSurface: '#fafafa',
          lightBorder: '#e5e7eb',
          yellow: '#ffa116',
          green: '#00b8a3',
          greenHover: '#00a390',
          red: '#ff375f',
          blue: '#0a84ff',
          textDark: '#eff1f6',
          textDarkMuted: '#9ca3af',
          textLight: '#262626',
          textLightMuted: '#6e7279'
        },
        brand: {
          dark: '#0f172a',
          card: '#1e293b',
          accent: '#3b82f6',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
