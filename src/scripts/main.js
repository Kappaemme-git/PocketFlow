import { Timer, formatTime } from './timer.js';
import { Todo } from './todo.js';
import { AudioPlayer } from './audio.js';
import { setupFloating, setupTabs, setupCornerShortcuts } from './ui.js';

const qs  = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

const isDesktop = Boolean(window.tinyflowEnv && window.tinyflowEnv.desktop);
const desktopApi = window.tinyflowDesktop || null;
let isPinnedDesktop = false;

const tinyflow = qs('#tinyflow');
const statusEl = null; // footer removed

// ── Tab icons + panels ─────────────────────
setupFloating(tinyflow, qs('#drag-handle'), null, statusEl, isDesktop, desktopApi);
setupTabs(qsa('.tab-icon'), qsa('.panel'), statusEl);         // ← icon buttons now
setupCornerShortcuts(tinyflow, statusEl, isDesktop, desktopApi, () => isDesktop && isPinnedDesktop);

if (isDesktop) {
  document.body.classList.add('desktop-app');
  bindWindowControls();
  bindPinControl();
}

ensureNotificationPermission();
bindQuickAddShortcut();

// ── Window controls ────────────────────────
function bindWindowControls() {
  if (!desktopApi?.windowControl) return;
  qs('#win-close')?.addEventListener('click', () => desktopApi.windowControl('close'));
  qs('#win-min')?.addEventListener('click', () => desktopApi.windowControl('minimize'));
}

async function bindPinControl() {
  const pinBtn = qs('#win-pin');
  if (!pinBtn || !desktopApi?.togglePin || !desktopApi?.getPinState) return;

  const state = await desktopApi.getPinState();
  isPinnedDesktop = Boolean(state);
  applyPin(pinBtn, isPinnedDesktop);

  pinBtn.addEventListener('click', async () => {
    const pinned = await desktopApi.togglePin();
    isPinnedDesktop = Boolean(pinned);
    applyPin(pinBtn, isPinnedDesktop);
  });
}

function applyPin(btn, pinned) {
  btn.classList.toggle('is-active', Boolean(pinned));
  btn.setAttribute('aria-label', pinned ? 'widget bloccato' : 'blocca widget');
  btn.title = pinned ? 'Bloccato' : 'Fissa widget';
  document.body.classList.toggle('widget-pinned', Boolean(pinned));
}

async function ensureNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'default') return;
  try {
    await Notification.requestPermission();
  } catch (_error) {
    // ignore permission prompt failures
  }
}

async function notifyTimerDone() {
  try {
    await desktopApi?.notifyTimerDone?.({
      title: 'PocketFlow',
      body: 'Focus session finished.',
    });
  } catch (_error) {
    // ignore desktop notification bridge failures
  }

  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    await ensureNotificationPermission();
  }
  if (Notification.permission === 'granted') {
    new Notification('PocketFlow', {
      body: 'Focus session finished.',
      silent: false,
    });
  }
}

// ── Timer ──────────────────────────────────
const mmEl        = qs('#timer-mm');
const ssEl        = qs('#timer-ss');
const bar         = qs('#progress-bar');
const customMinutes = qs('#custom-min');
const timerPanel  = qs('[data-panel="timer"]');
const timerStatePill = qs('#timer-state-pill');
const timerOrbit  = qs('.timer-display-orbit');
const startBtn    = qs('#start-btn');
const pauseBtn    = qs('#pause-btn');
const resetBtn    = qs('#reset-btn');

const timer = new Timer({
  onTick: (remaining, total) => {
    const ratio = total === 0 ? 0 : remaining / total;
    const [mm, ss] = formatTime(remaining).split(':');
    mmEl.textContent = mm;
    ssEl.textContent = ss;
    bar.style.width = `${ratio * 100}%`;
    bar.style.background = ratio <= 0.1 ? 'var(--orange)' : 'var(--accent)';
    timerOrbit?.style.setProperty('--timer-progress', String(ratio));
  },
  onDone: () => {
    syncTimerUi('idle');
    notifyTimerDone();
    if (qs('#auto-pause')?.checked) audio.stop();
  },
  statusEl,
});

function syncTimerUi(state = 'idle') {
  timerPanel?.setAttribute('data-timer-state', state);
  if (timerStatePill) {
    timerStatePill.textContent =
      state === 'running' ? 'Running' :
      state === 'paused' ? 'Paused' :
      'Ready';
  }
  startBtn?.classList.toggle('is-active', state === 'running');
  pauseBtn?.classList.toggle('is-active', state === 'paused');
}

startBtn.addEventListener('click', () => {
  timer.start();
  syncTimerUi('running');
  if (qs('#auto-play')?.checked && !audio.isPlaying) audio.play();
});
pauseBtn.addEventListener('click', () => {
  timer.pause();
  syncTimerUi('paused');
});
resetBtn.addEventListener('click', () => {
  timer.reset();
  syncTimerUi('idle');
});

function applyCustomMinutes() {
  if (!customMinutes) return;
  const parsed = Number(customMinutes.value);
  const minutes = Number.isFinite(parsed) ? Math.max(1, Math.min(999, Math.round(parsed))) : 25;
  customMinutes.value = String(minutes);
  timer.setDuration(minutes * 60);
  timer.reset();
  syncTimerUi('idle');
}

customMinutes?.addEventListener('change', applyCustomMinutes);
customMinutes?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    applyCustomMinutes();
    customMinutes.blur();
  }
});

document.addEventListener('keydown', (e) => {
  const target = e.target;
  const isTypingField = target instanceof HTMLElement && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );

  if (!isTypingField && e.code === 'Space') {
    e.preventDefault();
    const activePanel = document.querySelector('.panel.is-active')?.dataset.panel;
    if (activePanel === 'audio') {
      audio.togglePlay();
    } else if (timer.running) {
      timer.pause();
      syncTimerUi('paused');
    } else {
      timer.start();
      syncTimerUi('running');
      if (qs('#auto-play')?.checked && !audio.isPlaying) audio.play();
    }
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    timer.reset();
    syncTimerUi('idle');
  }
});

syncTimerUi('idle');

// ── Confirm dialog ─────────────────────────
const confirmDialog  = qs('#confirm-dialog');
const confirmBody    = qs('#confirm-body');
const confirmOk      = qs('#confirm-ok');
const confirmCancel  = qs('#confirm-cancel');
let   confirmCb      = null;

function showConfirm(message, onOk) {
  confirmBody.textContent = message;
  confirmCb = onOk;
  confirmDialog.hidden = false;
}

confirmOk.addEventListener('click', () => {
  confirmDialog.hidden = true;
  confirmCb?.();
  confirmCb = null;
});
confirmCancel.addEventListener('click', () => {
  confirmDialog.hidden = true;
  confirmCb = null;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !confirmDialog.hidden) {
    confirmDialog.hidden = true;
    confirmCb = null;
  }
});

// ── Todo + popup ───────────────────────────
const todo = new Todo({
  listEl:          qs('#todo-list'),
  inputEl:         qs('#todo-input'),
  statusEl,
  priorityEl:      qs('#todo-priority'),
  todayEl:         qs('#todo-today'),
  filterButtons:   qsa('.todo-filters [data-filter]'),
  onDeleteRequest: (id, text, doRemove) => {
    showConfirm(`Delete "${text}"?`, doRemove);
  },
});

qs('#clear-done').addEventListener('click', () => {
  if (!todo.todos.length) return;
  showConfirm('Delete all tasks? This cannot be undone.', () => todo.clearAll());
});

// Popup state
const taskPopup   = qs('#task-popup');
const popupText   = qs('#task-popup-text');
const prioButtons = qsa('.prio-btn');
let selectedPrio  = 'med';

// Open popup
qs('#add-task-btn').addEventListener('click', openPopup);

// Priority picker
prioButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    prioButtons.forEach((b) => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    selectedPrio = btn.dataset.prio;
  });
});

// Close
qs('#task-popup-close').addEventListener('click', closePopup);
taskPopup.addEventListener('click', (e) => { if (e.target === taskPopup) closePopup(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !taskPopup.hidden) closePopup(); });

// Submit
qs('#task-popup-submit').addEventListener('click', submitPopup);
popupText.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPopup(); });

function openPopup() {
  // Switch to todo tab if needed
  const todoIcon = qs('.tab-icon[data-tab="todo"]');
  if (!todoIcon.classList.contains('is-active')) todoIcon.click();

  taskPopup.hidden = false;
  requestAnimationFrame(() => popupText.focus());
}

function closePopup() {
  taskPopup.hidden = true;
  popupText.value  = '';
  selectedPrio     = 'med';
  prioButtons.forEach((b) => b.classList.toggle('is-selected', b.dataset.prio === 'med'));
}

function submitPopup() {
  const text = popupText.value.trim();
  if (!text) { popupText.focus(); return; }
  // Bridge to Todo class via hidden elements
  qs('#todo-priority').value = selectedPrio;
  qs('#todo-today').checked  = true;       // always "today" bucket
  qs('#todo-input').value    = text;
  qs('#todo-form').dispatchEvent(new Event('submit', { bubbles: true }));
  closePopup();
}

// ── Audio ──────────────────────────────────
const audio = new AudioPlayer({
  playBtn:       qs('#play-btn'),
  volumeEl:      qs('#volume'),
  statusEl,
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.stop();
});

// ── Quick-add shortcut ─────────────────────
function bindQuickAddShortcut() {
  document.addEventListener('keydown', (e) => {
    const isQA = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a';
    if (!isQA) return;
    e.preventDefault();
    openPopup();
    statusEl.textContent = 'Quick add attivo';
  });
}
