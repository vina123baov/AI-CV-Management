// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // Sử dụng plugin react-swc cho tốc độ nhanh hơn
import tailwindcss from '@tailwindcss/vite'; // Thêm plugin Tailwind CSS
import path from 'path';
export default defineConfig({
    // Kết hợp các plugin từ cả hai file
    plugins: [
        react(),
        tailwindcss()
    ],
    // Giữ lại cấu hình alias (giống nhau ở cả 2 file)
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    // Thêm cấu hình server proxy từ file 1
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            }
        }
    }
});
