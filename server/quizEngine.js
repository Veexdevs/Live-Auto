import { matchGiftToPower, normalizeText } from './giftCatalog.js';

const LETTERS = ['A', 'B', 'C', 'D'];

export function parseAnswerFromChat(comment, optionsMap = {}) {
  const raw = String(comment || '').trim();
  if (!raw) return null;

  // 1. Standalone letter: "A", "b", "(C)", "D)", "[a]", "B!"
  const singleMatch = raw.match(/^\s*[\(\[\-\*]*([a-dA-D])[\)\]\.\!\?\*\s]*$/);
  if (singleMatch) {
    return singleMatch[1].toUpperCase();
  }

  // 2. Explicit Portuguese answer pattern: "letra B", "opção C", "alternativa A", "resposta D", "vou de B", "acho que é A"
  const phraseMatch = raw.match(
    /^\s*(?:letra|op[cç][aã]o|alternativa|resposta|vou\s+de|eu\s+vou\s+de|acho\s+q(?:ue)?\s+[eé]|[eé]\s+a(?:\s+letra)?)\s*[:\-]?\s*[\(\[]?([a-dA-D])[\)\]]?(?:\s*[!\?\.\🔥\✅\👏]*)$/i
  );
  if (phraseMatch) {
    return phraseMatch[1].toUpperCase();
  }

  // 3. Exact match with option text (e.g., user typed "Amazonas")
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

export class QuizEngine {
  constructor({
    aiGenerator,
    initialConfig,
    initialLeaderboard,
    onStateUpdate,
    onEventAlert,
    onFeedItem,
    onPersist,
  }) {
    this.aiGenerator = aiGenerator;
    this.config = initialConfig;
    this.leaderboard = initialLeaderboard || {};

    this.onStateUpdate = onStateUpdate;
    this.onEventAlert = onEventAlert;
    this.onFeedItem = onFeedItem;
    this.onPersist = onPersist;

    this.roundNumber = 0;
    this.phase = 'IDLE'; // 'ACTIVE' | 'REVEAL' | 'PAUSED'
    this.pausedFromPhase = 'ACTIVE';
    this.currentQuestion = null;

    this.eliminatedOptions = [];
    this.hintVisible = false;
    this.extraHintText = '';
    this.revealedEarly = false;
    this.revealedBy = null;

    // Pending power-ups if sent during brief reveal transition
    this.pendingEliminations = 0;
    this.pendingHint = false;

    this.roundAttempts = new Map(); // userId -> { letter, correct }
    this.roundWinners = []; // [{ userId, uniqueId, nickname, avatar }]
    this.optionVoteCounts = { A: 0, B: 0, C: 0, D: 0 };

    this.timeRemaining = 0;
    this.totalPhaseDuration = 35;
    this.tickTimer = null;
    this.isTransitioning = false;
    this.recentFeed = [];
  }

  async start() {
    await this.startNextRound({ preferInstant: true });
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  pushFeed(item) {
    const entry = {
      id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...item,
    };
    this.recentFeed.unshift(entry);
    if (this.recentFeed.length > 60) {
      this.recentFeed.pop();
    }
    this.onFeedItem?.(entry);
  }

  emitAlert(alert) {
    this.onEventAlert?.({
      id: `al_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      ...alert,
    });
  }

  getTopPlayers(limit = 5) {
    return Object.values(this.leaderboard)
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

  addPointsToUser(user, deltaPoints, source = 'quiz') {
    const userId = String(user.userId || user.uniqueId);
    const existing = this.leaderboard[userId] || {
      userId,
      uniqueId: user.uniqueId || userId,
      nickname: user.nickname || user.uniqueId || userId,
      avatar: user.avatar || '',
      points: 0,
      correctAnswers: 0,
      giftsPoints: 0,
      lastScoredAt: Date.now(),
    };

    const nextPoints = Math.max(0, existing.points + deltaPoints);
    this.leaderboard[userId] = {
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

    if (nextPoints === 0) {
      delete this.leaderboard[userId];
    }

    this.onPersist?.();
    return this.leaderboard[userId]?.points || 0;
  }

  resetLeaderboard() {
    this.leaderboard = {};
    this.onPersist?.();
    this.emitAlert({
      type: 'info',
      icon: '🏆',
      title: 'Ranking Zerado!',
      subtitle: 'Nova disputa valendo o Top 5 começando agora!',
      sound: 'skip',
    });
    this.broadcastState();
  }

  updateConfig(partial) {
    const prevTheme = this.config.quizTheme;
    const prevDiff = this.config.difficulty;
    const prevModel = this.config.openRouterModel;

    if (partial.giftPowers) {
      const mergedGifts = { ...this.config.giftPowers };
      for (const [k, v] of Object.entries(partial.giftPowers)) {
        if (mergedGifts[k]) {
          mergedGifts[k] = { ...mergedGifts[k], ...v };
        }
      }
      partial = { ...partial, giftPowers: mergedGifts };
    }

    this.config = {
      ...this.config,
      ...partial,
    };

    if (
      this.config.quizTheme !== prevTheme ||
      this.config.difficulty !== prevDiff ||
      this.config.openRouterModel !== prevModel
    ) {
      this.aiGenerator.clearQueue();
      this.aiGenerator.refillQueueInBackground(2);
    }

    this.onPersist?.();
    this.broadcastState();
  }

  getPublicState({ includeAdmin = false } = {}) {
    const q = this.currentQuestion;
    const showCorrect =
      this.phase === 'REVEAL' || this.revealedEarly || includeAdmin;

    return {
      roundNumber: this.roundNumber,
      phase: this.phase,
      timeRemaining: this.timeRemaining,
      totalPhaseDuration: this.totalPhaseDuration,
      question: q
        ? {
            id: q.id,
            category: q.category,
            question: q.question,
            options: q.options,
            correctOption: showCorrect ? q.correctOption : null,
            hint: this.hintVisible || includeAdmin ? q.hint : null,
            hintVisible: this.hintVisible,
            extraHintText: this.extraHintText,
            eliminatedOptions: this.eliminatedOptions,
            revealedEarly: this.revealedEarly,
            revealedBy: this.revealedBy,
            source: q.source,
            model: q.model,
          }
        : null,
      roundWinners: this.roundWinners.slice(0, 8),
      totalRoundWinners: this.roundWinners.length,
      optionVoteCounts: this.optionVoteCounts,
      top5: this.getTopPlayers(5),
      allPlayers: includeAdmin ? this.getTopPlayers(50) : undefined,
      config: this.config,
      recentFeed: includeAdmin ? this.recentFeed.slice(0, 35) : undefined,
    };
  }

  broadcastState() {
    this.onStateUpdate?.();
  }

  async tick() {
    if (this.phase === 'PAUSED' || this.phase === 'IDLE' || this.isTransitioning) {
      return;
    }

    if (this.timeRemaining > 1) {
      this.timeRemaining -= 1;
      this.broadcastState();
      return;
    }

    // Timer reached 0
    if (this.phase === 'ACTIVE') {
      this.enterRevealPhase({ reason: 'timeout' });
    } else if (this.phase === 'REVEAL') {
      await this.startNextRound();
    }
  }

  enterRevealPhase({ reason = 'timeout', winner = null } = {}) {
    if (!this.currentQuestion) return;
    this.phase = 'REVEAL';
    const revealSec = Math.max(3, Math.min(15, Number(this.config.revealDurationSec) || 6));
    this.timeRemaining = revealSec;
    this.totalPhaseDuration = revealSec;

    if (reason === 'first_correct' && winner) {
      this.emitAlert({
        type: 'correct',
        icon: '🎯',
        title: `@${winner.uniqueId} cravou primeiro!`,
        subtitle: `Resposta certa: Letra ${this.currentQuestion.correctOption} (+1 ponto)`,
        sound: 'win',
      });
    } else {
      this.emitAlert({
        type: 'reveal',
        icon: '✨',
        title: `Resposta Certa: Letra ${this.currentQuestion.correctOption}`,
        subtitle: `${this.currentQuestion.correctText} • ${this.roundWinners.length} acertaram!`,
        sound: 'reveal',
      });
    }

    this.broadcastState();
  }

  async startNextRound({ preferInstant = false, reason = 'auto', triggeredBy = null } = {}) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    try {
      const nextQ = await this.aiGenerator.nextQuestion({ preferInstant });
      this.roundNumber += 1;
      this.currentQuestion = nextQ;
      this.eliminatedOptions = [];
      this.hintVisible = false;
      this.extraHintText = '';
      this.revealedEarly = false;
      this.revealedBy = null;
      this.roundAttempts.clear();
      this.roundWinners = [];
      this.optionVoteCounts = { A: 0, B: 0, C: 0, D: 0 };

      const duration = Math.max(10, Math.min(120, Number(this.config.roundDurationSec) || 35));
      this.phase = this.phase === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
      this.timeRemaining = duration;
      this.totalPhaseDuration = duration;

      // Apply any queued power-ups sent during previous reveal
      if (this.pendingEliminations > 0) {
        const count = Math.min(3, this.pendingEliminations);
        this.pendingEliminations = 0;
        for (let i = 0; i < count; i++) {
          this.eliminateOneWrongOption();
        }
      }
      if (this.pendingHint) {
        this.pendingHint = false;
        this.hintVisible = true;
      }

      if (reason === 'gift_skip' && triggeredBy) {
        this.emitAlert({
          type: 'skip',
          icon: '🎉',
          title: `@${triggeredBy.uniqueId} trocou a pergunta!`,
          subtitle: `Nova pergunta gerada pela IA (#${this.roundNumber})`,
          sound: 'skip',
        });
      }

      this.broadcastState();
    } finally {
      this.isTransitioning = false;
    }
  }

  togglePause() {
    if (this.phase === 'PAUSED') {
      this.phase = this.pausedFromPhase || 'ACTIVE';
    } else {
      this.pausedFromPhase = this.phase === 'IDLE' ? 'ACTIVE' : this.phase;
      this.phase = 'PAUSED';
    }
    this.broadcastState();
  }

  eliminateOneWrongOption() {
    if (!this.currentQuestion) return null;
    const candidates = LETTERS.filter(
      (l) =>
        l !== this.currentQuestion.correctOption &&
        !this.eliminatedOptions.includes(l)
    );
    if (candidates.length === 0) return null;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    this.eliminatedOptions.push(picked);
    return picked;
  }

  handleChatMessage({ user, comment, isSimulated = false }) {
    if (!this.currentQuestion) return;

    const chosenLetter = parseAnswerFromChat(comment, this.currentQuestion.options);

    if (!chosenLetter) {
      // Regular chat message
      this.pushFeed({
        kind: 'chat',
        user,
        comment,
        isSimulated,
      });
      return;
    }

    if (this.phase !== 'ACTIVE') {
      this.pushFeed({
        kind: 'chat',
        user,
        comment,
        badge: 'Fora do tempo',
        isSimulated,
      });
      return;
    }

    const userId = String(user.userId || user.uniqueId);
    const previousAttempt = this.roundAttempts.get(userId);

    // Prevent same user from scoring twice on the same question
    if (previousAttempt?.correct) {
      return;
    }

    // Enforce 1 attempt per user per round if enabled
    if (this.config.oneAttemptPerUser && previousAttempt) {
      this.pushFeed({
        kind: 'attempt_locked',
        user,
        comment,
        badge: `Já tentou (${previousAttempt.letter})`,
        isSimulated,
      });
      return;
    }

    const isCorrect = chosenLetter === this.currentQuestion.correctOption;
    this.roundAttempts.set(userId, { letter: chosenLetter, correct: isCorrect });
    this.optionVoteCounts[chosenLetter] = (this.optionVoteCounts[chosenLetter] || 0) + 1;

    if (isCorrect) {
      const totalPts = this.addPointsToUser(user, 1, 'quiz');
      this.roundWinners.push({
        userId,
        uniqueId: user.uniqueId,
        nickname: user.nickname,
        avatar: user.avatar || '',
        totalPts,
      });

      this.pushFeed({
        kind: 'correct',
        user,
        comment,
        badge: `+1 pt (Total: ${totalPts})`,
        isSimulated,
      });

      if (this.config.endRoundOnFirstCorrect) {
        this.enterRevealPhase({ reason: 'first_correct', winner: user });
        return;
      }

      this.emitAlert({
        type: 'correct',
        icon: '✅',
        title: `@${user.uniqueId} acertou! +1 PONTO`,
        subtitle: `Agora soma ${totalPts} pt${totalPts > 1 ? 's' : ''} no Ranking!`,
        sound: 'win',
      });
      this.broadcastState();
    } else {
      this.pushFeed({
        kind: 'wrong',
        user,
        comment,
        badge: `Errou (${chosenLetter})`,
        isSimulated,
      });
      this.broadcastState();
    }
  }

  async handleGiftEvent(giftEvent) {
    const { user, giftId, giftName, repeatCount = 1, isSimulated = false } = giftEvent;
    const match = matchGiftToPower(
      { giftId, giftName },
      this.config.giftPowers
    );

    if (!match) {
      this.pushFeed({
        kind: 'gift_unmapped',
        user,
        giftId,
        giftName,
        repeatCount,
        badge: `Presente (${giftName})`,
        isSimulated,
      });
      return;
    }

    const { powerKey, powerConfig } = match;

    this.pushFeed({
      kind: 'gift_power',
      user,
      giftId,
      giftName: powerConfig.displayName || giftName,
      icon: powerConfig.icon || '🎁',
      repeatCount,
      powerKey,
      badge: powerConfig.label,
      isSimulated,
    });

    switch (powerKey) {
      case 'eliminateWrong': {
        if (this.phase !== 'ACTIVE') {
          this.pendingEliminations += repeatCount;
          this.emitAlert({
            type: 'eliminate',
            icon: powerConfig.icon || '🌹',
            title: `@${user.uniqueId} enviou ${powerConfig.displayName}!`,
            subtitle: `Alternativa errada será eliminada na próxima pergunta!`,
            sound: 'eliminate',
          });
          this.broadcastState();
          return;
        }

        const eliminatedNow = [];
        for (let i = 0; i < repeatCount; i++) {
          const el = this.eliminateOneWrongOption();
          if (el) eliminatedNow.push(el);
        }

        if (eliminatedNow.length > 0) {
          this.emitAlert({
            type: 'eliminate',
            icon: powerConfig.icon || '🌹',
            title: `@${user.uniqueId} eliminou ${
              eliminatedNow.length > 1
                ? `as letras ${eliminatedNow.join(', ')}`
                : `a alternativa ${eliminatedNow[0]}`
            }!`,
            subtitle: `Presente ${powerConfig.displayName} ativado!`,
            sound: 'eliminate',
          });
        } else {
          this.emitAlert({
            type: 'eliminate',
            icon: powerConfig.icon || '🌹',
            title: `@${user.uniqueId} enviou ${powerConfig.displayName}!`,
            subtitle: 'Todas as alternativas erradas já foram eliminadas!',
            sound: 'eliminate',
          });
        }
        this.broadcastState();
        break;
      }

      case 'showHint': {
        if (this.phase !== 'ACTIVE' || !this.currentQuestion) {
          this.pendingHint = true;
          this.emitAlert({
            type: 'hint',
            icon: powerConfig.icon || '🫰',
            title: `@${user.uniqueId} garantiu DICA!`,
            subtitle: 'A dica já virá aberta na próxima pergunta!',
            sound: 'hint',
          });
          this.broadcastState();
          return;
        }

        if (!this.hintVisible) {
          this.hintVisible = true;
          this.emitAlert({
            type: 'hint',
            icon: powerConfig.icon || '💡',
            title: `@${user.uniqueId} desbloqueou a DICA!`,
            subtitle: this.currentQuestion.hint,
            sound: 'hint',
          });
        } else {
          // Bonus clue if hint was already unlocked!
          const ans = this.currentQuestion.correctText || '';
          this.extraHintText = `Super Dica: Começa com "${ans[0]?.toUpperCase() || '?'}" (${ans.length} letras)`;
          this.emitAlert({
            type: 'hint',
            icon: '💡',
            title: `@${user.uniqueId} liberou a SUPER DICA!`,
            subtitle: this.extraHintText,
            sound: 'hint',
          });
        }
        this.broadcastState();
        break;
      }

      case 'revealAnswer': {
        if (!this.currentQuestion) return;
        this.revealedEarly = true;
        this.revealedBy = {
          uniqueId: user.uniqueId,
          nickname: user.nickname,
        };
        if (this.phase === 'ACTIVE') {
          // Keep 7 seconds on clock so everyone clearly sees the revealed answer on screen!
          this.timeRemaining = Math.min(Math.max(this.timeRemaining, 6), 8);
        }
        this.emitAlert({
          type: 'reveal',
          icon: powerConfig.icon || '🍩',
          title: `@${user.uniqueId} REVELOU A RESPOSTA!`,
          subtitle: `Alternativa correta: Letra ${this.currentQuestion.correctOption} — ${this.currentQuestion.correctText}`,
          sound: 'reveal',
        });
        this.broadcastState();
        break;
      }

      case 'buyPoint': {
        const ptsPerGift = Math.max(1, Number(powerConfig.pointsAwarded) || 1);
        const ptsAdded = ptsPerGift * Math.max(1, repeatCount);
        const newTotal = this.addPointsToUser(user, ptsAdded, 'gift');

        this.emitAlert({
          type: 'buypoint',
          icon: powerConfig.icon || '👑',
          title: `@${user.uniqueId} comprou +${ptsAdded} PONTO${ptsAdded > 1 ? 'S' : ''}!`,
          subtitle: `Subiu para ${newTotal} pt${newTotal > 1 ? 's' : ''} no Ranking!`,
          sound: 'buypoint',
        });
        this.broadcastState();
        break;
      }

      case 'skipQuestion': {
        await this.startNextRound({
          preferInstant: false,
          reason: 'gift_skip',
          triggeredBy: user,
        });
        break;
      }

      default:
        break;
    }
  }
}
