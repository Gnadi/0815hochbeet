// Single source of truth for beds.
//
// Before this module every page re-read localStorage on its own, which meant a
// rename in one screen was invisible in another until a reload, and the route
// guard could bounce a signed-in user to onboarding because the Firestore beds
// had not landed in localStorage yet. Everything now goes through one small
// observable store that mirrors to Firestore when a user is signed in.
//
// Sync rules:
// - Every save bumps `rev` and writes the *whole* bed. Writing only the patch
//   with `merge: true` deep-merged nested maps in Firestore, so a plant deleted
//   locally stayed in the remote copy and came back on the next pull.
// - On pull the higher `rev` wins; on a tie the later `updatedAt`. Both are
//   set by the client, so the server clock never decides.
// - Beds synced to an account carry `ownerUid` and leave the device on logout.
// - Deletes are remembered until the remote delete went through, so a bed
//   deleted offline does not come back with the next pull.

import { loadFirebase } from '../firebase';
import { migrateSeasonCells } from './timeline';
import { remoteWins } from './syncRules';

const INDEX_KEY = 'hb_beds';
const DELETED_KEY = 'hb_beds_deleted';
const VIEW_KEY = 'hb_bed_view';
const bedKey = (id) => `hb_bed_${id}`;

const listeners = new Set();
let cache = null;
let syncUid = null;
const writeTimers = new Map();

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const readIndex = () => readJson(INDEX_KEY, []);
const writeIndex = (ids) => writeJson(INDEX_KEY, ids);
const readDeleted = () => readJson(DELETED_KEY, []);
const writeDeleted = (ids) => writeJson(DELETED_KEY, ids);

function readBed(id) {
  const bed = readJson(bedKey(id), null);
  return bed && typeof bed === 'object' ? { ...bed, id } : null;
}

function storeBed(bed) {
  writeJson(bedKey(bed.id), bed);
  const ids = readIndex();
  if (!ids.includes(bed.id)) writeIndex([...ids, bed.id]);
}

function readAll() {
  return readIndex()
    .map(readBed)
    .filter(Boolean)
    .map(raw => {
      const bed = normalizeBed(raw);
      // Persist a migration once, so planting ids stay stable between reads.
      if (!raw.plantings) storeBed(bed);
      return bed;
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function emit() {
  cache = readAll();
  listeners.forEach(fn => { try { fn(); } catch {} });
}

/**
 * Normalises anything we load. Old beds predate several fields; the oldest
 * kept a single `cells` map, later ones four `seasonCells` layouts. Both are
 * turned into dated plantings for the year they were last edited.
 */
export function normalizeBed(bed) {
  let plantings = bed.plantings;
  if (!plantings || typeof plantings !== 'object') {
    const legacy = bed.seasonCells
      || (bed.cells && Object.keys(bed.cells).length ? { summer: bed.cells } : null);
    const year = new Date(bed.updatedAt || bed.createdAt || Date.now()).getFullYear() || new Date().getFullYear();
    plantings = legacy ? migrateSeasonCells(legacy, year, genId) : {};
  }
  const createdAt = bed.createdAt || '1970-01-01T00:00:00.000Z';
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
    filledYear: Number(bed.filledYear) || Number(createdAt.slice(0, 4)) || new Date().getFullYear(),
    plantings,
    rev: Number(bed.rev) || 0,
    ownerUid: bed.ownerUid || null,
    createdAt,
    updatedAt: typeof bed.updatedAt === 'string' ? bed.updatedAt : createdAt,
  };
}

/** Meteorological season for "today". */
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

/** Normalised beds; the same array until something changes (safe for useSyncExternalStore). */
export function getSnapshot() {
  if (cache === null) cache = readAll();
  return cache;
}

export function getBed(id) {
  return getSnapshot().find(b => b.id === id) || null;
}

export function hasBeds() {
  return getSnapshot().length > 0;
}

// ── Per-device view (month & year shown in the planner) ──────────────────────
// Kept out of the bed itself: flipping through months is not an edit and must
// not bump the revision or trigger a sync.
export function getBedView(id) {
  const v = readJson(VIEW_KEY, {})[id];
  const now = new Date();
  return v && Number.isInteger(v.year) && Number.isInteger(v.month)
    ? v : { year: now.getFullYear(), month: now.getMonth() };
}
export function setBedView(id, view) {
  writeJson(VIEW_KEY, { ...readJson(VIEW_KEY, {}), [id]: { year: view.year, month: view.month } });
}

// ── Remote mirror ────────────────────────────────────────────────────────────
function remoteDoc(fb, id) {
  return fb.storeSdk.doc(fb.db, 'users', syncUid, 'beds', id);
}

async function writeRemote(bed) {
  const fb = await loadFirebase();
  if (!fb || !syncUid) return;
  // No merge: the stored document is exactly the local bed.
  await fb.storeSdk.setDoc(remoteDoc(fb, bed.id), JSON.parse(JSON.stringify(bed)));
}

function queueRemoteWrite(id) {
  if (!syncUid) return;
  clearTimeout(writeTimers.get(id));
  writeTimers.set(id, setTimeout(() => {
    writeTimers.delete(id);
    const bed = readBed(id);
    if (bed) writeRemote(normalizeBed(bed)).catch(() => {});
  }, 700));
}

/** Sends every pending write right away (before logout). */
export async function flushRemoteWrites() {
  const ids = [...writeTimers.keys()];
  ids.forEach(id => clearTimeout(writeTimers.get(id)));
  writeTimers.clear();
  await Promise.all(ids.map(id => {
    const bed = readBed(id);
    return bed ? writeRemote(normalizeBed(bed)).catch(() => {}) : null;
  }));
}

async function deleteRemote(id) {
  const fb = await loadFirebase();
  if (!fb || !syncUid) return false;
  try {
    await fb.storeSdk.deleteDoc(remoteDoc(fb, id));
    writeDeleted(readDeleted().filter(x => x !== id));
    return true;
  } catch { return false; }
}

// ── Mutations ────────────────────────────────────────────────────────────────
export function createBed(data = {}) {
  const id = data.id || genId();
  const now = new Date().toISOString();
  const bed = normalizeBed({
    ...data, id, createdAt: now, updatedAt: now, rev: 1,
    filledYear: data.filledYear || new Date().getFullYear(),
    plantings: data.plantings || {},
    ownerUid: syncUid,
  });
  storeBed(bed);
  emit();
  queueRemoteWrite(id);
  return bed;
}

/** Merges `patch` into the stored bed, bumps the revision and mirrors it. */
export function saveBed(id, patch) {
  const existing = readBed(id);
  if (!existing) return null;
  const base = normalizeBed(existing);
  const next = {
    ...base, ...patch, id,
    rev: base.rev + 1,
    ownerUid: base.ownerUid || syncUid,
    updatedAt: new Date().toISOString(),
  };
  storeBed(next);
  emit();
  queueRemoteWrite(id);
  return next;
}

export function deleteBed(id) {
  const owned = readBed(id)?.ownerUid;
  try { localStorage.removeItem(bedKey(id)); } catch {}
  writeIndex(readIndex().filter(x => x !== id));
  clearTimeout(writeTimers.get(id));
  writeTimers.delete(id);
  emit();
  if (owned || syncUid) {
    writeDeleted([...new Set([...readDeleted(), id])]);
    deleteRemote(id);
  }
}

export function duplicateBed(id) {
  const src = getBed(id);
  if (!src) return null;
  const plantings = Object.fromEntries(Object.values(src.plantings).map(p => {
    const nid = genId();
    return [nid, { ...p, id: nid }];
  }));
  return createBed({ ...src, id: undefined, name: `${src.name} (Kopie)`, plantings, filledYear: src.filledYear });
}

/**
 * Points the store at a signed-in user (or none). On sign-in: pulls the
 * account's beds, adopts beds made on this device while signed out, and
 * pushes whatever is newer locally. On sign-out: sends pending writes and
 * removes the account's beds from this device.
 */
export async function setSyncUser(uid) {
  uid = uid || null;
  if (uid === syncUid) return;
  const previous = syncUid;

  if (!uid) {
    if (previous) {
      await flushRemoteWrites();
      syncUid = null;
      const keep = readIndex().filter(id => {
        const bed = readBed(id);
        if (bed?.ownerUid === previous) { try { localStorage.removeItem(bedKey(id)); } catch {} return false; }
        return true;
      });
      writeIndex(keep);
      writeDeleted([]);
      emit();
    }
    return;
  }

  syncUid = uid;
  const fb = await loadFirebase();
  if (!fb || syncUid !== uid) return;
  try {
    const { collection, getDocs } = fb.storeSdk;
    const snap = await getDocs(collection(fb.db, 'users', uid, 'beds'));
    if (syncUid !== uid) return;
    const deleted = new Set(readDeleted());
    const remoteIds = new Set();
    const toPush = [];

    snap.docs.forEach(d => {
      remoteIds.add(d.id);
      if (deleted.has(d.id)) { deleteRemote(d.id); return; }
      const raw = d.data();
      const local = readBed(d.id);
      const legacy = raw.rev === undefined;
      const remote = normalizeBed({
        ...raw, id: d.id,
        updatedAt: raw.updatedAt?.toDate ? raw.updatedAt.toDate().toISOString() : raw.updatedAt,
      });
      if (remoteWins(legacy ? { ...remote, rev: undefined } : remote, local)) {
        storeBed({ ...remote, ownerUid: uid });
      } else if (local) {
        toPush.push(local.id);
      }
    });

    // Local beds the account does not know yet: made while signed out (adopt
    // them) or created here and never uploaded. Another account's leftovers
    // are not touched.
    for (const id of readIndex()) {
      if (remoteIds.has(id)) continue;
      const bed = readBed(id);
      if (!bed || (bed.ownerUid && bed.ownerUid !== uid)) continue;
      storeBed({ ...normalizeBed(bed), ownerUid: uid });
      toPush.push(id);
    }
    for (const id of deleted) if (!remoteIds.has(id)) writeDeleted(readDeleted().filter(x => x !== id));

    emit();
    await Promise.all(toPush.map(id => {
      const bed = readBed(id);
      return bed ? writeRemote(normalizeBed(bed)).catch(() => {}) : null;
    }));
  } catch {}
}

/** Pushes every local bed of this account (the "Jetzt sichern" button). */
export async function pushAllToRemote() {
  if (!syncUid) return;
  await Promise.all(getSnapshot()
    .filter(bed => !bed.ownerUid || bed.ownerUid === syncUid)
    .map(bed => writeRemote({ ...bed, ownerUid: syncUid }).catch(() => {})));
}
