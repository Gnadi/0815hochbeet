import { useState } from 'react';

const STORAGE_KEY = 'hb_todos';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function persist(todos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export function useTodos() {
  const [todos, setTodos] = useState(() => load());

  function addTodo({ title, date, bedId }) {
    const t = {
      id: genId(),
      title: title.trim(),
      date,
      bedId: bedId || undefined,
      done: false,
      createdAt: new Date().toISOString(),
    };
    setTodos(prev => {
      const next = [...prev, t];
      persist(next);
      return next;
    });
    return t;
  }

  function toggleTodo(id) {
    setTodos(prev => {
      const next = prev.map(t => t.id === id ? { ...t, done: !t.done } : t);
      persist(next);
      return next;
    });
  }

  function deleteTodo(id) {
    setTodos(prev => {
      const next = prev.filter(t => t.id !== id);
      persist(next);
      return next;
    });
  }

  function todosForDate(dateStr) {
    return todos.filter(t => t.date === dateStr);
  }

  return { todos, addTodo, toggleTodo, deleteTodo, todosForDate };
}
