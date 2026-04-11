const pad = (n) => String(n).padStart(2, '0');

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.34, now + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    master.connect(ctx.destination);

    const strikes = [0, 0.32, 0.68];
    const partials = [
      { freq: 1046.5, gain: 0.18, decay: 1.7 },
      { freq: 1568.0, gain: 0.12, decay: 2.2 },
      { freq: 2093.0, gain: 0.08, decay: 1.4 },
      { freq: 784.0,  gain: 0.06, decay: 2.4 },
    ];

    strikes.forEach((offset, index) => {
      const strikeAt = now + offset;
      partials.forEach(({ freq, gain, decay }) => {
        const osc = ctx.createOscillator();
        const partialGain = ctx.createGain();
        osc.type = index === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, strikeAt);
        partialGain.gain.setValueAtTime(0.0001, strikeAt);
        partialGain.gain.exponentialRampToValueAtTime(gain, strikeAt + 0.02);
        partialGain.gain.exponentialRampToValueAtTime(0.0001, strikeAt + decay);
        osc.connect(partialGain).connect(master);
        osc.start(strikeAt);
        osc.stop(strikeAt + decay + 0.05);
      });
    });
  } catch (e) {
    // ignore audio failures
  }
}

export class Timer {
  constructor({ onTick, onDone, statusEl }) {
    this.total = 1500; // default 25m
    this.remaining = this.total;
    this.interval = null;
    this.onTick = onTick;
    this.onDone = onDone;
    this.statusEl = statusEl;
    this.running = false;
  }

  setDuration(seconds) {
    this.total = seconds;
    this.remaining = seconds;
    this.onTick(this.remaining, this.total);
    this.setStatus('Durata impostata');
  }

  start() {
    if (this.running) return;
    if (this.remaining <= 0) this.remaining = this.total;
    this.running = true;
    this.setStatus('Timer in corso');
    this.interval = setInterval(() => {
      this.remaining -= 1;
      if (this.remaining <= 0) {
        this.finish();
      } else {
        this.onTick(this.remaining, this.total);
      }
    }, 1000);
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.interval);
    this.setStatus('In pausa');
  }

  reset() {
    clearInterval(this.interval);
    this.running = false;
    this.remaining = this.total;
    this.onTick(this.remaining, this.total);
    this.setStatus('Reset');
  }

  finish() {
    clearInterval(this.interval);
    this.running = false;
    this.remaining = 0;
    this.onTick(this.remaining, this.total);
    this.setStatus('Sessione terminata');
    playBeep();
    this.onDone?.();
  }

  setStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}

export function formatTime(seconds) {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${pad(mm)}:${pad(ss)}`;
}
