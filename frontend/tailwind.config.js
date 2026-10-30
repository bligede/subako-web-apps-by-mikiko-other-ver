/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        forest: { 900: '#0b2e28', 800: '#10443b', 700: '#175c4f' },
        teal: { 700: '#0f7a6b', 600: '#159d8a', 100: '#d6efea' },
        ink: '#172c30',
        slate: '#64748b',
        line: '#e2e8ec',
        warning: '#e8a23b',
        critical: '#b83a3a',
        info: '#2e6f9e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
