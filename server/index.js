import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';

import {
  loadPersistedState,
  savePersistedState,
  maskApiKey,
} from './storage.js';
import { TIKTOK_GIFT_CATALOG } from './giftCatalog.js';
import { AIQuestionGenerator } from './aiGenerator.js';
import { TikTokConnectorManager } from './tiktokConnector.js';
import { QuizEngine } from './quizEngine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3000);

const persisted = loadPersistedState();

function getEffectiveApiKey() {
  return (persisted.secretApiKey || process.env.OPENROUTER_API_KEY || '').trim();
}

function persistNow() {
  savePersistedState({
    config: quizEngine.config,
    leaderboard: quizEngine.leaderboard,
    secretApiKey: persisted.secretApiKey || '',
  });
}

const app = express();
app.use(express.json());

const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
  },
});

const aiGenerator = new AIQuestionGenerator({
  getApiKey: getEffectiveApiKey,
  getConfig: () => quizEngine?.config || persisted.config,
  onStatusChange: (aiStatus) => {
    io.to('studio').emit('ai:status', buildAIStatusPayload(aiStatus));
  },
});

function buildAIStatusPayload(aiStatus = aiGenerator.status) {
  const key = getEffectiveApiKey();
  return {
    ...aiStatus,
    hasApiKey: Boolean(key),
    maskedApiKey: maskApiKey(key),
    model: quizEngine?.config?.openRouterModel || persisted.config.openRouterModel,
  };
}

// Browser bridge for environments where container outbound internet is restricted
const pendingBridgeCalls = new Map();

aiGenerator.setBridgeRequester(async ({ messages, modelCandidates, apiKey }) => {
  const allSockets = await io.fetchSockets();
  const readySockets = allSockets.filter((s) => s.data?.bridgeReady);
  if (readySockets.length === 0) {
    throw new Error('Aguardando navegador para ponte IA');
  }

  const studioReady = readySockets.find((s) => s.rooms.has('studio'));
  const targetSocket = studioReady || readySockets[0];
  const reqId = `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingBridgeCalls.delete(reqId);
      reject(new Error('Tempo limite na geração via OpenRouter'));
    }, 8500);

    pendingBridgeCalls.set(reqId, { resolve, reject, timer });

    targetSocket.emit('ai:bridge:request', {
      reqId,
      messages,
      modelCandidates,
      apiKey,
    });
  });
});

const quizEngine = new QuizEngine({
  aiGenerator,
  initialConfig: persisted.config,
  initialLeaderboard: persisted.leaderboard,
  onStateUpdate: () => {
    io.to('overlay').emit('quiz:state', quizEngine.getPublicState({ includeAdmin: false }));
    io.to('studio').emit('quiz:state', quizEngine.getPublicState({ includeAdmin: true }));
  },
  onEventAlert: (alert) => {
    io.emit('quiz:alert', alert);
  },
  onFeedItem: (item) => {
    io.to('studio').emit('quiz:feed', item);
  },
  onPersist: () => {
    persistNow();
  },
});

const tiktokManager = new TikTokConnectorManager({
  onChat: (chatEvt) => {
    quizEngine.handleChatMessage(chatEvt);
  },
  onGift: (giftEvt) => {
    quizEngine.handleGiftEvent(giftEvt);
  },
  onStats: () => {
    io.emit('tiktok:status', tiktokManager.status);
  },
  onStatus: (status) => {
    io.emit('tiktok:status', status);
  },
});

// REST health & catalog endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    round: quizEngine.roundNumber,
    phase: quizEngine.phase,
  });
});

app.get('/api/gifts-catalog', (_req, res) => {
  res.json({ catalog: TIKTOK_GIFT_CATALOG });
});

// Socket.IO handlers
io.on('connection', (socket) => {
  const role = socket.handshake.query?.role === 'overlay' ? 'overlay' : 'studio';
  socket.join(role);

  socket.emit('quiz:state', quizEngine.getPublicState({ includeAdmin: role === 'studio' }));
  socket.emit('tiktok:status', tiktokManager.status);
  socket.emit('gift:catalog', TIKTOK_GIFT_CATALOG);
  if (role === 'studio') {
    socket.emit('ai:status', buildAIStatusPayload());
  }

  socket.on('ai:bridge:ready', () => {
    socket.data.bridgeReady = true;
    aiGenerator.refillQueueInBackground(2);
  });

  socket.on('ai:bridge:response', ({ reqId, content, model, error }) => {
    const pending = pendingBridgeCalls.get(reqId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingBridgeCalls.delete(reqId);
    if (error) {
      pending.resolve({ error });
    } else {
      pending.resolve({ content, model });
    }
  });

  socket.on('tiktok:connect', async ({ username }, ack) => {
    try {
      quizEngine.updateConfig({ tiktokUsername: username });
      const st = await tiktokManager.connect(username);
      ack?.({ ok: true, status: st });
    } catch (err) {
      ack?.({ ok: false, error: err.message });
    }
  });

  socket.on('tiktok:disconnect', async (_payload, ack) => {
    await tiktokManager.disconnect();
    ack?.({ ok: true });
  });

  socket.on('tiktok:simulate_crowd', ({ active }, ack) => {
    tiktokManager.toggleCrowdSimulation(active, () => quizEngine.config.giftPowers);
    ack?.({ ok: true, active: tiktokManager.status.simulationActive });
  });

  socket.on('simulate:chat', ({ nickname, uniqueId, comment }, ack) => {
    const cleanId = (uniqueId || nickname || 'visitante_teste')
      .toLowerCase()
      .replace(/[^a-z0-9._]/g, '') || 'visitante_teste';
    quizEngine.handleChatMessage({
      user: {
        userId: `manual_${cleanId}`,
        uniqueId: cleanId,
        nickname: nickname || cleanId,
        avatar: '',
      },
      comment: String(comment || ''),
      isSimulated: true,
    });
    ack?.({ ok: true });
  });

  socket.on(
    'simulate:gift',
    async ({ nickname, uniqueId, powerKey, giftId, giftName, repeatCount = 1 }, ack) => {
      const cleanId = (uniqueId || nickname || 'apoiador_vip')
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, '') || 'apoiador_vip';

      let resolvedGiftId = Number(giftId || 0);
      let resolvedGiftName = giftName || 'Gift';
      let coins = 1;

      if (powerKey && quizEngine.config.giftPowers?.[powerKey]) {
        const p = quizEngine.config.giftPowers[powerKey];
        resolvedGiftId = p.giftId;
        resolvedGiftName = p.giftName;
        coins = p.coins || 1;
      }

      await quizEngine.handleGiftEvent({
        user: {
          userId: `manual_${cleanId}`,
          uniqueId: cleanId,
          nickname: nickname || cleanId,
          avatar: '',
        },
        giftId: resolvedGiftId,
        giftName: resolvedGiftName,
        diamondCount: coins,
        repeatCount: Math.max(1, Number(repeatCount) || 1),
        isSimulated: true,
        timestamp: Date.now(),
      });
      ack?.({ ok: true });
    }
  );

  socket.on('quiz:skip', async (_payload, ack) => {
    await quizEngine.startNextRound({ preferInstant: false, reason: 'admin_skip' });
    ack?.({ ok: true });
  });

  socket.on('quiz:pause', (_payload, ack) => {
    quizEngine.togglePause();
    ack?.({ ok: true, phase: quizEngine.phase });
  });

  socket.on('quiz:hint', (_payload, ack) => {
    if (quizEngine.currentQuestion) {
      quizEngine.hintVisible = true;
      quizEngine.emitAlert({
        type: 'hint',
        icon: '💡',
        title: 'Dica Liberada pelo Host!',
        subtitle: quizEngine.currentQuestion.hint,
        sound: 'hint',
      });
      quizEngine.broadcastState();
    }
    ack?.({ ok: true });
  });

  socket.on('quiz:eliminate', (_payload, ack) => {
    const letter = quizEngine.eliminateOneWrongOption();
    if (letter) {
      quizEngine.emitAlert({
        type: 'eliminate',
        icon: '❌',
        title: `Alternativa ${letter} Eliminada!`,
        subtitle: 'Uma opção incorreta saiu do jogo!',
        sound: 'eliminate',
      });
      quizEngine.broadcastState();
    }
    ack?.({ ok: true, eliminated: letter });
  });

  socket.on('quiz:reveal', (_payload, ack) => {
    if (quizEngine.currentQuestion) {
      quizEngine.enterRevealPhase({ reason: 'admin_reveal' });
    }
    ack?.({ ok: true });
  });

  socket.on('leaderboard:reset', (_payload, ack) => {
    quizEngine.resetLeaderboard();
    ack?.({ ok: true });
  });

  socket.on('leaderboard:adjust', ({ userId, uniqueId, nickname, delta }, ack) => {
    const cleanId = (uniqueId || userId || 'jogador').replace(/^@/, '');
    quizEngine.addPointsToUser(
      {
        userId: userId || `manual_${cleanId}`,
        uniqueId: cleanId,
        nickname: nickname || cleanId,
      },
      Number(delta) || 0,
      'admin'
    );
    quizEngine.broadcastState();
    ack?.({ ok: true });
  });

  socket.on('config:update', ({ config, newApiKey }, ack) => {
    if (typeof newApiKey === 'string' && newApiKey.trim()) {
      persisted.secretApiKey = newApiKey.trim();
      aiGenerator.clearQueue();
    }
    if (config && typeof config === 'object') {
      quizEngine.updateConfig(config);
    } else {
      persistNow();
    }
    io.to('studio').emit('ai:status', buildAIStatusPayload());
    setTimeout(() => aiGenerator.refillQueueInBackground(2), 100);
    ack?.({ ok: true, aiStatus: buildAIStatusPayload() });
  });
});

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

  await quizEngine.start();

  if (persisted.config.tiktokUsername && process.env.TIKTOK_USERNAME) {
    tiktokManager.connect(persisted.config.tiktokUsername).catch((err) => {
      console.warn('[AutoConnect TikTok]', err.message);
    });
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
