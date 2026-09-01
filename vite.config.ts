import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // repo-naam, want de app draait op https://<user>.github.io/frans/
  base: '/frans/',
  plugins: [react(), tailwindcss()],
})
