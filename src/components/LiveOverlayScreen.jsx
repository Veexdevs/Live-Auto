import React from 'react';

const OPTION_STYLES = {
  A: {
    badge: 'from-cyan-400 to-blue-600 text-slate-950 shadow-cyan-500/40',
    border: 'border-cyan-500/35 hover:border-cyan-400/70',
  },
  B: {
    badge: 'from-fuchsia-400 to-purple-600 text-white shadow-fuchsia-500/40',
    border: 'border-fuchsia-500/35 hover:border-fuchsia-400/70',
  },
  C: {
    badge: 'from-amber-300 to-orange-500 text-slate-950 shadow-amber-500/40',
    border: 'border-amber-500/35 hover:border-amber-400/70',
  },
  D: {
    badge: 'from-emerald-400 to-teal-600 text-slate-950 shadow-emerald-500/40',
    border: 'border-emerald-500/35 hover:border-emerald-400/70',
  },
};

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4º', '5º'];

const ALERT_THEMES = {
  correct: 'from-emerald-500/95 via-teal-600/95 to-cyan-600/95 border-emerald-300/60',
  buypoint: 'from-amber-400/95 via-yellow-500/95 to-orange-500/95 border-yellow-200/70 text-slate-950',
  eliminate: 'from-rose-600/95 via-red-600/95 to-pink-600/95 border-rose-300/60',
  hint: 'from-amber-500/95 via-orange-500/95 to-yellow-600/95 border-amber-200/60',
  reveal: 'from-violet-600/95 via-fuchsia-600/95 to-pink-600/95 border-fuchsia-300/60',
  skip: 'from-cyan-500/95 via-blue-600/95 to-indigo-600/95 border-cyan-300/60',
  info: 'from-slate-800/95 to-slate-900/95 border-slate-500/50',
};

function AvatarBadge({ player, rankIndex }) {
  const initials = (player?.nickname || player?.uniqueId || '?')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase() || '?';

  if (player?.avatar) {
    return (
      <img
        src={player.avatar}
        alt={player.uniqueId}
        className="w-5 h-5 rounded-full object-cover ring-1 ring-white/30 shrink-0"
      />
    );
  }

  const gradients = [
    'from-amber-400 to-orange-500 text-slate-950',
    'from-slate-200 to-slate-400 text-slate-950',
    'from-amber-600 to-amber-800 text-white',
    'from-cyan-500 to-blue-600 text-white',
    'from-fuchsia-500 to-purple-600 text-white',
  ];

  return (
    <div
      className={`w-5 h-5 rounded-full bg-gradient-to-br ${
        gradients[rankIndex] || gradients[3]
      } flex items-center justify-center text-[9px] font-black shrink-0`}
    >
      {initials}
    </div>
  );
}

export default function LiveOverlayScreen({
  quizState,
  tiktokStatus,
  activeAlert,
  fullBleed = false,
  onQuickAnswerClick,
}) {
  const question = quizState?.question;
  const config = quizState?.config || {};
  const top5 = quizState?.top5 || [];
  const phase = quizState?.phase || 'ACTIVE';
  const timeRemaining = quizState?.timeRemaining ?? 0;
  const totalDuration = Math.max(1, quizState?.totalPhaseDuration || 35);
  const progressPct = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));

  const isRevealed =
    phase === 'REVEAL' || Boolean(question?.revealedEarly && question?.correctOption);
  const isUrgent = phase === 'ACTIVE' && timeRemaining <= 7 && !isRevealed;

  const giftPowers = config.giftPowers || {};
  const orderedPowers = [
    giftPowers.eliminateWrong,
    giftPowers.showHint,
    giftPowers.revealAnswer,
    giftPowers.buyPoint,
    giftPowers.skipQuestion,
  ].filter((p) => p && p.enabled !== false);

  const transparentBg = Boolean(config.transparentBg);
  const safeZoneBottom = Boolean(config.safeZoneBottom);

  const questionLength = question?.question?.length || 0;
  const questionFontSize =
    questionLength > 105
      ? 'text-[15px] leading-snug'
      : questionLength > 75
      ? 'text-[17px] leading-snug'
      : 'text-[19px] leading-tight';

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none flex flex-col justify-between ${
        fullBleed ? '' : 'rounded-[28px] border border-white/15 shadow-2xl shadow-cyan-950/50'
      } ${
        transparentBg
          ? 'bg-transparent'
          : 'bg-[#070817]'
      }`}
      style={{ aspectRatio: fullBleed ? undefined : '9 / 16' }}
    >
      {/* Animated Neon Broadcast Studio Background */}
      {!transparentBg && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl animate-float-slow" />
          <div
            className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-fuchsia-600/20 blur-3xl animate-float-slow"
            style={{ animationDelay: '2s' }}
          />
          <div className="absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-indigo-600/25 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />
        </div>
      )}

      {/* TOP SECTION: Left Info/Timer + Top-Right Corner Top 5 Leaderboard */}
      <div className="relative z-10 px-3.5 pt-3.5 flex items-start justify-between gap-2.5">
        {/* Top-Left: Live Badge, Round, Category & Countdown */}
        <div className="flex flex-col gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/90 border border-rose-400/50 text-[10px] font-extrabold tracking-wider uppercase shadow-lg shadow-rose-950/60">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              AO VIVO
            </span>

            <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-bold text-slate-200">
              #{quizState?.roundNumber || 1}
            </span>

            {(tiktokStatus?.connected || tiktokStatus?.simulationActive) && (
              <span className="px-2 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-bold text-cyan-200">
                👁 {tiktokStatus.viewerCount || 1}
              </span>
            )}
          </div>

          {/* Timer Display */}
          <div
            className={`rounded-2xl px-3 py-2 backdrop-blur-md border transition-all duration-300 ${
              phase === 'PAUSED'
                ? 'bg-amber-500/20 border-amber-400/50'
                : isRevealed
                ? 'bg-emerald-500/20 border-emerald-400/50'
                : isUrgent
                ? 'bg-rose-600/30 border-rose-400/70 animate-pulse'
                : 'bg-slate-900/75 border-white/15'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-widest font-bold text-slate-300/90">
                  {phase === 'PAUSED'
                    ? 'Quiz Pausado'
                    : isRevealed
                    ? 'Resposta Certa'
                    : 'Tempo'}
                </span>
                <span
                  className={`text-2xl font-black leading-none tracking-tight ${
                    isUrgent
                      ? 'text-rose-300'
                      : isRevealed
                      ? 'text-emerald-300'
                      : 'text-white'
                  }`}
                >
                  {phase === 'PAUSED' ? '⏸' : `${timeRemaining}s`}
                </span>
              </div>

              <div className="text-right min-w-0">
                <span className="inline-block max-w-[105px] truncate px-2 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/25 border border-cyan-400/30 text-[10px] font-bold text-cyan-100">
                  {question?.category || 'Quiz IA'}
                </span>
                <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                  Comente A, B, C ou D
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-linear ${
                  isRevealed
                    ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                    : isUrgent
                    ? 'bg-gradient-to-r from-rose-500 to-orange-400'
                    : 'bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* TOP-RIGHT CORNER: TOP 5 RANKING */}
        <div className="w-[46%] max-w-[186px] shrink-0 rounded-2xl bg-slate-950/85 backdrop-blur-xl border border-amber-400/35 shadow-xl shadow-black/50 p-2.5">
          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-white/10">
            <div className="flex items-center gap-1">
              <span className="text-xs">🏆</span>
              <span className="text-[10px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                TOP 5 RANKING
              </span>
            </div>
            <span className="text-[9px] font-bold text-amber-300/80">PTS</span>
          </div>

          <div className="space-y-1">
            {[0, 1, 2, 3, 4].map((idx) => {
              const player = top5[idx];
              return (
                <div
                  key={player ? player.userId : `empty_${idx}`}
                  className={`flex items-center justify-between gap-1.5 px-1.5 py-0.5 rounded-lg text-[10px] transition-all ${
                    idx === 0 && player
                      ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/10 border border-amber-400/35'
                      : player
                      ? 'bg-white/[0.05]'
                      : 'bg-white/[0.02] opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="w-4 text-center font-black text-[10px] shrink-0">
                      {RANK_MEDALS[idx]}
                    </span>
                    {player ? (
                      <>
                        <AvatarBadge player={player} rankIndex={idx} />
                        <span className="truncate font-bold text-white/95">
                          @{player.uniqueId}
                        </span>
                      </>
                    ) : (
                      <span className="truncate text-slate-400 italic text-[9px]">
                        Sua vaga!
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-1.5 py-0.2 rounded font-black text-[10px] shrink-0 ${
                      idx === 0 && player
                        ? 'bg-amber-400 text-slate-950'
                        : player
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-500'
                    }`}
                  >
                    {player ? player.points : '0'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DYNAMIC FLOATING ALERT BANNER (Gifts / Correct Answer Celebration) */}
      <div className="relative z-20 px-3.5 min-h-[44px] flex items-center justify-center my-1">
        {activeAlert ? (
          <div
            key={activeAlert.id}
            className={`w-full rounded-2xl px-3 py-2 border shadow-2xl bg-gradient-to-r animate-pop-in flex items-center gap-2.5 ${
              ALERT_THEMES[activeAlert.type] || ALERT_THEMES.info
            }`}
          >
            <span className="text-xl shrink-0 drop-shadow">{activeAlert.icon || '⚡'}</span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="font-black text-xs truncate">{activeAlert.title}</div>
              {activeAlert.subtitle && (
                <div className="text-[10px] font-semibold opacity-90 truncate">
                  {activeAlert.subtitle}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full rounded-xl px-3 py-1.5 bg-white/[0.04] border border-white/10 flex items-center justify-between text-[10px] text-slate-300">
            <span className="font-bold truncate">
              🎯 {config.liveTitle || 'QUIZ AUTOMÁTICO IA • ACERTOU = +1 PONTO!'}
            </span>
            {quizState?.totalRoundWinners > 0 && (
              <span className="shrink-0 ml-2 px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 font-extrabold">
                ✅ {quizState.totalRoundWinners} acertaram
              </span>
            )}
          </div>
        )}
      </div>

      {/* CENTER STAGE: QUESTION + HINT + 4 ALTERNATIVES */}
      <div className="relative z-10 px-3.5 flex-1 flex flex-col justify-center gap-2.5 min-h-0">
        {/* Question Card */}
        <div className="relative rounded-2xl bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-cyan-400/30 p-3.5 shadow-xl shadow-black/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-300 flex items-center gap-1">
              <span>✨ PERGUNTA GERADA POR IA</span>
            </span>
            {question?.revealedBy && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/25 border border-fuchsia-400/40 text-fuchsia-200">
                👁 Revelada por @{question.revealedBy.uniqueId}
              </span>
            )}
          </div>

          <h2 className={`font-black text-white tracking-tight ${questionFontSize}`}>
            {question?.question || 'Gerando próxima pergunta com IA...'}
          </h2>

          {/* Hint Box when unlocked by gift */}
          {question?.hintVisible && question?.hint && (
            <div className="mt-2.5 rounded-xl bg-amber-500/15 border border-amber-400/45 px-2.5 py-1.5 animate-pop-in">
              <div className="text-[10px] font-extrabold text-amber-200 leading-snug">
                💡 DICA: <span className="font-semibold text-amber-100">{question.hint}</span>
              </div>
              {question.extraHintText && (
                <div className="text-[9px] font-bold text-yellow-300 mt-0.5">
                  ⚡ {question.extraHintText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4 Alternatives (A, B, C, D) */}
        <div className="grid grid-cols-1 gap-2">
          {['A', 'B', 'C', 'D'].map((letter) => {
            const text = question?.options?.[letter] || '...';
            const isEliminated = question?.eliminatedOptions?.includes(letter);
            const isCorrect = isRevealed && question?.correctOption === letter;
            const isDimmedWrong = isRevealed && question?.correctOption !== letter;
            const style = OPTION_STYLES[letter];

            let cardClasses = `bg-slate-900/85 backdrop-blur-md ${style.border}`;
            if (isCorrect) {
              cardClasses =
                'bg-gradient-to-r from-emerald-500/35 via-teal-500/30 to-emerald-600/35 border-emerald-300 ring-2 ring-emerald-400/60 scale-[1.015] shadow-lg shadow-emerald-950/70';
            } else if (isEliminated) {
              cardClasses =
                'bg-rose-950/35 border-rose-500/30 opacity-45';
            } else if (isDimmedWrong) {
              cardClasses = 'bg-slate-900/50 border-white/10 opacity-50';
            }

            return (
              <div
                key={letter}
                onClick={() => onQuickAnswerClick?.(letter)}
                className={`relative rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2.5 transition-all duration-300 ${
                  onQuickAnswerClick ? 'cursor-pointer active:scale-[0.99]' : ''
                } ${cardClasses}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br font-black text-sm flex items-center justify-center shadow-md shrink-0 ${
                      isEliminated
                        ? 'from-rose-800 to-rose-950 text-rose-300'
                        : isCorrect
                        ? 'from-emerald-300 to-emerald-500 text-slate-950'
                        : style.badge
                    }`}
                  >
                    {isEliminated ? '✖' : letter}
                  </div>

                  <span
                    className={`font-bold text-[14px] leading-tight truncate ${
                      isEliminated
                        ? 'line-through text-rose-200/70'
                        : isCorrect
                        ? 'text-emerald-100 font-black'
                        : 'text-white'
                    }`}
                  >
                    {text}
                  </span>
                </div>

                {isEliminated && (
                  <span className="shrink-0 px-2 py-0.5 rounded bg-rose-500/25 border border-rose-400/40 text-[9px] font-black uppercase text-rose-200">
                    ELIMINADA
                  </span>
                )}

                {isCorrect && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black uppercase shadow">
                    ✓ CERTA
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM BAR: 5 GIFT POWER-UPS LEGEND */}
      <div
        className={`relative z-10 px-3.5 pt-2 ${
          safeZoneBottom ? 'pb-16' : 'pb-3.5'
        }`}
      >
        <div className="rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/15 p-2 shadow-xl">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">
              🎁 ENVIE PRESENTES PARA ATIVAR PODERES NA LIVE
            </span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">
              Automático
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {orderedPowers.map((power) => (
              <div
                key={power.action}
                className="rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.03] border border-white/10 px-1 py-1.5 flex flex-col items-center text-center"
              >
                <span className="text-lg leading-none mb-1 drop-shadow">
                  {power.icon || '🎁'}
                </span>
                <span className="text-[9px] font-black text-white truncate w-full leading-tight">
                  {power.displayName || power.giftName}
                </span>
                <span className="text-[8px] font-bold text-cyan-300 truncate w-full leading-tight mt-0.5">
                  {power.action === 'buyPoint' && (power.pointsAwarded || 1) > 1
                    ? `+${power.pointsAwarded} Pontos`
                    : power.shortLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
