import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', '');

	return {
		plugins: [
			react(),
			tailwindcss(),
			VitePWA({
				registerType: 'autoUpdate',
				includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
				manifest: {
					name: 'K書中心預約系統',
					short_name: 'K書中心',
					description: '鳳山高中 K書中心座位預約系統 — 線上預約自習座位，輕鬆管理學習空間',
					theme_color: '#0f172a',
					background_color: '#0f172a',
					icons: [
						{
							src: 'pwa-192x192.png',
							sizes: '192x192',
							type: 'image/png'
						},
						{
							src: 'pwa-512x512.png',
							sizes: '512x512',
							type: 'image/png'
						},
						{
							src: 'pwa-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any maskable'
						}
					]
				}
			})
		],


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