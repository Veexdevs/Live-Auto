class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ttsEnabled = false;
  }

  ensureCtx() {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq, duration = 0.14, type = 'sine', delay = 0, gainVal = 0.14) {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  play(effect) {
    if (!this.enabled) return;

    switch (effect) {
      case 'win':
        this.playTone(523.25, 0.14, 'triangle', 0, 0.16);
        this.playTone(659.25, 0.14, 'triangle', 0.09, 0.16);
        this.playTone(783.99, 0.25, 'triangle', 0.18, 0.18);
        break;

      case 'buypoint':
        this.playTone(880, 0.11, 'sine', 0, 0.16);
        this.playTone(1174.66, 0.28, 'sine', 0.09, 0.2);
        break;

      case 'eliminate':
        this.playTone(440, 0.12, 'sawtooth', 0, 0.11);
        this.playTone(311.13, 0.22, 'sawtooth', 0.09, 0.12);
        break;

      case 'hint':
        this.playTone(587.33, 0.12, 'sine', 0, 0.14);
        this.playTone(739.99, 0.12, 'sine', 0.08, 0.14);
        this.playTone(880, 0.14, 'sine', 0.16, 0.15);
        this.playTone(1174.66, 0.24, 'sine', 0.24, 0.16);
        break;

      case 'reveal':
        this.playTone(392.0, 0.15, 'triangle', 0, 0.15);
        this.playTone(493.88, 0.15, 'triangle', 0.11, 0.15);
        this.playTone(587.33, 0.15, 'triangle', 0.22, 0.15);
        this.playTone(783.99, 0.35, 'triangle', 0.33, 0.18);
        break;

      case 'skip':
        this.playTone(330, 0.1, 'sine', 0, 0.12);
        this.playTone(494, 0.1, 'sine', 0.07, 0.13);
        this.playTone(660, 0.18, 'sine', 0.14, 0.15);
        break;

      case 'tick':
        this.playTone(900, 0.045, 'sine', 0, 0.06);
        break;

      default:
        break;
    }
  }

  speakQuestion(questionObj) {
    if (!this.ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const opts = questionObj.options || {};
      const script = `${questionObj.question} Opção A: ${opts.A}. B: ${opts.B}. C: ${opts.C}. Ou D: ${opts.D}.`;
      const utter = new SpeechSynthesisUtterance(script);
      utter.lang = 'pt-BR';
      utter.rate = 1.08;
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find((v) => v.lang?.toLowerCase().startsWith('pt'));
      if (ptVoice) utter.voice = ptVoice;
      window.speechSynthesis.speak(utter);
    } catch {
      // ignore TTS browser restrictions
    }
  }
}

export const soundManager = new SoundManager();
