import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pionc/',
  server: {
    proxy: {
      // Все запросы, начинающиеся с /api-search, будут перенаправляться
      '/api-search': {
        target: 'https://api.duckduckgo.com', // Куда перенаправляем
        changeOrigin: true, // Меняем Origin, чтобы DuckDuckGo не блокировал
        rewrite: (path) => path.replace(/^\/api-search/, ''), // Убираем префикс
      },
    },
  },
});