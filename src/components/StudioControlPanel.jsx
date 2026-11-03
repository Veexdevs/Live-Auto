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
    label: '🌎 Mix Geral & Pop',
    value:
      'Conhecimentos Gerais, Filmes Disney/Pop, Curiosidades, Brasil, Esportes e Games',
  },
  {
    label: '🎬 Disney, Filmes & Séries',
    value: 'Filmes da Disney, Pixar, Marvel, Séries da Netflix e Cinema Pop',
  },
  {
    label: '⚽ Futebol & Esportes',
    value: 'Futebol Brasileiro, Copa do Mundo, Champions League, Craques e Esportes',
  },
  {
    label: '🎮 Games & Animes',
    value:
      'Games populares (Minecraft, GTA, Free Fire, Roblox) e Animes (Naruto, Dragon Ball, One Piece)',
  },
  {
    label: '🇧🇷 Brasil & Curiosidades',
    value: 'História do Brasil, Estados, Capitais, Comidas Típicas e Curiosidades',
  },
  {
    label: '🔬 Ciência & Planeta',
    value: 'Astronomia, Corpo Humano, Animais Curiosos, Natureza e Invenções',
  },
  {
    label: '📖 Quiz Bíblico',
    value: 'Histórias Bíblicas, Personagens do Antigo e Novo Testamento',
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
  onAction,
  quizState,
  tiktokStatus,
  aiStatus,
  giftCatalog = [],
  feedItems = [],
}) {
  const [activeTab, setActiveTab] = useState('live');
  const [usernameInput, setUsernameInput] = useState(
    quizState?.config?.tiktokUsername || ''
  );
  const [connectingTikTok, setConnectingTikTok] = useState(false);

  const [simUser, setSimUser] = useState('joao_vip');
  const [simComment, setSimComment] = useState('');

  const [themeInput, setThemeInput] = useState(quizState?.config?.quizTheme || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedToast, setSavedToast] = useState('');

  const [manualPlayer, setManualPlayer] = useState('');
  const [copiedObs, setCopiedObs] = useState(false);

  useEffect(() => {
    if (quizState?.config?.quizTheme && !themeInput) {
      setThemeInput(quizState.config.quizTheme);
    }
  }, [quizState?.config?.quizTheme]);

  useEffect(() => {
    const target = tiktokStatus?.username || quizState?.config?.tiktokUsername;
    if (target && !usernameInput) {
      setUsernameInput(target);
    }
  }, [tiktokStatus?.username, quizState?.config?.tiktokUsername]);

  const config = quizState?.config || {};
  const giftPowers = config.giftPowers || {};
  const question = quizState?.question;
  const allPlayers = quizState?.allPlayers || quizState?.top5 || [];

  const cleanUserParam = (usernameInput || tiktokStatus?.username || '')
    .trim()
    .replace(/^@/, '');
  const overlayUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/overlay${
          cleanUserParam ? `?user=${encodeURIComponent(cleanUserParam)}` : ''
        }`
      : '/overlay';

  const handleCopyOverlay = () => {
    navigator.clipboard?.writeText(overlayUrl);
    setCopiedObs(true);
    setTimeout(() => setCopiedObs(false), 2000);
  };

  const handleConnectTikTok = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    setConnectingTikTok(true);
    await onAction('tiktok:set_user', {
      username: usernameInput.trim(),
      autoConnect: true,
    });
    setConnectingTikTok(false);
    setSavedToast('Automação TikTok Ativada!');
    setTimeout(() => setSavedToast(''), 2000);
  };

  const handleDisconnectTikTok = () => {
    onAction('tiktok:disconnect');
  };

  const handleToggleCrowd = () => {
    onAction('tiktok:simulate_crowd', {
      active: !tiktokStatus?.simulationActive,
    });
  };

  const sendSimChat = (text) => {
    const msg = text ?? simComment;
    if (!String(msg).trim()) return;
    onAction('simulate:chat', {
      uniqueId: simUser || 'visitante_live',
      nickname: simUser || 'Visitante',
      comment: msg,
    });
    if (text === undefined) {
      setSimComment('');
    }
  };

  const sendSimGift = (powerKey) => {
    onAction('simulate:gift', {
      uniqueId: simUser || 'apoiador_vip',
      nickname: simUser || 'Apoiador VIP',
      powerKey,
      repeatCount: 1,
    });
  };

  const updateConfigImmediate = async (patch) => {
    await onAction('config:update', { config: patch });
    setSavedToast('Salvo!');
    setTimeout(() => setSavedToast(''), 1500);
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

  const handleSaveAiSettings = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    await onAction('config:update', {
      config: { quizTheme: themeInput },
      newApiKey: apiKeyInput.trim() || undefined,
    });
    setSavingConfig(false);
    setApiKeyInput('');
    setSavedToast('IA Atualizada!');
    setTimeout(() => setSavedToast(''), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-white text-zinc-900 border-[2.5px] border-zinc-950 rounded-3xl overflow-hidden shadow-xl">
      {/* Header & OBS Copy Bar */}
      <div className="px-4 pt-4 pb-3 border-b-2 border-zinc-900 bg-zinc-50">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-2 text-zinc-950">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Painel Automático • TikTok Quiz
            </h1>
            <p className="text-xs text-zinc-600 font-medium">
              Detecta chat e presentes automaticamente + gera perguntas com IA OpenRouter
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedToast && (
              <span className="px-2.5 py-1 rounded-lg bg-zinc-950 text-white text-xs font-bold">
                ✓ {savedToast}
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyOverlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-950 text-xs font-extrabold text-zinc-950 transition cursor-pointer"
            >
              {copiedObs ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedObs ? 'Copiado!' : 'Copiar Link OBS'}
            </button>
            <a
              href={overlayUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold transition"
            >
              Tela 9:16 <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-zinc-200/80 border border-zinc-300">
          {[
            { id: 'live', label: 'Automação Live', icon: Radio },
            { id: 'gifts', label: '5 Presentes', icon: Gift },
            { id: 'ai', label: 'IA & Visual', icon: Sparkles },
            { id: 'ranking', label: 'Top 5 Placar', icon: Trophy },
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
                    ? 'bg-zinc-950 text-white shadow'
                    : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/60'
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
        {/* ================= TAB 1: AUTOMAÇÃO LIVE & SIMULADOR ================= */}
        {activeTab === 'live' && (
          <>
            {/* TikTok Automatic Detection Card */}
            <div className="rounded-2xl bg-zinc-50 border-2 border-zinc-950 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      tiktokStatus?.connected
                        ? 'bg-emerald-500 animate-ping'
                        : tiktokStatus?.username && tiktokStatus?.autoConnect
                        ? 'bg-amber-500 animate-pulse'
                        : tiktokStatus?.simulationActive
                        ? 'bg-blue-500 animate-pulse'
                        : 'bg-zinc-400'
                    }`}
                  />
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-950">
                    {tiktokStatus?.connected
                      ? `AO VIVO CONECTADO: @${tiktokStatus.username} (${tiktokStatus.viewerCount || 0} assistindo)`
                      : tiktokStatus?.username && tiktokStatus?.autoConnect
                      ? `Auto-Detectando Live de @${tiktokStatus.username}...`
                      : 'Automação de Chat & Presentes TikTok'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleCrowd}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 transition cursor-pointer ${
                    tiktokStatus?.simulationActive
                      ? 'bg-red-600 border-red-600 text-white'
                      : 'bg-white hover:bg-zinc-100 border-zinc-950 text-zinc-950'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  {tiktokStatus?.simulationActive
                    ? 'Parar Bots de Teste'
                    : 'Simular Plateia ao Vivo'}
                </button>
              </div>

              <form onSubmit={handleConnectTikTok} className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Digite o @usuario do TikTok para auto-detectar chat e presentes"
                  className="flex-1 rounded-xl bg-white border-2 border-zinc-900 px-3 py-2 text-xs font-bold text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
                />
                {tiktokStatus?.connected ||
                (tiktokStatus?.username && tiktokStatus?.autoConnect) ? (
                  <button
                    type="button"
                    onClick={handleDisconnectTikTok}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-black text-white transition cursor-pointer"
                  >
                    Parar
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={connectingTikTok}
                    className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-black transition disabled:opacity-50 cursor-pointer"
                  >
                    {connectingTikTok ? 'Ativando...' : 'Ativar Automação'}
                  </button>
                )}
              </form>

              {tiktokStatus?.error && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 px-3 py-2 text-[11px] font-semibold text-amber-900">
                  📡 {tiktokStatus.error}
                </div>
              )}
            </div>

            {/* Host Direct Controls */}
            <div className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  Controles Rápidos da Rodada
                </span>
                {question?.correctOption && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-zinc-950 text-white text-[11px] font-extrabold">
                    Resposta Certa: Letra {question.correctOption}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => onAction('quiz:pause')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-xs font-extrabold cursor-pointer"
                >
                  {quizState?.phase === 'PAUSED' ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-600" /> Retomar
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pausar
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onAction('quiz:skip')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-xs font-extrabold cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" /> Nova IA
                </button>

                <button
                  type="button"
                  onClick={() => onAction('quiz:eliminate')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-xs font-extrabold cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-red-600" /> -1 Errada
                </button>

                <button
                  type="button"
                  onClick={() => onAction('quiz:hint')}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-900 text-xs font-extrabold cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" /> Dar Dica
                </button>

                <button
                  type="button"
                  onClick={() => onAction('quiz:reveal')}
                  className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-extrabold cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Revelar
                </button>
              </div>
            </div>

            {/* Simulator: Test all 5 Gift Powers + Chat Answers */}
            <div className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  🧪 Testar Chat & Os 5 Presentes Agora
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-zinc-600">Espectador:</span>
                  <input
                    type="text"
                    value={simUser}
                    onChange={(e) => setSimUser(e.target.value)}
                    placeholder="ex: maria_top1"
                    className="w-32 rounded-lg bg-white border-2 border-zinc-900 px-2 py-1 text-xs font-extrabold text-zinc-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {POWER_ORDER.map((key) => {
                  const p = giftPowers[key];
                  if (!p) return null;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => sendSimGift(key)}
                      className="rounded-xl bg-white hover:bg-zinc-950 hover:text-white active:scale-95 border-2 border-zinc-900 p-2 flex flex-col items-center text-center transition cursor-pointer group"
                    >
                      <span className="text-xl mb-0.5">{p.icon || '🎁'}</span>
                      <span className="text-[11px] font-black truncate w-full">
                        {p.displayName}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 truncate w-full">
                        {p.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => sendSimChat(letter)}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-950 hover:text-white border-2 border-zinc-900 text-xs font-black transition cursor-pointer"
                  >
                    Mandar "{letter}"
                  </button>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendSimChat();
                  }}
                  className="flex-1 min-w-[170px] flex gap-1.5"
                >
                  <input
                    type="text"
                    value={simComment}
                    onChange={(e) => setSimComment(e.target.value)}
                    placeholder="Simular comentário no chat..."
                    className="flex-1 rounded-xl bg-white border-2 border-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-950 placeholder:text-zinc-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs transition cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Live Feed Log */}
            <div className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                  Eventos Detectados (Chat & Presentes)
                </span>
                <span className="text-[11px] font-bold text-zinc-500">
                  {feedItems.length} recentes
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {feedItems.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-4 text-center font-medium">
                    Nenhum evento ainda. Use os botões acima para testar ou ative sua live!
                  </p>
                ) : (
                  feedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="font-black text-zinc-950 shrink-0">
                          @{item.user?.uniqueId}
                        </span>
                        <span className="text-zinc-700 font-medium truncate">
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
                          className="rounded-lg bg-zinc-100 border border-zinc-900 px-2 py-0.5 text-[10px] font-bold text-zinc-900"
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
                            className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              item.kind === 'correct'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                                : item.kind === 'wrong'
                                ? 'bg-red-100 text-red-800'
                                : item.kind === 'gift_power'
                                ? 'bg-zinc-950 text-white'
                                : 'bg-zinc-200 text-zinc-700'
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
            <div className="rounded-2xl bg-zinc-100 border-2 border-zinc-900 p-3 text-xs font-semibold text-zinc-800">
              Escolha qual presente específico do TikTok ativa cada poder na caixa{' '}
              <strong>"O que vale pro jogo?"</strong>.
            </div>

            {POWER_ORDER.map((powerKey) => {
              const p = giftPowers[powerKey];
              if (!p) return null;

              return (
                <div
                  key={powerKey}
                  className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-3.5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.icon || '🎁'}</span>
                      <div>
                        <div className="text-sm font-black text-zinc-950">{p.label}</div>
                        <div className="text-[11px] text-zinc-600">{p.description}</div>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-1.5 text-xs font-extrabold text-zinc-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.enabled !== false}
                        onChange={(e) =>
                          handlePowerFieldChange(powerKey, 'enabled', e.target.checked)
                        }
                        className="accent-zinc-950 w-4 h-4"
                      />
                      Ativo
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-zinc-600 mb-1">
                        Presente do TikTok
                      </label>
                      <select
                        value={
                          giftCatalog.find((g) => g.giftId === Number(p.giftId))?.key || ''
                        }
                        onChange={(e) => handlePowerPresetSelect(powerKey, e.target.value)}
                        className="w-full rounded-xl bg-white border-2 border-zinc-900 px-2.5 py-2 text-xs font-bold text-zinc-950"
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
                      <label className="block text-[10px] font-extrabold uppercase text-zinc-600 mb-1">
                        Nome na Tela
                      </label>
                      <input
                        type="text"
                        value={p.displayName || ''}
                        onChange={(e) =>
                          handlePowerFieldChange(powerKey, 'displayName', e.target.value)
                        }
                        className="w-full rounded-xl bg-white border-2 border-zinc-900 px-2.5 py-2 text-xs font-bold text-zinc-950"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-zinc-600 mb-1">
                          Ícone
                        </label>
                        <input
                          type="text"
                          value={p.icon || ''}
                          onChange={(e) =>
                            handlePowerFieldChange(powerKey, 'icon', e.target.value)
                          }
                          className="w-full rounded-xl bg-white border-2 border-zinc-900 px-2.5 py-2 text-xs text-center font-bold text-zinc-950"
                        />
                      </div>

                      {powerKey === 'buyPoint' ? (
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-zinc-900 mb-1">
                            Pontos
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
                            className="w-full rounded-xl bg-white border-2 border-zinc-900 px-2.5 py-2 text-xs font-black text-zinc-950"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase text-zinc-600 mb-1">
                            Gift ID
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
                            className="w-full rounded-xl bg-white border-2 border-zinc-900 px-2.5 py-2 text-xs font-bold text-zinc-950"
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

        {/* ================= TAB 3: IA OPENROUTER & VISUAL ================= */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <form
              onSubmit={handleSaveAiSettings}
              className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-zinc-950" />
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-950">
                    IA OpenRouter (Gerador Automático)
                  </span>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                    aiStatus?.hasApiKey
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-500'
                      : 'bg-red-100 text-red-900 border border-red-400'
                  }`}
                >
                  {aiStatus?.hasApiKey
                    ? `Chave Ativa (${aiStatus.maskedApiKey})`
                    : 'Sem Chave API'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white border border-zinc-300 p-2">
                  <div className="text-[10px] font-bold text-zinc-500">Geradas pela IA</div>
                  <div className="text-sm font-black text-zinc-950">
                    {aiStatus?.generatedCount ?? 0}
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-zinc-300 p-2">
                  <div className="text-[10px] font-bold text-zinc-500">Fila Pronta</div>
                  <div className="text-sm font-black text-zinc-950">
                    {aiStatus?.queueSize ?? 0} perguntas
                  </div>
                </div>
                <div className="rounded-xl bg-white border border-zinc-300 p-2">
                  <div className="text-[10px] font-bold text-zinc-500">Fonte Atual</div>
                  <div className="text-xs font-black text-zinc-950 truncate">
                    {aiStatus?.lastSource === 'openrouter' ? 'OpenRouter IA' : 'Banco PT-BR'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">
                    Modelo da OpenRouter
                  </label>
                  <select
                    value={config.openRouterModel || 'openai/gpt-4o-mini'}
                    onChange={(e) =>
                      updateConfigImmediate({ openRouterModel: e.target.value })
                    }
                    className="w-full rounded-xl bg-white border-2 border-zinc-900 px-3 py-2 text-xs font-bold text-zinc-950"
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">
                    Trocar Chave OpenRouter (opcional)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Manter chave configurada..."
                    className="w-full rounded-xl bg-white border-2 border-zinc-900 px-3 py-2 text-xs font-bold text-zinc-950 placeholder:text-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-zinc-700 mb-1.5">
                  Tema das Perguntas
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setThemeInput(preset.value)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-950 hover:text-white border border-zinc-900 text-[11px] font-bold transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={themeInput}
                  onChange={(e) => setThemeInput(e.target.value)}
                  className="w-full rounded-xl bg-white border-2 border-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-950"
                />
              </div>

              <button
                type="submit"
                disabled={savingConfig}
                className="w-full py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs transition cursor-pointer"
              >
                {savingConfig ? 'Salvando...' : 'Salvar Tema & Atualizar IA'}
              </button>
            </form>

            {/* Visual & Round Rules */}
            <div className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-4 space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-950 block">
                Cores, Tempo & Regras
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">
                    Tempo da Pergunta ({config.roundDurationSec || 20}s)
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    step={5}
                    value={config.roundDurationSec || 20}
                    onChange={(e) =>
                      updateConfigImmediate({
                        roundDurationSec: Number(e.target.value),
                      })
                    }
                    className="w-full accent-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">
                    Tempo Resposta ({config.revealDurationSec || 5}s)
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    step={1}
                    value={config.revealDurationSec || 5}
                    onChange={(e) =>
                      updateConfigImmediate({
                        revealDurationSec: Number(e.target.value),
                      })
                    }
                    className="w-full accent-zinc-950"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-zinc-700 mb-1">
                    Dificuldade
                  </label>
                  <select
                    value={config.difficulty || 'misto'}
                    onChange={(e) =>
                      updateConfigImmediate({ difficulty: e.target.value })
                    }
                    className="w-full rounded-xl bg-white border-2 border-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-950"
                  >
                    <option value="misto">Misto</option>
                    <option value="facil">Fácil</option>
                    <option value="medio">Médio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border-2 border-zinc-900 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.invertedTheme !== false}
                    onChange={(e) =>
                      updateConfigImmediate({ invertedTheme: e.target.checked })
                    }
                    className="accent-zinc-950 w-4 h-4"
                  />
                  <div>
                    <div className="font-extrabold text-zinc-950">
                      Cores Invertidas (Branco + Preto)
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      Desmarque para usar fundo preto com linhas brancas
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border-2 border-zinc-900 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.oneAttemptPerUser)}
                    onChange={(e) =>
                      updateConfigImmediate({ oneAttemptPerUser: e.target.checked })
                    }
                    className="accent-zinc-950 w-4 h-4"
                  />
                  <div>
                    <div className="font-extrabold text-zinc-950">
                      1 tentativa por pessoa
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      Evita spam de A, B, C e D seguidos
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border-2 border-zinc-900 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.endRoundOnFirstCorrect)}
                    onChange={(e) =>
                      updateConfigImmediate({
                        endRoundOnFirstCorrect: e.target.checked,
                      })
                    }
                    className="accent-zinc-950 w-4 h-4"
                  />
                  <div>
                    <div className="font-extrabold text-zinc-950">
                      1º acerto já encerra a rodada
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      Modo velocidade (Morte Súbita)
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border-2 border-zinc-900 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(config.transparentBg)}
                    onChange={(e) =>
                      updateConfigImmediate({ transparentBg: e.target.checked })
                    }
                    className="accent-zinc-950 w-4 h-4"
                  />
                  <div>
                    <div className="font-extrabold text-zinc-950">
                      Fundo Transparente (OBS)
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      Remove a grade de fundo para sobrepor webcam
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: RANKING TOP 5 ================= */}
        {activeTab === 'ranking' && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-zinc-50 border-2 border-zinc-900 p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-zinc-950">
                  Placar Geral & Top 5
                </h3>
                <p className="text-xs text-zinc-600">
                  Os 5 primeiros aparecem no card Top 5 no canto superior direito
                </p>
              </div>

              <button
                type="button"
                onClick={() => onAction('leaderboard:reset')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Zerar Placar
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!manualPlayer.trim()) return;
                onAction('leaderboard:adjust', {
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
                className="flex-1 rounded-xl bg-white border-2 border-zinc-900 px-3 py-2 text-xs font-bold text-zinc-950"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-black text-xs transition cursor-pointer"
              >
                + Adicionar
              </button>
            </form>

            <div className="rounded-2xl bg-white border-2 border-zinc-900 divide-y divide-zinc-200 overflow-hidden">
              {allPlayers.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 font-medium">
                  Nenhum jogador pontuou ainda.
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
                            ? 'bg-zinc-950 text-white'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {p.rank}º
                      </span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-zinc-950 truncate">
                          @{p.uniqueId}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-semibold">
                          {p.correctAnswers || 0} acertos • {p.giftsPoints || 0} pts por presentes
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-300 text-zinc-950 font-black">
                        {p.points} pts
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onAction('leaderboard:adjust', {
                            userId: p.userId,
                            uniqueId: p.uniqueId,
                            nickname: p.nickname,
                            delta: 1,
                          })
                        }
                        className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onAction('leaderboard:adjust', {
                            userId: p.userId,
                            uniqueId: p.uniqueId,
                            nickname: p.nickname,
                            delta: -1,
                          })
                        }
                        className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 cursor-pointer"
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
