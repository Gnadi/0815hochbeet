import { useState } from 'react';

const STORAGE_KEY = 'hb_harvests';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function persist(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useHarvestLog() {
  const [entries, setEntries] = useState(() => load());

  function addEntry({ bedId, plantId, season, amountKg, note }) {
    const e = {
      id: genId(),
      bedId,
      plantId,
      season,
      amountKg: parseFloat(amountKg) || 0,
      note: note?.trim() || '',
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    setEntries(prev => {
      const next = [...prev, e];
      persist(next);
      return next;
    });
  }

  function deleteEntry(id) {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      persist(next);
      return next;
    });
  }

  function entriesForBed(bedId) {
    return entries.filter(e => e.bedId === bedId);
  }

  return { entries, addEntry, deleteEntry, entriesForBed };
}
