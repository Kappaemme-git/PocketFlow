const STORAGE_KEY = 'tinyflow-todos';
const FILTER_KEY = 'tinyflow-todos-filter';

const PRIORITY_WEIGHT = { high: 0, med: 1, low: 2 };

export class Todo {
  constructor({ listEl, inputEl, statusEl, priorityEl, todayEl, filterButtons, onDeleteRequest }) {
    this.listEl = listEl;
    this.inputEl = inputEl;
    this.statusEl = statusEl;
    this.priorityEl = priorityEl;
    this.todayEl = todayEl;
    this.filterButtons = filterButtons;
    this.onDeleteRequest = onDeleteRequest || null;
    this.filter = localStorage.getItem(FILTER_KEY) || 'all';
    this.todos = this.load();
    this.bind();
    this.render();
  }

  bind() {
    this.inputEl.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask(this.inputEl.value.trim());
    });

    this.filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.filter = btn.dataset.filter || 'all';
        localStorage.setItem(FILTER_KEY, this.filter);
        this.render();
      });
    });
  }

  addTask(text) {
    if (!text) return;
    this.todos.push({
      id: crypto.randomUUID(),
      text,
      done: false,
      priority: this.priorityEl?.value || 'med',
      bucket: this.todayEl?.checked ? 'today' : 'later',
      createdAt: Date.now(),
    });
    this.inputEl.value = '';
    this.persist();
    this.render();
    this.setStatus('Task added');
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return parsed.map((item) => ({
        id: item.id || crypto.randomUUID(),
        text: item.text || '',
        done: Boolean(item.done),
        priority: ['high', 'med', 'low'].includes(item.priority) ? item.priority : 'med',
        bucket: item.bucket === 'later' ? 'later' : 'today',
        createdAt: Number(item.createdAt) || Date.now(),
      }));
    } catch (e) {
      return [];
    }
  }

  persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.todos));
  }

  toggle(id) {
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    this.persist();
    this.render();
  }

  remove(id) {
    this.todos = this.todos.filter((t) => t.id !== id);
    this.persist();
    this.render();
  }

  clearDone() {
    this.todos = this.todos.filter((t) => !t.done);
    this.persist();
    this.render();
  }

  clearAll() {
    this.todos = [];
    this.persist();
    this.render();
  }

  cyclePriority(id) {
    const next = { high: 'med', med: 'low', low: 'high' };
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, priority: next[t.priority] } : t));
    this.persist();
    this.render();
  }

  toggleBucket(id) {
    this.todos = this.todos.map((t) => (t.id === id ? { ...t, bucket: t.bucket === 'today' ? 'later' : 'today' } : t));
    this.persist();
    this.render();
  }

  reorder(fromId, toId) {
    if (this.filter !== 'all' || fromId === toId) return;
    const fromIndex = this.todos.findIndex((t) => t.id === fromId);
    const toIndex = this.todos.findIndex((t) => t.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [item] = this.todos.splice(fromIndex, 1);
    this.todos.splice(toIndex, 0, item);
    this.persist();
    this.render();
  }

  getVisibleTodos() {
    let visible = this.todos;
    if (this.filter === 'today') visible = visible.filter((t) => t.bucket === 'today');
    if (this.filter === 'later') visible = visible.filter((t) => t.bucket === 'later');
    return [...visible].sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.bucket !== b.bucket) return a.bucket === 'today' ? -1 : 1;
      if (PRIORITY_WEIGHT[a.priority] !== PRIORITY_WEIGHT[b.priority]) {
        return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      }
      return a.createdAt - b.createdAt;
    });
  }

  render() {
    this.listEl.innerHTML = '';
    this.filterButtons.forEach((btn) => {
      btn.classList.toggle('is-active', (btn.dataset.filter || 'all') === this.filter);
    });

    const visible = this.getVisibleTodos();
    if (!visible.length) {
      const empty = document.createElement('li');
      empty.textContent = 'No tasks yet';
      empty.className = 'todo-empty';
      this.listEl.appendChild(empty);
      return;
    }

    visible.forEach((todo) => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.done ? 'done' : ''}`;
      li.draggable = this.filter === 'all';
      li.dataset.id = todo.id;

      const checkbox = document.createElement('button');
      checkbox.className = 'checkbox' + (todo.done ? ' checked' : '');
      checkbox.setAttribute('aria-label', todo.done ? 'segna incompleto' : 'segna completato');
      checkbox.addEventListener('click', () => this.toggle(todo.id));

      const content = document.createElement('div');
      content.className = 'todo-content';
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = todo.text;
      const chips = document.createElement('div');
      chips.className = 'todo-chips';

      const prio = document.createElement('button');
      prio.className = `chip priority ${todo.priority}`;
      prio.textContent = todo.priority.toUpperCase();
      prio.title = 'Change priority';
      prio.addEventListener('click', () => this.cyclePriority(todo.id));

      const bucket = document.createElement('button');
      bucket.className = `chip bucket ${todo.bucket}`;
      bucket.textContent = todo.bucket === 'today' ? 'Today' : 'Later';
      bucket.title = 'Toggle bucket';
      bucket.addEventListener('click', () => this.toggleBucket(todo.id));

      // Text row: priority dot inline before text
      const textRow = document.createElement('div');
      textRow.className = 'todo-text-row';
      textRow.append(prio, text);

      chips.append(bucket); // bucket is hidden via CSS, kept as JS hook
      content.append(textRow, chips);

      const del = document.createElement('button');
      del.className = 'delete';
      del.textContent = 'x';
      del.setAttribute('aria-label', 'delete task');
      del.addEventListener('click', () => {
        if (this.onDeleteRequest) {
          this.onDeleteRequest(todo.id, todo.text, () => this.remove(todo.id));
        } else {
          this.remove(todo.id);
        }
      });

      li.append(checkbox, content, del);
      this.listEl.appendChild(li);
    });

    this.attachDnD();
  }

  attachDnD() {
    if (this.filter !== 'all') return;
    const items = Array.from(this.listEl.querySelectorAll('.todo-item'));
    let draggingId = null;

    items.forEach((item) => {
      item.addEventListener('dragstart', () => {
        draggingId = item.dataset.id;
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetId = item.dataset.id;
        if (draggingId && draggingId !== targetId) {
          this.reorder(draggingId, targetId);
          draggingId = targetId;
        }
      });
    });
  }

  setStatus(msg) {
    if (this.statusEl) this.statusEl.textContent = msg;
  }
}
