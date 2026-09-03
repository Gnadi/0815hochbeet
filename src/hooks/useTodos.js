import { useMemo, useSyncExternalStore } from 'react';
import {
  addTodo, deleteTodo, getAutoDone, getTodos, subscribeTasks, toggleTask, updateTodo,
} from '../lib/tasks';
import { generateTasks, toDateStr, weekRange } from '../utils/taskEngine';
import { useBeds } from './useBeds';

const DAY = 86400000;

/**
 * The task list a screen actually renders: hand-written to-dos merged with the
 * tasks derived from what is planted. `range` widens the generated window
 * (default: this week ± a month, enough for the calendar view).
 */
export function useTodos({ from, to } = {}) {
  const manual = useSyncExternalStore(subscribeTasks, getTodos, getTodos);
  const autoDone = useSyncExternalStore(subscribeTasks, getAutoDone, getAutoDone);
  const beds = useBeds();

  const fromTs = from ? new Date(from).getTime() : Date.now() - 35 * DAY;
  const toTs = to ? new Date(to).getTime() : Date.now() + 35 * DAY;

  const todos = useMemo(() => {
    const auto = generateTasks(beds, new Date(fromTs), new Date(toTs))
      .map(t => ({ ...t, done: !!autoDone[t.id] }));
    return [...manual.map(t => ({ ...t, kind: t.kind || 'manual' })), ...auto]
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [manual, autoDone, beds, fromTs, toTs]);

  return {
    todos,
    addTodo,
    deleteTodo,
    updateTodo,
    toggleTodo: toggleTask,
    todosForDate: (dateStr) => todos.filter(t => t.date === dateStr),
    todosForBed: (bedId) => todos.filter(t => t.bedId === bedId),
    weekTodos: (() => {
      const { start, end } = weekRange();
      const a = toDateStr(start), b = toDateStr(end);
      return todos.filter(t => t.date >= a && t.date <= b);
    })(),
  };
}
