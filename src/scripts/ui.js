const FLOAT_POS_KEY = 'tinyflow-float-pos';
const COMPACT_KEY = 'tinyflow-compact';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function setupFloating(container, handle, resetBtn, statusEl, isDesktop = false, desktopApi = null) {
  if (isDesktop) {
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (desktopApi && desktopApi.snapToCorner) desktopApi.snapToCorner('top-left');
        setStatus(statusEl, 'Agganciato in alto a sinistra');
      });
    }
    setStatus(statusEl, 'Modalita desktop: Cmd+Option+Freccia');
    return;
  }

  const initial = loadSavedPosition();
  applyPosition(container, initial.x, initial.y);

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('pointerdown', (event) => {
    dragging = true;
    const rect = container.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    container.classList.add('dragging');
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const x = clamp(event.clientX - offsetX, 8, window.innerWidth - container.offsetWidth - 8);
    const y = clamp(event.clientY - offsetY, 8, window.innerHeight - container.offsetHeight - 8);
    applyPosition(container, x, y);
  });

  const stopDragging = () => {
    if (!dragging) return;
    dragging = false;
    container.classList.remove('dragging');
    savePosition(container);
    setStatus(statusEl, 'Posizione aggiornata');
  };

  handle.addEventListener('pointerup', stopDragging);
  handle.addEventListener('pointercancel', stopDragging);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyPosition(container, 16, 16);
      savePosition(container);
      setStatus(statusEl, 'Posizione resettata');
    });
  }

  window.addEventListener('resize', () => {
    const rect = container.getBoundingClientRect();
    const x = clamp(rect.left, 8, window.innerWidth - container.offsetWidth - 8);
    const y = clamp(rect.top, 8, window.innerHeight - container.offsetHeight - 8);
    applyPosition(container, x, y);
    savePosition(container);
  });
}

export function setupCompact(container, compactBtn, statusEl) {
  const saved = localStorage.getItem(COMPACT_KEY) === 'true';
  container.classList.toggle('compact', saved);
  compactBtn.textContent = saved ? '+' : '-';
  if (saved) setTimerTabActive();

  compactBtn.addEventListener('click', () => {
    const compact = !container.classList.contains('compact');
    container.classList.toggle('compact', compact);
    compactBtn.textContent = compact ? '+' : '-';
    localStorage.setItem(COMPACT_KEY, String(compact));
    if (compact) setTimerTabActive();
    setStatus(statusEl, compact ? 'Vista compatta' : 'Vista completa');
  });
}

export function setupTabs(tabButtons, panels, statusEl) {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      tabButtons.forEach((item) => item.classList.toggle('is-active', item === btn));
      panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === target));
      setStatus(statusEl, `Vista ${target}`);
    });
  });
}

export function setupCornerShortcuts(
  container,
  statusEl,
  isDesktop = false,
  desktopApi = null,
  isMoveLocked = () => false
) {
  document.addEventListener('keydown', (event) => {
    const validCombo = (event.ctrlKey && event.altKey) || (event.metaKey && event.altKey);
    if (!validCombo) return;
    const lockedByUi = document.body.classList.contains('widget-pinned');
    if (isMoveLocked() || lockedByUi) return;
    const corner = resolveCorner(event.key);
    if (!corner) return;
    event.preventDefault();

    if (isDesktop && desktopApi && desktopApi.snapToCorner) {
      desktopApi.snapToCorner(corner);
    } else {
      moveToCorner(container, corner);
      savePosition(container);
    }

    setStatus(statusEl, `Agganciato: ${humanCorner(corner)}`);
  });
}

function loadSavedPosition() {
  try {
    const raw = localStorage.getItem(FLOAT_POS_KEY);
    if (!raw) return { x: 16, y: 16 };
    const parsed = JSON.parse(raw);
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return { x: 16, y: 16 };
    return parsed;
  } catch (error) {
    return { x: 16, y: 16 };
  }
}

function savePosition(container) {
  localStorage.setItem(
    FLOAT_POS_KEY,
    JSON.stringify({ x: Math.round(container.offsetLeft), y: Math.round(container.offsetTop) })
  );
}

function applyPosition(container, x, y) {
  container.style.left = `${x}px`;
  container.style.top = `${y}px`;
}

function setStatus(statusEl, msg) {
  if (statusEl) statusEl.textContent = msg;
}

function resolveCorner(key) {
  if (key === 'ArrowUp') return 'top-left';
  if (key === 'ArrowRight') return 'top-right';
  if (key === 'ArrowDown') return 'bottom-right';
  if (key === 'ArrowLeft') return 'bottom-left';
  return null;
}

function moveToCorner(container, corner) {
  const padding = 8;
  const maxX = window.innerWidth - container.offsetWidth - padding;
  const maxY = window.innerHeight - container.offsetHeight - padding;
  if (corner === 'top-left') applyPosition(container, padding, padding);
  if (corner === 'top-right') applyPosition(container, maxX, padding);
  if (corner === 'bottom-right') applyPosition(container, maxX, maxY);
  if (corner === 'bottom-left') applyPosition(container, padding, maxY);
}

function humanCorner(corner) {
  if (corner === 'top-left') return 'alto sinistra';
  if (corner === 'top-right') return 'alto destra';
  if (corner === 'bottom-right') return 'basso destra';
  return 'basso sinistra';
}

function setTimerTabActive() {
  const tabs   = Array.from(document.querySelectorAll('.tab-icon'));
  const panels = Array.from(document.querySelectorAll('.panel'));
  tabs.forEach((item)  => item.classList.toggle('is-active', item.dataset.tab === 'timer'));
  panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === 'timer'));
}
