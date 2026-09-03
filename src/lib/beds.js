// Single source of truth for beds.
//
// Before this module every page re-read localStorage on its own, which meant a
// rename in one screen was invisible in another until a reload, and the route
// guard could bounce a signed-in user to onboarding because the Firestore beds
// had not landed in localStorage yet. Everything now goes through one small
// observable store that mirrors to Firestore when a user is signed in.

import { loadFirebase } from '../firebase';

const INDEX_KEY = 'hb_beds';
const bedKey = (id) => `hb_bed_${id}`;

const listeners = new Set();
let cache = null;
let syncUid = null;
let pulled = false;
const writeTimers = new Map();

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]'); } catch { return []; }
}

function writeIndex(ids) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(ids)); } catch {}
}

function readBed(id) {
  try {
    const raw = localStorage.getItem(bedKey(id));
    if (!raw) return null;
    const bed = JSON.parse(raw);
    return bed && typeof bed === 'object' ? { ...bed, id } : null;
  } catch { return null; }
}

function readAll() {
  return readIndex()
    .map(readBed)
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

function emit() {
  cache = readAll();
  listeners.forEach(fn => { try { fn(); } catch {} });
}

/** Normalises anything we load — old beds predate several fields. */
export function normalizeBed(bed) {
  const seasonCells = bed.seasonCells
    || (bed.cells && Object.keys(bed.cells).length ? { spring: {}, summer: bed.cells, autumn: {}, winter: {} } : null)
    || { spring: {}, summer: {}, autumn: {}, winter: {} };
  return {
    id: bed.id,
    name: bed.name || 'Mein Hochbeet',
    width: Number(bed.width) > 0 ? Number(bed.width) : 120,
    depth: Number(bed.depth) > 0 ? Number(bed.depth) : 80,
    height: Number(bed.height) > 0 ? Number(bed.height) : 80,
    shapeId: bed.shapeId || 'rect',
    sun: bed.sun || '5-7',
    zone: bed.zone || 'zone7',
    notes: bed.notes || '',
    season: bed.season || currentSeason(),
    seasonCells: {
      spring: seasonCells.spring || {},
      summer: seasonCells.summer || {},
      autumn: seasonCells.autumn || {},
      winter: seasonCells.winter || {},
    },
    createdAt: bed.createdAt || new Date().toISOString(),
    updatedAt: bed.updatedAt || new Date().toISOString(),
  };
}

/** Meteorological season for "today" — a sensible default for a new bed. */
export function currentSeason(date = new Date()) {
  const m = date.getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSnapshot() {
  if (cache === null) cache = readAll();
  return cache;
}

export function getBed(id) {
  const local = readBed(id);
  return local ? normalizeBed(local) : null;
}

export function hasBeds() {
  return getSnapshot().length > 0;
}

function queueRemoteWrite(id, data) {
  if (!syncUid) return;
  clearTimeout(writeTimers.get(id));
  writeTimers.set(id, setTimeout(async () => {
    const fb = await loadFirebase();
    if (!fb || !syncUid) return;
    const { doc, setDoc, serverTimestamp } = fb.storeSdk;
    setDoc(
      doc(fb.db, 'users', syncUid, 'beds', id),
      { ...data, updatedAt: serverTimestamp() },
      { merge: true },
    ).catch(() => {});
  }, 700));
}

export function createBed(data = {}) {
  const id = data.id || genId();
  const now = new Date().toISOString();
  const bed = normalizeBed({ ...data, id, createdAt: now, updatedAt: now });
  try {
    localStorage.setItem(bedKey(id), JSON.stringify(bed));
    const ids = readIndex();
    if (!ids.includes(id)) writeIndex([...ids, id]);
  } catch {}
  emit();
  queueRemoteWrite(id, bed);
  return bed;
}

/** Shallow-merges `patch` into the stored bed and mirrors it remotely. */
export function saveBed(id, patch) {
  const existing = readBed(id);
  if (!existing) return null;
  const next = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(bedKey(id), JSON.stringify(next));
    const ids = readIndex();
    if (!ids.includes(id)) writeIndex([...ids, id]);
  } catch {}
  emit();
  queueRemoteWrite(id, patch);
  return next;
}

export function deleteBed(id) {
  try {
    localStorage.removeItem(bedKey(id));
    writeIndex(readIndex().filter(x => x !== id));
  } catch {}
  clearTimeout(writeTimers.get(id));
  emit();
  if (syncUid) {
    loadFirebase().then(fb => {
      if (fb && syncUid) fb.storeSdk.deleteDoc(fb.storeSdk.doc(fb.db, 'users', syncUid, 'beds', id)).catch(() => {});
    });
  }
}

export function duplicateBed(id) {
  const src = getBed(id);
  if (!src) return null;
  return createBed({ ...src, id: undefined, name: `${src.name} (Kopie)` });
}

/**
 * Points the store at a signed-in user. Pulls remote beds once and merges them
 * in — remote-only beds are added, and a remote copy that is newer than the
 * local one wins.
 */
export async function setSyncUser(uid) {
  if (uid === syncUid) return;
  syncUid = uid || null;
  pulled = false;
  if (!syncUid) return;
  const fb = await loadFirebase();
  if (!fb) return;
  try {
    const { collection, getDocs } = fb.storeSdk;
    const snap = await getDocs(collection(fb.db, 'users', syncUid, 'beds'));
    if (pulled) return;
    pulled = true;
    let touched = false;
    snap.docs.forEach(d => {
      const remote = normalizeBed({ ...d.data(), id: d.id });
      const local = readBed(d.id);
      const remoteAt = String(remote.updatedAt?.toDate?.().toISOString?.() ?? remote.updatedAt ?? '');
      const localAt = String(local?.updatedAt ?? '');
      if (!local || remoteAt > localAt) {
        try {
          localStorage.setItem(bedKey(d.id), JSON.stringify({ ...remote, updatedAt: remoteAt || new Date().toISOString() }));
          const ids = readIndex();
          if (!ids.includes(d.id)) writeIndex([...ids, d.id]);
          touched = true;
        } catch {}
      }
    });
    if (touched) emit();
  } catch {}
}

/** Pushes every local bed to the signed-in account (used right after login). */
export async function pushAllToRemote() {
  if (!syncUid) return;
  const fb = await loadFirebase();
  if (!fb) return;
  const { doc, setDoc, serverTimestamp } = fb.storeSdk;
  await Promise.all(getSnapshot().map(bed =>
    setDoc(doc(fb.db, 'users', syncUid, 'beds', bed.id), { ...bed, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {}),
  ));
}
