// Observable store for the task list: hand-written to-dos plus the completion
// state of auto-generated ones. Kept outside React so every screen sees the
// same list without prop drilling or stale localStorage reads.

const TODO_KEY = 'hb_todos';
const DONE_KEY = 'hb_auto_done';

const listeners = new Set();
let todoCache = null;
let doneCache = null;

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function emit() {
  todoCache = read(TODO_KEY, '[]');
  doneCache = read(DONE_KEY, '{}');
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function subscribeTasks(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getTodos() {
  if (todoCache === null) todoCache = read(TODO_KEY, '[]');
  return todoCache;
}

export function getAutoDone() {
  if (doneCache === null) doneCache = read(DONE_KEY, '{}');
  return doneCache;
}

export function addTodo({ title, date, bedId, plantId, detail }) {
  const t = {
    id: genId(),
    title: String(title || '').trim(),
    date,
    bedId: bedId || undefined,
    plantId: plantId || undefined,
    detail: detail || undefined,
    kind: 'manual',
    done: false,
    createdAt: new Date().toISOString(),
  };
  if (!t.title) return null;
  write(TODO_KEY, [...getTodos(), t]);
  emit();
  return t;
}

export function updateTodo(id, patch) {
  write(TODO_KEY, getTodos().map(t => (t.id === id ? { ...t, ...patch } : t)));
  emit();
}

export function deleteTodo(id) {
  write(TODO_KEY, getTodos().filter(t => t.id !== id));
  emit();
}

/** Works for both manual todos and generated ones (ids prefixed `auto:`). */
export function toggleTask(id) {
  if (id.startsWith('auto:')) {
    const done = { ...getAutoDone() };
    if (done[id]) delete done[id]; else done[id] = new Date().toISOString();
    write(DONE_KEY, done);
  } else {
    write(TODO_KEY, getTodos().map(t => (t.id === id ? { ...t, done: !t.done } : t)));
  }
  emit();
}

/** Drops completion flags for generated tasks older than 60 days. */
export function pruneAutoDone() {
  const cutoff = Date.now() - 60 * 86400000;
  const done = getAutoDone();
  const next = Object.fromEntries(
    Object.entries(done).filter(([, at]) => new Date(at).getTime() > cutoff),
  );
  if (Object.keys(next).length !== Object.keys(done).length) {
    write(DONE_KEY, next);
    emit();
  }
}
