import React, { useEffect, useState, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX, Mic, MicOff, Maximize2, Minimize2 } from 'lucide-react';

import LiveOverlayScreen from './components/LiveOverlayScreen.jsx';
import StudioControlPanel from './components/StudioControlPanel.jsx';
import { soundManager } from './utils/soundEffects.js';
import { executeOpenRouterBridge } from './utils/aiBridge.js';

export default function App() {
  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const isOverlayRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/overlay') ||
      searchParams.get('mode') === 'overlay');

  const urlTikTokUser = searchParams.get('user') || '';

  const [quizState, setQuizState] = useState(null);
  const [tiktokStatus, setTiktokStatus] = useState({});
  const [aiStatus, setAiStatus] = useState({});
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [serverClockOffset, setServerClockOffset] = useState(0);

  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTtsOn] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(isOverlayRoute);

  const seenAlertIdRef = useRef(null);
  const alertTimerRef = useRef(null);
  const lastSpokenQuestionIdRef = useRef(null);
  const bridgeBusyRef = useRef(false);
  const workerSourceRef = useRef(null);

  const role = isOverlayRoute ? 'overlay' : 'studio';

  useEffect(() => {
    soundManager.enabled = soundOn;
  }, [soundOn]);

  useEffect(() => {
    soundManager.ttsEnabled = ttsOn;
    if (ttsOn && quizState?.question) {
      soundManager.speakQuestion(quizState.question);
      lastSpokenQuestionIdRef.current = quizState.question.id;
    }
  }, [ttsOn]);

  const applyServerPayload = useCallback((data) => {
    if (!data) return;

    if (typeof data.serverNow === 'number') {
      setServerClockOffset(data.serverNow - Date.now());
    }

    if (data.quizState) {
      setQuizState(data.quizState);

      if (Array.isArray(data.quizState.recentFeed)) {
        setFeedItems(data.quizState.recentFeed);
      }

      const incomingAlert = data.quizState.latestAlert;
      if (incomingAlert && incomingAlert.id !== seenAlertIdRef.current) {
        seenAlertIdRef.current = incomingAlert.id;
        setActiveAlert(incomingAlert);

        if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => {
          setActiveAlert(null);
        }, 3800);

        if (incomingAlert.sound) {
          soundManager.play(incomingAlert.sound);
        }

        if (
          incomingAlert.type === 'correct' ||
          incomingAlert.type === 'buypoint' ||
          incomingAlert.type === 'reveal'
        ) {
          try {
            confetti({
              particleCount: 45,
              spread: 60,
              origin: { y: 0.55 },
            });
          } catch {
            // ignore canvas errors
          }
        }
      }
    }

    if (data.tiktokStatus) {
      setTiktokStatus(data.tiktokStatus);
    }

    if (data.aiStatus) {
      setAiStatus(data.aiStatus);
    }

    if (Array.isArray(data.giftCatalog)) {
      setGiftCatalog(data.giftCatalog);
    }
  }, []);

  const sendAction = useCallback(
    async (type, payload = {}) => {
      try {
        const res = await fetch(`/api/action?role=${role}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        });
        const data = await res.json();
        if (data?.ok) {
          applyServerPayload(data);
        }
        return data;
      } catch (err) {
        console.warn('[Action Error]', err);
        return { ok: false };
      }
    },
    [role, applyServerPayload]
  );

  // Continuous state polling (lightweight & serverless-friendly)
  useEffect(() => {
    let active = true;
    let firstFetch = true;

    const poll = async () => {
      try {
        const userParam =
          firstFetch && urlTikTokUser
            ? `&user=${encodeURIComponent(urlTikTokUser)}`
            : '';
        firstFetch = false;
        const res = await fetch(`/api/state?role=${role}${userParam}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active) {
          applyServerPayload(data);
        }
      } catch {
        // ignore transient poll error
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [role, urlTikTokUser, applyServerPayload]);

  // Automatic SSE TikTok Live Worker (auto-connects & auto-reconnects when a TikTok @username is configured)
  useEffect(() => {
    const shouldRunWorker =
      Boolean(tiktokStatus?.username) && tiktokStatus?.autoConnect !== false;

    if (!shouldRunWorker) {
      if (workerSourceRef.current) {
        workerSourceRef.current.close();
        workerSourceRef.current = null;
      }
      return;
    }

    if (workerSourceRef.current || tiktokStatus?.workerActive) {
      return;
    }

    let reconnectTimeout = null;
    let cancelled = false;

    const connectWorker = () => {
      if (cancelled || workerSourceRef.current) return;
      const es = new EventSource(`/api/tiktok-worker?role=${role}`);
      workerSourceRef.current = es;

      es.addEventListener('state', (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          applyServerPayload(parsed);
        } catch {
          // ignore
        }
      });

      const handleEnd = () => {
        es.close();
        if (workerSourceRef.current === es) {
          workerSourceRef.current = null;
        }
        if (!cancelled) {
          reconnectTimeout = setTimeout(connectWorker, 1500);
        }
      };

      es.addEventListener('cycle', handleEnd);
      es.addEventListener('standby', () => {
        es.close();
        if (workerSourceRef.current === es) {
          workerSourceRef.current = null;
        }
      });
      es.onerror = handleEnd;
    };

    connectWorker();

    return () => {
      cancelled = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (workerSourceRef.current) {
        workerSourceRef.current.close();
        workerSourceRef.current = null;
      }
    };
  }, [
    tiktokStatus?.username,
    tiktokStatus?.autoConnect,
    tiktokStatus?.workerActive,
    role,
    applyServerPayload,
  ]);

  // Browser AI Bridge fallback ONLY when running inside network-restricted local sandbox
  useEffect(() => {
    const job = aiStatus?.bridgeJob;
    if (!job || bridgeBusyRef.current) return;

    bridgeBusyRef.current = true;
    executeOpenRouterBridge(job)
      .then((res) => {
        if (res?.content) {
          return sendAction('ai:push_question', {
            content: res.content,
            model: res.model,
          });
        }
      })
      .finally(() => {
        setTimeout(() => {
          bridgeBusyRef.current = false;
        }, 1200);
      });
  }, [aiStatus?.bridgeJob, sendAction]);

  // Speak new question if Narrator Voice is ON
  useEffect(() => {
    const q = quizState?.question;
    if (q?.id && q.id !== lastSpokenQuestionIdRef.current) {
      lastSpokenQuestionIdRef.current = q.id;
      if (ttsOn) {
        soundManager.speakQuestion(q);
      }
    }
  }, [quizState?.question?.id, ttsOn]);

  // Pure 9:16 OBS / TikTok Live Studio Overlay Mode (/overlay)
  if (isOverlayRoute) {
    const forceTransparent =
      searchParams.get('bg') === 'transparent' ||
      Boolean(quizState?.config?.transparentBg);
    const inverted = quizState?.config?.invertedTheme !== false;

    return (
      <div
        className={`w-screen h-screen flex items-center justify-center overflow-hidden ${
          forceTransparent
            ? 'bg-transparent'
            : inverted
            ? 'bg-white'
            : 'bg-black'
        }`}
      >
        <div className="h-full aspect-[9/16] max-w-full">
          <LiveOverlayScreen
            quizState={
              forceTransparent
                ? {
                    ...quizState,
                    config: { ...(quizState?.config || {}), transparentBg: true },
                  }
                : quizState
            }
            serverClockOffset={serverClockOffset}
            activeAlert={activeAlert}
            fullBleed
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-zinc-100 text-zinc-950 overflow-x-hidden">
      {/* Studio Top Bar */}
      <header className="px-4 py-2.5 border-b-2 border-zinc-900 bg-white flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-950 text-white flex items-center justify-center font-black text-sm">
            Q
          </div>
          <div>
            <span className="font-black text-sm tracking-tight text-zinc-950">
              TikTok Live Auto Quiz
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full bg-zinc-950 text-white text-[10px] font-bold">
              IA OpenRouter • Automação Total
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold transition cursor-pointer ${
              soundOn
                ? 'bg-zinc-950 border-zinc-950 text-white'
                : 'bg-white border-zinc-300 text-zinc-500'
            }`}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundOn ? 'Sons ON' : 'Sons OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setTtsOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold transition cursor-pointer ${
              ttsOn
                ? 'bg-zinc-950 border-zinc-950 text-white'
                : 'bg-white border-zinc-300 text-zinc-500'
            }`}
          >
            {ttsOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{ttsOn ? 'Voz ON' : 'Narrador Voz'}</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewOnly((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 border-2 border-zinc-950 text-xs font-extrabold transition cursor-pointer"
          >
            {previewOnly ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" /> Mostrar Painel
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" /> Focar Tela 9:16
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-5 overflow-y-auto lg:overflow-hidden">
        {/* Left: 9:16 Vertical TikTok Live Screen (Inverted White + Black Grid!) */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div
            className={
              previewOnly
                ? 'h-[calc(100vh-84px)] aspect-[9/16] max-w-full'
                : 'w-[340px] sm:w-[375px] lg:w-auto lg:h-[calc(100vh-84px)] lg:max-h-[820px] aspect-[9/16]'
            }
          >
            <LiveOverlayScreen
              quizState={quizState}
              serverClockOffset={serverClockOffset}
              activeAlert={activeAlert}
              onQuickAnswerClick={(letter) => {
                sendAction('simulate:chat', {
                  uniqueId: 'teste_rapido',
                  nickname: 'Teste Rápido',
                  comment: letter,
                });
              }}
            />
          </div>
        </div>

        {/* Right: Streamer Control & Automation Panel */}
        {!previewOnly && (
          <div className="w-full max-w-3xl flex-1 min-h-[540px] lg:min-h-0 lg:h-full">
            <StudioControlPanel
              onAction={sendAction}
              quizState={quizState}
              tiktokStatus={tiktokStatus}
              aiStatus={aiStatus}
              giftCatalog={giftCatalog}
              feedItems={feedItems}
            />
          </div>
        )}
      </main>
    </div>
  );
}
