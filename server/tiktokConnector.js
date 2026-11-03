import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from 'tiktok-live-connector';
import { TIKTOK_GIFT_CATALOG } from './giftCatalog.js';

function extractAvatarUrl(user) {
  if (!user) return '';
  const pic = user.profilePicture || user.profilePictureMedium;
  if (typeof user.profilePictureUrl === 'string') return user.profilePictureUrl;
  if (Array.isArray(pic?.url) && pic.url[0]) return pic.url[0];
  if (Array.isArray(pic?.urls) && pic.urls[0]) return pic.urls[0];
  if (Array.isArray(pic?.urlList) && pic.urlList[0]) return pic.urlList[0];
  return '';
}

export function normalizeTikTokUser(rawUser = {}) {
  const uniqueId =
    rawUser.uniqueId ||
    rawUser.displayId ||
    rawUser.username ||
    `user_${rawUser.userId || Math.floor(Math.random() * 10000)}`;
  const nickname = rawUser.nickname || uniqueId;
  const userId = String(rawUser.userId || uniqueId);
  const avatar = rawUser.avatar || extractAvatarUrl(rawUser);

  return {
    userId,
    uniqueId: String(uniqueId).replace(/^@/, ''),
    nickname: String(nickname),
    avatar,
  };
}

export function parseUsernameInput(input = '') {
  let clean = String(input).trim();
  const urlMatch = clean.match(/tiktok\.com\/@?([a-zA-Z0-9._-]+)/i);
  if (urlMatch) {
    clean = urlMatch[1];
  }
  return clean.replace(/^@/, '').trim();
}

const SIM_USERS = [
  { userId: 'sim_1', uniqueId: 'lucas.gamerbr', nickname: 'Lucas Gamer 🎮' },
  { userId: 'sim_2', uniqueId: 'mari_silva02', nickname: 'Mariana Silva ✨' },
  { userId: 'sim_3', uniqueId: 'pedro_fut99', nickname: 'Pedro Henrique ⚽' },
  { userId: 'sim_4', uniqueId: 'ana.clara_ofc', nickname: 'Ana Clara 💖' },
  { userId: 'sim_5', uniqueId: 'biel_zika', nickname: 'Biel 🔥' },
  { userId: 'sim_6', uniqueId: 'camila_quiz', nickname: 'Camila 🧠' },
  { userId: 'sim_7', uniqueId: 'rafael.sp', nickname: 'Rafa SP' },
  { userId: 'sim_8', uniqueId: 'julia_mendes', nickname: 'Júlia Mendes 🌸' },
  { userId: 'sim_9', uniqueId: 'thiago_dev', nickname: 'Thiago 🚀' },
  { userId: 'sim_10', uniqueId: 'leticia.br', nickname: 'Letícia ⭐' },
];

export class TikTokConnectorManager {
  constructor({ onChat, onGift, onStats, onStatus }) {
    this.onChat = onChat;
    this.onGift = onGift;
    this.onStats = onStats;
    this.onStatus = onStatus;

    this.connection = null;
    this.streakTracker = new Map();
    this.simInterval = null;

    this.status = {
      connected: false,
      connecting: false,
      username: '',
      roomId: '',
      viewerCount: 0,
      likeCount: 0,
      error: '',
      simulationActive: false,
    };
  }

  updateStatus(patch) {
    this.status = { ...this.status, ...patch };
    if (this.onStatus) {
      this.onStatus(this.status);
    }
  }

  cleanupStreakTracker() {
    const now = Date.now();
    for (const [k, v] of this.streakTracker.entries()) {
      if (now - v.updatedAt > 60000) {
        this.streakTracker.delete(k);
      }
    }
  }

  async connect(rawUsername) {
    const username = parseUsernameInput(rawUsername);
    if (!username) {
      throw new Error('Informe o @usuario do TikTok que está em live.');
    }

    await this.disconnect();

    this.updateStatus({
      connecting: true,
      connected: false,
      username,
      error: '',
    });

    try {
      const conn = new TikTokLiveConnection(username, {
        processInitialData: false,
        enableExtendedGiftInfo: true,
        fetchRoomInfoOnConnect: true,
      });

      this.connection = conn;

      conn.on(ControlEvent.CONNECTED, (state) => {
        this.updateStatus({
          connected: true,
          connecting: false,
          roomId: String(state?.roomId || conn.roomId || ''),
          error: '',
        });
      });

      conn.on(ControlEvent.DISCONNECTED, () => {
        this.updateStatus({
          connected: false,
          connecting: false,
        });
      });

      conn.on(WebcastEvent.STREAM_END, () => {
        this.updateStatus({
          connected: false,
          connecting: false,
          error: 'A transmissão ao vivo foi encerrada no TikTok.',
        });
      });

      conn.on(ControlEvent.ERROR, (err) => {
        const msg = err?.info || err?.exception?.message || err?.message || 'Erro na conexão TikTok';
        console.warn('[TikTok Error]', msg);
      });

      conn.on(WebcastEvent.ROOM_USER, (data) => {
        if (typeof data?.viewerCount === 'number') {
          this.updateStatus({ viewerCount: data.viewerCount });
          if (this.onStats) {
            this.onStats({ viewerCount: data.viewerCount });
          }
        }
      });

      conn.on(WebcastEvent.LIKE, (data) => {
        if (typeof data?.totalLikeCount === 'number') {
          this.updateStatus({ likeCount: data.totalLikeCount });
        }
      });

      conn.on(WebcastEvent.CHAT, (data) => {
        const user = normalizeTikTokUser(data?.user);
        const comment = String(data?.comment || '').trim();
        if (!comment) return;
        if (this.onChat) {
          this.onChat({
            user,
            comment,
            isSimulated: false,
            timestamp: Date.now(),
          });
        }
      });

      conn.on(WebcastEvent.GIFT, (data) => {
        this.handleRawGiftEvent(data);
      });

      const state = await conn.connect();
      this.updateStatus({
        connected: true,
        connecting: false,
        roomId: String(state?.roomId || conn.roomId || ''),
        error: '',
      });

      return this.status;
    } catch (err) {
      this.connection = null;
      let friendlyMsg = err?.message || 'Falha ao conectar ao TikTok Live.';
      if (
        friendlyMsg.includes('UserOffline') ||
        friendlyMsg.toLowerCase().includes('offline')
      ) {
        friendlyMsg = `O perfil @${username} não está ao vivo no momento.`;
      } else if (
        friendlyMsg.includes('ENOTFOUND') ||
        friendlyMsg.includes('ECONNRESET') ||
        friendlyMsg.includes('ECONNREFUSED')
      ) {
        friendlyMsg =
          'Rede do ambiente de preview bloqueia conexão externa ao TikTok. Use o Simulador aqui ou rode localmente no seu PC/OBS para conectar à live real!';
      }

      this.updateStatus({
        connected: false,
        connecting: false,
        error: friendlyMsg,
      });
      throw new Error(friendlyMsg);
    }
  }

  handleRawGiftEvent(data) {
    this.cleanupStreakTracker();

    const user = normalizeTikTokUser(data?.user);
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

    const diamondCount = Number(
      data?.giftDetails?.diamondCount ??
        data?.gift?.diamondCount ??
        data?.extendedGiftInfo?.diamond_count ??
        data?.diamondCount ??
        1
    );

    const giftPictureUrl =
      data?.giftDetails?.giftImage?.giftPictureUrl ||
      data?.gift?.image?.url?.[0] ||
      data?.extendedGiftInfo?.image?.url_list?.[0] ||
      '';

    const repeatCount = Math.max(1, Number(data?.repeatCount || 1));
    const repeatEnd = Boolean(data?.repeatEnd);
    const groupId = String(data?.groupId || `${user.userId}_${giftId}`);

    let deltaCount = repeatCount;
    if (giftType === 1) {
      const prev = this.streakTracker.get(groupId)?.count || 0;
      deltaCount = Math.max(0, repeatCount - prev);
      this.streakTracker.set(groupId, {
        count: Math.max(prev, repeatCount),
        updatedAt: Date.now(),
      });
      if (repeatEnd) {
        // Keep briefly to avoid late duplicate packet, cleaned up by TTL
        this.streakTracker.set(groupId, {
          count: Math.max(prev, repeatCount),
          updatedAt: Date.now(),
        });
      }
      if (deltaCount <= 0) {
        return; // Final repeatEnd packet already accounted for in real-time!
      }
    }

    if (this.onGift) {
      this.onGift({
        user,
        giftId,
        giftName,
        diamondCount,
        giftPictureUrl,
        repeatCount: deltaCount,
        totalStreakCount: repeatCount,
        isSimulated: false,
        timestamp: Date.now(),
      });
    }
  }

  async disconnect() {
    if (this.connection) {
      try {
        await this.connection.disconnect();
      } catch {
        // ignore disconnect errors
      }
      this.connection = null;
    }
    this.updateStatus({
      connected: false,
      connecting: false,
      roomId: '',
    });
  }

  toggleCrowdSimulation(active, getGiftPowers) {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    const enabled = Boolean(active);
    this.updateStatus({
      simulationActive: enabled,
      viewerCount: enabled ? Math.max(this.status.viewerCount, 148) : this.status.viewerCount,
    });

    if (!enabled) return;

    const chatPhrases = [
      'A',
      'B',
      'C',
      'D',
      'letra A!',
      'acho que é B',
      'C com certeza',
      'opção D',
      'essa tá boa demais 🔥',
      'manda dica família!!',
      'bora subir no top 5 🏆',
    ];

    this.simInterval = setInterval(() => {
      const randomUser = SIM_USERS[Math.floor(Math.random() * SIM_USERS.length)];
      const roll = Math.random();

      // Update simulated viewer fluctuation
      const deltaViewers = Math.floor(Math.random() * 9) - 3;
      const nextViewers = Math.max(45, (this.status.viewerCount || 140) + deltaViewers);
      this.updateStatus({ viewerCount: nextViewers });

      if (roll < 0.82) {
        const phrase = chatPhrases[Math.floor(Math.random() * chatPhrases.length)];
        this.onChat?.({
          user: randomUser,
          comment: phrase,
          isSimulated: true,
          timestamp: Date.now(),
        });
      } else {
        // Occasionally send one of the configured gifts (weighted toward hint/eliminate/buyPoint)
        const powers = getGiftPowers?.() || {};
        const weightedKeys = [
          'eliminateWrong',
          'eliminateWrong',
          'showHint',
          'showHint',
          'buyPoint',
          'buyPoint',
          'revealAnswer',
          'skipQuestion',
        ];
        const chosenKey = weightedKeys[Math.floor(Math.random() * weightedKeys.length)];
        const cfg = powers[chosenKey];
        if (cfg && cfg.enabled !== false) {
          this.onGift?.({
            user: randomUser,
            giftId: cfg.giftId,
            giftName: cfg.giftName,
            diamondCount: cfg.coins || 1,
            giftPictureUrl: '',
            repeatCount: 1,
            totalStreakCount: 1,
            isSimulated: true,
            timestamp: Date.now(),
          });
        }
      }
    }, 2800);
  }
}
