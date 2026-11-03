import React, { useEffect, useState } from 'react';

function StopwatchIcon({ className = 'w-10 h-10' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Top stopwatch stem & cap */}
      <line
        x1="20"
        y1="5"
        x2="28"
        y2="5"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="5"
        x2="24"
        y2="10"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* Angled side clicker */}
      <line
        x1="34.5"
        y1="12.5"
        x2="38"
        y2="9"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {/* Main dial circle */}
      <circle
        cx="24"
        cy="27"
        r="16"
        stroke="currentColor"
        strokeWidth="3.4"
      />
      {/* Watch hand */}
      <line
        x1="24"
        y1="27"
        x2="24"
        y2="17"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="27" r="2.2" fill="currentColor" />
    </svg>
  );
}

function TrophyIcon({ className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M6 3h12v2h3a1 1 0 0 1 1 1v2a5 5 0 0 1-4.33 4.95A6.01 6.01 0 0 1 13 16.92V19h4v2H7v-2h4v-2.08A6.01 6.01 0 0 1 6.33 12.95 5 5 0 0 1 2 8V6a1 1 0 0 1 1-1h3V3Zm-2 4v1a3 3 0 0 0 2.05 2.84A14.2 14.2 0 0 1 6 9V7H4Zm16 0h-2v2c0 .63-.02 1.25-.05 1.84A3 3 0 0 0 20 8V7Z" />
    </svg>
  );
}

function GiftSilhouetteIcon({ className = 'w-10 h-10' }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Bow loops */}
      <path d="M24 13c-1.8-4.8-5.6-7.5-9.2-6.5-2.6.7-4.1 3.3-3.2 5.8.7 1.9 2.7 3.2 5.6 3.7H24v-3Zm0 0c1.8-4.8 5.6-7.5 9.2-6.5 2.6.7 4.1 3.3 3.2 5.8-.7 1.9-2.7 3.2-5.6 3.7H24v-3Z" />
      {/* Box Lid */}
      <rect x="6" y="15" width="16.2" height="8" rx="2.2" />
      <rect x="25.8" y="15" width="16.2" height="8" rx="2.2" />
      {/* Box Body */}
      <path d="M9 26h13.2v15H12a3 3 0 0 1-3-3V26Zm16.8 0H39v12a3 3 0 0 1-3 3H25.8V26Z" />
    </svg>
  );
}

export default function LiveOverlayScreen({
  quizState,
  serverClockOffset = 0,
  activeAlert,
  fullBleed = false,
  onQuickAnswerClick,
}) {
  const question = quizState?.question;
  const config = quizState?.config || {};
  const top5 = quizState?.top5 || [];
  const phase = quizState?.phase || 'ACTIVE';
  const totalDuration = Math.max(1, quizState?.totalPhaseDuration || 20);

  // Smooth local countdown synced to server's phaseEndsAt
  const [liveRemainingMs, setLiveRemainingMs] = useState(
    (quizState?.timeRemaining ?? 15) * 1000
  );

  useEffect(() => {
    if (!quizState) return;
    if (quizState.phase === 'PAUSED') {
      setLiveRemainingMs(quizState.remainingMs ?? (quizState.timeRemaining || 0) * 1000);
      return;
    }

    const updateClock = () => {
      const estimatedServerNow = Date.now() + serverClockOffset;
      if (quizState.phaseEndsAt) {
        const rem = Math.max(0, quizState.phaseEndsAt - estimatedServerNow);
        setLiveRemainingMs(rem);
      } else {
        setLiveRemainingMs((quizState.timeRemaining || 0) * 1000);
      }
    };

    updateClock();
    const id = setInterval(updateClock, 100);
    return () => clearInterval(id);
  }, [
    quizState?.phaseEndsAt,
    quizState?.phase,
    quizState?.remainingMs,
    quizState?.timeRemaining,
    serverClockOffset,
  ]);

  const displaySeconds = Math.max(0, Math.ceil(liveRemainingMs / 1000));
  const progressFraction = Math.max(
    0,
    Math.min(1, liveRemainingMs / (totalDuration * 1000))
  );

  const isRevealed =
    phase === 'REVEAL' || Boolean(question?.revealedEarly && question?.correctOption);
  const isUrgent = phase === 'ACTIVE' && displaySeconds <= 4 && !isRevealed;

  const inverted = config.invertedTheme !== false; // Default TRUE (White background + Black outlines)
  const transparentBg = Boolean(config.transparentBg);
  const safeZoneBottom = Boolean(config.safeZoneBottom);

  const giftPowers = config.giftPowers || {};
  const orderedPowers = [
    giftPowers.eliminateWrong,
    giftPowers.showHint,
    giftPowers.skipQuestion,
    giftPowers.revealAnswer,
    giftPowers.buyPoint,
  ].filter((p) => p && p.enabled !== false);

  const qLen = question?.question?.length || 0;
  const questionFontClass =
    qLen > 105
      ? 'text-[17px] leading-[1.28]'
      : qLen > 72
      ? 'text-[20px] leading-[1.24]'
      : 'text-[22px] leading-[1.22]';

  // Circular C-arc parameters around the timer number (right side of the pill)
  const arcRadius = 29;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const visibleArcSpan = arcCircumference * 0.62; // ~223° right-side C-arc like screenshot!
  const activeArcLength = visibleArcSpan * progressFraction;

  // Theme tokens (Inverted = White w/ Black lines; Non-inverted = Black w/ White lines)
  const bgCanvas = transparentBg
    ? 'bg-transparent'
    : inverted
    ? 'bg-white text-zinc-950'
    : 'bg-black text-white';

  const cardSurface = inverted
    ? 'bg-white border-zinc-950 text-zinc-950'
    : 'bg-black border-white text-white';

  const dividerColor = inverted ? 'bg-zinc-950' : 'bg-white';
  const gridLineColor = inverted
    ? 'rgba(0, 0, 0, 0.085)'
    : 'rgba(255, 255, 255, 0.09)';

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none flex flex-col justify-between ${
        fullBleed
          ? ''
          : inverted
          ? 'rounded-[30px] border-[3px] border-zinc-950 shadow-2xl'
          : 'rounded-[30px] border-[3px] border-white/80 shadow-2xl'
      } ${bgCanvas}`}
      style={{ aspectRatio: fullBleed ? undefined : '9 / 16' }}
    >
      {/* Square Grid Background Pattern (matches reference image, inverted!) */}
      {!transparentBg && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, ${gridLineColor} 1px, transparent 1px),
              linear-gradient(to bottom, ${gridLineColor} 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />
      )}

      {/* TOP SECTION: Stopwatch Timer Pill (Left) + Top 5 Box (Right Corner) */}
      <div className="relative z-10 px-4 pt-4 flex items-start justify-between gap-2.5">
        {/* Top-Left Timer Pill with Stopwatch + Right Arc */}
        <div
          className={`mt-2 relative h-[76px] w-[162px] rounded-full border-[3.5px] px-4 flex items-center justify-between shadow-sm ${cardSurface}`}
        >
          <StopwatchIcon
            className={`w-9 h-9 shrink-0 ${isUrgent ? 'text-red-600' : ''}`}
          />

          <div className="relative w-[74px] h-[68px] flex items-center justify-center">
            {/* Background & Foreground C-shaped Circular Progress Arc */}
            <svg
              viewBox="0 0 72 72"
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: 'rotate(-112deg)' }}
            >
              {/* Track Arc */}
              <circle
                cx="36"
                cy="36"
                r={arcRadius}
                fill="none"
                stroke={inverted ? '#E4E4E7' : '#27272A'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${visibleArcSpan} ${arcCircumference}`}
              />
              {/* Active Countdown Arc */}
              <circle
                cx="36"
                cy="36"
                r={arcRadius}
                fill="none"
                stroke={
                  isUrgent ? '#DC2626' : inverted ? '#09090B' : '#FFFFFF'
                }
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${activeArcLength} ${arcCircumference}`}
                className="transition-[stroke-dasharray] duration-100 ease-linear"
              />
            </svg>

            <span
              className={`relative z-10 text-[36px] font-black leading-none tracking-tight tabular-nums pr-1 ${
                isUrgent ? 'text-red-600' : ''
              }`}
            >
              {phase === 'PAUSED' ? '⏸' : displaySeconds}
            </span>
          </div>
        </div>

        {/* Top-Right Corner: Top 5 Ranking Card */}
        <div
          className={`w-[150px] shrink-0 rounded-[16px] border-[2.5px] px-3 py-2 shadow-sm ${cardSurface}`}
        >
          <div className="flex items-center justify-center gap-1.5 pb-1.5">
            <TrophyIcon className="w-4 h-4 shrink-0" />
            <span className="text-[14px] font-extrabold leading-none tracking-tight">
              Top 5
            </span>
          </div>

          <div className={`w-full h-[2px] mb-1.5 ${dividerColor}`} />

          <div className="space-y-0.5">
            {[0, 1, 2, 3, 4].map((idx) => {
              const player = top5[idx];
              return (
                <div
                  key={player ? player.userId : `slot_${idx}`}
                  className="flex items-center justify-between gap-1.5 text-[11.5px] leading-[1.35]"
                >
                  <span className="w-4 font-extrabold shrink-0">{idx + 1}º</span>
                  <span
                    className={`flex-1 truncate font-bold ${
                      player ? '' : 'opacity-65'
                    }`}
                  >
                    {player ? player.uniqueId : '---'}
                  </span>
                  <span className="font-extrabold tabular-nums shrink-0">
                    {player ? player.points : 0}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* FLOATING TOAST ALERT (Scores & Gift Power-Ups) */}
      <div className="relative z-20 px-4 min-h-[34px] flex items-center justify-center">
        {activeAlert && (
          <div
            key={activeAlert.id}
            className={`w-full rounded-full border-[2.5px] px-3.5 py-1.5 shadow-md animate-pop-in flex items-center gap-2 ${
              inverted
                ? 'bg-zinc-950 border-zinc-950 text-white'
                : 'bg-white border-white text-zinc-950'
            }`}
          >
            <span className="text-base leading-none shrink-0">
              {activeAlert.icon || '⚡'}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[11px] font-black truncate">
                {activeAlert.title}
              </div>
              {activeAlert.subtitle && (
                <div className="text-[9.5px] font-semibold opacity-85 truncate">
                  {activeAlert.subtitle}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MIDDLE SECTION: QUESTION BOX + 4 ALTERNATIVES */}
      <div className="relative z-10 px-4 flex-1 flex flex-col justify-center gap-2.5 min-h-0">
        {/* Question Rounded Box */}
        <div
          className={`rounded-[26px] border-[3.5px] px-4 py-5 min-h-[142px] flex flex-col items-center justify-center text-center shadow-sm ${cardSurface}`}
        >
          <h2 className={`font-extrabold tracking-tight ${questionFontClass}`}>
            {question?.question || 'Carregando próxima pergunta...'}
          </h2>

          {/* Hint unlocked via Gift */}
          {question?.hintVisible && question?.hint && (
            <div
              className={`mt-3 w-full rounded-xl border-[2px] px-3 py-1.5 text-[11px] font-bold animate-pop-in ${
                inverted
                  ? 'bg-zinc-100 border-zinc-900 text-zinc-900'
                  : 'bg-zinc-900 border-white text-white'
              }`}
            >
              💡 Dica: {question.hint}
              {question.extraHintText ? ` • ${question.extraHintText}` : ''}
            </div>
          )}
        </div>

        {/* 4 Alternative Bars (A | Option) */}
        <div className="flex flex-col gap-2.5 mt-0.5">
          {['A', 'B', 'C', 'D'].map((letter) => {
            const text = question?.options?.[letter] || '...';
            const isEliminated = question?.eliminatedOptions?.includes(letter);
            const isCorrect = isRevealed && question?.correctOption === letter;
            const isDimmedWrong = isRevealed && question?.correctOption !== letter;

            let barStyle = cardSurface;
            let separatorBg = dividerColor;

            if (isCorrect) {
              barStyle = inverted
                ? 'bg-zinc-950 border-zinc-950 text-white scale-[1.015] shadow-md'
                : 'bg-white border-white text-zinc-950 scale-[1.015] shadow-md';
              separatorBg = inverted ? 'bg-white' : 'bg-zinc-950';
            } else if (isEliminated) {
              barStyle = inverted
                ? 'bg-zinc-100/90 border-zinc-300 text-zinc-400'
                : 'bg-zinc-900/70 border-zinc-700 text-zinc-500';
              separatorBg = inverted ? 'bg-zinc-300' : 'bg-zinc-700';
            } else if (isDimmedWrong) {
              barStyle = `${cardSurface} opacity-45`;
            }

            return (
              <div
                key={letter}
                onClick={() => onQuickAnswerClick?.(letter)}
                className={`rounded-[18px] border-[3.5px] px-4 py-2.5 flex items-center gap-3 transition-all duration-200 ${
                  onQuickAnswerClick ? 'cursor-pointer active:scale-[0.99]' : ''
                } ${barStyle}`}
              >
                <span className="w-6 text-center text-[22px] font-black leading-none shrink-0">
                  {letter}
                </span>

                <span className={`w-[2.5px] h-6 rounded-full shrink-0 ${separatorBg}`} />

                <span
                  className={`flex-1 text-[15.5px] font-extrabold leading-tight truncate ${
                    isEliminated ? 'line-through' : ''
                  }`}
                >
                  {text}
                </span>

                {isEliminated && (
                  <span className="text-[9.5px] font-black uppercase tracking-wider shrink-0">
                    ✕
                  </span>
                )}

                {isCorrect && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 ${
                      inverted ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'
                    }`}
                  >
                    ✓ Certa
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BOTTOM SECTION: "O que vale pro jogo?" Gift Box */}
      <div className={`relative z-10 px-4 pt-2 ${safeZoneBottom ? 'pb-14' : 'pb-4'}`}>
        <div
          className={`rounded-[22px] border-[3.5px] px-3.5 py-2.5 flex items-center gap-3 shadow-sm ${cardSurface}`}
        >
          <GiftSilhouetteIcon className="w-9 h-9 shrink-0" />

          <div className={`w-[2.5px] self-stretch rounded-full shrink-0 my-0.5 ${dividerColor}`} />

          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-black leading-tight mb-1">
              O que vale pro jogo?
            </div>

            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10.5px] font-bold leading-snug">
              {orderedPowers.map((power, idx) => {
                const effectText =
                  power.action === 'buyPoint' && (power.pointsAwarded || 1) > 1
                    ? `+${power.pointsAwarded} Pontos`
                    : power.shortLabel;
                return (
                  <React.Fragment key={power.action}>
                    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                      <span>{power.icon || '🎁'}</span>
                      <span>
                        {power.displayName || power.giftName} = {effectText}
                      </span>
                    </span>
                    {idx < orderedPowers.length - 1 && (
                      <span className="opacity-45 font-normal">|</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
