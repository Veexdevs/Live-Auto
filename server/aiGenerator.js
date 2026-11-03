import { FALLBACK_QUESTIONS } from './fallbackQuestions.js';
import { normalizeText } from './giftCatalog.js';

const LETTERS = ['A', 'B', 'C', 'D'];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class AIQuestionGenerator {
  constructor({ getApiKey, getConfig, onStatusChange }) {
    this.getApiKey = getApiKey;
    this.getConfig = getConfig;
    this.onStatusChange = onStatusChange;

    this.recentQuestions = [];
    this.prefetchedQueue = [];
    this.isRefilling = false;
    this.directNetworkBlocked = false;
    this.bridgeRequester = null; // async ({ messages, modelCandidates, apiKey }) => rawContent

    this.status = {
      lastSource: 'boot',
      lastModel: '',
      lastError: '',
      generatedCount: 0,
      queueSize: 0,
      usingBridge: false,
    };
  }

  setBridgeRequester(fn) {
    this.bridgeRequester = fn;
  }

  emitStatus(patch = {}) {
    this.status = {
      ...this.status,
      ...patch,
      queueSize: this.prefetchedQueue.length,
    };
    if (this.onStatusChange) {
      this.onStatusChange(this.status);
    }
  }

  clearQueue() {
    this.prefetchedQueue = [];
    this.emitStatus();
  }

  rememberQuestion(qText) {
    const norm = normalizeText(qText);
    if (!norm) return;
    this.recentQuestions.push(qText.trim());
    if (this.recentQuestions.length > 45) {
      this.recentQuestions.shift();
    }
  }

  isDuplicate(qText) {
    const norm = normalizeText(qText);
    return this.recentQuestions.some((prev) => normalizeText(prev) === norm);
  }

  formatShuffledQuestion({ category, question, options, answer, hint, source, model }) {
    const cleanOptions = options.map((o) => String(o).trim()).slice(0, 4);
    const shuffled = shuffleArray(cleanOptions);
    let correctIdx = shuffled.findIndex(
      (opt) => normalizeText(opt) === normalizeText(answer)
    );
    if (correctIdx === -1) {
      correctIdx = 0;
    }

    const optionsMap = {};
    LETTERS.forEach((letter, idx) => {
      optionsMap[letter] = shuffled[idx];
    });

    const correctLetter = LETTERS[correctIdx];
    this.rememberQuestion(question);

    return {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      category: String(category || 'Quiz Geral').trim().slice(0, 32),
      question: String(question).trim(),
      options: optionsMap,
      correctOption: correctLetter,
      correctText: optionsMap[correctLetter],
      hint:
        String(hint || '').trim() ||
        `A resposta correta começa com a letra "${optionsMap[correctLetter][0]}".`,
      source: source || 'ai',
      model: model || '',
      createdAt: Date.now(),
    };
  }

  getFallbackQuestion() {
    const available = FALLBACK_QUESTIONS.filter((q) => !this.isDuplicate(q.question));
    const pool = available.length > 0 ? available : FALLBACK_QUESTIONS;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    return this.formatShuffledQuestion({
      ...chosen,
      source: 'fallback',
      model: 'Banco Local PT-BR',
    });
  }

  buildPrompt() {
    const cfg = this.getConfig();
    const theme =
      cfg.quizTheme?.trim() ||
      'Conhecimentos Gerais, Curiosidades, Cultura Pop, Brasil, Esportes e Games';

    const difficultyMap = {
      facil: 'FÁCIL (perguntas rápidas e acessíveis que geram muitos comentários na live)',
      medio: 'MÉDIO (equilíbrio ideal entre desafio e participação)',
      dificil: 'DIFÍCIL (perguntas desafiadoras para testar quem realmente sabe)',
      misto: 'VARIADO (alterne entre perguntas fáceis, curiosas e de nível médio)',
    };
    const diffDesc = difficultyMap[cfg.difficulty] || difficultyMap.misto;

    const avoidList =
      this.recentQuestions.length > 0
        ? `\nNÃO repita nem faça variações destas perguntas recentes:\n- ${this.recentQuestions
            .slice(-25)
            .join('\n- ')}`
        : '';

    const randomSeed = Math.floor(Math.random() * 999999);

    return [
      {
        role: 'system',
        content:
          'Você é um criador especialista em Quiz Interativo para Lives do TikTok no Brasil. ' +
          'Gere SEMPRE perguntas 100% factuais, verificadas, dinâmicas, curtas e envolventes em Português do Brasil (pt-BR). ' +
          'Responda APENAS com um objeto JSON válido, sem markdown e sem texto extra.',
      },
      {
        role: 'user',
        content:
          `Crie 1 nova pergunta inédita de múltipla escolha para uma Live do TikTok.\n` +
          `Tema(s): ${theme}\n` +
          `Nível de dificuldade: ${diffDesc}\n` +
          `Semente criativa aleatória: #${randomSeed}\n` +
          `${avoidList}\n\n` +
          `Regras obrigatórias:\n` +
          `1. A pergunta deve ter no máximo 135 caracteres, direta e clara.\n` +
          `2. Exatamente 4 alternativas curtas (máx 38 caracteres cada), apenas UMA 100% correta e três incorretas plausíveis.\n` +
          `3. NÃO inclua prefixos como "A)", "B)" dentro do texto das opções.\n` +
          `4. Inclua uma "hint" (dica inteligente que ajude sem entregar a palavra exata da resposta).\n` +
          `5. Retorne ESTRITAMENTE neste formato JSON:\n` +
          `{"category":"Categoria Curta","question":"Texto da pergunta?","options":["Opção Correta","Errada 1","Errada 2","Errada 3"],"answer":"Opção Correta","hint":"Dica útil e criativa"}`,
      },
    ];
  }

  parseAIJson(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
      throw new Error('Resposta vazia da IA');
    }

    let cleaned = rawContent.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (
      !parsed.question ||
      !Array.isArray(parsed.options) ||
      parsed.options.length < 4
    ) {
      throw new Error('JSON da IA incompleto');
    }

    // Strip accidental "A) " prefixes if any
    const cleanOpts = parsed.options
      .slice(0, 4)
      .map((o) => String(o).replace(/^[A-Da-d][\)\.\-\:]\s*/, '').trim());

    let answerText = String(parsed.answer || '').replace(/^[A-Da-d][\)\.\-\:]\s*/, '').trim();
    if (!cleanOpts.some((o) => normalizeText(o) === normalizeText(answerText))) {
      // Check if answer was "A"/"B"/"C"/"D"
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

  getModelCandidates() {
    const cfgModel = (this.getConfig().openRouterModel || 'openai/gpt-4o-mini').trim();
    const defaults = [
      cfgModel,
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'openrouter/free',
      'meta-llama/llama-3.3-70b-instruct:free',
    ];
    return [...new Set(defaults.filter(Boolean))];
  }

  async callOpenRouterDirect(messages, modelCandidates, apiKey) {
    let lastErr = null;

    for (const model of modelCandidates) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'TikTok Live Auto Quiz',
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.85,
            max_tokens: 350,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          lastErr = new Error(`HTTP ${res.status} (${model}): ${errBody.slice(0, 120)}`);
          if (res.status === 401) {
            break; // Invalid API key, don't retry other models
          }
          continue;
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return { content, model: data?.model || model };
        }
      } catch (err) {
        const code = err?.cause?.code || err?.code || '';
        const msg = err?.message || '';
        if (
          code === 'ECONNRESET' ||
          code === 'ENOTFOUND' ||
          code === 'ECONNREFUSED' ||
          code === 'ETIMEDOUT' ||
          msg.includes('fetch failed')
        ) {
          this.directNetworkBlocked = true;
          throw new Error('DIRECT_NETWORK_BLOCKED');
        }
        lastErr = err;
      }
    }

    throw lastErr || new Error('Falha ao consultar modelos OpenRouter');
  }

  async generateSingleAIQuestion() {
    const apiKey = (this.getApiKey() || '').trim();
    if (!apiKey) {
      this.emitStatus({
        lastSource: 'fallback',
        lastError: 'Chave OpenRouter não configurada',
      });
      return this.getFallbackQuestion();
    }

    const messages = this.buildPrompt();
    const modelCandidates = this.getModelCandidates();

    // 1. Try direct server-side OpenRouter call unless known sandbox-blocked
    if (!this.directNetworkBlocked) {
      try {
        const { content, model } = await this.callOpenRouterDirect(
          messages,
          modelCandidates,
          apiKey
        );
        const parsed = this.parseAIJson(content);
        const formatted = this.formatShuffledQuestion({
          ...parsed,
          source: 'openrouter',
          model,
        });
        this.emitStatus({
          lastSource: 'openrouter',
          lastModel: model,
          lastError: '',
          usingBridge: false,
          generatedCount: this.status.generatedCount + 1,
        });
        return formatted;
      } catch (err) {
        if (err.message !== 'DIRECT_NETWORK_BLOCKED') {
          this.emitStatus({
            lastSource: 'fallback',
            lastError: err.message,
          });
          return this.getFallbackQuestion();
        }
      }
    }

    // 2. If server outbound is restricted (e.g. preview sandbox), try connected Studio Browser Bridge
    if (this.bridgeRequester) {
      try {
        const bridgeRes = await this.bridgeRequester({
          messages,
          modelCandidates,
          apiKey,
        });
        if (bridgeRes?.content) {
          const parsed = this.parseAIJson(bridgeRes.content);
          const formatted = this.formatShuffledQuestion({
            ...parsed,
            source: 'openrouter',
            model: bridgeRes.model || modelCandidates[0],
          });
          this.emitStatus({
            lastSource: 'openrouter',
            lastModel: bridgeRes.model || modelCandidates[0],
            lastError: '',
            usingBridge: true,
            generatedCount: this.status.generatedCount + 1,
          });
          return formatted;
        }
        if (bridgeRes?.error) {
          this.emitStatus({
            lastSource: 'fallback',
            lastError: bridgeRes.error,
          });
        }
      } catch (bridgeErr) {
        this.emitStatus({
          lastSource: 'fallback',
          lastError: bridgeErr.message,
        });
      }
    }

    // 3. Zero-downtime fallback
    return this.getFallbackQuestion();
  }

  async refillQueueInBackground(targetSize = 2) {
    if (this.isRefilling) return;
    this.isRefilling = true;
    try {
      while (this.prefetchedQueue.length < targetSize) {
        const q = await this.generateSingleAIQuestion();
        // Only cache real AI questions in prefetch queue so once bridge connects, AI takes over immediately!
        if (q.source === 'openrouter') {
          this.prefetchedQueue.push(q);
          this.emitStatus();
        } else {
          break;
        }
      }
    } finally {
      this.isRefilling = false;
      this.emitStatus();
    }
  }

  async nextQuestion({ preferInstant = false } = {}) {
    if (this.prefetchedQueue.length > 0) {
      const next = this.prefetchedQueue.shift();
      this.emitStatus();
      // Trigger async refill
      this.refillQueueInBackground(2);
      return next;
    }

    if (preferInstant) {
      const fb = this.getFallbackQuestion();
      this.refillQueueInBackground(2);
      return fb;
    }

    const generated = await this.generateSingleAIQuestion();
    this.refillQueueInBackground(2);
    return generated;
  }
}
