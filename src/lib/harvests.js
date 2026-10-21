// Harvest log store. Was a per-component useState, so two screens could hold
// different copies, and a full or blocked localStorage threw on every save.

import { toDateStr } from './timeline';

const STORAGE_KEY = 'hb_harvests';
const listeners = new Set();
let cache = null;

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

function persist(entries) {
  cache = entries;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function subscribeHarvests(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getHarvests() {
  if (cache === null) cache = load();
  return cache;
}

export function addHarvest({ bedId, plantId, amountKg, note }) {
  const now = new Date();
  persist([...getHarvests(), {
    id: genId(), bedId, plantId,
    amountKg: parseFloat(amountKg) || 0,
    note: note?.trim() || '',
    date: toDateStr(now),
    createdAt: now.toISOString(),
  }]);
}

export function deleteHarvest(id) {
  persist(getHarvests().filter(e => e.id !== id));
}
