// import react from '@vitejs/plugin-react'
// import { defineConfig } from 'vite'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
//   server: {
//     proxy: {
//       '/api': {
//         target: 'http://127.0.0.1:8000',
//         changeOrigin: true,
//       },
//     },
//   },
// })


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PUBLIC_IP = '195.112.114.234'; // например 203.0.113.10

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,

    // Чтобы Vite не блокировал запросы по IP
    allowedHosts: [PUBLIC_IP, 'localhost', '127.0.0.1'], 
    // для быстрой проверки можно temporary: allowedHosts: true

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },

    // Чтобы HMR не ломался при доступе по IP
    hmr: {
      host: PUBLIC_IP,
      protocol: 'ws',
      clientPort: 5173,
    },
  },
});