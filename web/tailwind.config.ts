import type { Config } from 'tailwindcss'
import { heroui } from '@heroui/react'

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    heroui({
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {},
          layout: {
            fontFamily: {
              sans: 'Montserrat, ui-sans-serif, system-ui, sans-serif',
            },
          },
        },
      },
    }),
  ],
} satisfies Config
