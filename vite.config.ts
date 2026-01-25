import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    include: ['react-is', 'recharts', '@react-three/fiber', '@react-three/drei', 'three']
  },
  build: {
    outDir: 'web-dist'
  }
})

