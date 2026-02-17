import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 7000,
    proxy: {
      "/agent": {
        target: "http://localhost:6003",
        changeOrigin: true,
        ws: true,
      },
      "/api": {
        target: "http://localhost:6000",
        changeOrigin: true,
      },
    },
  },
})
