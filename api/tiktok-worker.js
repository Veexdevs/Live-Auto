import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from 'tiktok-live-connector';
import { loadRoomState, saveRoomState } from '../server/cloudStore.js';
import {
  normalizeLoadedState,
  ensureActiveState,
  processChatEvent,
  processGiftEvent,
  formatRoomResponse,
} from '../server/quizCore.js';
import { TIKTOK_GIFT_CATALOG } from '../server/giftCatalog.js';

export const config = {
  maxDuration: 300,
};

function extractAvatarUrl(user) {
  if (!user) return '';
  const pic = user.profilePicture || user.profilePictureMedium;
  if (typeof user.profilePictureUrl === 'string') return user.profilePictureUrl;
  if (Array.isArray(pic?.url) && pic.url[0]) return pic.url[0];
  if (Array.isArray(pic?.urls) && pic.urls[0]) return pic.urls[0];
  if (Array.isArray(pic?.urlList) && pic.urlList[0]) return pic.urlList[0];
  return '';
}

function normalizeUser(rawUser = {}) {
  const uniqueId =
    rawUser.uniqueId ||
    rawUser.displayId ||
    rawUser.username ||
    `user_${rawUser.userId || Math.floor(Math.random() * 10000)}`;
  return {
    userId: String(rawUser.userId || uniqueId),
    uniqueId: String(uniqueId).replace(/^@/, ''),
    nickname: String(rawUser.nickname || uniqueId),
    avatar: rawUser.avatar || extractAvatarUrl(rawUser),
  };
}

export default async function handler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const role = req.query?.role === 'studio' ? 'studio' : 'overlay';
  const workerId = `wk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  let closed = false;
  let connection = null;
  let writeChain = Promise.resolve();

  const sendEvent = (event, payload) => {
    if (closed) return;
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // ignore closed socket write
    }
  };

  // Serialize state mutations inside this worker so concurrent chat+gift events never clobber each other
  const mutateState = (fn) => {
    writeChain = writeChain
      .then(async () => {
        if (closed) return;
        const raw = await loadRoomState({ forceFresh: true });
        const state = normalizeLoadedState(raw);
        const shouldSave = await fn(state);
        if (shouldSave !== false) {
          await saveRoomState(state);
        }
        sendEvent('state', formatRoomResponse(state, { role }));
        return state;
      })
      .catch((err) => {
        console.warn('[Worker Mutate]', err.message);
      });
    return writeChain;
  };

  // Initial lease check
  const initialRaw = await loadRoomState({ forceFresh: true });
  const initialState = normalizeLoadedState(initialRaw);
  const now = Date.now();
  const targetUser =
    initialState.tiktok?.targetUsername || initialState.config?.tiktokUsername || '';

  if (!targetUser || initialState.tiktok?.autoConnect === false) {
    sendEvent('standby', { reason: 'no_target_user' });
    res.end();
    return;
  }

  if (
    initialState.tiktok?.workerLeaseUntil > now &&
    initialState.tiktok?.workerId &&
    initialState.tiktok?.workerId !== workerId
  ) {
    sendEvent('standby', { reason: 'another_worker_active' });
    res.end();
    return;
  }

  // Acquire worker lease
  initialState.tiktok.workerId = workerId;
  initialState.tiktok.workerLeaseUntil = now + 15000;
  initialState.tiktok.connecting = true;
  await saveRoomState(initialState);
  sendEvent('state', formatRoomResponse(initialState, { role }));

  let networkSandboxBlocked = false;
  let lastConnectAttemptAt = 0;

  const disconnectCurrent = async () => {
    if (connection) {
      try {
        await connection.disconnect();
      } catch {
        // ignore
      }
      connection = null;
    }
  };

  const tryConnectTikTok = async (username) => {
    if (closed || networkSandboxBlocked || !username) return;
    lastConnectAttemptAt = Date.now();
    await disconnectCurrent();

    const conn = new TikTokLiveConnection(username, {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      fetchRoomInfoOnConnect: true,
    });
    connection = conn;

    conn.on(ControlEvent.DISCONNECTED, () => {
      if (closed) return;
      mutateState(async (st) => {
        st.tiktok.connected = false;
        st.tiktok.connecting = false;
      });
    });

    conn.on(WebcastEvent.STREAM_END, () => {
      if (closed) return;
      mutateState(async (st) => {
        st.tiktok.connected = false;
        st.tiktok.connecting = false;
        st.tiktok.error = `A live de @${username} foi encerrada. Aguardando próxima live...`;
      });
    });

    conn.on(ControlEvent.ERROR, () => {});

    conn.on(WebcastEvent.ROOM_USER, (data) => {
      if (typeof data?.viewerCount === 'number') {
        mutateState(async (st) => {
          st.tiktok.viewerCount = data.viewerCount;
        });
      }
    });

    conn.on(WebcastEvent.LIKE, (data) => {
      if (typeof data?.totalLikeCount === 'number') {
        mutateState(async (st) => {
          st.tiktok.likeCount = data.totalLikeCount;
        });
      }
    });

    conn.on(WebcastEvent.CHAT, (data) => {
      const comment = String(data?.comment || '').trim();
      if (!comment) return;
      const user = normalizeUser(data?.user);
      const eventId = String(
        data?.common?.msgId || data?.msgId || `${user.userId}_${comment}_${Date.now()}`
      );
      mutateState(async (st) => {
        processChatEvent(st, { user, comment, eventId, isSimulated: false });
      });
    });

    conn.on(WebcastEvent.GIFT, (data) => {
      const user = normalizeUser(data?.user);
      const giftId = Number(data?.giftId || data?.gift?.id || 0);
      const giftName =
        data?.giftDetails?.giftName ||
        data?.gift?.name ||
        data?.extendedGiftInfo?.name ||
        data?.giftName ||
        TIKTOK_GIFT_CATALOG.find((g) => g.giftId === giftId)?.name ||
        `Gift #${giftId}`;
      const giftType = Number(
        data?.giftDetails?.giftType ??
          data?.gift?.type ??
          data?.extendedGiftInfo?.type ??
          data?.giftType ??
          0
      );
      const repeatCount = Math.max(1, Number(data?.repeatCount || 1));
      const groupId = String(data?.groupId || `${user.userId}_${giftId}`);
      const eventId = String(
        data?.common?.msgId || data?.logId || `${groupId}_${repeatCount}`
      );

      mutateState(async (st) => {
        await processGiftEvent(st, {
          user,
          giftId,
          giftName,
          repeatCount,
          giftType,
          groupId,
          eventId,
          isSimulated: false,
        });
      });
    });

    try {
      const roomState = await conn.connect();
      if (closed) {
        await disconnectCurrent();
        return;
      }
      await mutateState(async (st) => {
        st.tiktok.connected = true;
        st.tiktok.connecting = false;
        st.tiktok.roomId = String(roomState?.roomId || conn.roomId || '');
        st.tiktok.error = '';
      });
    } catch (err) {
      connection = null;
      const rawMsg = String(err?.message || '');
      let friendly = rawMsg || 'Não foi possível conectar ao TikTok.';

      if (rawMsg.includes('UserOffline') || rawMsg.toLowerCase().includes('offline')) {
        friendly = `Aguardando @${username} entrar ao vivo no TikTok (auto-detecção ativa a cada 18s)...`;
      } else if (
        rawMsg.includes('ENOTFOUND') ||
        rawMsg.includes('ECONNRESET') ||
        rawMsg.includes('ECONNREFUSED')
      ) {
        networkSandboxBlocked = true;
        friendly =
          'Ambiente de preview local sem rede externa p/ TikTok. Na URL da Vercel a conexão automática funciona direto!';
      }

      await mutateState(async (st) => {
        st.tiktok.connected = false;
        st.tiktok.connecting = false;
        st.tiktok.error = friendly;
      });
    }
  };

  await tryConnectTikTok(targetUser);

  // Heartbeat + auto-reconnect + round timer advancement loop
  const heartbeatInterval = setInterval(async () => {
    if (closed) return;

    await mutateState(async (st) => {
      const currentTarget =
        st.tiktok?.targetUsername || st.config?.tiktokUsername || '';

      if (!currentTarget || st.tiktok?.autoConnect === false) {
        st.tiktok.connected = false;
        st.tiktok.connecting = false;
        st.tiktok.workerLeaseUntil = 0;
        setTimeout(() => cleanupAndClose('stopped'), 50);
        return true;
      }

      st.tiktok.workerId = workerId;
      st.tiktok.workerLeaseUntil = Date.now() + 15000;
      await ensureActiveState(st, { allowAiFetch: true });

      // Auto-retry if user wasn't live yet and 18s passed
      if (
        !connection &&
        !networkSandboxBlocked &&
        Date.now() - lastConnectAttemptAt >= 18000
      ) {
        st.tiktok.connecting = true;
        tryConnectTikTok(currentTarget);
      }
      return true;
    });
  }, 3000);

  // Gracefully cycle at 235s (before Vercel 300s maxDuration) so EventSource seamlessly reconnects
  const cycleTimer = setTimeout(() => {
    cleanupAndClose('cycle');
  }, 235000);

  const cleanupAndClose = async (reason = 'close') => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeatInterval);
    clearTimeout(cycleTimer);
    await disconnectCurrent();

    try {
      const raw = await loadRoomState({ forceFresh: true });
      const st = normalizeLoadedState(raw);
      if (st.tiktok?.workerId === workerId) {
        st.tiktok.workerLeaseUntil = 0;
        if (reason !== 'cycle') {
          st.tiktok.connected = false;
          st.tiktok.connecting = false;
        }
        await saveRoomState(st);
      }
    } catch {
      // ignore final release errors
    }

    try {
      res.write(`event: ${reason}\ndata: {}\n\n`);
      res.end();
    } catch {
      // ignore
    }
  };

  req.on('close', () => {
    cleanupAndClose('client_disconnect');
  });
}
