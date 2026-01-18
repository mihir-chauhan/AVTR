import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        proxy: {
            '/heygen': {
                target: 'https://api.heygen.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/heygen/, ''),
                secure: false
            }
        }
    }
});
