/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // メインカラー
        purple: {
          light: '#c084fc',
          DEFAULT: '#a855f7',
          dark: '#7c3aed',
        },
        pink: {
          light: '#f472b6',
          DEFAULT: '#ec4899',
          dark: '#be185d',
        },
        teal: {
          light: '#5eead4',
          DEFAULT: '#2dd4bf',
          dark: '#0d9488',
        },
        violet: {
          DEFAULT: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['"Zen Maru Gothic"', '"M PLUS Rounded 1c"', 'sans-serif'],
      },
      backdropBlur: {
        glass: '16px',
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(180deg, #fffbfe 0%, #fdf4ff 30%, #f0fdfa 60%, #fdf2f8 100%)',
        'gradient-purple-pink': 'linear-gradient(135deg, #a855f7, #ec4899)',
        'gradient-teal': 'linear-gradient(135deg, #2dd4bf, #5eead4)',
        'gradient-pink': 'linear-gradient(135deg, #ec4899, #f472b6)',
        'gradient-violet': 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(168, 85, 247, 0.06)',
        'glass-hover': '0 16px 48px rgba(168, 85, 247, 0.12)',
        'button-purple': '0 4px 20px rgba(168, 85, 247, 0.3)',
        'button-pink': '0 4px 16px rgba(236, 72, 153, 0.25)',
        'button-teal': '0 4px 16px rgba(45, 212, 191, 0.25)',
      },
    },
  },
  plugins: [],
}
