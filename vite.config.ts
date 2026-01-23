import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/api/frequency': {
        target: 'https://driftsdata.statnett.no',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/frequency/, '/restapi/Frequency/BySecond?From=2012-01-01'),
      },
    },
  },
})
