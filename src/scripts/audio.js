const STREAM_URL = 'https://usa9.fastcast4u.com/proxy/jamz?mp=/1';
const VOLUME_KEY = 'tinyflow-audio-volume';

export class AudioPlayer {
  constructor({ playBtn, volumeEl, statusEl }) {
    this.playBtn = playBtn;
    this.volumeEl = volumeEl;
    this.statusEl = statusEl;
    this.isPlaying = false;

    this.audio = new Audio(STREAM_URL);
    this.audio.crossOrigin = 'anonymous';
    this.audio.loop = true;
    this.audio.addEventListener('error', () => this.handleError());

    const persistedVolume = Number(localStorage.getItem(VOLUME_KEY));
    const initialVolume = Number.isFinite(persistedVolume) ? persistedVolume : Number(this.volumeEl.value);
    this.volumeEl.value = String(initialVolume);
    this.audio.volume = initialVolume;

    this.bind();
  }

  bind() {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.volumeEl.addEventListener('input', () => this.setVolume(Number(this.volumeEl.value)));
  }

  setVolume(vol) {
    const volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem(VOLUME_KEY, String(volume));
    this.audio.volume = volume;
  }

  async play() {
    try {
      await this.fadeStreamTo(0, 0);
      await this.audio.play();
      await this.fadeStreamTo(Number(this.volumeEl.value), 180);
      this.isPlaying = true;
      this.playBtn.classList.add('is-playing');
      this.playBtn.setAttribute('aria-label', 'Pause audio');
      this.playBtn.title = 'Pause';
      this.setStatus('Audio playing');
    } catch (e) {
      this.setStatus('Audio error');
    }
  }

  stop(immediate = false) {
    if (!this.isPlaying) return;
    if (immediate) {
      this.audio.pause();
    } else {
      this.fadeStreamTo(0.0001, 120).then(() => this.audio.pause());
    }
    this.isPlaying = false;
    this.playBtn.classList.remove('is-playing');
    this.playBtn.setAttribute('aria-label', 'Play audio');
    this.playBtn.title = 'Play';
    this.setStatus('Audio paused');
  }

  togglePlay() {
    if (!this.isPlaying) this.play();
    else this.stop();
  }

  async fadeStreamTo(target, durationMs) {
    const start = this.audio.volume;
    if (durationMs <= 0) {
      this.audio.volume = target;
      return;
    }
    const startTime = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const progress = Math.min(1, (now - startTime) / durationMs);
        this.audio.volume = start + (target - start) * progress;
        if (progress >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  handleError() {
    this.stop(true);
    this.setStatus('Ambient stream unavailable');
  }

  setStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}
