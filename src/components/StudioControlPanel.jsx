import React, { useState, useEffect } from 'react';
import {
  Radio,
  Gift,
  Sparkles,
  Trophy,
  Play,
  Pause,
  SkipForward,
  Eye,
  Lightbulb,
  XCircle,
  Send,
  Users,
  Trash2,
  Plus,
  Minus,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';

const THEME_PRESETS = [
  {
    label: '🌎 Mix Geral (Recomendado)',
    value: 'Conhecimentos Gerais, Curiosidades, Cultura Pop, Brasil, Esportes e Games',
  },
  {
    label: '⚽ Futebol & Esportes',
    value: 'Futebol Brasileiro, Copa do Mundo, Champions League, Craques e Esportes',
  },
  {
    label: '🎬 Filmes, Séries & Pop',
    value: 'Filmes famosos, Séries da Netflix, Marvel, Disney, Música Pop e Celebridades',
  },
  {
    label: '🎮 Games & Animes',
    value: 'Games populares (Minecraft, GTA, Free Fire, Roblox) e Animes (Naruto, Dragon Ball, One Piece)',
  },
  {
    label: '🇧🇷 Brasil & Curiosidades',
    value: 'História do Brasil, Estados, Capitais, Comidas Típicas e Curiosidades Brasileiras',
  },
  {
    label: '🔬 Ciência & Planeta',
    value: 'Astronomia, Corpo Humano, Animais Curiosos, Natureza e Invenções',
  },
  {
    label: '📖 Quiz Bíblico',
    value: 'Histórias Bíblicas, Personagens do Antigo e Novo Testamento e Curiosidades da Bíblia',
  },
];

const MODEL_OPTIONS = [
  { label: 'GPT-4o Mini (Rápido & Preciso)', value: 'openai/gpt-4o-mini' },
  { label: 'Google Gemini 2.0 Flash', value: 'google/gemini-2.0-flash-001' },
  { label: 'OpenRouter Auto (Automático)', value: 'openrouter/auto' },
  { label: 'Llama 3.3 70B (Free Tier)', value: 'meta-llama/llama-3.3-70b-instruct:free' },
];

const POWER_ORDER = [
  'eliminateWrong',
  'showHint',
  'revealAnswer',
  'buyPoint',
  'skipQuestion',
];

export default function StudioControlPanel({
  socket,
  quizState,
  tiktokStatus,
  aiStatus,
  giftCatalog,
  feedItems,
}) {
  const [activeTab, setActiveTab] = useState('live');
  const [usernameInput, setUsernameInput] = useState(
    quizState?.config?.tiktokUsername || ''
  );
  const [connectingTikTok, setConnectingTikTok] = useState(false);

  // Simulator inputs
  const [simUser, setSimUser] = useState('joao_vip');
  const [simComment, setSimComment] = useState('');

  // AI & Rules local form state
  const [themeInput, setThemeInput] = useState(quizState?.config?.quizTheme || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedToast, setSavedToast] = useState('');

  // Manual player score form
  const [manualPlayer, setManualPlayer] = useState('');
  const [copiedObs, setCopiedObs] = useState(false);

  useEffect(() => {
    if (quizState?.config?.quizTheme && !themeInput) {
      setThemeInput(quizState.config.quizTheme);
    }
  }, [quizState?.config?.quizTheme]);

  useEffect(() => {
    if (quizState?.config?.tiktokUsername && !usernameInput) {
      setUsernameInput(quizState.config.tiktokUsername);
    }
  }, [quizState?.config?.tiktokUsername]);

  const config = quizState?.config || {};
  const giftPowers = config.giftPowers || {};
  const question = quizState?.question;
  const allPlayers = quizState?.allPlayers || quizState?.top5 || [];

  const overlayUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/overlay` : '/overlay';

  const handleCopyOverlay = () => {
    navigator.clipboard?.writeText(overlayUrl);
    setCopiedObs(true);
    setTimeout(() => setCopiedObs(false), 2000);
  };

  const handleConnectTikTok = (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setConnectingTikTok(true);
    socket?.emit('tiktok:connect', { username: usernameInput.trim() }, () => {
      setConnectingTikTok(false);
    });
  };

  const handleDisconnectTikTok = () => {
    socket?.emit('tiktok:disconnect');
  };

  const handleToggleCrowd = () => {
    socket?.emit('tiktok:simulate_crowd', {
      active: !tiktokStatus?.simulationActive,
    });
  };

  const sendSimChat = (text) => {
    const msg = text ?? simComment;
    if (!String(msg).trim()) return;
    socket?.emit('simulate:chat', {
      uniqueId: simUser || 'visitante_live',
      nickname: simUser || 'Visitante',
      comment: msg,
    });
    if (text === undefined) {
      setSimComment('');
    }
  };

  const sendSimGift = (powerKey) => {
    socket?.emit('simulate:gift', {
      uniqueId: simUser || 'apoiador_vip',
      nickname: simUser || 'Apoiador VIP',
      powerKey,
      repeatCount: 1,
    });
  };

  const updateConfigImmediate = (patch) => {
    socket?.emit('config:update', { config: patch }, () => {
      setSavedToast('Salvo!');
      setTimeout(() => setSavedToast(''), 1600);
    });
  };

  const handlePowerPresetSelect = (powerKey, catalogKey) => {
    const found = giftCatalog.find((g) => g.key === catalogKey);
    if (!found) return;
    updateConfigImmediate({
      giftPowers: {
        [powerKey]: {
          ...giftPowers[powerKey],
          giftId: found.giftId,
          giftName: found.name,
          displayName: found.displayName,
          aliases: found.aliases,
          icon: found.icon,
          coins: found.coins,
        },
      },
    });
  };

  const handlePowerFieldChange = (powerKey, field, value) => {
    updateConfigImmediate({
      giftPowers: {
        [powerKey]: {
          ...giftPowers[powerKey],
          [field]: value,
        },
      },
    });
  };

  const handleBindIncomingGift = (powerKey, item) => {
    if (!powerKey) return;
    updateConfigImmediate({
      giftPowers: {
        [powerKey]: {
          ...giftPowers[powerKey],
          giftId: Number(item.giftId || 0),
          giftName: item.giftName,
          displayName: item.giftName,
          aliases: [item.giftName.toLowerCase()],
        },
      },
    });
  };

  const handleSaveAiSettings = (e) => {
    e.preventDefault();
    setSavingConfig(true);
    socket?.emit(
      'config:update',
      {
        config: {
          quizTheme: themeInput,
        },
        newApiKey: apiKeyInput.trim() || undefined,
      },
      () => {
        setSavingConfig(false);
        setApiKeyInput('');
        setSavedToast('Configurações de IA atualizadas!');
        setTimeout(() => setSavedToast(''), 2200);
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
      {/* Top OBS Link Banner + Tabs */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow shadow-cyan-400" />
              Estúdio de Controle • TikTok Quiz IA
            </h1>
            <p className="text-xs text-slate-400">
              Gerencie a live, teste presentes e copie a tela limpa 9:16 para o OBS / TikTok Live Studio
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedToast && (
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
                ✓ {savedToast}
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyOverlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-100 transition cursor-pointer"
            >
              {copiedObs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-300" />}
              {copiedObs ? 'Link OBS Copiado!' : 'Copiar URL OBS'}
            </button>
            <a
              href="/overlay"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-slate-950 text-xs font-black transition"
            >
              Abrir Tela 9:16 <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-white/10">
          {[
            { id: 'live', label: 'Ao Vivo & Testar', icon: Radio },
            { id: 'gifts', label: '5 Presentes', icon: Gift },
            { id: 'ai', label: 'IA & Regras', icon: Sparkles },
            { id: 'ranking', label: 'Ranking Top 5', icon: Trophy },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/25 border border-cyan-400/40 text-white shadow'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ================= TAB 1: AO VIVO & SIMULADOR ================= */}
        {activeTab === 'live' && (
          <>
            {/* TikTok Live Connection Card */}
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      tiktokStatus?.connected
                        ? 'bg-emerald-400 animate-pulse'
                        : tiktokStatus?.simulationActive
                        ? 'bg-cyan-400 animate-pulse'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-200">
                    {tiktokStatus?.connected
                      ? `Conectado em @${tiktokStatus.username}`
                      : tiktokStatus?.simulationActive
                      ? 'Plateia Simulada Ativa'
                      : 'Conexão TikTok Live'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleCrowd}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                    tiktokStatus?.simulationActive
                      ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                      : 'bg-cyan-500/15 hover:bg-cyan-500/25 border-cyan-400/40 text-cyan-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  {tiktokStatus?.simulationActive
                    ? 'Parar Plateia Bot'
                    : 'Simular Plateia ao Vivo'}
                </button>
              </div>

              <form onSubmit={handleConnectTikTok} className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="@seu_usuario_tiktok (em live)"
                  className="flex-1 rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                {tiktokStatus?.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectTikTok}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-black text-white transition cursor-pointer"
                  >
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={connectingTikTok}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:opacity-95 text-slate-950 text-xs font-black transition disabled:opacity-50 cursor-pointer"
                  >
                    {connectingTikTok ? 'Conectando...' : 'Conectar Live'}
                  </button>
                )}
              </form>

              {tiktokStatus?.error && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-400/35 px-3 py-2 text-[11px] text-amber-200">
                  ℹ️ {tiktokStatus.error}
                </div>
              )}
            </div>

            {/* Host Direct Controls */}
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Controles Rápidos da Rodada
                </span>
                {question?.correctOption && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-300">
                    Gabarito Host: Letra {question.correctOption}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => socket?.emit('quiz:pause')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold cursor-pointer"
                >
                  {quizState?.phase === 'PAUSED' ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-400" /> Retomar
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-300" /> Pausar
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => socket?.emit('quiz:skip')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Nova IA
                </button>

                <button
                  type="button"
                  onClick={() => socket?.emit('quiz:eliminate')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-bold cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" /> -1 Errada
                </button>

                <button
                  type="button"
                  onClick={() => socket?.emit('quiz:hint')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" /> Dar Dica
                </button>

                <button
                  type="button"
                  onClick={() => socket?.emit('quiz:reveal')}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 text-xs font-bold cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Revelar
                </button>
              </div>
            </div>

            {/* Interactive Simulator: Test all 5 Gift Powers + Chat Answers */}
            <div className="rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-cyan-500/25 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                  🧪 Simulador de Espectador (Chat & 5 Presentes)
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Usuário:</span>
                  <input
                    type="text"
                    value={simUser}
                    onChange={(e) => setSimUser(e.target.value)}
                    placeholder="ex: maria_top1"
                    className="w-32 rounded-lg bg-slate-950 border border-white/15 px-2 py-1 text-xs font-bold text-cyan-200 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* 5 Gift Power Simulator Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {POWER_ORDER.map((key) => {
                  const p = giftPowers[key];
                  if (!p) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => sendSimGift(key)}
                      className="rounded-xl bg-white/[0.06] hover:bg-white/[0.13] active:scale-95 border border-white/15 p-2 flex flex-col items-center text-center transition cursor-pointer"
                    >
                      <span className="text-xl mb-0.5">{p.icon || '🎁'}</span>
                      <span className="text-[11px] font-black text-white truncate w-full">
                        {p.displayName}
                      </span>
                      <span className="text-[10px] text-cyan-300 font-semibold truncate w-full">
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Chat A/B/C/D + Custom Comment */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => sendSimChat(letter)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 border border-white/15 text-xs font-black transition cursor-pointer"
                  >
                    Mandar "{letter}"
                  </button>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendSimChat();
                  }}
                  className="flex-1 min-w-[180px] flex gap-1.5"
                >
                  <input
                    type="text"
                    value={simComment}
                    onChange={(e) => setSimComment(e.target.value)}
                    placeholder="Simular comentário no chat..."
                    className="flex-1 rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Live Feed Log */}
            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Feed em Tempo Real (Chat & Presentes)
                </span>
                <span className="text-[11px] text-slate-500">
                  {feedItems.length} eventos recentes
                </span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {feedItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Teste mandar uma resposta ou presente acima, ou ative "Simular Plateia ao Vivo"!
                  </p>
                ) : (
                  feedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-white/5 text-xs"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="font-extrabold text-cyan-300 shrink-0">
                          @{item.user?.uniqueId}
                        </span>
                        <span className="text-slate-200 truncate">
                          {item.kind === 'gift_power'
                            ? `${item.icon || '🎁'} enviou ${item.giftName} (x${item.repeatCount || 1})`
                            : item.kind === 'gift_unmapped'
                            ? `🎁 enviou ${item.giftName} (ID: ${item.giftId})`
                            : item.comment}
                        </span>
                      </div>

                      {item.kind === 'gift_unmapped' ? (
                        <select
                          defaultValue=""
                          onChange={(e) => handleBindIncomingGift(e.target.value, item)}
                          className="rounded-lg bg-slate-800 border border-white/15 px-2 py-0.5 text-[10px] text-amber-200"
                        >
                          <option value="">Vincular poder...</option>
                          <option value="eliminateWrong">Eliminar Errada</option>
                          <option value="showHint">Pedir Dica</option>
                          <option value="revealAnswer">Ver Resposta</option>
                          <option value="buyPoint">Comprar Ponto</option>
                          <option value="skipQuestion">Outra Pergunta</option>
                        </select>
                      ) : (
                        item.badge && (
                          <span
                            className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.kind === 'correct'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.kind === 'wrong'
                                ? 'bg-rose-500/15 text-rose-300'
                                : item.kind === 'gift_power'
                                ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                                : 'bg-white/10 text-slate-300'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: CONFIGURAR OS 5 PRESENTES ================= */}
        {activeTab === 'gifts' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-cyan-500/10 border border-cyan-400/30 p-3 text-xs text-cyan-100">
              Escolha qual presente do TikTok ativa cada um dos <strong>5 poderes interativos</strong>.
              Toda alteração atualiza a legenda da tela da live automaticamente!
            </div>

            {POWER_ORDER.map((powerKey) => {
              const p = giftPowers[powerKey];
              if (!p) return null;

              return (
                <div
                  key={powerKey}
                  className="rounded-2xl bg-slate-900/85 border border-white/10 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.icon || '🎁'}</span>
                      <div>
                        <div className="text-sm font-black text-white">{p.label}</div>
                        <div className="text-[11px] text-slate-400">{p.description}</div>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.enabled !== false}
                        onChange={(e) =>
                          handlePowerFieldChange(powerKey, 'enabled', e.target.checked)
                        }
                        className="accent-cyan-400 w-4 h-4"
                      />
                      Ativo
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Catálogo Rápido TikTok
                      </label>
                      <select
                        value={
                          giftCatalog.find((g) => g.giftId === Number(p.giftId))?.key || ''
                        }
                        onChange={(e) => handlePowerPresetSelect(powerKey, e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-white/15 px-2.5 py-2 text-xs text-white"
                      >
                        <option value="">Personalizado...</option>
                        {giftCatalog.map((g) => (
                          <option key={g.key} value={g.key}>
                            {g.icon} {g.displayName} ({g.name} • {g.coins}🪙)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Nome Exibido na Live
                      </label>
                      <input
                        type="text"
                        value={p.displayName || ''}
                        onChange={(e) =>
                          handlePowerFieldChange(powerKey, 'displayName', e.target.value)
                        }
                        className="w-full rounded-xl bg-slate-950 border border-white/15 px-2.5 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                          Ícone
                        </label>
                        <input
                          type="text"
                          value={p.icon || ''}
                          onChange={(e) =>
                            handlePowerFieldChange(powerKey, 'icon', e.target.value)
                          }
                          className="w-full rounded-xl bg-slate-950 border border-white/15 px-2.5 py-2 text-xs text-center text-white"
                        />
                      </div>

                      {powerKey === 'buyPoint' ? (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-amber-300 mb-1">
                            Pontos Ganhos
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={p.pointsAwarded || 1}
                            onChange={(e) =>
                              handlePowerFieldChange(
                                powerKey,
                                'pointsAwarded',
                                Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                            className="w-full rounded-xl bg-slate-950 border border-amber-400/40 px-2.5 py-2 text-xs font-bold text-amber-200"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Gift ID TikTok
                          </label>
                          <input
                            type="number"
                            value={p.giftId || 0}
                            onChange={(e) =>
                              handlePowerFieldChange(
                                powerKey,
                                'giftId',
                                Number(e.target.value) || 0
                              )
                            }
                            className="w-full rounded-xl bg-slate-950 border border-white/15 px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= TAB 3: IA OPENROUTER & REGRAS ================= */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {/* OpenRouter Status Card */}
            <form
              onSubmit={handleSaveAiSettings}
              className="rounded-2xl bg-slate-900/85 border border-white/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Motor de IA OpenRouter
                  </span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    aiStatus?.hasApiKey
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/35'
                  }`}
                >
                  {aiStatus?.hasApiKey
                    ? `Chave Ativa (${aiStatus.maskedApiKey})`
                    : 'Sem Chave API'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-950/80 border border-white/5 p-2">
                  <div className="text-[10px] text-slate-400">Perguntas IA Geradas</div>
                  <div className="text-sm font-black text-cyan-300">
                    {aiStatus?.generatedCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950/80 border border-white/5 p-2">
                  <div className="text-[10px] text-slate-400">Fila Pré-Carregada</div>
                  <div className="text-sm font-black text-emerald-300">
                    {aiStatus?.queueSize ?? 0} prontas
                  </div>
                </div>
                <div className="rounded-xl bg-slate-950/80 border border-white/5 p-2">
                  <div className="text-[10px] text-slate-400">Última Fonte</div>
                  <div className="text-xs font-black text-fuchsia-300 truncate">
                    {aiStatus?.lastSource === 'openrouter' ? 'OpenRouter IA' : 'Banco Local'}
                  </div>
                </div>
              </div>

              {aiStatus?.lastError && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-400/30 px-3 py-2 text-[11px] text-amber-200">
                  Aviso IA: {aiStatus.lastError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Modelo da OpenRouter
                  </label>
                  <select
                    value={config.openRouterModel || 'openai/gpt-4o-mini'}
                    onChange={(e) =>
                      updateConfigImmediate({ openRouterModel: e.target.value })
                    }
                    className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Atualizar Chave OpenRouter (opcional)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Manter chave atual configurada..."
                    className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Temas das Perguntas Geradas pela IA
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setThemeInput(preset.value)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-[11px] font-semibold text-slate-200 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={themeInput}
                  onChange={(e) => setThemeInput(e.target.value)}
                  placeholder="Digite qualquer tema (ex: Futebol, Animes, Enem, Música Sertaneja...)"
                  className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-xs hover:opacity-95 transition cursor-pointer"
              >
                {savingConfig ? 'Salvando...' : 'Aplicar Tema & Atualizar Fila de Perguntas IA'}
              </button>
            </form>

            {/* Quiz Rules & Visual Options */}
            <div className="rounded-2xl bg-slate-900/85 border border-white/10 p-4 space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-white block">
                Tempo, Pontuação & Layout OBS
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Tempo da Pergunta ({config.roundDurationSec || 35}s)
                  </label>
                  <input
                    type="range"
                    min={15}
                    max={90}
                    step={5}
                    value={config.roundDurationSec || 35}
                    onChange={(e) =>
                      updateConfigImmediate({
                        roundDurationSec: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Tempo Revelação ({config.revealDurationSec || 6}s)
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    step={1}
                    value={config.revealDurationSec || 6}
                    onChange={(e) =>
                      updateConfigImmediate({
                        revealDurationSec: Number(e.target.value),
                      })
                    }
                    className="w-full accent-fuchsia-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Dificuldade IA
                  </label>
                  <select
                    value={config.difficulty || 'misto'}
                    onChange={(e) =>
                      updateConfigImmediate({ difficulty: e.target.value })
                    }
                    className="w-full rounded-xl bg-slate-950 border border-white/15 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="misto">Misto (Ideal p/ Live)</option>
                    <option value="facil">Fácil (Alto Engajamento)</option>
                    <option value="medio">Médio</option>
                    <option value="dificil">Difícil (Desafio)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.oneAttemptPerUser)}
                    onChange={(e) =>
                      updateConfigImmediate({ oneAttemptPerUser: e.target.checked })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <div>
                    <div className="font-bold text-white">1 tentativa por pessoa</div>
                    <div className="text-[10px] text-slate-400">
                      Impede chutar A, B, C e D seguidos na mesma rodada
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.endRoundOnFirstCorrect)}
                    onChange={(e) =>
                      updateConfigImmediate({
                        endRoundOnFirstCorrect: e.target.checked,
                      })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <div>
                    <div className="font-bold text-white">Morte Súbita (1º acerto encerra)</div>
                    <div className="text-[10px] text-slate-400">
                      Desativado = todos pontuam até acabar o tempo
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.safeZoneBottom)}
                    onChange={(e) =>
                      updateConfigImmediate({ safeZoneBottom: e.target.checked })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <div>
                    <div className="font-bold text-white">Margem Chat TikTok Mobile</div>
                    <div className="text-[10px] text-slate-400">
                      Sobe a barra inferior para não ficar atrás dos comentários
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.transparentBg)}
                    onChange={(e) =>
                      updateConfigImmediate({ transparentBg: e.target.checked })
                    }
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <div>
                    <div className="font-bold text-white">Fundo Transparente (OBS)</div>
                    <div className="text-[10px] text-slate-400">
                      Permite colocar sua câmera ou gameplay por trás no OBS
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: RANKING & JOGADORES ================= */}
        {activeTab === 'ranking' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-900/85 border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">
                  Gerenciar Placar & Top 5 da Live
                </h3>
                <p className="text-xs text-slate-400">
                  Os 5 primeiros aparecem automaticamente no canto superior direito da live
                </p>
              </div>

              <button
                type="button"
                onClick={() => socket?.emit('leaderboard:reset')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-extrabold text-rose-200 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Zerar Ranking
              </button>
            </div>

            {/* Add manual player */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualPlayer.trim()) return;
                socket?.emit('leaderboard:adjust', {
                  uniqueId: manualPlayer.trim(),
                  nickname: manualPlayer.trim(),
                  delta: 1,
                });
                setManualPlayer('');
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualPlayer}
                onChange={(e) => setManualPlayer(e.target.value)}
                placeholder="Adicionar @jogador manualmente (+1 ponto)..."
                className="flex-1 rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition cursor-pointer"
              >
                + Adicionar
              </button>
            </form>

            {/* Players List */}
            <div className="rounded-2xl bg-slate-900/85 border border-white/10 divide-y divide-white/10 overflow-hidden">
              {allPlayers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhum jogador pontuou ainda nesta rodada. Assim que alguém acertar ou comprar ponto, aparecerá aqui e no Top 5!
                </div>
              ) : (
                allPlayers.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-black ${
                          p.rank <= 5
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {p.rank}º
                      </span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-white truncate">
                          @{p.uniqueId}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.correctAnswers || 0} acertos • {p.giftsPoints || 0} pts por presentes
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-200 font-black">
                        {p.points} pts
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          socket?.emit('leaderboard:adjust', {
                            userId: p.userId,
                            uniqueId: p.uniqueId,
                            nickname: p.nickname,
                            delta: 1,
                          })
                        }
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 cursor-pointer"
                        title="+1 ponto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          socket?.emit('leaderboard:adjust', {
                            userId: p.userId,
                            uniqueId: p.uniqueId,
                            nickname: p.nickname,
                            delta: -1,
                          })
                        }
                        className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 cursor-pointer"
                        title="-1 ponto"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
