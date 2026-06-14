import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],


    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    
    server: {
      // 這裡新增 Proxy 設定！
      proxy: {
        // 當前端請求 /api 開頭的路徑時，轉發給本機的 FastAPI (Port 8000)
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // 登入的 /token 也要轉發
        '/token': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        }
      }
    },
  };
}); 