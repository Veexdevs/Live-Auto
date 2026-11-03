import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_GIFT_POWERS } from './giftCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

export const DEFAULT_CONFIG = {
  tiktokUsername: process.env.TIKTOK_USERNAME || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  quizTheme: 'Conhecimentos Gerais, Curiosidades, Cultura Pop, Brasil, Esportes e Games',
  difficulty: 'misto', // 'facil' | 'medio' | 'dificil' | 'misto'
  roundDurationSec: 35,
  revealDurationSec: 6,
  oneAttemptPerUser: true,
  endRoundOnFirstCorrect: false,
  safeZoneBottom: false,
  transparentBg: false,
  liveTitle: 'QUIZ AO VIVO • VALENDO RANKING!',
  giftPowers: DEFAULT_GIFT_POWERS,
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadPersistedState() {
  try {
    ensureDataDir();
    if (!fs.existsSync(STATE_FILE)) {
      return {
        config: structuredClone(DEFAULT_CONFIG),
        leaderboard: {},
        secretApiKey: '',
      };
    }
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const mergedGifts = { ...structuredClone(DEFAULT_GIFT_POWERS) };
    if (raw.config?.giftPowers) {
      for (const [k, v] of Object.entries(raw.config.giftPowers)) {
        if (mergedGifts[k]) {
          mergedGifts[k] = { ...mergedGifts[k], ...v };
        }
      }
    }
    return {
      config: {
        ...structuredClone(DEFAULT_CONFIG),
        ...(raw.config || {}),
        giftPowers: mergedGifts,
      },
      leaderboard: raw.leaderboard || {},
      secretApiKey: raw.secretApiKey || '',
    };
  } catch (err) {
    console.error('[Storage] Erro ao carregar state.json:', err.message);
    return {
      config: structuredClone(DEFAULT_CONFIG),
      leaderboard: {},
      secretApiKey: '',
    };
  }
}

export function savePersistedState(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage] Erro ao salvar state.json:', err.message);
  }
}

export function maskApiKey(key = '') {
  if (!key || key.length < 12) return key ? '••••••••' : '';
  return `${key.slice(0, 10)}...${key.slice(-4)}`;
}
