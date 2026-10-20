import { useMemo, useSyncExternalStore } from 'react';
import {
  addTodo, deleteTodo, getAutoDone, getTodos, subscribeTasks, toggleTask, updateTodo,
} from '../lib/tasks';
import { generateTasks, toDateStr, weekRange } from '../utils/taskEngine';
import { useBeds } from './useBeds';
import { useWeather } from './useWeather';

const DAY = 86400000;

/** Midnight of the day `offsetDays` from today — stable for a whole day. */
function dayTs(offsetDays) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.getTime();
}

/**
 * The task list a screen actually renders: hand-written to-dos merged with the
 * tasks derived from what is planted, the bed's age and the weather.
 * Default window: today ± 35 days, enough for the calendar view.
 */
export function useTodos({ from, to } = {}) {
  const manual = useSyncExternalStore(subscribeTasks, getTodos, getTodos);
  const autoDone = useSyncExternalStore(subscribeTasks, getAutoDone, getAutoDone);
  const beds = useBeds();
  const { data: weather } = useWeather();

  // Rounded to whole days: a raw Date.now() changed on every render and
  // defeated the memo below, regenerating weeks of tasks each time.
  const fromTs = from ? new Date(from).setHours(0, 0, 0, 0) : dayTs(-35);
  const toTs = to ? new Date(to).setHours(23, 59, 59, 999) : dayTs(35) + DAY - 1;

  const todos = useMemo(() => {
    const auto = generateTasks(beds, new Date(fromTs), new Date(toTs), { weather })
      .map(t => ({ ...t, done: !!autoDone[t.id] }));
    return [...manual.map(t => ({ ...t, kind: t.kind || 'manual' })), ...auto]
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [manual, autoDone, beds, fromTs, toTs, weather]);

  const weekTodos = useMemo(() => {
    const { start, end } = weekRange();
    const a = toDateStr(start), b = toDateStr(end);
    return todos.filter(t => t.date >= a && t.date <= b);
  }, [todos]);

  return {
    todos,
    addTodo,
    deleteTodo,
    updateTodo,
    toggleTodo: toggleTask,
    todosForDate: (dateStr) => todos.filter(t => t.date === dateStr),
    todosForBed: (bedId) => todos.filter(t => t.bedId === bedId),
    weekTodos,
  };
}
