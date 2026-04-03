import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY || ''),
      'process.env.LANGFUSE_PUBLIC_KEY': JSON.stringify(env.LANGFUSE_PUBLIC_KEY || ''),
      'process.env.LANGFUSE_SECRET_KEY': JSON.stringify(env.LANGFUSE_SECRET_KEY || ''),
      'process.env.LANGFUSE_HOST': JSON.stringify(env.LANGFUSE_HOST || 'http://localhost:3000'),
      'process.env.OLLAMA_BASE_URL': JSON.stringify(env.OLLAMA_BASE_URL || 'http://localhost:11434'),
    },
    optimizeDeps: {
      include: ['sql.js'],
    },
  };
});
