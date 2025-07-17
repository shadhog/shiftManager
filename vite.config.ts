
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { cwd } from 'node:process'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), '');
  return {
    plugins: [
      react(),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        '~': path.resolve(__dirname, './src'),
      }
    }
  };
})