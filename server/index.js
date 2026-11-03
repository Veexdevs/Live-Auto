import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';

import stateHandler from '../api/state.js';
import actionHandler from '../api/action.js';
import tiktokWorkerHandler from '../api/tiktok-worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

const app = express();
app.use(express.json());

// Mount the exact same serverless handlers used on Vercel
app.get('/api/state', (req, res) => stateHandler(req, res));
app.post('/api/action', (req, res) => actionHandler(req, res));
app.get('/api/tiktok-worker', (req, res) => tiktokWorkerHandler(req, res));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

const httpServer = http.createServer(app);

async function startServer() {
  const distPath = path.join(ROOT_DIR, 'dist');
  const isProd =
    process.env.NODE_ENV === 'production' &&
    fs.existsSync(path.join(distPath, 'index.html'));

  if (isProd) {
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: ROOT_DIR,
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: {
          server: httpServer,
          path: '/__vite_hmr',
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 TikTok Live Auto Quiz rodando em http://0.0.0.0:${PORT}`);
    console.log(`📱 Overlay OBS (9:16): http://localhost:${PORT}/overlay`);
  });
}

startServer().catch((err) => {
  console.error('Erro fatal ao iniciar servidor:', err);
  process.exit(1);
});
