import { defineConfig } from 'vite';

// Both upstream APIs are routed through the Vite server.
// SerpAPI does not allow browser (CORS) requests, so a proxy is required;
// OpenAI is proxied too so everything goes through one origin.
// API keys are entered in the UI and forwarded per request — nothing is stored server-side.
const proxy = {
  '/api/serpapi': {
    target: 'https://serpapi.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/serpapi/, ''),
  },
  '/api/openai': {
    target: 'https://api.openai.com',
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/openai/, ''),
  },
};

export default defineConfig({
  server: { proxy },
  preview: { proxy },
});
