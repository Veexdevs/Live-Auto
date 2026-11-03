import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { Volume2, VolumeX, Mic, MicOff, Maximize2, Minimize2 } from 'lucide-react';

import LiveOverlayScreen from './components/LiveOverlayScreen.jsx';
import StudioControlPanel from './components/StudioControlPanel.jsx';
import { soundManager } from './utils/soundEffects.js';
import { executeOpenRouterBridge } from './utils/aiBridge.js';

export default function App() {
  const isOverlayRoute =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/overlay') ||
      new URLSearchParams(window.location.search).get('mode') === 'overlay');

  const [socket, setSocket] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [tiktokStatus, setTiktokStatus] = useState({});
  const [aiStatus, setAiStatus] = useState({});
  const [giftCatalog, setGiftCatalog] = useState([]);
  const [feedItems, setFeedItems] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);

  const [soundOn, setSoundOn] = useState(true);
  const [ttsOn, setTtsOn] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(isOverlayRoute);

  const alertTimeoutRef = useRef(null);
  const lastSpokenQuestionIdRef = useRef(null);
  const prevTimeRef = useRef(null);

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

  useEffect(() => {
    const role = isOverlayRoute ? 'overlay' : 'studio';
    const s = io({
      query: { role },
      transports: ['websocket', 'polling'],
    });

    setSocket(s);

    s.on('quiz:state', (st) => {
      setQuizState(st);
      if (Array.isArray(st?.recentFeed)) {
        setFeedItems((prev) => (prev.length === 0 ? st.recentFeed : prev));
      }
    });

    s.on('tiktok:status', (st) => {
      setTiktokStatus(st);
    });

    s.on('ai:status', (st) => {
      setAiStatus(st);
    });

    s.on('gift:catalog', (cat) => {
      setGiftCatalog(cat || []);
    });

    s.on('quiz:feed', (item) => {
      setFeedItems((prev) => [item, ...prev].slice(0, 50));
    });

    s.on('quiz:alert', (alert) => {
      setActiveAlert(alert);
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      alertTimeoutRef.current = setTimeout(() => {
        setActiveAlert(null);
      }, 4200);

      if (alert?.sound) {
        soundManager.play(alert.sound);
      }

      if (
        alert?.type === 'correct' ||
        alert?.type === 'buypoint' ||
        alert?.type === 'reveal'
      ) {
        try {
          confetti({
            particleCount: alert.type === 'buypoint' ? 55 : 40,
            spread: 65,
            origin: { y: 0.55 },
          });
        } catch {
          // ignore confetti canvas issues
        }
      }
    });

    s.on('ai:bridge:request', async ({ reqId, messages, modelCandidates, apiKey }) => {
      const result = await executeOpenRouterBridge({
        messages,
        modelCandidates,
        apiKey,
      });
      s.emit('ai:bridge:response', {
        reqId,
        ...result,
      });
    });

    s.on('connect', () => {
      s.emit('ai:bridge:ready');
    });

    return () => {
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
      s.disconnect();
    };
  }, [isOverlayRoute]);

  // Speak new question if TTS narrator is enabled & play urgent countdown ticks
  useEffect(() => {
    const q = quizState?.question;
    if (q?.id && q.id !== lastSpokenQuestionIdRef.current) {
      lastSpokenQuestionIdRef.current = q.id;
      if (ttsOn) {
        soundManager.speakQuestion(q);
      }
    }

    const t = quizState?.timeRemaining;
    if (
      quizState?.phase === 'ACTIVE' &&
      typeof t === 'number' &&
      t <= 5 &&
      t > 0 &&
      t !== prevTimeRef.current
    ) {
      soundManager.play('tick');
    }
    prevTimeRef.current = t;
  }, [quizState?.question?.id, quizState?.timeRemaining, quizState?.phase, ttsOn]);

  // Pure OBS / TikTok Live Studio Overlay Mode (/overlay)
  if (isOverlayRoute) {
    const forceTransparent =
      new URLSearchParams(window.location.search).get('bg') === 'transparent' ||
      Boolean(quizState?.config?.transparentBg);

    return (
      <div
        className={`w-screen h-screen flex items-center justify-center overflow-hidden ${
          forceTransparent ? 'bg-transparent' : 'bg-[#05060f]'
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
            tiktokStatus={tiktokStatus}
            activeAlert={activeAlert}
            fullBleed
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#05060f] text-white overflow-x-hidden">
      {/* Studio Top Utility Bar */}
      <header className="px-4 py-2.5 border-b border-white/10 bg-slate-950/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-600 flex items-center justify-center font-black text-slate-950 text-sm shadow-lg shadow-cyan-500/20">
            Q
          </div>
          <div>
            <span className="font-black text-sm tracking-tight">
              TikTok Live Auto Quiz
            </span>
            <span className="hidden sm:inline-block ml-2 px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-[10px] font-bold text-cyan-300">
              IA OpenRouter • Automático
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              soundOn
                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundOn ? 'Sons ON' : 'Sons OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setTtsOn((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              ttsOn
                ? 'bg-fuchsia-500/20 border-fuchsia-400/45 text-fuchsia-200'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
          >
            {ttsOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {ttsOn ? 'Voz IA ON' : 'Narrador Voz'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewOnly((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold transition cursor-pointer"
          >
            {previewOnly ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-cyan-300" /> Mostrar Painel
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-cyan-300" /> Focar Tela Live
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace: 9:16 Live Screen + Streamer Control Panel */}
      <main className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-4 overflow-y-auto lg:overflow-hidden">
        {/* Left / Center: 9:16 Vertical TikTok Live Screen */}
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
              tiktokStatus={tiktokStatus}
              activeAlert={activeAlert}
              onQuickAnswerClick={(letter) => {
                socket?.emit('simulate:chat', {
                  uniqueId: 'teste_rapido',
                  nickname: 'Teste Rápido',
                  comment: letter,
                });
              }}
            />
          </div>
        </div>

        {/* Right: Streamer Control & Simulator Panel */}
        {!previewOnly && (
          <div className="w-full max-w-3xl flex-1 min-h-[540px] lg:min-h-0 lg:h-full">
            <StudioControlPanel
              socket={socket}
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
