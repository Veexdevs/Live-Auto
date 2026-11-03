import {
  DEFAULT_GIFT_POWERS,
  TIKTOK_GIFT_CATALOG,
  matchGiftToPower,
  normalizeText,
} from './giftCatalog.js';
import { FALLBACK_QUESTIONS } from './fallbackQuestions.js';

const LETTERS = ['A', 'B', 'C', 'D'];
let directOpenRouterBlocked = false;

export const DEFAULT_ROOM_CONFIG = {
  tiktokUsername: process.env.TIKTOK_USERNAME || '',
  autoConnectTikTok: true,
  openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  quizTheme:
    'Conhecimentos Gerais, Filmes Disney/Pop, Curiosidades, Brasil, Esportes e Games',
  difficulty: 'misto',
  roundDurationSec: 20,
  revealDurationSec: 5,
  oneAttemptPerUser: true,
  endRoundOnFirstCorrect: false,
  safeZoneBottom: false,
  transparentBg: false,
  invertedTheme: true, // White grid + bold black outlines (inverted from screenshot!)
  giftPowers: DEFAULT_GIFT_POWERS,
};

const SIM_USERS = [
  { userId: 'sim_1', uniqueId: 'lucas.gamer', nickname: 'Lucas' },
  { userId: 'sim_2', uniqueId: 'mari_silva', nickname: 'Mariana' },
  { userId: 'sim_3', uniqueId: 'pedro_fut', nickname: 'Pedro' },
  { userId: 'sim_4', uniqueId: 'ana.clara', nickname: 'Ana Clara' },
  { userId: 'sim_5', uniqueId: 'biel_ofc', nickname: 'Biel' },
  { userId: 'sim_6', uniqueId: 'camila_sp', nickname: 'Camila' },
  { userId: 'sim_7', uniqueId: 'rafa_br', nickname: 'Rafa' },
  { userId: 'sim_8', uniqueId: 'julia_m', nickname: 'Júlia' },
];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function maskApiKey(key = '') {
  if (!key || key.length < 12) return key ? '••••••••' : '';
  return `${key.slice(0, 10)}...${key.slice(-4)}`;
}

export function getEffectiveApiKey(state) {
  return String(state?.secretApiKey || process.env.OPENROUTER_API_KEY || '').trim();
}

export function parseUsernameInput(input = '') {
  let clean = String(input || '').trim();
  const urlMatch = clean.match(/tiktok\.com\/@?([a-zA-Z0-9._-]+)/i);
  if (urlMatch) clean = urlMatch[1];
  return clean.replace(/^@/, '').trim();
}

export function parseAnswerFromChat(comment, optionsMap = {}) {
  const raw = String(comment || '').trim();
  if (!raw) return null;

  const singleMatch = raw.match(/^\s*[\(\[\-\*]*([a-dA-D])[\)\]\.\!\?\*\s]*$/);
  if (singleMatch) {
    return singleMatch[1].toUpperCase();
  }

  const phraseMatch = raw.match(
    /^\s*(?:letra|op[cç][aã]o|alternativa|resposta|vou\s+de|eu\s+vou\s+de|acho\s+q(?:ue)?\s+[eé]|[eé]\s+a(?:\s+letra)?)\s*[:\-]?\s*[\(\[]?([a-dA-D])[\)\]]?(?:\s*[!\?\.\🔥\✅\👏]*)$/i
  );
  if (phraseMatch) {
    return phraseMatch[1].toUpperCase();
  }

  const normComment = normalizeText(raw.replace(/[!\?\.]+$/g, ''));
  if (normComment.length >= 2) {
    for (const letter of LETTERS) {
      const optText = optionsMap[letter];
      if (optText && normalizeText(optText) === normComment) {
        return letter;
      }
    }
  }

  return null;
}

export function formatShuffledQuestion(
  state,
  { category, question, options, answer, hint, source, model }
) {
  const cleanOptions = options.map((o) => String(o).trim()).slice(0, 4);
  const shuffled = shuffleArray(cleanOptions);
  let correctIdx = shuffled.findIndex(
    (opt) => normalizeText(opt) === normalizeText(answer)
  );
  if (correctIdx === -1) correctIdx = 0;

  const optionsMap = {};
  LETTERS.forEach((letter, idx) => {
    optionsMap[letter] = shuffled[idx];
  });
  const correctLetter = LETTERS[correctIdx];

  state.recentQuestions = state.recentQuestions || [];
  state.recentQuestions.push(String(question).trim());
  if (state.recentQuestions.length > 45) {
    state.recentQuestions = state.recentQuestions.slice(-45);
  }

  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    category: String(category || 'Quiz Geral').trim().slice(0, 32),
    question: String(question).trim(),
    options: optionsMap,
    correctOption: correctLetter,
    correctText: optionsMap[correctLetter],
    hint:
      String(hint || '').trim() ||
      `Começa com a letra "${optionsMap[correctLetter][0]}".`,
    source: source || 'openrouter',
    model: model || '',
    createdAt: Date.now(),
  };
}

export function pickFallbackQuestion(state) {
  const recent = state.recentQuestions || [];
  const available = FALLBACK_QUESTIONS.filter(
    (q) => !recent.some((r) => normalizeText(r) === normalizeText(q.question))
  );
  const pool = available.length > 0 ? available : FALLBACK_QUESTIONS;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  return formatShuffledQuestion(state, {
    ...chosen,
    source: 'fallback',
    model: 'Banco Local PT-BR',
  });
}

export function buildOpenRouterPrompt(state) {
  const cfg = state.config || DEFAULT_ROOM_CONFIG;
  const theme =
    cfg.quizTheme?.trim() ||
    'Conhecimentos Gerais, Filmes, Curiosidades, Brasil, Esportes e Games';
  const difficultyMap = {
    facil: 'FÁCIL (perguntas rápidas e acessíveis que geram muitos comentários)',
    medio: 'MÉDIO (equilíbrio ideal entre desafio e participação)',
    dificil: 'DIFÍCIL (perguntas desafiadoras)',
    misto: 'VARIADO (alterne entre perguntas fáceis, curiosas e médias)',
  };
  const diffDesc = difficultyMap[cfg.difficulty] || difficultyMap.misto;
  const recent = (state.recentQuestions || []).slice(-22);
  const avoidList =
    recent.length > 0
      ? `\nNÃO repita estas perguntas recentes:\n- ${recent.join('\n- ')}`
      : '';
  const seed = Math.floor(Math.random() * 999999);

  return [
    {
      role: 'system',
      content:
        'Você é um criador especialista em Quiz Interativo para Lives do TikTok no Brasil. ' +
        'Gere SEMPRE perguntas 100% factuais, verificadas, dinâmicas, curtas e envolventes em Português do Brasil (pt-BR). ' +
        'Responda APENAS com um objeto JSON válido, sem markdown.',
    },
    {
      role: 'user',
      content:
        `Crie 1 pergunta inédita de múltipla escolha para Live do TikTok.\n` +
        `Tema(s): ${theme}\n` +
        `Dificuldade: ${diffDesc}\n` +
        `Semente: #${seed}${avoidList}\n\n` +
        `Regras:\n` +
        `1. Pergunta curta e direta (máx 125 caracteres).\n` +
        `2. 4 opções curtas (máx 34 caracteres cada), apenas UMA correta e 3 erradas plausíveis, sem "A)" no texto.\n` +
        `3. Inclua "hint" (dica inteligente sem entregar a palavra exata).\n` +
        `4. JSON estrito: {"category":"Categoria","question":"Pergunta?","options":["Certa","Errada 1","Errada 2","Errada 3"],"answer":"Certa","hint":"Dica útil"}`,
    },
  ];
}

export function parseOpenRouterContent(rawContent) {
  let cleaned = String(rawContent || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  const parsed = JSON.parse(cleaned);
  if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length < 4) {
    throw new Error('JSON incompleto da IA');
  }
  const cleanOpts = parsed.options
    .slice(0, 4)
    .map((o) => String(o).replace(/^[A-Da-d][\)\.\-\:]\s*/, '').trim());
  let answerText = String(parsed.answer || '')
    .replace(/^[A-Da-d][\)\.\-\:]\s*/, '')
    .trim();
  if (!cleanOpts.some((o) => normalizeText(o) === normalizeText(answerText))) {
    const idx = LETTERS.indexOf(answerText.toUpperCase());
    answerText = idx >= 0 ? cleanOpts[idx] : cleanOpts[0];
  }
  return {
    category: parsed.category || 'Quiz IA',
    question: String(parsed.question).trim(),
    options: cleanOpts,
    answer: answerText,
    hint: parsed.hint || '',
  };
}

export function getModelCandidates(state) {
  const cfgModel = (state?.config?.openRouterModel || 'openai/gpt-4o-mini').trim();
  return [
    ...new Set(
      [
        cfgModel,
        'openai/gpt-4o-mini',
        'google/gemini-2.0-flash-001',
        'openrouter/free',
        'meta-llama/llama-3.3-70b-instruct:free',
      ].filter(Boolean)
    ),
  ];
}

export async function generateQuestionServerSide(state) {
  const apiKey = getEffectiveApiKey(state);
  if (!apiKey || directOpenRouterBlocked) {
    return null;
  }

  const messages = buildOpenRouterPrompt(state);
  const models = getModelCandidates(state);
  let lastErr = '';

  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://live-auto.vercel.app',
          'X-Title': 'TikTok Live Auto Quiz',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.85,
          max_tokens: 320,
        }),
        signal: AbortSignal.timeout(7500),
      });

      if (!res.ok) {
        const bodyTxt = await res.text().catch(() => '');
        lastErr = `HTTP ${res.status} (${model}): ${bodyTxt.slice(0, 90)}`;
        if (res.status === 401) break;
        continue;
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        const parsed = parseOpenRouterContent(content);
        const formatted = formatShuffledQuestion(state, {
          ...parsed,
          source: 'openrouter',
          model: data?.model || model,
        });
        state.aiStatus = {
          ...(state.aiStatus || {}),
          lastSource: 'openrouter',
          lastModel: data?.model || model,
          lastError: '',
          generatedCount: (state.aiStatus?.generatedCount || 0) + 1,
          needsBrowserBridge: false,
        };
        return formatted;
      }
    } catch (err) {
      const code = err?.cause?.code || err?.code || '';
      if (
        code === 'ECONNRESET' ||
        code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        String(err?.message || '').includes('fetch failed')
      ) {
        directOpenRouterBlocked = true;
        state.aiStatus = {
          ...(state.aiStatus || {}),
          needsBrowserBridge: true,
        };
        return null;
      }
      lastErr = err?.message || 'Erro OpenRouter';
    }
  }

  if (lastErr) {
    state.aiStatus = {
      ...(state.aiStatus || {}),
      lastSource: 'fallback',
      lastError: lastErr,
    };
  }
  return null;
}

export function createInitialRoomState() {
  const state = {
    version: 2,
    roundNumber: 0,
    phase: 'ACTIVE',
    pausedFromPhase: 'ACTIVE',
    pausedRemainingMs: 20000,
    phaseStartedAt: Date.now(),
    phaseEndsAt: Date.now() + 20000,
    phaseDurationSec: 20,
    currentQuestion: null,
    prefetchedQueue: [],
    recentQuestions: [],
    eliminatedOptions: [],
    hintVisible: false,
    extraHintText: '',
    revealedEarly: false,
    revealedBy: null,
    pendingEliminations: 0,
    pendingHint: false,
    roundAttempts: {},
    roundWinners: [],
    leaderboard: {},
    recentFeed: [],
    latestAlert: null,
    processedEventIds: [],
    streakCounts: {},
    lastSimStepAt: 0,
    secretApiKey: '',
    config: structuredClone(DEFAULT_ROOM_CONFIG),
    tiktok: {
      targetUsername: process.env.TIKTOK_USERNAME || '',
      autoConnect: true,
      connected: false,
      connecting: false,
      roomId: '',
      viewerCount: 0,
      likeCount: 0,
      error: '',
      simulationActive: false,
      workerId: '',
      workerLeaseUntil: 0,
    },
    aiStatus: {
      lastSource: 'boot',
      lastModel: '',
      lastError: '',
      generatedCount: 0,
      needsBrowserBridge: false,
    },
  };

  const firstQ = pickFallbackQuestion(state);
  startRoundWithQuestion(state, firstQ);
  return state;
}

export function normalizeLoadedState(raw) {
  if (!raw || typeof raw !== 'object' || !raw.version || raw.version < 2) {
    const fresh = createInitialRoomState();
    if (raw?.leaderboard) fresh.leaderboard = raw.leaderboard;
    if (raw?.secretApiKey) fresh.secretApiKey = raw.secretApiKey;
    if (raw?.config) {
      fresh.config = {
        ...fresh.config,
        ...raw.config,
        invertedTheme: raw.config.invertedTheme ?? true,
        giftPowers: {
          ...structuredClone(DEFAULT_GIFT_POWERS),
          ...(raw.config.giftPowers || {}),
        },
      };
      if (raw.config.tiktokUsername) {
        fresh.tiktok.targetUsername = parseUsernameInput(raw.config.tiktokUsername);
      }
    }
    return fresh;
  }

  raw.config = {
    ...structuredClone(DEFAULT_ROOM_CONFIG),
    ...(raw.config || {}),
    giftPowers: {
      ...structuredClone(DEFAULT_GIFT_POWERS),
      ...(raw.config?.giftPowers || {}),
    },
  };
  raw.tiktok = {
    targetUsername: raw.config.tiktokUsername || '',
    autoConnect: true,
    connected: false,
    connecting: false,
    roomId: '',
    viewerCount: 0,
    likeCount: 0,
    error: '',
    simulationActive: false,
    workerId: '',
    workerLeaseUntil: 0,
    ...(raw.tiktok || {}),
  };
  raw.prefetchedQueue = Array.isArray(raw.prefetchedQueue) ? raw.prefetchedQueue : [];
  raw.recentQuestions = Array.isArray(raw.recentQuestions) ? raw.recentQuestions : [];
  raw.processedEventIds = Array.isArray(raw.processedEventIds)
    ? raw.processedEventIds
    : [];
  raw.streakCounts = raw.streakCounts || {};
  raw.roundAttempts = raw.roundAttempts || {};
  raw.roundWinners = Array.isArray(raw.roundWinners) ? raw.roundWinners : [];
  raw.recentFeed = Array.isArray(raw.recentFeed) ? raw.recentFeed : [];
  raw.leaderboard = raw.leaderboard || {};
  return raw;
}

export function setAlert(state, alert) {
  state.latestAlert = {
    id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    ...alert,
  };
}

export function pushFeed(state, item) {
  const entry = {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    ...item,
  };
  state.recentFeed.unshift(entry);
  if (state.recentFeed.length > 50) {
    state.recentFeed = state.recentFeed.slice(0, 50);
  }
}

export function markEventProcessed(state, eventKey) {
  if (!eventKey) return true;
  if (state.processedEventIds.includes(eventKey)) {
    return false;
  }
  state.processedEventIds.push(eventKey);
  if (state.processedEventIds.length > 250) {
    state.processedEventIds = state.processedEventIds.slice(-250);
  }
  return true;
}

export function eliminateOneWrongOption(state) {
  const q = state.currentQuestion;
  if (!q) return null;
  const candidates = LETTERS.filter(
    (l) => l !== q.correctOption && !state.eliminatedOptions.includes(l)
  );
  if (candidates.length === 0) return null;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  state.eliminatedOptions.push(picked);
  return picked;
}

export function startRoundWithQuestion(state, questionObj) {
  const now = Date.now();
  const durationSec = Math.max(
    10,
    Math.min(120, Number(state.config?.roundDurationSec) || 20)
  );

  state.roundNumber = (state.roundNumber || 0) + 1;
  state.currentQuestion = questionObj;
  state.eliminatedOptions = [];
  state.hintVisible = false;
  state.extraHintText = '';
  state.revealedEarly = false;
  state.revealedBy = null;
  state.roundAttempts = {};
  state.roundWinners = [];

  if (state.phase !== 'PAUSED') {
    state.phase = 'ACTIVE';
  }
  state.phaseDurationSec = durationSec;
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + durationSec * 1000;
  state.pausedRemainingMs = durationSec * 1000;

  if (state.pendingEliminations > 0) {
    const count = Math.min(3, state.pendingEliminations);
    state.pendingEliminations = 0;
    for (let i = 0; i < count; i++) {
      eliminateOneWrongOption(state);
    }
  }
  if (state.pendingHint) {
    state.pendingHint = false;
    state.hintVisible = true;
  }
}

export async function advanceToNextQuestion(
  state,
  { allowAiFetch = true, reason = 'auto', triggeredBy = null } = {}
) {
  let nextQ = null;
  if (state.prefetchedQueue.length > 0) {
    nextQ = state.prefetchedQueue.shift();
  } else if (allowAiFetch) {
    nextQ = await generateQuestionServerSide(state);
  }
  if (!nextQ) {
    nextQ = pickFallbackQuestion(state);
  }

  startRoundWithQuestion(state, nextQ);

  if (reason === 'gift_skip' && triggeredBy) {
    setAlert(state, {
      type: 'skip',
      icon: '🎉',
      title: `@${triggeredBy.uniqueId} pulou a pergunta!`,
      subtitle: `Nova pergunta gerada (#${state.roundNumber})`,
      sound: 'skip',
    });
  }
}

export function enterRevealPhase(state, { reason = 'timeout', winner = null } = {}) {
  if (!state.currentQuestion) return;
  const now = Date.now();
  const revealSec = Math.max(
    3,
    Math.min(15, Number(state.config?.revealDurationSec) || 5)
  );

  state.phase = 'REVEAL';
  state.phaseDurationSec = revealSec;
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + revealSec * 1000;

  if (reason === 'first_correct' && winner) {
    setAlert(state, {
      type: 'correct',
      icon: '🎯',
      title: `@${winner.uniqueId} acertou primeiro!`,
      subtitle: `Resposta: ${state.currentQuestion.correctOption} (+1 ponto)`,
      sound: 'win',
    });
  } else {
    setAlert(state, {
      type: 'reveal',
      icon: '✓',
      title: `Resposta Certa: ${state.currentQuestion.correctOption} — ${state.currentQuestion.correctText}`,
      subtitle: `${state.roundWinners.length} pessoa(s) pontuaram nesta rodada`,
      sound: 'reveal',
    });
  }
}

export async function refillPrefetchIfNeeded(state, target = 2) {
  if (directOpenRouterBlocked || !getEffectiveApiKey(state)) {
    if (directOpenRouterBlocked) {
      state.aiStatus = { ...(state.aiStatus || {}), needsBrowserBridge: true };
    }
    return false;
  }
  let changed = false;
  while (state.prefetchedQueue.length < target) {
    const q = await generateQuestionServerSide(state);
    if (q) {
      state.prefetchedQueue.push(q);
      changed = true;
    } else {
      break;
    }
  }
  return changed;
}

export function runSimulationTickIfDue(state) {
  if (!state.tiktok?.simulationActive) return false;
  const now = Date.now();
  if (now - (state.lastSimStepAt || 0) < 2600) return false;
  state.lastSimStepAt = now;

  const randomUser = SIM_USERS[Math.floor(Math.random() * SIM_USERS.length)];
  const deltaViewers = Math.floor(Math.random() * 9) - 3;
  state.tiktok.viewerCount = Math.max(48, (state.tiktok.viewerCount || 135) + deltaViewers);

  const roll = Math.random();
  if (roll < 0.8) {
    const phrases = ['A', 'B', 'C', 'D', 'letra A', 'acho que é B', 'C!', 'opção D'];
    const comment = phrases[Math.floor(Math.random() * phrases.length)];
    processChatEvent(state, {
      user: randomUser,
      comment,
      isSimulated: true,
    });
  } else {
    const keys = [
      'eliminateWrong',
      'eliminateWrong',
      'showHint',
      'buyPoint',
      'revealAnswer',
      'skipQuestion',
    ];
    const powerKey = keys[Math.floor(Math.random() * keys.length)];
    const cfg = state.config?.giftPowers?.[powerKey];
    if (cfg && cfg.enabled !== false) {
      return { triggerGiftPower: { user: randomUser, powerKey, cfg } };
    }
  }
  return true;
}

export async function ensureActiveState(state, { allowAiFetch = true } = {}) {
  let mutated = false;
  const now = Date.now();

  if (!state.currentQuestion) {
    await advanceToNextQuestion(state, { allowAiFetch });
    mutated = true;
  }

  if (state.phase !== 'PAUSED' && now >= state.phaseEndsAt) {
    if (state.phase === 'ACTIVE') {
      enterRevealPhase(state, { reason: 'timeout' });
      mutated = true;
    } else if (state.phase === 'REVEAL') {
      await advanceToNextQuestion(state, { allowAiFetch });
      mutated = true;
    }
  }

  const simRes = runSimulationTickIfDue(state);
  if (simRes) {
    mutated = true;
    if (simRes.triggerGiftPower) {
      const { user, cfg } = simRes.triggerGiftPower;
      await processGiftEvent(state, {
        user,
        giftId: cfg.giftId,
        giftName: cfg.giftName,
        diamondCount: cfg.coins || 1,
        repeatCount: 1,
        isSimulated: true,
      });
    }
  }

  if (allowAiFetch && state.prefetchedQueue.length < 1) {
    const filled = await refillPrefetchIfNeeded(state, 2);
    if (filled) mutated = true;
  }

  return mutated;
}

export function addPointsToUser(state, user, deltaPoints, source = 'quiz') {
  const userId = String(user.userId || user.uniqueId);
  const existing = state.leaderboard[userId] || {
    userId,
    uniqueId: user.uniqueId || userId,
    nickname: user.nickname || user.uniqueId || userId,
    avatar: user.avatar || '',
    points: 0,
    correctAnswers: 0,
    giftsPoints: 0,
    lastScoredAt: Date.now(),
  };

  const nextPoints = Math.max(0, (existing.points || 0) + deltaPoints);
  if (nextPoints === 0) {
    delete state.leaderboard[userId];
    return 0;
  }

  state.leaderboard[userId] = {
    ...existing,
    uniqueId: user.uniqueId || existing.uniqueId,
    nickname: user.nickname || existing.nickname,
    avatar: user.avatar || existing.avatar,
    points: nextPoints,
    correctAnswers:
      source === 'quiz' ? (existing.correctAnswers || 0) + 1 : existing.correctAnswers || 0,
    giftsPoints:
      source === 'gift'
        ? (existing.giftsPoints || 0) + Math.max(0, deltaPoints)
        : existing.giftsPoints || 0,
    lastScoredAt: Date.now(),
  };

  return nextPoints;
}

export function getTopPlayers(state, limit = 5) {
  return Object.values(state.leaderboard || {})
    .filter((p) => p.points > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if ((b.correctAnswers || 0) !== (a.correctAnswers || 0)) {
        return (b.correctAnswers || 0) - (a.correctAnswers || 0);
      }
      return (a.lastScoredAt || 0) - (b.lastScoredAt || 0);
    })
    .slice(0, limit)
    .map((p, idx) => ({
      rank: idx + 1,
      userId: p.userId,
      uniqueId: p.uniqueId,
      nickname: p.nickname,
      avatar: p.avatar || '',
      points: p.points,
      correctAnswers: p.correctAnswers || 0,
      giftsPoints: p.giftsPoints || 0,
    }));
}

export function processChatEvent(
  state,
  { user, comment, eventId = '', isSimulated = false }
) {
  if (!state.currentQuestion) return false;
  if (eventId && !markEventProcessed(state, `chat_${eventId}`)) {
    return false;
  }

  const chosenLetter = parseAnswerFromChat(comment, state.currentQuestion.options);
  if (!chosenLetter) {
    pushFeed(state, { kind: 'chat', user, comment, isSimulated });
    return true;
  }

  if (state.phase !== 'ACTIVE') {
    pushFeed(state, {
      kind: 'chat',
      user,
      comment,
      badge: 'Fora do tempo',
      isSimulated,
    });
    return true;
  }

  const userId = String(user.userId || user.uniqueId);
  const prev = state.roundAttempts[userId];
  if (prev?.correct) return false;

  if (state.config?.oneAttemptPerUser && prev) {
    pushFeed(state, {
      kind: 'attempt_locked',
      user,
      comment,
      badge: `Já tentou (${prev.letter})`,
      isSimulated,
    });
    return true;
  }

  const isCorrect = chosenLetter === state.currentQuestion.correctOption;
  state.roundAttempts[userId] = { letter: chosenLetter, correct: isCorrect };

  if (isCorrect) {
    const totalPts = addPointsToUser(state, user, 1, 'quiz');
    state.roundWinners.push({
      userId,
      uniqueId: user.uniqueId,
      nickname: user.nickname,
      totalPts,
    });

    pushFeed(state, {
      kind: 'correct',
      user,
      comment,
      badge: `+1 pt (Total: ${totalPts})`,
      isSimulated,
    });

    if (state.config?.endRoundOnFirstCorrect) {
      enterRevealPhase(state, { reason: 'first_correct', winner: user });
      return true;
    }

    setAlert(state, {
      type: 'correct',
      icon: '✅',
      title: `@${user.uniqueId} acertou! +1 PONTO`,
      subtitle: `Subiu para ${totalPts} pt${totalPts > 1 ? 's' : ''} no Ranking!`,
      sound: 'win',
    });
  } else {
    pushFeed(state, {
      kind: 'wrong',
      user,
      comment,
      badge: `Errou (${chosenLetter})`,
      isSimulated,
    });
  }

  return true;
}

export async function processGiftEvent(state, giftEvent) {
  const {
    user,
    giftId,
    giftName,
    repeatCount = 1,
    giftType = 0,
    groupId = '',
    eventId = '',
    isSimulated = false,
  } = giftEvent;

  let effectiveCount = Math.max(1, Number(repeatCount) || 1);

  if (!isSimulated && giftType === 1 && groupId) {
    const prevCount = state.streakCounts[groupId]?.count || 0;
    const delta = effectiveCount - prevCount;
    state.streakCounts[groupId] = {
      count: Math.max(prevCount, effectiveCount),
      at: Date.now(),
    };
    // Prune old streak keys
    const keys = Object.keys(state.streakCounts);
    if (keys.length > 150) {
      const cutoff = Date.now() - 120000;
      for (const k of keys) {
        if ((state.streakCounts[k]?.at || 0) < cutoff) {
          delete state.streakCounts[k];
        }
      }
    }
    if (delta <= 0) return false;
    effectiveCount = delta;
  } else if (eventId && !markEventProcessed(state, `gift_${eventId}`)) {
    return false;
  }

  const match = matchGiftToPower({ giftId, giftName }, state.config?.giftPowers);
  if (!match) {
    pushFeed(state, {
      kind: 'gift_unmapped',
      user,
      giftId,
      giftName,
      repeatCount: effectiveCount,
      badge: `Presente (${giftName})`,
      isSimulated,
    });
    return true;
  }

  const { powerKey, powerConfig } = match;
  pushFeed(state, {
    kind: 'gift_power',
    user,
    giftId,
    giftName: powerConfig.displayName || giftName,
    icon: powerConfig.icon || '🎁',
    repeatCount: effectiveCount,
    powerKey,
    badge: powerConfig.label,
    isSimulated,
  });

  switch (powerKey) {
    case 'eliminateWrong': {
      if (state.phase !== 'ACTIVE') {
        state.pendingEliminations = (state.pendingEliminations || 0) + effectiveCount;
        setAlert(state, {
          type: 'eliminate',
          icon: powerConfig.icon || '🌹',
          title: `@${user.uniqueId} enviou ${powerConfig.displayName}!`,
          subtitle: '-1 alternativa errada garantida na próxima pergunta!',
          sound: 'eliminate',
        });
        return true;
      }

      const eliminatedNow = [];
      for (let i = 0; i < effectiveCount; i++) {
        const el = eliminateOneWrongOption(state);
        if (el) eliminatedNow.push(el);
      }
      setAlert(state, {
        type: 'eliminate',
        icon: powerConfig.icon || '🌹',
        title:
          eliminatedNow.length > 0
            ? `@${user.uniqueId} eliminou ${eliminatedNow.join(', ')}!`
            : `@${user.uniqueId} enviou ${powerConfig.displayName}!`,
        subtitle:
          eliminatedNow.length > 0
            ? `Opção incorreta removida do jogo!`
            : 'Todas as erradas já foram eliminadas!',
        sound: 'eliminate',
      });
      return true;
    }

    case 'showHint': {
      if (state.phase !== 'ACTIVE' || !state.currentQuestion) {
        state.pendingHint = true;
        setAlert(state, {
          type: 'hint',
          icon: powerConfig.icon || '💡',
          title: `@${user.uniqueId} liberou DICA!`,
          subtitle: 'A dica abrirá automaticamente na próxima pergunta!',
          sound: 'hint',
        });
        return true;
      }

      if (!state.hintVisible) {
        state.hintVisible = true;
        setAlert(state, {
          type: 'hint',
          icon: powerConfig.icon || '💡',
          title: `@${user.uniqueId} desbloqueou a DICA!`,
          subtitle: state.currentQuestion.hint,
          sound: 'hint',
        });
      } else {
        const ans = state.currentQuestion.correctText || '';
        state.extraHintText = `Super Dica: começa com "${ans[0]?.toUpperCase() || '?'}" (${ans.length} letras)`;
        setAlert(state, {
          type: 'hint',
          icon: '💡',
          title: `@${user.uniqueId} liberou a SUPER DICA!`,
          subtitle: state.extraHintText,
          sound: 'hint',
        });
      }
      return true;
    }

    case 'revealAnswer': {
      if (!state.currentQuestion) return true;
      state.revealedEarly = true;
      state.revealedBy = { uniqueId: user.uniqueId, nickname: user.nickname };
      if (state.phase === 'ACTIVE') {
        const remMs = Math.max(0, state.phaseEndsAt - Date.now());
        const clampedMs = Math.min(Math.max(remMs, 6000), 8000);
        state.phaseEndsAt = Date.now() + clampedMs;
      }
      setAlert(state, {
        type: 'reveal',
        icon: powerConfig.icon || '🍩',
        title: `@${user.uniqueId} REVELOU A RESPOSTA!`,
        subtitle: `Alternativa certa: ${state.currentQuestion.correctOption} — ${state.currentQuestion.correctText}`,
        sound: 'reveal',
      });
      return true;
    }

    case 'buyPoint': {
      const ptsPerGift = Math.max(1, Number(powerConfig.pointsAwarded) || 1);
      const ptsAdded = ptsPerGift * effectiveCount;
      const newTotal = addPointsToUser(state, user, ptsAdded, 'gift');
      setAlert(state, {
        type: 'buypoint',
        icon: powerConfig.icon || '👑',
        title: `@${user.uniqueId} comprou +${ptsAdded} PONTO${ptsAdded > 1 ? 'S' : ''}!`,
        subtitle: `Total no Ranking: ${newTotal} pt${newTotal > 1 ? 's' : ''}`,
        sound: 'buypoint',
      });
      return true;
    }

    case 'skipQuestion': {
      await advanceToNextQuestion(state, {
        allowAiFetch: true,
        reason: 'gift_skip',
        triggeredBy: user,
      });
      return true;
    }

    default:
      return true;
  }
}

export async function applyRoomAction(state, body = {}) {
  const { type, payload = {} } = body;

  switch (type) {
    case 'tiktok:set_user': {
      const username = parseUsernameInput(payload.username || '');
      state.config.tiktokUsername = username;
      state.tiktok.targetUsername = username;
      state.tiktok.autoConnect = payload.autoConnect !== false;
      state.tiktok.error = '';
      if (!username) {
        state.tiktok.connected = false;
        state.tiktok.connecting = false;
      }
      break;
    }

    case 'tiktok:disconnect': {
      state.tiktok.autoConnect = false;
      state.tiktok.connected = false;
      state.tiktok.connecting = false;
      state.tiktok.workerLeaseUntil = 0;
      state.tiktok.error = '';
      break;
    }

    case 'tiktok:simulate_crowd': {
      const active = Boolean(payload.active);
      state.tiktok.simulationActive = active;
      if (active) {
        state.tiktok.viewerCount = Math.max(state.tiktok.viewerCount || 0, 142);
      }
      break;
    }

    case 'simulate:chat': {
      const cleanId =
        String(payload.uniqueId || payload.nickname || 'visitante')
          .toLowerCase()
          .replace(/[^a-z0-9._]/g, '') || 'visitante';
      processChatEvent(state, {
        user: {
          userId: `manual_${cleanId}`,
          uniqueId: cleanId,
          nickname: payload.nickname || cleanId,
        },
        comment: String(payload.comment || ''),
        isSimulated: true,
      });
      break;
    }

    case 'simulate:gift': {
      const cleanId =
        String(payload.uniqueId || payload.nickname || 'apoiador_vip')
          .toLowerCase()
          .replace(/[^a-z0-9._]/g, '') || 'apoiador_vip';
      let giftId = Number(payload.giftId || 0);
      let giftName = payload.giftName || 'Gift';
      let coins = 1;
      if (payload.powerKey && state.config?.giftPowers?.[payload.powerKey]) {
        const p = state.config.giftPowers[payload.powerKey];
        giftId = p.giftId;
        giftName = p.giftName;
        coins = p.coins || 1;
      }
      await processGiftEvent(state, {
        user: {
          userId: `manual_${cleanId}`,
          uniqueId: cleanId,
          nickname: payload.nickname || cleanId,
        },
        giftId,
        giftName,
        diamondCount: coins,
        repeatCount: Math.max(1, Number(payload.repeatCount) || 1),
        isSimulated: true,
      });
      break;
    }

    case 'quiz:skip': {
      await advanceToNextQuestion(state, { allowAiFetch: true, reason: 'admin_skip' });
      break;
    }

    case 'quiz:pause': {
      if (state.phase === 'PAUSED') {
        state.phase = state.pausedFromPhase || 'ACTIVE';
        const rem = Math.max(2000, state.pausedRemainingMs || 15000);
        state.phaseStartedAt = Date.now();
        state.phaseEndsAt = Date.now() + rem;
      } else {
        state.pausedFromPhase = state.phase;
        state.pausedRemainingMs = Math.max(1000, state.phaseEndsAt - Date.now());
        state.phase = 'PAUSED';
      }
      break;
    }

    case 'quiz:hint': {
      if (state.currentQuestion) {
        state.hintVisible = true;
        setAlert(state, {
          type: 'hint',
          icon: '💡',
          title: 'Dica Liberada!',
          subtitle: state.currentQuestion.hint,
          sound: 'hint',
        });
      }
      break;
    }

    case 'quiz:eliminate': {
      const el = eliminateOneWrongOption(state);
      if (el) {
        setAlert(state, {
          type: 'eliminate',
          icon: '✕',
          title: `Alternativa ${el} Eliminada!`,
          subtitle: 'Uma opção incorreta saiu do jogo',
          sound: 'eliminate',
        });
      }
      break;
    }

    case 'quiz:reveal': {
      enterRevealPhase(state, { reason: 'admin_reveal' });
      break;
    }

    case 'leaderboard:reset': {
      state.leaderboard = {};
      setAlert(state, {
        type: 'info',
        icon: '🏆',
        title: 'Ranking Zerado!',
        subtitle: 'Nova disputa pelo Top 5 iniciada!',
        sound: 'skip',
      });
      break;
    }

    case 'leaderboard:adjust': {
      const cleanId = String(payload.uniqueId || payload.userId || 'jogador').replace(
        /^@/,
        ''
      );
      addPointsToUser(
        state,
        {
          userId: payload.userId || `manual_${cleanId}`,
          uniqueId: cleanId,
          nickname: payload.nickname || cleanId,
        },
        Number(payload.delta) || 0,
        'admin'
      );
      break;
    }

    case 'config:update': {
      const prevTheme = state.config.quizTheme;
      const prevDiff = state.config.difficulty;
      const prevModel = state.config.openRouterModel;

      if (typeof payload.newApiKey === 'string' && payload.newApiKey.trim()) {
        state.secretApiKey = payload.newApiKey.trim();
        state.prefetchedQueue = [];
      }

      if (payload.config && typeof payload.config === 'object') {
        const incoming = { ...payload.config };
        if (incoming.giftPowers) {
          const merged = { ...state.config.giftPowers };
          for (const [k, v] of Object.entries(incoming.giftPowers)) {
            if (merged[k]) merged[k] = { ...merged[k], ...v };
          }
          incoming.giftPowers = merged;
        }
        state.config = { ...state.config, ...incoming };
        if (typeof incoming.tiktokUsername === 'string') {
          state.tiktok.targetUsername = parseUsernameInput(incoming.tiktokUsername);
        }
      }

      if (
        state.config.quizTheme !== prevTheme ||
        state.config.difficulty !== prevDiff ||
        state.config.openRouterModel !== prevModel
      ) {
        state.prefetchedQueue = [];
        await refillPrefetchIfNeeded(state, 2);
      }
      break;
    }

    case 'ai:push_question': {
      if (payload.content && state.prefetchedQueue.length < 4) {
        try {
          const parsed = parseOpenRouterContent(payload.content);
          const formatted = formatShuffledQuestion(state, {
            ...parsed,
            source: 'openrouter',
            model: payload.model || state.config.openRouterModel,
          });
          state.prefetchedQueue.push(formatted);
          state.aiStatus = {
            ...(state.aiStatus || {}),
            lastSource: 'openrouter',
            lastModel: payload.model || state.config.openRouterModel,
            lastError: '',
            generatedCount: (state.aiStatus?.generatedCount || 0) + 1,
          };
        } catch {
          // ignore invalid pushed content
        }
      }
      break;
    }

    default:
      break;
  }
}

export function formatRoomResponse(state, { role = 'overlay' } = {}) {
  const isStudio = role === 'studio';
  const now = Date.now();
  const q = state.currentQuestion;
  const showCorrect =
    state.phase === 'REVEAL' || state.revealedEarly || isStudio;

  const remainingMs =
    state.phase === 'PAUSED'
      ? Math.max(0, state.pausedRemainingMs || 0)
      : Math.max(0, (state.phaseEndsAt || now) - now);
  const timeRemaining = Math.ceil(remainingMs / 1000);
  const key = getEffectiveApiKey(state);

  return {
    serverNow: now,
    quizState: {
      roundNumber: state.roundNumber,
      phase: state.phase,
      timeRemaining,
      remainingMs,
      phaseEndsAt: state.phaseEndsAt,
      totalPhaseDuration: state.phaseDurationSec || 20,
      question: q
        ? {
            id: q.id,
            category: q.category,
            question: q.question,
            options: q.options,
            correctOption: showCorrect ? q.correctOption : null,
            correctText: showCorrect ? q.correctText : null,
            hint: state.hintVisible || isStudio ? q.hint : null,
            hintVisible: state.hintVisible,
            extraHintText: state.extraHintText,
            eliminatedOptions: state.eliminatedOptions || [],
            revealedEarly: state.revealedEarly,
            revealedBy: state.revealedBy,
            source: q.source,
            model: q.model,
          }
        : null,
      roundWinners: (state.roundWinners || []).slice(0, 8),
      totalRoundWinners: (state.roundWinners || []).length,
      top5: getTopPlayers(state, 5),
      allPlayers: isStudio ? getTopPlayers(state, 50) : undefined,
      config: state.config,
      recentFeed: isStudio ? (state.recentFeed || []).slice(0, 35) : undefined,
      latestAlert:
        state.latestAlert && now - state.latestAlert.timestamp < 5000
          ? state.latestAlert
          : null,
    },
    tiktokStatus: {
      connected: Boolean(state.tiktok?.connected),
      connecting: Boolean(state.tiktok?.connecting),
      username: state.tiktok?.targetUsername || state.config?.tiktokUsername || '',
      autoConnect: state.tiktok?.autoConnect !== false,
      roomId: state.tiktok?.roomId || '',
      viewerCount: state.tiktok?.viewerCount || 0,
      likeCount: state.tiktok?.likeCount || 0,
      error: state.tiktok?.error || '',
      simulationActive: Boolean(state.tiktok?.simulationActive),
      workerActive: (state.tiktok?.workerLeaseUntil || 0) > now,
    },
    aiStatus: isStudio
      ? {
          ...(state.aiStatus || {}),
          hasApiKey: Boolean(key),
          maskedApiKey: maskApiKey(key),
          queueSize: (state.prefetchedQueue || []).length,
          model: state.config?.openRouterModel,
          // Provide bridge prompt ONLY when direct server network is sandboxed and queue needs refill
          bridgeJob:
            state.aiStatus?.needsBrowserBridge &&
            key &&
            (state.prefetchedQueue || []).length < 2
              ? {
                  apiKey: key,
                  modelCandidates: getModelCandidates(state),
                  messages: buildOpenRouterPrompt(state),
                }
              : null,
        }
      : undefined,
    giftCatalog: isStudio ? TIKTOK_GIFT_CATALOG : undefined,
  };
}
