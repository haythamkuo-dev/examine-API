import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

const apiPort = +(process.env.API_SERVER_PORT || 3000);
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === 'true';
const base = isGitHubPagesBuild && repositoryName ? `/${repositoryName}/` : '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${apiPort}`,
      '/health': `http://localhost:${apiPort}`,
    },
  },
});
